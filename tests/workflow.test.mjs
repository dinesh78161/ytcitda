import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDemoCommand,
  createDemo,
  demoProfiles,
  summarize,
  visibleDemo,
} from "../src/lib/demo.ts";
const command = (actor, action, payload) => ({
  id: crypto.randomUUID(),
  actor: actor.id,
  action,
  payload,
  created_at: new Date().toISOString(),
});
const worker = demoProfiles[0],
  doctor = demoProfiles[1],
  navigator = demoProfiles[3];
const payload = () => ({
  patient_id: crypto.randomUUID(),
  screening_id: crypto.randomUUID(),
  display_name: "Synthetic Test",
  age_years: 46,
  village: "Demo village",
  language: "te",
  consent: true,
  photo_consent: true,
  notes: "Synthetic intake",
});

test("demo registration retains all seven additional language choices", () => {
  for (const language of ["hi", "ta", "kn", "ml", "mr", "bn", "or"]) {
    const p = { ...payload(), language };
    const data = applyDemoCommand(
      createDemo(),
      worker,
      command(worker, "register", p),
    );
    assert.equal(
      data.patients.find((patient) => patient.id === p.patient_id)
        .preferred_language,
      language,
    );
    assert.ok(
      data.consents
        .filter((consent) => consent.patient_id === p.patient_id)
        .every((consent) => consent.language === language),
    );
  }
});

test("structured worker intake persists measurements and preserves unknown findings", () => {
  const p = {
    ...payload(),
    tobacco: "former",
    habits: ["reverse_smoking", "alcohol"],
    duration_years: "15",
    frequency_per_day: "8",
    reported_symptoms: ["burning"],
    mouth_opening_mm: "32",
    lymph_nodes: "not_assessed",
  };
  const data = applyDemoCommand(
    createDemo(),
    worker,
    command(worker, "register", p),
  );
  const saved = data.screenings.find((s) => s.patient_id === p.patient_id);
  assert.deepEqual(saved.tobacco_history, {
    use: "former",
    habits: ["reverse_smoking", "alcohol"],
    duration_years: 15,
    frequency_per_day: 8,
  });
  assert.deepEqual(saved.symptoms, {
    discomfort: false,
    reported: ["burning"],
    mouth_opening_mm: 32,
    lymph_nodes: "not_assessed",
  });
  const missing = payload();
  const blank = applyDemoCommand(
    createDemo(),
    worker,
    command(worker, "register", missing),
  ).screenings.find((s) => s.patient_id === missing.patient_id);
  assert.equal(blank.symptoms.mouth_opening_mm, null);
  assert.equal(blank.symptoms.lymph_nodes, "not_assessed");
});

test("invalid screening measurements and selections are rejected without adding a patient", () => {
  for (const extra of [
    { mouth_opening_mm: -1 },
    { duration_years: 121 },
    { frequency_per_day: "NaN" },
    { mouth_opening_mm: true },
    { habits: ["invented"] },
    { reported_symptoms: "burning" },
    { lymph_nodes: "normal" },
  ]) {
    const original = createDemo();
    assert.throws(() =>
      applyDemoCommand(
        original,
        worker,
        command(worker, "register", { ...payload(), ...extra }),
      ),
    );
    assert.equal(original.patients.length, 12);
  }
});
test("demo registration, clinician referral, appointment and outcome form one record", () => {
  let data = createDemo();
  const p = payload();
  data = applyDemoCommand(data, worker, command(worker, "register", p));
  assert.equal(data.patients.length, 13);
  data = applyDemoCommand(
    data,
    doctor,
    command(doctor, "review", {
      patient_id: p.patient_id,
      revision: 1,
      findings: "Simulated specialist assessment requested",
      decision: "refer",
      priority: "routine",
    }),
  );
  const referral = data.referrals.find((r) => r.patient_id === p.patient_id);
  assert.ok(referral);
  data = applyDemoCommand(
    data,
    navigator,
    command(navigator, "appoint", {
      referral_id: referral.id,
      starts_at: "2099-01-03T04:30:00Z",
      mode: "in_person",
    }),
  );
  const appointment = data.appointments.find(
    (a) => a.patient_id === p.patient_id,
  );
  data = applyDemoCommand(
    data,
    navigator,
    command(navigator, "attendance", {
      appointment_id: appointment.id,
      status: "missed",
    }),
  );
  assert.ok(
    data.navigation_tasks.some(
      (t) => t.patient_id === p.patient_id && t.task_type === "missed_visit",
    ),
  );
  data = applyDemoCommand(
    data,
    doctor,
    command(doctor, "diagnosis", {
      referral_id: referral.id,
      diagnosis: "Synthetic pathology outcome",
    }),
  );
  assert.equal(
    data.screenings.find((s) => s.patient_id === p.patient_id).status,
    "result_reviewed",
  );
});
test("demo rejects registration without consent and clinician review by a worker", () => {
  assert.throws(
    () =>
      applyDemoCommand(
        createDemo(),
        worker,
        command(worker, "register", { ...payload(), consent: false }),
      ),
    /consent/,
  );
  assert.throws(
    () => applyDemoCommand(createDemo(), worker, command(worker, "review", {})),
    /role/,
  );
});
test("demo detects stale review revisions", () => {
  const data = createDemo();
  assert.throws(
    () =>
      applyDemoCommand(
        data,
        doctor,
        command(doctor, "review", {
          patient_id: data.patients[6].id,
          revision: 5,
        }),
      ),
    /changed/,
  );
});
test("navigator display excludes all clinical content", () => {
  const data = visibleDemo(createDemo(), "navigator");
  assert.equal(data.screenings.length, 0);
  assert.equal(data.clinical_reviews.length, 0);
  assert.equal(data.images.length, 0);
  assert.equal(data.patients.length, 12);
});
test("district administrator display contains no patient records", () => {
  const source = createDemo();
  assert.equal(visibleDemo(source, "district_admin").patients.length, 0);
  assert.equal(summarize(source).patients, 12);
});
