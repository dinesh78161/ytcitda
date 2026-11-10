import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { clinicalConversionSQL } from "../scripts/prepare-clinical-conversion.mjs";

test("dedicated clinical workspace supports signed real-record workflows without mixing test data or research AI", async () => {
  const db = new PGlite();
  const worker = "00000000-0000-4000-8000-000000000101",
    doctor = "00000000-0000-4000-8000-000000000102";
  const person = crypto.randomUUID(),
    screen = crypto.randomUUID(),
    facility = "10000000-0000-4000-8000-000000000001";
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text unique);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text not null,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    const setup = await readFile(
      new URL("../supabase/setup.sql", import.meta.url),
      "utf8",
    );
    const upgradeStart = setup.indexOf(
      "-- Source: supabase/migrations/202610280006_privileged_mfa.sql",
    );
    assert.ok(upgradeStart > 0);
    await db.exec(setup.slice(0, upgradeStart) + "\ncommit;");
    await db.exec(
      await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
    );
    await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
      worker,
      "worker@clinic.invalid",
      doctor,
      "doctor@clinic.invalid",
    ]);
    await db.query(
      `insert into public.profiles(id,display_name,role,facility_id,active) values($1,'Test worker','health_worker',$3,true),($2,'Test doctor','medical_officer',$3,true)`,
      [worker, doctor, facility],
    );
    const resetDb = new PGlite({ loadDataDir: await db.dumpDataDir("gzip") });
    try {
      await resetDb.query(
        "insert into public.patients(id,facility_id,registered_by,display_name,age_years,village) values($1,$2,$3,'Test reset fixture',46,'Test village')",
        [person, facility, worker],
      );
      await resetDb.query(
        "insert into public.consents(patient_id,purpose,granted,language,consent_version,recorded_by) values($1,'screening',true,'en','evaluation-v1',$2)",
        [person, worker],
      );
      const conversion = await clinicalConversionSQL();
      await resetDb.exec(conversion);
      assert.equal(
        (await resetDb.query("select count(*)::int as n from public.patients"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (await resetDb.query("select count(*)::int as n from public.consents"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (await resetDb.query("select count(*)::int as n from public.profiles"))
          .rows[0].n,
        2,
      );
      assert.equal(
        (
          await resetDb.query(
            "select mode from app_private.workspace_configuration",
          )
        ).rows[0].mode,
        "clinical",
      );
      await assert.rejects(
        () => resetDb.exec(conversion),
        (e) => e.code === "23514",
      );
      await resetDb.exec("rollback");
    } finally {
      await resetDb.close();
    }
    await db.exec("begin;\n" + setup.slice(upgradeStart));
    await assert.rejects(
      () =>
        db.exec(
          "update app_private.workspace_configuration set mode='clinical'",
        ),
      (e) => e.code === "23514",
    );
    await db.exec(
      "update app_private.workspace_configuration set mode='clinical',approval_reference='AUTOMATED-TEST-NO-PATIENT-DATA',consent_version='clinic-test-v1'",
    );
    async function actor(id, run, aal = "aal2") {
      await db.exec("begin");
      try {
        await db.exec("set local role authenticated");
        await db.query(
          "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
          [id, JSON.stringify({ sub: id, aal })],
        );
        const result = await run();
        await db.exec("commit");
        return result;
      } catch (e) {
        await db.exec("rollback");
        throw e;
      }
    }
    const rpc = (action, payload) =>
      db.query("select public.submit_workflow($1,$2,$3::jsonb) as result", [
        crypto.randomUUID(),
        action,
        JSON.stringify(payload),
      ]);
    await actor(worker, async () => {
      const policy = (await db.query("select public.workspace_policy() as p"))
        .rows[0].p;
      assert.equal(policy.mode, "clinical");
      assert.equal(policy.ai_clinical_use, false);
      assert.equal(
        (await db.query("select public.image_findings_policy() as p")).rows[0].p
          .version,
        0,
      );
      await assert.rejects(
        () =>
          db.exec(
            "update app_private.workspace_configuration set mode='evaluation'",
          ),
        (e) => e.code === "42501",
      );
    });
    await actor(worker, () =>
      rpc("register", {
        patient_id: person,
        screening_id: screen,
        display_name: "Clinical Test Record",
        age_years: 46,
        village: "Test village",
        consent: true,
        photo_consent: true,
        language: "hi",
      }),
    );
    const patient = (
      await db.query("select * from public.patients where id=$1", [person])
    ).rows[0];
    assert.equal(patient.is_synthetic, false);
    assert.equal(patient.preferred_language, "hi");
    assert.ok(
      (
        await db.query("select consent_version from public.consents")
      ).rows.every((c) => c.consent_version === "clinic-test-v1"),
    );
    await assert.rejects(
      () =>
        db.exec(
          "update app_private.workspace_configuration set mode='evaluation'",
        ),
      (e) => e.code === "23514",
    );
    await assert.rejects(
      () =>
        db.query("update public.patients set is_synthetic=true where id=$1", [
          person,
        ]),
      (e) => e.code === "23514",
    );
    await actor(doctor, () =>
      rpc("review", {
        screening_id: screen,
        patient_id: person,
        revision: 1,
        findings: "Automated fixture examination; not actual patient data.",
        decision: "refer",
        priority: "routine",
      }),
    );
    const review = (await db.query("select * from public.clinical_reviews"))
      .rows[0];
    assert.ok(review.signed_at);
    const referral = (await db.query("select id from public.referrals")).rows[0]
      .id;
    await actor(doctor, () =>
      rpc("diagnosis", {
        referral_id: referral,
        diagnosis: "Automated fixture report review",
      }),
    );
    assert.equal(
      (await db.query("select is_simulated from public.investigations")).rows[0]
        .is_simulated,
      false,
    );
    const count = await actor(
      doctor,
      () => db.query("select count(*)::int as n from public.patients"),
      "aal1",
    );
    assert.equal(count.rows[0].n, 0);
    const consent = (
      await db.query(
        "select id from public.consents where purpose='image_capture'",
      )
    ).rows[0].id;
    const image = crypto.randomUUID();
    await db.query(
      `insert into public.images(id,patient_id,screening_id,consent_id,uploaded_by,object_key,sha256,oral_view) values($1,$2,$3,$4,$5,'test/no-photo.jpg',repeat('a',64),'cheek')`,
      [image, person, screen, consent, worker],
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into public.ai_analyses(image_id,provider,model_version,status,research_label) values($1,'research','fixture','completed','fixture')",
          [image],
        ),
      (e) => e.code === "23514",
    );
    assert.ok(
      Number(
        (await db.query("select count(*) as n from public.audit_events"))
          .rows[0].n,
      ) > 0,
    );
    // Clinical assistance leaves the original research ban intact.
    assert.equal(
      (
        await actor(doctor, () =>
          db.query(
            "select public.clinical_image_assistance_policy() as policy",
          ),
        )
      ).rows[0].policy.version,
      1,
    );
    await db.query(
      "update public.images set quality_status='acceptable' where id=$1",
      [image],
    );
    const clinicalFindings = JSON.stringify({
      engine: "clinical",
      image_kind: "oral_photo",
      summary: "Synthetic draft fixture",
      visible_findings: [],
      possible_conditions: [],
      limitations: ["Fixture only"],
    });
    const insertDraft = (permission, requestedBy = doctor, score = null) =>
      db.query(
        `insert into public.ai_analyses(image_id,provider,model_version,status,research_label,findings,requested_by,assistance_consent_id,warning,score)
       values($1,'clinical_assistance','clinical-fixture-v1','completed','clinician_assistance_draft',$2::jsonb,$3,$4,'AI DRAFT - CLINICIAN REVIEW REQUIRED',$5) returning id`,
        [image, clinicalFindings, requestedBy, permission, score],
      );
    await assert.rejects(
      () => insertDraft(consent),
      (e) => e.code === "23514",
    );
    await actor(worker, () =>
      rpc("consent", {
        patient_id: person,
        purpose: "ai_assistance",
        granted: true,
        language: "en",
      }),
    );
    const aiPermission = (
      await db.query(
        "select id from public.consents where purpose='ai_assistance' order by recorded_at desc limit 1",
      )
    ).rows[0].id;
    await assert.rejects(
      () => insertDraft(aiPermission, worker),
      (e) => e.code === "23514",
    );
    await assert.rejects(
      () => insertDraft(aiPermission, doctor, 0.99),
      (e) => e.code === "23514",
    );
    const draft = (await insertDraft(aiPermission)).rows[0].id;
    assert.equal(
      (
        await db.query(
          "select actor_id from public.audit_events where action='CLINICIAN_ASSISTANCE_DRAFT' and resource_id=$1",
          [draft],
        )
      ).rows[0].actor_id,
      doctor,
    );
    assert.equal(
      (
        await actor(doctor, () =>
          db.query("select id from public.ai_analyses where id=$1", [draft]),
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await actor(
          doctor,
          () =>
            db.query("select id from public.ai_analyses where id=$1", [draft]),
          "aal1",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await actor(worker, () =>
          db.query("select id from public.ai_analyses where id=$1", [draft]),
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      () =>
        db.query(
          "update public.ai_analyses set model_version='edited' where id=$1",
          [draft],
        ),
      (e) => e.code === "55000",
    );
    await actor(worker, () =>
      rpc("consent", {
        patient_id: person,
        purpose: "ai_assistance",
        granted: false,
        language: "en",
      }),
    );
    await assert.rejects(
      () => insertDraft(aiPermission),
      (e) => e.code === "23514",
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into public.ai_analyses(image_id,provider,model_version,status) values($1,'research','fixture','completed')",
          [image],
        ),
      (e) => e.code === "23514",
    );
  } finally {
    await db.close();
  }
});
