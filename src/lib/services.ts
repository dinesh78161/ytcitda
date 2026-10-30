import { supabase } from "./client";
export interface ServiceStatus {
  database: boolean;
  files: boolean;
  video: boolean;
  video_provider?: "livekit" | "daily" | "disabled";
  ai: boolean;
  ai_provider?: "mock" | "research" | "gemini" | "medgemma" | "disabled";
  reminders: boolean;
}
export type VideoAccess =
  | {
      provider: "livekit";
      server_url: string;
      token: string;
      room_name: string;
      expires_at: number;
    }
  | { provider?: "daily"; url: string; expires_at: number };
export async function uploadRequestId(
  actor: string,
  kind: string,
  payload: Record<string, unknown>,
) {
  const content = JSON.stringify([
    actor,
    kind,
    payload.patient_id,
    payload.oral_view ?? null,
    payload.investigation_id ?? null,
    payload.name ?? null,
    payload.preview,
  ]);
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)),
  );
  hash[6] = (hash[6] & 15) | 128; // UUIDv8: deterministic application-defined upload identity.
  hash[8] = (hash[8] & 63) | 128;
  const hex = [...hash.slice(0, 16)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function serviceStatus(): Promise<ServiceStatus> {
  const response = await fetch("/api/status", {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Care API is unavailable.");
  return response.json();
}
export async function careApi<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T> {
  let session = (await supabase!.auth.getSession()).data.session;
  if (!session) throw new Error("Sign in first.");

  const nowSec = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at <= nowSec + 30) {
    const { data: refreshed } = await supabase!.auth.refreshSession();
    if (refreshed.session) session = refreshed.session;
  }

  let response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (response.status === 401) {
    const { data: refreshed } = await supabase!.auth.refreshSession();
    if (refreshed.session) {
      session = refreshed.session;
      response = await fetch(`/api/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
    }
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(result.error || "Care service is unavailable.");
  return result as T;
}
export async function fileDataUrl(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Use a file smaller than 10 MB.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.readAsDataURL(file);
  });
}
export function downloadUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noreferrer";
  a.click();
}
