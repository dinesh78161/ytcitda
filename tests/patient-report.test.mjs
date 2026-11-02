import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../src/lib/demo.ts";
import {
  patientReportDetails,
  patientReportCsv,
} from "../src/lib/patient-report.ts";

test("report uses the latest screening referral priority without carrying old risk forward", () => {
  const data = createDemo(),
    patient = data.patients[0];
  assert.equal(patientReportDetails(data, patient).priority, "priority");
  data.screenings.push({
    ...data.screenings[0],
    id: "new-screening",
    created_at: "2099-01-01T00:00:00Z",
  });
  assert.equal(patientReportDetails(data, patient).priority, undefined);
  assert.equal(
    patientReportDetails(data, data.patients[11]).priority,
    undefined,
  );
  const details = patientReportDetails(data, patient);
  assert.ok(details.tasks.every((task) => task.patient_id === patient.id));
});

test("patient CSV preserves Unicode, commas, quotes, newlines and protects formula-like cells", () => {
  const csv = patientReportCsv(
    ["Name", "Phone", "Actions"],
    [
      ['పేరు, "Patient"', "+919876543210", "Contact\nthen follow-up"],
      [" =1+1", "@formula", "-formula"],
    ],
  );
  assert.ok(csv.startsWith('\uFEFF"Name","Phone","Actions"\r\n'));
  assert.ok(csv.includes('"పేరు, ""Patient"""'));
  assert.ok(csv.includes('"\'+919876543210"'));
  assert.ok(csv.includes('"Contact\nthen follow-up"'));
  assert.ok(csv.includes('"\' =1+1","\'@formula","\'-formula"'));
});
