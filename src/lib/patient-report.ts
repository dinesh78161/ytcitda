import type { DataSet, Patient } from "./types";

export function patientReportDetails(data: DataSet, patient: Patient) {
  const screening = data.screenings
    .filter((row) => row.patient_id === patient.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const review =
    screening &&
    data.clinical_reviews
      .filter((row) => row.screening_id === screening.id)
      .sort((a, b) => b.signed_at.localeCompare(a.signed_at))[0];
  const referral =
    review &&
    data.referrals
      .filter((row) => row.review_id === review.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    priority: referral?.priority,
    tasks: data.navigation_tasks
      .filter((row) => row.patient_id === patient.id)
      .sort((a, b) => a.due_at.localeCompare(b.due_at)),
  };
}

export function patientReportCsv(headers: string[], rows: string[][]) {
  const cell = (value: string) => {
    // Keep phone numbers as text and prevent patient-entered formulas executing.
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
  );
}
