import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { sealBackup, openBackup } from "../server/backup-archive.mjs";
const root = new URL("../test-results/clinical-conversion/", import.meta.url);
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error("Configure the existing Supabase project privately.");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tables = [
  "facilities",
  "profiles",
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
const snapshot = {};
for (const table of tables) {
  const rows = [];
  for (let page = 0; ; page++) {
    const r = await client
      .from(table)
      .select("*")
      .order("id")
      .range(page * 500, page * 500 + 499);
    if (r.error)
      throw new Error(
        "Could not inspect " + table + "; no deletion attempted.",
      );
    rows.push(...r.data);
    if (r.data.length < 500) break;
  }
  snapshot[table] = rows;
}
if (
  snapshot.patients.some((p) => p.is_synthetic !== true) ||
  snapshot.investigations.some((p) => p.is_simulated !== true)
)
  throw new Error("Non-test records were found. No deletion attempted.");
const files = { "public-records.json": Buffer.from(JSON.stringify(snapshot)) };
for (const [table, bucket] of [
  ["images", "oral-images"],
  ["patient_documents", "pathology-reports"],
])
  for (const row of snapshot[table]) {
    const r = await client.storage.from(bucket).download(row.object_key);
    if (r.error)
      throw new Error(
        "A referenced test object could not be backed up; no deletion attempted.",
      );
    files["storage/" + bucket + "/" + row.object_key] = Buffer.from(
      await r.data.arrayBuffer(),
    );
  }
const passphrase = randomBytes(32).toString("base64url");
const archive = sealBackup(
  files,
  {
    purpose: "user-authorized test reset",
    created_at: new Date().toISOString(),
    project: new URL(url).hostname,
  },
  passphrase,
);
openBackup(archive, passphrase);
await mkdir(root, { recursive: true });
await writeFile(new URL("snapshot.sealed", root), archive, { flag: "wx" });
await writeFile(new URL("snapshot-recovery-key.txt", root), passphrase + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    verified_test_patients: snapshot.patients.length,
    images: snapshot.images.length,
    reports: snapshot.patient_documents.length,
    staff_preserved: snapshot.profiles.length,
    facilities_preserved: snapshot.facilities.length,
    encrypted_snapshot: "test-results/clinical-conversion/snapshot.sealed",
    database_changed: false,
  }),
);
