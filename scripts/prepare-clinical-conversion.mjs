import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const root = new URL("../", import.meta.url);
const patientTables = [
  "patients",
  "patient_assignments",
  "consents",
  "screenings",
  "images",
  "ai_analyses",
  "clinical_reviews",
  "referrals",
  "appointments",
  "investigations",
  "navigation_tasks",
  "audit_events",
  "treatments",
  "treatment_events",
  "patient_documents",
  "outreach_events",
  "appointment_reminders",
  "care_decisions",
];
const tables = patientTables
  .map((t) => "public." + t)
  .concat("app_private.workflow_requests")
  .join(",\n  ");
const migrations = [
  ["security_policy", "202610280006_privileged_mfa.sql"],
  ["screening_intake_policy", "202610290007_screening_intake.sql"],
  ["image_findings_policy", "202610290008_image_findings.sql"],
  ["language_policy", "202610290009_languages.sql"],
  ["workspace_policy", "202610300010_clinical_workspace.sql"],
];
export async function clinicalConversionSQL() {
  const rollout = [];
  for (const [policy, file] of migrations) {
    const source = (
      await readFile(new URL("supabase/migrations/" + file, root), "utf8")
    )
      .replace(/\r\n/g, "\n")
      .trim();
    const sql = source
      .replace(/^begin;\n?/m, "")
      .replace(/^commit;$/m, "")
      .trim();
    if (sql.includes("$clinical_migration$"))
      throw new Error("Unexpected migration delimiter");
    rollout.push(`do $clinical_rollout$ begin
 if to_regprocedure('public.${policy}()') is null then
   execute $clinical_migration$${sql}$clinical_migration$;
 end if;
end $clinical_rollout$;`);
  }
  const sql = `-- USER-AUTHORIZED TEST RESET AND CLINICAL ACTIVATION, 30 October 2026.
-- Existing project only. Run as database owner after saving the encrypted snapshot.
-- Preserves facilities, staff profiles, Auth users and Storage buckets.
-- Deletes test patient workflows, test outreach, test audits and retry payloads.
-- Physical Storage objects are removed separately from the saved snapshot manifest.
-- No CASCADE, no disabling integrity/immutability triggers, no dropped tables.
begin;
set local lock_timeout='10s';
lock table ${tables} in access exclusive mode;
do $clinical_checks$ begin
 if exists(select 1 from public.patients where not is_synthetic)
    or exists(select 1 from public.investigations where not is_simulated) then
   raise exception 'Refusing reset: non-test records exist' using errcode='23514';
 end if;
 if to_regclass('app_private.workspace_configuration') is not null then
   if exists(select 1 from app_private.workspace_configuration where mode='clinical') then
     raise exception 'Refusing reset: clinical workspace is already active' using errcode='23514';
   end if;
 end if;
end $clinical_checks$;
${rollout.join("\n\n")}
truncate table ${tables};
update app_private.workspace_configuration
set mode='clinical',approval_reference='Clinic approval confirmed by project owner, 2026-10-30',
    consent_version='clinical-intake-v1'
where singleton;
insert into public.audit_events(action,resource_type,resource_id)
values('CLINICAL_WORKSPACE_ACTIVATED','workspace',gen_random_uuid());
notify pgrst,'reload schema';
commit;
select mode,consent_version from app_private.workspace_configuration where singleton;
select count(*) as remaining_patients from public.patients;
`;
  return sql;
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const sql = await clinicalConversionSQL();
  await mkdir(new URL("test-results/clinical-conversion/", root), {
    recursive: true,
  });
  await writeFile(
    new URL(
      "test-results/clinical-conversion/activate-existing-project.sql",
      root,
    ),
    sql,
    "utf8",
  );
  console.log(
    "Prepared test-results/clinical-conversion/activate-existing-project.sql; no database changes made.",
  );
}
