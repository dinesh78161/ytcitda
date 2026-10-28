import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyDemoCommand,
  createDemo,
  demoProfiles,
  summarize,
} from "../src/lib/demo.ts";
import {
  caseRecords,
  closureBlockers,
  patientJourney,
} from "../src/lib/journey.ts";
const [, doctor, , navigator] = demoProfiles;
function fixture() {
  let data = createDemo(),
    tick = 0;
  const patient_id = data.referrals[1].patient_id,
    referral_id = data.referrals[1].id;
  const records = () => caseRecords(data, patient_id);
  const run = (action, payload = {}, actor = doctor) => {
    data = applyDemoCommand(data, actor, {
      id: crypto.randomUUID(),
      actor: actor.id,
      action,
      payload,
      created_at: new Date(Date.UTC(2026, 9, 28, 12, 0, tick++)).toISOString(),
    });
    return data;
  };
  const decision = (category, value) =>
    run("care_decision", {
      patient_id,
      revision: records().screening.revision,
      category,
      decision: value,
      notes: "Synthetic signed rationale",
    });
  const resolve = () => {
    for (const a of records().appointments.filter((a) =>
      ["requested", "confirmed", "rescheduled"].includes(a.status),
    ))
      run(
        "attendance",
        { appointment_id: a.id, status: "completed" },
        navigator,
      );
    for (const t of records().tasks.filter((t) => t.status === "pending"))
      run("followup", { task_id: t.id, status: "completed" }, navigator);
  };
  return {
    get data() {
      return data;
    },
    patient_id,
    referral_id,
    records,
    run,
    decision,
    resolve,
  };
}
test("patient stages follow consultation, pending diagnostics, treatment, closure and reopening", () => {
  const f = fixture();
  assert.equal(f.records().screening.status, "appointed");
  assert.throws(() => f.decision("case", "close"), /closing/);
  f.resolve();
  assert.equal(f.records().screening.status, "assessed");
  f.run("investigation", {
    referral_id: f.referral_id,
    kind: "biopsy",
    status: "requested",
    notes: "Synthetic request",
  });
  assert.equal(f.records().screening.status, "diagnostics_pending");
  f.run("treatment", {
    referral_id: f.referral_id,
    plan: "Synthetic plan",
    status: "active",
    notes: "Synthetic start",
  });
  assert.equal(f.records().screening.status, "diagnostics_pending");
  assert.throws(
    () => f.decision("diagnostics", "not_required"),
    /investigations/,
  );
  const i = f.records().investigations[0];
  f.run("investigation", {
    referral_id: f.referral_id,
    investigation_id: i.id,
    previous_status: i.status,
    kind: "biopsy",
    status: "reviewed",
    notes: "Synthetic report reviewed",
  });
  assert.equal(f.records().screening.status, "care_linked");
  assert.throws(() => f.decision("case", "close"), /closing/);
  const t = f.records().treatments[0];
  f.run("treatment_update", {
    treatment_id: t.id,
    revision: t.revision,
    status: "completed",
    notes: "Synthetic plan completed",
  });
  assert.deepEqual(closureBlockers(f.data, f.patient_id), []);
  f.decision("case", "close");
  assert.equal(f.records().screening.status, "closed");
  assert.equal(summarize(f.data).completed_cases, 1);
  assert.throws(
    () =>
      f.run("investigation", {
        referral_id: f.referral_id,
        kind: "biopsy",
        status: "requested",
      }),
    /Reopen/,
  );
  f.decision("case", "reopen");
  assert.equal(f.records().screening.status, "care_linked");
  assert.equal(f.records().decisions.length, 2);
  const steps = patientJourney(
    f.data,
    f.patient_id,
    "medical_officer",
    true,
    false,
  );
  assert.equal(steps.length, 9);
  assert.equal(steps.find((s) => s.id === "analysis").state, "unavailable");
  assert.equal(steps.find((s) => s.id === "treatment").state, "complete");
});
test("optional procedures require explicit rationale and cannot be silently skipped at closure", () => {
  const f = fixture();
  f.resolve();
  assert.deepEqual(closureBlockers(f.data, f.patient_id), [
    "diagnostic_decision",
    "treatment_decision",
  ]);
  f.decision("diagnostics", "not_required");
  f.decision("treatment", "not_required");
  assert.deepEqual(closureBlockers(f.data, f.patient_id), []);
  assert.equal(
    patientJourney(f.data, f.patient_id, "specialist", false, false).find(
      (s) => s.id === "diagnostics",
    ).state,
    "not_required",
  );
  f.decision("case", "close");
  assert.throws(
    () =>
      f.run(
        "care_decision",
        {
          patient_id: f.patient_id,
          revision: f.records().screening.revision,
          category: "case",
          decision: "reopen",
          notes: "Forged",
        },
        navigator,
      ),
    /role/,
  );
});
test("follow-up without referral is actionable and prevents premature case closure", () => {
  let data = createDemo();
  const p = data.patients.find(
    (p) => !data.referrals.some((r) => r.patient_id === p.id),
  );
  const run = (action, payload, actor = doctor) => {
    data = applyDemoCommand(data, actor, {
      id: crypto.randomUUID(),
      actor: actor.id,
      action,
      payload,
      created_at: "2026-10-28T12:00:00Z",
    });
  };
  run("review", {
    patient_id: p.id,
    revision: caseRecords(data, p.id).screening.revision,
    decision: "follow_up",
    findings: "Synthetic routine review",
    followup_at: "2099-01-01T10:00:00Z",
  });
  const c = caseRecords(data, p.id);
  assert.equal(c.referrals.length, 0);
  assert.equal(c.tasks[0].referral_id, null);
  assert.deepEqual(closureBlockers(data, p.id), ["followups"]);
  run("followup", { task_id: c.tasks[0].id, status: "completed" }, navigator);
  assert.deepEqual(closureBlockers(data, p.id), []);
});
test("booking rejects duplicate referrals and overlapping clinician slots", () => {
  const f = fixture();
  assert.throws(
    () =>
      f.run(
        "appoint",
        {
          referral_id: f.referral_id,
          starts_at: "2099-01-01T10:00:00Z",
          mode: "in_person",
        },
        navigator,
      ),
    /already/,
  );
  f.resolve();
  f.run(
    "appoint",
    {
      referral_id: f.referral_id,
      starts_at: "2099-01-01T10:00:00Z",
      mode: "in_person",
    },
    navigator,
  );
  const other = f.data.referrals.find(
    (r) =>
      r.id !== f.referral_id &&
      !f.data.appointments.some(
        (a) =>
          a.referral_id === r.id &&
          ["confirmed", "requested", "rescheduled"].includes(a.status),
      ),
  );
  assert.ok(other);
  assert.throws(
    () =>
      f.run(
        "appoint",
        {
          referral_id: other.id,
          starts_at: "2099-01-01T10:10:00Z",
          mode: "in_person",
        },
        navigator,
      ),
    /already/,
  );
});
