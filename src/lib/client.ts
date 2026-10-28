import { createClient } from "@supabase/supabase-js";
import {
  emptyData,
  type Command,
  type DataSet,
  type Profile,
  type Summary,
} from "./types";
export const isCloud = import.meta.env.VITE_APP_MODE === "supabase";
const url = import.meta.env.VITE_SUPABASE_URL ?? "",
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const valid =
  url.startsWith("https://") &&
  !url.includes("YOUR_") &&
  key.length > 15 &&
  !key.includes("YOUR_");
export const configurationError =
  isCloud && !valid
    ? "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, then restart the app."
    : null;
export const supabase = isCloud && valid ? createClient(url, key) : null;
export async function fetchProfile(id: string): Promise<Profile> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data?.active)
    throw new Error(
      "An active staff profile must be assigned by the project administrator.",
    );
  return data as Profile;
}
export async function fetchWorkspace(
  profile: Profile,
): Promise<{ data: DataSet; summary: Summary | null }> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const data = emptyData();
  await Promise.all(
    (Object.keys(data) as (keyof DataSet)[]).map(async (table) => {
      let page = 0;
      const rows: unknown[] = [];
      while (true) {
        const result = await supabase!
          .from(table)
          .select("*")
          .order("id")
          .range(page * 500, (page + 1) * 500 - 1);
        if (result.error) throw result.error;
        rows.push(...result.data);
        if (result.data.length < 500) break;
        page++;
      }
      (data[table] as unknown[]) = rows;
    }),
  );
  if (profile.role === "district_admin") {
    const { data: summary, error } = await supabase.rpc("dashboard_summary");
    if (error) throw error;
    return { data, summary };
  }
  return { data, summary: null };
}
export async function submitCloud(command: Command) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("submit_workflow", {
    request_id: command.id,
    action: command.action,
    payload: command.payload,
  });
  if (error) throw error;
  return data;
}
