import { createClient } from "@supabase/supabase-js";
import {
  emptyData,
  type Command,
  type DataSet,
  type Profile,
  type Summary,
} from "./types";
const appMode = import.meta.env.VITE_APP_MODE;
export const isClinical = import.meta.env.VITE_WORKSPACE_MODE === "clinical";
export const isCloud = appMode !== "demo";
const url = import.meta.env.VITE_SUPABASE_URL ?? "",
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
export const offlineScope = `${url}|${isClinical ? "clinical" : "evaluation"}`;
const valid =
  url.startsWith("https://") &&
  !url.includes("YOUR_") &&
  key.length > 15 &&
  !key.includes("YOUR_");
export const configurationError =
  !["supabase", "demo"].includes(appMode) ||
  (isClinical && !isCloud) ||
  ![undefined, "evaluation", "clinical"].includes(
    import.meta.env.VITE_WORKSPACE_MODE,
  )
    ? "Configure an authenticated Supabase workspace. Local training must be selected explicitly."
    : isCloud && !valid
      ? "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, then restart the app."
      : null;
export const supabase = isCloud && valid ? createClient(url, key) : null;
export async function verifyClinicalWorkspace() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.rpc("workspace_policy");
  if (!isClinical && ["PGRST202", "42883"].includes(result.error?.code ?? ""))
    return;
  if (
    result.error ||
    result.data?.version !== 1 ||
    result.data.mode !== (isClinical ? "clinical" : "evaluation")
  )
    throw new Error(
      "Workspace configuration does not match this application. Contact your workspace administrator.",
    );
}
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
export async function fetchPatientRegistrationStaff(): Promise<
  Record<string, string>
> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const names: Record<string, string> = {};
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .rpc("patient_registration_staff")
      .order("patient_id")
      .range(page * 500, (page + 1) * 500 - 1);
    if (error) throw error;
    for (const row of data) names[row.patient_id] = row.staff_name;
    if (data.length < 500) break;
  }
  return names;
}

export async function submitCloud(command: Command) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (
    command.action === "consent" &&
    command.payload.purpose === "ai_assistance"
  ) {
    const policy = await supabase.rpc("clinical_image_assistance_policy");
    if (
      policy.error ||
      policy.data?.version !== 1 ||
      policy.data?.mode !== "clinical"
    )
      throw new Error(
        "Apply the clinical image assistance database update before recording AI consent.",
      );
  }
  if (
    command.action === "register" &&
    command.payload.language &&
    !["en", "te"].includes(String(command.payload.language))
  ) {
    const policy = await supabase.rpc("language_policy");
    if (
      policy.error ||
      !policy.data?.languages?.includes(command.payload.language)
    )
      throw new Error(
        "Additional patient languages are not available in this workspace yet. Your draft is saved; contact your workspace administrator.",
      );
  }
  if (command.action === "register" && command.payload.intake_version === 1) {
    const policy = await supabase.rpc("screening_intake_policy");
    if (policy.error || policy.data?.version !== 1)
      throw new Error(
        "The screening intake update is not available in this workspace yet. Your draft is saved; contact your workspace administrator.",
      );
  }
  const { data, error } = await supabase.rpc("submit_workflow", {
    request_id: command.id,
    action: command.action,
    payload: command.payload,
  });
  if (error) throw error;
  return data;
}
