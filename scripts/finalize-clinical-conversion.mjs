import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hostedClients, demoSession, checked } from "./hosted-session.mjs";
import { openBackup } from "../server/backup-archive.mjs";
const root = new URL("../", import.meta.url),
  folder = new URL("test-results/clinical-conversion/", root);
try {
  const clients = hostedClients();
  const worker = await demoSession(clients, "health_worker");
  let policy;
  try {
    policy = checked(
      await worker.client.rpc("workspace_policy"),
      "Clinical workspace check",
    );
  } finally {
    await worker.client.auth.signOut({ scope: "local" });
  }
  if (policy?.version !== 1 || policy.mode !== "clinical")
    throw new Error(
      "Clinical activation is not complete. No Storage files or environment settings changed.",
    );
  const current = checked(
    await clients.admin.from("patients").select("id,is_synthetic"),
    "Record-origin check",
  );
  if (current.some((p) => p.is_synthetic !== false))
    throw new Error(
      "Unexpected test patient remains. No Storage files or environment settings changed.",
    );
  console.log(
    JSON.stringify({
      workspace_mode: policy.mode,
      patient_count: current.length,
      ai_clinical_use: false,
    }),
  );
  if (process.argv.includes("--cleanup-test-files")) {
    const passphrase = (
      await readFile(new URL("snapshot-recovery-key.txt", folder), "utf8")
    ).trim();
    const snapshot = openBackup(
      await readFile(new URL("snapshot.sealed", folder)),
      passphrase,
    );
    if (snapshot.metadata.project !== new URL(clients.url).hostname)
      throw new Error("Snapshot belongs to another project; no files removed.");
    const data = JSON.parse(
      snapshot.files.get("public-records.json").toString("utf8"),
    );
    if (data.patients.some((p) => p.is_synthetic !== true))
      throw new Error("Snapshot contains non-test records; no files removed.");
    const people = new Set(data.patients.map((p) => p.id));
    for (const [table, bucket] of [
      ["images", "oral-images"],
      ["patient_documents", "pathology-reports"],
    ]) {
      const records = data[table];
      if (records.some((r) => !people.has(r.patient_id)))
        throw new Error(
          "Unexpected file ownership in snapshot; no further files removed.",
        );
      const keys = [...new Set(records.map((r) => r.object_key))];
      for (let i = 0; i < keys.length; i += 50) {
        const batch = keys.slice(i, i + 50);
        const referenced = checked(
          await clients.admin.from(table).select("id").in("object_key", batch),
          "Active file reference check",
        );
        if (referenced.length)
          throw new Error(
            "An old file is referenced by an active record; no further files removed.",
          );
        checked(
          await clients.admin.storage.from(bucket).remove(batch),
          "Test file cleanup",
        );
      }
      console.log(
        bucket + ": removed " + keys.length + " saved test-file keys.",
      );
    }
    checked(
      await clients.admin
        .from("audit_events")
        .insert({
          action: "TEST_STORAGE_CLEANUP",
          resource_type: "workspace",
          resource_id: randomUUID(),
        }),
      "Cleanup audit",
    );
  }
  if (process.argv.includes("--configure-local")) {
    for (const [file, values] of [
      [".env", { VITE_APP_MODE: "supabase", VITE_WORKSPACE_MODE: "clinical" }],
      [
        ".env.server",
        { WORKSPACE_MODE: "clinical", SCREENING_AI_MODE: "disabled" },
      ],
    ]) {
      const path = new URL(file, root);
      let source = await readFile(path, "utf8");
      for (const [name, value] of Object.entries(values)) {
        const pattern = new RegExp("^" + name + "=.*$", "m");
        source = pattern.test(source)
          ? source.replace(pattern, name + "=" + value)
          : source.trimEnd() + "\n" + name + "=" + value + "\n";
      }
      await writeFile(path, source, "utf8");
    }
    console.log(
      "Local clinical settings updated. Restart and rebuild the app; no secret values printed.",
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
