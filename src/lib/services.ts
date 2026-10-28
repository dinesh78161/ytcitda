import { supabase } from "./client";
export interface ServiceStatus {
  database: boolean;
  files: boolean;
  video: boolean;
  ai: boolean;
  reminders: boolean;
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
  const { data } = await supabase!.auth.getSession();
  if (!data.session) throw new Error("Sign in first.");
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
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
