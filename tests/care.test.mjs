import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyDemoCommand,
  createDemo,
  demoProfiles,
  visibleDemo,
  summarize,
} from "../src/lib/demo.ts";
import { hasConsent } from "../src/lib/care-workflows.ts";
const [worker, doctor, , navigator] = demoProfiles;
const cmd = (actor, action, payload) => ({
  id: crypto.randomUUID(),
  actor: actor.id,
  action,
  payload,
  created_at: "2026-10-27T12:00:00.000Z",
});
const run = (data, actor, action, payload) =>
  applyDemoCommand(data, actor, cmd(actor, action, payload));
test("treatment records retain progress and reject stale and closed updates", () => {
  let data = createDemo();
  const referral_id = data.referrals[0].id;
  data = run(data, doctor, "treatment", {
    referral_id,
    plan: "Synthetic care plan",
    notes: "Started plan",
    status: "active",
  });
  const t = data.treatments[0];
  data = run(data, doctor, "treatment_update", {
    treatment_id: t.id,
    revision: 1,
    notes: "Synthetic review completed",
    status: "completed",
  });
  assert.equal(data.treatment_events.length, 2);
  assert.equal(data.treatments[0].revision, 2);
  assert.throws(
    () =>
      run(data, doctor, "treatment_update", {
        treatment_id: t.id,
        revision: 1,
        notes: "stale",
        status: "active",
      }),
    /changed/,
  );
  assert.throws(
    () =>
      run(data, doctor, "treatment_update", {
        treatment_id: t.id,
        revision: 2,
        notes: "reopen",
        status: "active",
      }),
    /closed/,
  );
  for (const role of ["health_worker", "navigator", "district_admin"]) {
    const view = visibleDemo(data, role);
    assert.equal(view.treatments.length, 0);
    assert.equal(view.treatment_events.length, 0);
  }
  assert.throws(
    () =>
      run(data, navigator, "treatment", {
        referral_id,
        plan: "x",
        notes: "x",
        status: "active",
      }),
    /role/,
  );
});
test("rescheduling cancels old reminders, detects conflicts, and cancellation stops pending delivery", () => {
  let data = createDemo();
  const a = data.appointments[1];
  data = run(data, navigator, "reschedule", {
    appointment_id: a.id,
    previous_starts_at: a.starts_at,
    starts_at: "2026-12-01T04:30:00Z",
  });
  const reminders = data.appointment_reminders.filter(
    (r) => r.appointment_id === a.id,
  );
  assert.equal(reminders.filter((r) => r.status === "pending").length, 1);
  assert.ok(reminders.some((r) => r.status === "cancelled"));
  const other = data.appointments[2];
  assert.throws(
    () =>
      run(data, navigator, "reschedule", {
        appointment_id: other.id,
        previous_starts_at: other.starts_at,
        starts_at: "2026-12-01T04:40:00Z",
      }),
    /already/,
  );
  assert.throws(
    () =>
      run(data, navigator, "reschedule", {
        appointment_id: a.id,
        previous_starts_at: a.starts_at,
        starts_at: "2026-12-02T04:30:00Z",
      }),
    /changed/,
  );
  data = run(data, navigator, "attendance", {
    appointment_id: a.id,
    status: "cancelled",
  });
  assert.ok(
    data.appointment_reminders
      .filter((r) => r.appointment_id === a.id)
      .every((r) => r.status === "cancelled"),
  );
});
test("latest consent controls images; withdrawal cannot be overridden by historical grants", () => {
  let data = createDemo();
  const patient_id = data.patients[0].id;
  const grant = cmd(worker, "consent", {
    patient_id,
    purpose: "image_capture",
    granted: true,
  });
  data = applyDemoCommand(data, worker, grant);
  assert.equal(hasConsent(data, patient_id, "image_capture"), true);
  const withdraw = {
    ...cmd(worker, "consent", {
      patient_id,
      purpose: "image_capture",
      granted: false,
    }),
    created_at: "2026-10-27T12:01:00.000Z",
  };
  data = applyDemoCommand(data, worker, withdraw);
  assert.equal(hasConsent(data, patient_id, "image_capture"), false);
  assert.throws(
    () => run(data, worker, "image", { patient_id, preview: "x" }),
    /consent/,
  );
});
test("outreach and completed follow-up totals derive from saved records", () => {
  let data = createDemo();
  data = run(data, worker, "outreach", {
    village: "Synthetic village",
    held_on: "2026-10-27",
    attendees: 30,
    screened: 24,
  });
  data = run(data, navigator, "followup", {
    task_id: data.navigation_tasks[0].id,
    status: "completed",
  });
  assert.equal(summarize(data).follow_up_completion_rate, 25);
  assert.equal(summarize(data).outreach_screened, 24);
  assert.throws(
    () =>
      run(data, worker, "outreach", {
        village: "x",
        held_on: "2026-10-27",
        attendees: 10,
        screened: 11,
      }),
    /count/,
  );
  assert.throws(
    () =>
      run(data, worker, "outreach", {
        village: "x",
        held_on: "2026-10-28",
        attendees: 10,
        screened: 9,
      }),
    /completed/,
  );
});
test("investigation progress requires notes and prevents changing reviewed records", () => {
  let data = createDemo();
  const referral_id = data.referrals[0].id;
  data = run(data, doctor, "investigation", {
    referral_id,
    kind: "biopsy",
    status: "requested",
  });
  const i = data.investigations[0];
  assert.throws(
    () =>
      run(data, doctor, "investigation", {
        referral_id,
        investigation_id: i.id,
        previous_status: "requested",
        kind: "biopsy",
        status: "reviewed",
        notes: "",
      }),
    /text/,
  );
  data = run(data, doctor, "investigation", {
    referral_id,
    investigation_id: i.id,
    previous_status: "requested",
    kind: "biopsy",
    status: "reviewed",
    notes: "Synthetic report reviewed",
  });
  assert.throws(
    () =>
      run(data, doctor, "investigation", {
        referral_id,
        investigation_id: i.id,
        previous_status: "reviewed",
        kind: "biopsy",
        status: "requested",
      }),
    /backwards/,
  );
});

test("outreach uses the India calendar date across the UTC midnight boundary", () => {
  const command = {
    ...cmd(worker, "outreach", {
      village: "Synthetic midnight camp",
      held_on: "2026-10-28",
      attendees: 10,
      screened: 8,
    }),
    created_at: "2026-10-27T20:00:00Z",
  };
  const data = applyDemoCommand(createDemo(), worker, command);
  assert.equal(data.outreach_events[0].held_on, "2026-10-28");
});
