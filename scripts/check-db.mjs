import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
if (!url || !key || url.includes("YOUR_") || key.includes("YOUR_")) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.server first.",
  );
  process.exit(1);
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tables = [
  "profiles",
  "facilities",
  "patients",
  "patient_assignments",
  "screenings",
  "consents",
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
try {
  const auth = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (auth.error) {
    console.error(
      `Supabase authentication check failed (${auth.error.status || "network error"}). Check the project URL and server key.`,
    );
    process.exitCode = 1;
  } else {
    console.log("Supabase connection and server credentials verified.");
    console.log(
      auth.data.users.length
        ? "Auth accounts exist; verify staff profiles and assignments."
        : "No Auth accounts yet. Create the five demo accounts described in docs/SUPABASE_SETUP.md.",
    );
  }
  // Use GET: a failed HEAD request may have no JSON error body.
  const results = await Promise.all(
    tables.map(async (table) => {
      const result = await client.from(table).select("id").limit(1);
      return {
        table,
        ok:
          result.status === 200 && !result.error && Array.isArray(result.data),
        code: result.error?.code || String(result.status),
      };
    }),
  );
  const failed = results.filter((result) => !result.ok);
  console.log(
    `Application tables accessible: ${tables.length - failed.length}/${tables.length}.`,
  );
  for (const result of failed) console.error(`${result.table}: ${result.code}`);
  if (failed.length) {
    console.error(
      "Apply missing migrations in order using docs/SUPABASE_SETUP.md, then run npm run db:check again.",
    );
    process.exitCode = 1;
  }
} catch {
  console.error(
    "Database check could not reach Supabase. Check network access and .env.server settings.",
  );
  process.exitCode = 1;
}
