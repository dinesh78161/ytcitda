import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { registerCareTests } from "./database-care.mjs";

const db = new PGlite();
const sqlFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const patient = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const screening = "40000000-0000-4000-8000-000000000001";
const image = "90000000-0000-4000-8000-000000000001";
const imageConsent = "31000000-0000-4000-8000-000000000001";

// Mimic Supabase's roles/Auth UID in embedded PostgreSQL. This does not emulate
// Auth HTTP, JWT verification, the Storage service, or hosted PostgREST.
before(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text unique);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
  `);
  if (process.env.AAROGYA_TEST_SETUP_BUNDLE === "1") {
    await db.exec(await sqlFile("supabase/setup.sql"));
  } else {
    await db.exec(
      await sqlFile("supabase/migrations/202610260001_initial_schema.sql"),
    );
    await db.exec(
      await sqlFile("supabase/migrations/202610260002_private_storage.sql"),
    );
    await db.exec(
      await sqlFile("supabase/migrations/202610260003_workflow_api.sql"),
    );
    await db.exec(await sqlFile("supabase/seed.sql"));
    await db.exec(
      await sqlFile("supabase/migrations/202610270004_care_workflows.sql"),
    );
    await db.exec(
      await sqlFile("supabase/migrations/202610280005_patient_journey.sql"),
    );
    await db.exec(
      await sqlFile("supabase/migrations/202610290008_image_findings.sql"),
    );
  }
  for (const [index, name] of [
    "worker",
    "doctor",
    "specialist",
    "navigator",
    "admin",
    "outsider",
  ].entries()) {
    await db.query("insert into auth.users(id, email) values ($1, $2)", [
      uid(index + 1),
      `${name}@aarohanytc.in`,
    ]);
  }
  await db.exec(await sqlFile("supabase/demo_seed.sql"));
  await db.query(
    `insert into public.profiles(id, display_name, role, facility_id, active)
    values ($1, 'Unassigned worker', 'health_worker', '10000000-0000-4000-8000-000000000001', true)`,
    [uid(6)],
  );
  await db.query(
    `insert into public.consents(id, patient_id, purpose, granted, language, consent_version, recorded_by)
    values ($1, $2, 'image_capture', true, 'te', 'demo-v1', $3)`,
    [imageConsent, patient(1), uid(1)],
  );
  await db.query(
    `insert into public.images(id, patient_id, screening_id, consent_id, uploaded_by, object_key, sha256, oral_view)
    values ($1, $2, $3, $4, $5, 'test-only/no-upload.jpg', repeat('a', 64), 'tongue')`,
    [image, patient(1), screening, imageConsent, uid(1)],
  );
  await db.query(
    `insert into public.ai_analyses(image_id, provider, model_version, status, research_label)
    values ($1, 'mock', 'mock-v1', 'completed', 'suspicious_example')`,
    [image],
  );
});
after(async () => db.close());

async function asRole(role, userId, run) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`); // role is a test constant, never user input.
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
      userId ?? "",
    ]);
    return await run();
  } finally {
    await db.exec("rollback");
  }
}
async function count(table) {
  return Number(
    (await db.query(`select count(*) as count from public.${table}`)).rows[0]
      .count,
  );
}
const denied = (fn) => assert.rejects(fn, (error) => error.code === "42501");
const invalid = (fn) => assert.rejects(fn, (error) => error.code === "23514");

test("all 20 application tables have row level security enabled", async () => {
  const { rows } = await db.query(
    "select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r'",
  );
  assert.equal(rows.length, 20);
  assert.ok(rows.every((row) => row.relrowsecurity));
});

test("anonymous requests cannot read patient data or dashboard totals", async () => {
  await denied(() =>
    asRole("anon", null, () => db.query("select * from public.patients")),
  );
  await denied(() =>
    asRole("anon", null, () => db.query("select public.dashboard_summary()")),
  );
});

test("assigned worker can read their patients and screening images", async () => {
  await asRole("authenticated", uid(1), async () => {
    assert.equal(await count("patients"), 12);
    assert.equal(await count("screenings"), 12);
    assert.equal(await count("images"), 1);
    assert.equal(await count("ai_analyses"), 1);
  });
});

test("a worker at the same facility cannot read unassigned patients", async () => {
  await asRole("authenticated", uid(6), async () => {
    for (const table of [
      "patients",
      "screenings",
      "images",
      "ai_analyses",
      "clinical_reviews",
      "referrals",
      "appointments",
    ]) {
      assert.equal(await count(table), 0, table);
    }
  });
});

test("specialist sees only the four referred and assigned patients", async () => {
  await asRole("authenticated", uid(3), async () => {
    assert.equal(await count("patients"), 4);
    assert.equal(await count("screenings"), 4);
  });
});

test("navigator sees logistics but cannot read clinical notes, AI or photos", async () => {
  await asRole("authenticated", uid(4), async () => {
    assert.equal(await count("patients"), 12);
    assert.equal(await count("appointments"), 4);
    assert.equal(await count("navigation_tasks"), 4);
    for (const table of [
      "screenings",
      "images",
      "ai_analyses",
      "clinical_reviews",
      "investigations",
    ]) {
      assert.equal(await count(table), 0, table);
    }
  });
});

test("district administrator receives exact aggregates and no patient records", async () => {
  await asRole("authenticated", uid(5), async () => {
    assert.equal(await count("patients"), 0);
    assert.equal(await count("images"), 0);
    const { rows } = await db.query(
      "select public.dashboard_summary() as summary",
    );
    assert.deepEqual(rows[0].summary, {
      patients: 12,
      screenings: 12,
      referrals: 4,
      missed_appointments: 1,
      pending_follow_ups: 4,
      completed_follow_ups: 0,
      total_follow_ups: 4,
      follow_up_completion_rate: 0,
      outreach_events: 0,
      outreach_attendees: 0,
      outreach_screened: 0,
      active_treatments: 0,
      completed_cases: 0,
      stage_counts: {
        awaiting_clinician: 8,
        referral_planned: 1,
        appointed: 3,
      },
    });
  });
});

test("non-admin cannot call aggregate RPC", async () => {
  await denied(() =>
    asRole("authenticated", uid(1), () =>
      db.query("select public.dashboard_summary()"),
    ),
  );
});

test("browser users cannot elevate roles, assign patients, write diagnoses or forge audits", async () => {
  for (const query of [
    "update public.profiles set role = 'district_admin'",
    "delete from public.patient_assignments",
    "update public.investigations set clinician_diagnosis = 'forged'",
    "insert into public.audit_events(action, resource_type, resource_id) values ('fake', 'patients', gen_random_uuid())",
  ])
    await denied(() => asRole("authenticated", uid(1), () => db.exec(query)));
});

test("inactive staff and revoked assignments lose access immediately", async () => {
  await db.query("update public.profiles set active = false where id = $1", [
    uid(1),
  ]);
  try {
    await asRole("authenticated", uid(1), async () =>
      assert.equal(await count("patients"), 0),
    );
  } finally {
    await db.query("update public.profiles set active = true where id = $1", [
      uid(1),
    ]);
  }
  await db.query(
    "update public.patient_assignments set revoked_at = clock_timestamp() where user_id = $1 and patient_id = $2",
    [uid(3), patient(1)],
  );
  try {
    await asRole("authenticated", uid(3), async () =>
      assert.equal(await count("patients"), 3),
    );
  } finally {
    await db.query(
      "update public.patient_assignments set revoked_at = null where user_id = $1 and patient_id = $2",
      [uid(3), patient(1)],
    );
  }
});

test("missing image consent is rejected", async () => {
  await invalid(() =>
    db.query(
      `insert into public.images(patient_id, screening_id, consent_id, uploaded_by, object_key, sha256, oral_view)
    values ($1, $2, $3, $4, 'rejected.jpg', repeat('b', 64), 'tongue')`,
      [patient(1), screening, "30000000-0000-4000-8000-000000000001", uid(1)],
    ),
  );
});

test("withdrawn image consent prevents new image records", async () => {
  await asRole("service_role", null, async () => {
    await db.query(
      `insert into public.consents(patient_id, purpose, granted, language, consent_version, recorded_by)
      values ($1, 'image_capture', false, 'te', 'demo-v1', $2)`,
      [patient(1), uid(1)],
    );
    await invalid(() =>
      db.query(
        `insert into public.images(patient_id, screening_id, consent_id, uploaded_by, object_key, sha256, oral_view)
      values ($1, $2, $3, $4, 'withdrawn.jpg', repeat('c', 64), 'tongue')`,
        [patient(1), screening, imageConsent, uid(1)],
      ),
    );
  });
});

test("cross-patient referral linkage is rejected", async () => {
  await assert.rejects(
    () =>
      db.query(
        `insert into public.referrals(patient_id, review_id, destination_facility_id, specialty, priority)
    values ($1, '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Demo', 'routine')`,
        [patient(2)],
      ),
    (error) => error.code === "23503",
  );
});

test("a health worker cannot be recorded as a signing clinician", async () => {
  await invalid(() =>
    db.query(
      `insert into public.clinical_reviews(patient_id, screening_id, doctor_id, findings, clinical_decision)
    values ($1, $2, $3, 'Invalid author', 'close')`,
      [patient(1), screening, uid(1)],
    ),
  );
});

test("consents, signed reviews and audit events cannot be overwritten", async () => {
  for (const table of ["consents", "clinical_reviews", "audit_events"]) {
    await assert.rejects(
      () => db.exec(`delete from public.${table}`),
      (error) => error.code === "55000",
    );
  }
});

test("AI cannot claim clinical use or skip clinician review", async () => {
  for (const assignment of [
    "clinical_use = true",
    "requires_clinician_review = false",
    "score = 0.95",
  ]) {
    await invalid(() => db.exec(`update public.ai_analyses set ${assignment}`));
  }
});

test("patient and pathology records must remain explicitly synthetic", async () => {
  await invalid(() =>
    db.exec("update public.patients set is_synthetic = false"),
  );
  await invalid(() =>
    db.query(
      `insert into public.investigations(patient_id, referral_id, clinician_id, kind, is_simulated)
    values ($1, '60000000-0000-4000-8000-000000000001', $2, 'pathology', false)`,
      [patient(1), uid(2)],
    ),
  );
});

test("database audit records contain actions and IDs, not clinical content", async () => {
  assert.ok((await count("audit_events")) > 0);
  const { rows } = await db.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'audit_events'",
  );
  assert.deepEqual(rows.map((row) => row.column_name).sort(), [
    "action",
    "actor_id",
    "id",
    "occurred_at",
    "resource_id",
    "resource_type",
  ]);
});

test("both storage buckets are private and restrict allowed file types", async () => {
  const { rows } = await db.query("select * from storage.buckets order by id");
  assert.equal(rows.length, 2);
  assert.ok(
    rows.every(
      (row) => !row.public && Number(row.file_size_limit) === 10485760,
    ),
  );
  assert.deepEqual(rows[1].allowed_mime_types, [
    "application/pdf",
    "image/jpeg",
  ]);
});

test("repeating seed scripts does not duplicate the 12 patients or four referrals", async () => {
  await db.exec(await sqlFile("supabase/seed.sql"));
  await db.exec(await sqlFile("supabase/demo_seed.sql"));
  assert.equal(await count("patients"), 12);
  assert.equal(await count("referrals"), 4);
});

const registrationPayload = () => ({
  patient_id: crypto.randomUUID(),
  screening_id: crypto.randomUUID(),
  display_name: "Synthetic RPC Patient",
  age_years: 46,
  village: "Demo Village",
  language: "te",
  consent: true,
  photo_consent: true,
  tobacco: "never",
  notes: "Test intake",
});
const rpc = (action, payload, requestId = crypto.randomUUID()) =>
  db.query("select public.submit_workflow($1, $2, $3::jsonb) as result", [
    requestId,
    action,
    JSON.stringify(payload),
  ]);

registerCareTests({ db, asRole, rpc, uid, patient, denied });

test("registration RPC atomically creates consent, screening and care-team assignments", async () => {
  await asRole("authenticated", uid(1), async () => {
    const payload = registrationPayload();
    await rpc("register", payload);
    const { rows } = await db.query(
      "select * from public.screenings where patient_id = $1",
      [payload.patient_id],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "awaiting_clinician");
    assert.equal(
      (
        await db.query("select * from public.consents where patient_id = $1", [
          payload.patient_id,
        ])
      ).rows.length,
      2,
    );
  });
});

test("registration retry returns the same result without duplicate records", async () => {
  await asRole("authenticated", uid(1), async () => {
    const payload = registrationPayload(),
      requestId = crypto.randomUUID();
    const first = await rpc("register", payload, requestId),
      second = await rpc("register", payload, requestId);
    assert.deepEqual(first.rows, second.rows);
    assert.equal(
      (
        await db.query("select * from public.patients where id=$1", [
          payload.patient_id,
        ])
      ).rows.length,
      1,
    );
  });
});

test("request ID cannot be reused with a different payload", async () => {
  await asRole("authenticated", uid(1), async () => {
    const payload = registrationPayload(),
      requestId = crypto.randomUUID();
    await rpc("register", payload, requestId);
    await assert.rejects(
      () => rpc("register", { ...payload, display_name: "Changed" }, requestId),
      (e) => e.code === "23505",
    );
  });
});

test("RPC rejects missing consent and never creates a partial patient", async () => {
  const payload = { ...registrationPayload(), consent: false };
  await invalid(() =>
    asRole("authenticated", uid(1), () => rpc("register", payload)),
  );
  assert.equal(
    (
      await db.query("select * from public.patients where id=$1", [
        payload.patient_id,
      ])
    ).rows.length,
    0,
  );
});

test("non-health-worker cannot register through the privileged RPC", async () => {
  await denied(() =>
    asRole("authenticated", uid(4), () =>
      rpc("register", registrationPayload()),
    ),
  );
});

test("unassigned clinician cannot review a patient through the RPC", async () => {
  await denied(() =>
    asRole("authenticated", uid(3), () =>
      rpc("review", {
        patient_id: patient(12),
        revision: 1,
        findings: "Unassigned",
        decision: "refer",
      }),
    ),
  );
});

test("clinician review creates a referral and records the verified audit actor", async () => {
  await asRole("authenticated", uid(2), async () => {
    const result = await rpc("review", {
      patient_id: patient(12),
      revision: 1,
      findings: "Independent synthetic review",
      decision: "refer",
      priority: "routine",
    });
    assert.ok(result.rows[0].result.referral_id);
    assert.equal(
      (
        await db.query("select * from public.referrals where patient_id=$1", [
          patient(12),
        ])
      ).rows.length,
      1,
    );
    await db.exec("reset role");
    const audits = await db.query(
      "select actor_id from public.audit_events where resource_type='clinical_reviews' and resource_id=$1",
      [result.rows[0].result.review_id],
    );
    assert.equal(audits.rows[0].actor_id, uid(2));
  });
});

test("stale clinician revisions reject concurrent overwrites", async () => {
  await assert.rejects(
    () =>
      asRole("authenticated", uid(2), () =>
        rpc("review", {
          patient_id: patient(12),
          revision: 999,
          findings: "Stale",
          decision: "close",
        }),
      ),
    (e) => e.code === "40001",
  );
});

test("missed attendance creates exactly one navigation task when retried", async () => {
  await asRole("authenticated", uid(4), async () => {
    const payload = {
        appointment_id: "70000000-0000-4000-8000-000000000002",
        status: "missed",
      },
      requestId = crypto.randomUUID();
    const before = await count("navigation_tasks");
    await rpc("attendance", payload, requestId);
    await rpc("attendance", payload, requestId);
    assert.equal(await count("navigation_tasks"), before + 1);
  });
});

test("navigator cannot submit a diagnosis through RPC", async () => {
  await denied(() =>
    asRole("authenticated", uid(4), () =>
      rpc("diagnosis", {
        referral_id: "60000000-0000-4000-8000-000000000001",
        diagnosis: "Invalid",
      }),
    ),
  );
});

test("authenticated users cannot inspect private request payloads", async () => {
  await denied(() =>
    asRole("authenticated", uid(1), () =>
      db.query("select * from app_private.workflow_requests"),
    ),
  );
});

test("RPC booking, clinician diagnostics and follow-up completion persist linked records", async () => {
  await asRole("authenticated", uid(2), async () => {
    const referral_id = "60000000-0000-4000-8000-000000000001";
    const booked = await rpc("appoint", {
      referral_id,
      starts_at: "2099-01-03T04:30:00Z",
      mode: "in_person",
    });
    assert.equal(
      (
        await db.query(
          "select patient_id from public.appointments where id=$1",
          [booked.rows[0].result.id],
        )
      ).rows[0].patient_id,
      patient(1),
    );
    const diagnosed = await rpc("diagnosis", {
      referral_id,
      diagnosis: "Synthetic report reviewed",
    });
    assert.equal(
      (
        await db.query(
          "select clinician_id from public.investigations where id=$1",
          [diagnosed.rows[0].result.id],
        )
      ).rows[0].clinician_id,
      uid(2),
    );
    await rpc("followup", {
      task_id: "80000000-0000-4000-8000-000000000001",
      status: "completed",
    });
    assert.equal(
      (
        await db.query(
          "select status from public.navigation_tasks where id='80000000-0000-4000-8000-000000000001'",
        )
      ).rows[0].status,
      "completed",
    );
  });
});
