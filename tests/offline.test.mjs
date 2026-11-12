import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureSnapshot,
  projectDrafts,
  validOfflineSession,
} from "../src/lib/offline.ts";
import { emptyData } from "../src/lib/types.ts";

const worker = {
  id: "worker-a",
  active: true,
  role: "health_worker",
  facility_id: "clinic-a",
  display_name: "Fixture worker",
};
const registration = () => ({
  id: "patient-a",
  actor: worker.id,
  action: "register",
  status: "pending",
  created_at: new Date().toISOString(),
  payload: {
    patient_id: "patient-a",
    screening_id: "screening-a",
    display_name: "Offline fixture",
    age_years: 46,
    village: "Fixture village",
    language: "te",
    consent: true,
    photo_consent: true,
    intake_version: 1,
    habits: [],
    reported_symptoms: [],
    lymph_nodes: "not_assessed",
  },
});
const photo = () => ({
  id: "photo-a",
  actor: worker.id,
  action: "image",
  status: "failed",
  created_at: new Date().toISOString(),
  payload: {
    patient_id: "patient-a",
    oral_view: "cheek",
    preview: "data:image/jpeg;base64,fixture",
    quality_status: "acceptable",
  },
});

test("offline access needs the same active worker, a current login and a recent verified workspace", () => {
  const session = {
      profile: worker,
      verified_at: Date.now(),
      data: emptyData(),
    },
    expiry = Date.now() / 1000 + 60;
  assert.equal(validOfflineSession(session, worker.id, expiry), true);
  assert.equal(validOfflineSession(undefined, worker.id, expiry), false);
  assert.equal(validOfflineSession(session, "another-account", expiry), false);
  assert.equal(
    validOfflineSession(session, worker.id, Date.now() / 1000 - 1),
    false,
  );
  for (const profile of [
    { ...worker, active: false },
    { ...worker, role: "medical_officer" },
  ])
    assert.equal(
      validOfflineSession({ ...session, profile }, worker.id, expiry),
      false,
    );
  assert.equal(
    validOfflineSession(
      { ...session, verified_at: Date.now() - 25 * 3600000 },
      worker.id,
      expiry,
    ),
    false,
  );
  assert.equal(
    validOfflineSession(
      { ...session, verified_at: Date.now() + 60000 },
      worker.id,
      expiry,
    ),
    false,
  );
});

test("pending clinical capture preserves IDs, consent, findings and a visible local photo without duplicating acknowledged rows", () => {
  const drafts = [registration(), photo()];
  const data = projectDrafts(emptyData(), worker, drafts, true);
  assert.equal(data.patients.length, 1);
  assert.equal(data.patients[0].is_synthetic, false);
  assert.equal(data.screenings[0].id, "screening-a");
  assert.equal(data.consents.length, 2);
  assert.equal(data.images[0].pending_sync, true);
  assert.equal(data.images[0].preview, drafts[1].payload.preview);
  assert.equal(data.images[0].screening_id, "screening-a");
  const server = structuredClone(data);
  server.images[0] = {
    ...server.images[0],
    pending_sync: undefined,
    preview: undefined,
    object_key: "private/server.jpg",
  };
  const reconciled = projectDrafts(server, worker, drafts, true);
  assert.equal(reconciled.patients.length, 1);
  assert.equal(reconciled.images.length, 1);
  assert.equal(reconciled.images[0].object_key, "private/server.jpg");
  assert.equal(reconciled.images[0].pending_sync, undefined);
  assert.equal(
    projectDrafts(
      emptyData(),
      worker,
      [{ ...registration(), actor: "someone-else" }],
      true,
    ).patients.length,
    0,
  );
});

test("a pending photo is hidden after consent withdrawal and is never attached to an absent screening", () => {
  const draft = registration();
  draft.payload.photo_consent = false;
  assert.equal(
    projectDrafts(emptyData(), worker, [draft, photo()], true).images.length,
    0,
  );
  assert.equal(
    projectDrafts(emptyData(), worker, [photo()], true).images.length,
    0,
  );
  const data = projectDrafts(emptyData(), worker, [registration()], true);
  data.consents.push({
    id: "withdrawal",
    patient_id: "patient-a",
    purpose: "image_capture",
    granted: false,
    recorded_at: new Date(Date.now() + 1000).toISOString(),
  });
  assert.equal(projectDrafts(data, worker, [photo()], true).images.length, 0);
});

test("offline snapshots exclude other workers, reports, signed notes, remote files and AI results", () => {
  const data = projectDrafts(
    emptyData(),
    worker,
    [registration(), photo()],
    true,
  );
  data.patients.push({
    ...data.patients[0],
    id: "other-patient",
    registered_by: "other-worker",
  });
  data.screenings.push({
    ...data.screenings[0],
    id: "other-screening",
    patient_id: "other-patient",
  });
  data.patient_documents.push({ id: "private-report" });
  data.clinical_reviews.push({ id: "private-review" });
  data.ai_analyses.push({ id: "private-ai" });
  const cached = captureSnapshot(data, worker);
  assert.equal(cached.patients.length, 1);
  assert.equal(cached.screenings.length, 1);
  for (const field of [
    "images",
    "patient_documents",
    "clinical_reviews",
    "ai_analyses",
  ])
    assert.deepEqual(cached[field], []);
});
