import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jpeg from "jpeg-js";
import { PDFDocument } from "pdf-lib";
import { checkDeployment, deploymentOrigin } from "./check-deployment.mjs";
import {
  checked,
  demoAccounts,
  demoSession,
  hostedClients,
} from "./hosted-session.mjs";

const sessions = [];
try {
  const base = deploymentOrigin(process.argv[2] || process.env.DEPLOY_URL);
  const write = process.argv.includes("--write");
  const localApi = process.env.HOSTED_TEST_LOCAL_API;
  if (localApi && !/^http:\/\/127\.0\.0\.1:\d+$/.test(localApi))
    throw new Error(
      "HOSTED_TEST_LOCAL_API may only target an explicit 127.0.0.1 port.",
    );
  const api = localApi || base;
  const status = await checkDeployment(base);
  const clients = hostedClients();
  // Confirm the public frontend points at the project whose test users we use.
  const html = await (
    await fetch(base, { signal: AbortSignal.timeout(60000) })
  ).text();
  const script = /src="(\/assets\/[^" ]+\.js)"/.exec(html)?.[1];
  assert.ok(script, "Deployed app must reference a JavaScript bundle");
  const bundle = await (
    await fetch(new URL(script, base), { signal: AbortSignal.timeout(60000) })
  ).text();
  assert.ok(
    bundle.includes(clients.url),
    "Local Supabase settings must match the deployed frontend",
  );
  const buckets = checked(
    await clients.admin.storage.listBuckets(),
    "Storage inspection",
  );
  for (const name of ["oral-images", "pathology-reports"])
    assert.ok(
      buckets.some((b) => b.name === name && !b.public),
      `${name} must be private`,
    );
  const accounts = {};
  for (const role of Object.keys(demoAccounts)) {
    const context = await demoSession(clients, role);
    sessions.push(context);
    accounts[role] = context;
    const profile = checked(
      await context.client
        .from("profiles")
        .select("role,active")
        .eq("id", context.session.user.id)
        .single(),
      "Own profile",
    );
    assert.equal(profile.role, role);
    assert.equal(profile.active, true);
    const people = checked(
      await context.client.from("patients").select("id").limit(100),
      "Patient access",
    );
    if (role === "district_admin")
      assert.equal(people.length, 0, "District admin cannot read patient rows");
    else assert.ok(people.length > 0, `${role} must have assigned demo cases`);
    if (["district_admin", "navigator"].includes(role)) {
      for (const table of [
        "images",
        "ai_analyses",
        "clinical_reviews",
        "patient_documents",
      ])
        assert.equal(
          checked(
            await context.client.from(table).select("id").limit(1),
            "Restricted table",
          ).length,
          0,
          `${role} must not read ${table}`,
        );
    }
    if (role === "district_admin")
      checked(
        await context.client.rpc("dashboard_summary"),
        "District summary",
      );
    console.log(`PASS: authenticated ${role} profile and record access.`);
  }
  const anon = clients.user();
  const anonymousRows = await anon.from("patients").select("id").limit(1);
  assert.ok(
    anonymousRows.error?.code === "42501" ||
      (!anonymousRows.error && anonymousRows.data?.length === 0),
    "Anonymous patient access must be denied or empty",
  );
  assert.ok(
    (await anon.rpc("dashboard_summary")).error,
    "Anonymous summaries must be denied",
  );
  console.log(
    "PASS: private storage, anonymous restrictions and all five hosted roles.",
  );
  if (write) {
    const worker = accounts.health_worker,
      doctor = accounts.medical_officer,
      specialist = accounts.specialist,
      navigator = accounts.navigator,
      admin = accounts.district_admin;
    const rpc = async (actor, action, payload, id = randomUUID()) =>
      checked(
        await actor.client.rpc("submit_workflow", {
          request_id: id,
          action,
          payload,
        }),
        action,
      );
    const post = async (actor, path, body, expected = 200) => {
      const response = await fetch(`${api}/api/${path}`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${actor.session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, expected, `${path} response`);
      return response.json();
    };
    const patient = randomUUID(),
      screening = randomUUID(),
      request = randomUUID();
    console.log(
      `Synthetic acceptance case: ${patient} (retained with its audit history).`,
    );
    const intake = {
      patient_id: patient,
      screening_id: screening,
      display_name: `Synthetic acceptance ${patient.slice(0, 8)}`,
      age_years: 46,
      village: "G. Madugula (synthetic test)",
      language: "te",
      consent: true,
      photo_consent: true,
      tobacco: "never",
      notes: "Synthetic acceptance fixture. No real medical data.",
      discomfort: true,
    };
    const registered = await rpc(worker, "register", intake, request);
    assert.deepEqual(
      await rpc(worker, "register", intake, request),
      registered,
    );
    assert.equal(
      checked(
        await worker.client
          .from("screenings")
          .select("id")
          .eq("patient_id", patient),
        "Screening retry",
      ).length,
      1,
    );
    assert.equal(
      checked(
        await specialist.client.from("patients").select("id").eq("id", patient),
        "Unassigned specialist",
      ).length,
      0,
    );
    const current = async () =>
      checked(
        await doctor.client
          .from("screenings")
          .select("revision,status")
          .eq("id", screening)
          .single(),
        "Screening state",
      );
    const pixels = Buffer.alloc(512 * 512 * 4, 255);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        const value = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 185 : 70;
        pixels.fill(value, (y * 512 + x) * 4, (y * 512 + x) * 4 + 3);
      }
    const photo = {
      kind: "oral",
      request_id: randomUUID(),
      patient_id: patient,
      oral_view: "cheek",
      data_url: `data:image/jpeg;base64,${jpeg.encode({ data: pixels, width: 512, height: 512 }, 85).data.toString("base64")}`,
    };
    const image = await post(worker, "upload", photo);
    assert.equal(image.quality_status, "acceptable");
    assert.equal(
      (await post(worker, "upload", photo)).id,
      image.id,
      "Upload retries must return the same image",
    );
    const apiStatus = localApi
      ? await (await fetch(`${api}/api/status`)).json()
      : status;
    if (apiStatus.ai_provider === "mock") {
      const analysis = await post(worker, "analyze", { image_id: image.id });
      assert.equal(analysis.provider, "mock");
      assert.equal(analysis.score, null);
      assert.equal(analysis.clinical_use, false);
    } else
      console.log("SKIP: mock analysis (target is not configured for mock).");
    const review = await rpc(doctor, "review", {
      patient_id: patient,
      revision: (await current()).revision,
      findings:
        "Synthetic independent clinician review for acceptance testing.",
      decision: "refer",
      priority: "routine",
    });
    const referral = review.referral_id;
    assert.ok(referral);
    assert.equal(
      checked(
        await specialist.client.from("patients").select("id").eq("id", patient),
        "Referred specialist",
      ).length,
      1,
    );
    const start = new Date(
      Date.now() + 3 * 86400000 + Math.floor(Math.random() * 1440) * 60000,
    ).toISOString();
    const appointment = await rpc(navigator, "appoint", {
      referral_id: referral,
      starts_at: start,
      mode: "in_person",
    });
    await rpc(navigator, "reschedule", {
      appointment_id: appointment.id,
      previous_starts_at: start,
      starts_at: new Date(Date.parse(start) + 3600000).toISOString(),
    });
    await rpc(navigator, "attendance", {
      appointment_id: appointment.id,
      status: "completed",
    });
    const investigation = await rpc(specialist, "investigation", {
      referral_id: referral,
      kind: "biopsy",
      status: "reviewed",
      notes: "Simulated pathology reviewed; no clinical interpretation.",
    });
    const pdf = await PDFDocument.create();
    pdf
      .addPage()
      .drawText("SYNTHETIC ACCEPTANCE REPORT - NOT FOR CLINICAL USE", {
        x: 30,
        y: 700,
        size: 12,
      });
    const reportBody = {
      kind: "report",
      request_id: randomUUID(),
      patient_id: patient,
      investigation_id: investigation.id,
      name: "synthetic-acceptance.pdf",
      data_url: `data:application/pdf;base64,${Buffer.from(await pdf.save()).toString("base64")}`,
    };
    const report = await post(specialist, "upload", reportBody);
    assert.equal((await post(specialist, "upload", reportBody)).id, report.id);
    const download = await post(doctor, "download", {
      kind: "report",
      id: report.id,
    });
    const content = await fetch(download.url, {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    assert.equal(content.status, 200);
    assert.ok((await content.arrayBuffer()).byteLength > 0);
    await post(navigator, "download", { kind: "report", id: report.id }, 403);
    const treatment = await rpc(specialist, "treatment", {
      referral_id: referral,
      status: "active",
      plan: "Synthetic treatment plan",
      notes: "Acceptance test only",
    });
    const plan = checked(
      await specialist.client
        .from("treatments")
        .select("revision")
        .eq("id", treatment.id)
        .single(),
      "Treatment revision",
    );
    await rpc(specialist, "treatment_update", {
      treatment_id: treatment.id,
      revision: plan.revision,
      status: "completed",
      notes: "Synthetic plan complete",
    });
    for (const task of checked(
      await navigator.client
        .from("navigation_tasks")
        .select("id")
        .eq("patient_id", patient)
        .eq("status", "pending"),
      "Follow-up tasks",
    ))
      await rpc(navigator, "followup", {
        task_id: task.id,
        status: "completed",
      });
    await rpc(worker, "consent", {
      patient_id: patient,
      purpose: "image_capture",
      granted: false,
      language: "te",
    });
    await post(worker, "download", { kind: "oral", id: image.id }, 403);
    for (const decision of ["close", "reopen", "close"]) {
      await rpc(doctor, "care_decision", {
        patient_id: patient,
        revision: (await current()).revision,
        category: "case",
        decision,
        notes: "Synthetic acceptance workflow complete",
      });
    }
    assert.equal((await current()).status, "closed");
    const totals = checked(
      await admin.client.rpc("dashboard_summary"),
      "Final district summary",
    );
    assert.ok(totals.completed_cases >= 1);
    assert.equal(
      checked(
        await admin.client.from("patients").select("id").eq("id", patient),
        "Admin privacy",
      ).length,
      0,
    );
    console.log(
      "PASS: hosted registration/retry, private photo/report/retry, independent referral, assignment, reschedule, attendance, diagnostics, treatment, follow-up, consent withdrawal, closure/reopening and aggregate privacy.",
    );
    if (localApi)
      console.log(
        "API exercised the local updated server against hosted Supabase; repeat against Render after deployment.",
      );
  } else
    console.log(
      "Read-only record checks complete. Add --write to create and retain one clearly labelled synthetic acceptance case.",
    );
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const context of sessions)
    await context.client.auth.signOut({ scope: "local" });
}
