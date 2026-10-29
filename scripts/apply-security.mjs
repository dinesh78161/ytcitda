import { readFile } from "node:fs/promises";

// Additive migration only. Never runs first-time setup, seeds, account changes or
// a restore. The user-owned management token is passed in a header, never argv.
try {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectURL = new URL(
    process.env.SUPABASE_URL || "https://invalid.example",
  );
  const match = /^([a-z0-9]+)\.supabase\.co$/.exec(projectURL.hostname);
  if (!token || !match)
    throw new Error(
      "Configure SUPABASE_ACCESS_TOKEN in private .env.recovery and the existing SUPABASE_URL in .env.server. The project service key cannot apply SQL migrations.",
    );
  const endpoint = `https://api.supabase.com/v1/projects/${match[1]}/database/query`;
  const query = async (sql) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(60000),
      redirect: "error",
    });
    if (!response.ok)
      throw new Error(
        `Supabase migration request failed (HTTP ${response.status}). No credentials or SQL response are printed.`,
      );
    return response.json();
  };
  const existing = await query(
    "select to_regprocedure('public.security_policy()') is not null as installed",
  );
  if (existing[0]?.installed) {
    const policy = await query("select public.security_policy() as policy");
    if (
      policy[0]?.policy?.version !== 1 ||
      policy[0]?.policy?.privileged_mfa !== true
    )
      throw new Error(
        "Unexpected existing security policy; inspect before continuing.",
      );
    console.log(
      "PASS: privileged MFA migration is already installed; no SQL changed.",
    );
  } else {
    const schema = await query(
      "select to_regprocedure('public.submit_workflow(uuid,text,jsonb)') is not null as workflow, to_regclass('public.care_decisions') is not null as journey",
    );
    if (!schema[0]?.workflow || !schema[0]?.journey)
      throw new Error(
        "Apply the existing five baseline migrations first. This command will not install/reset an unknown database.",
      );
    await query(
      await readFile(
        new URL(
          "../supabase/migrations/202610280006_privileged_mfa.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const verified = await query(
      "select count(*)::int as policies from pg_policies where schemaname='public' and policyname='require_privileged_mfa'",
    );
    if (verified[0]?.policies !== 19)
      throw new Error(
        "Migration returned but policy count verification failed. Inspect the database.",
      );
    console.log(
      "PASS: migration 006 installed; 19 restrictive policies and privileged workflow/summary guards verified.",
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
