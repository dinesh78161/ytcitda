import type { DataSet, Role } from "./types.ts";

export const stages = [
  "awaiting_clinician",
  "reviewed",
  "referral_planned",
  "appointed",
  "assessed",
  "diagnostics_pending",
  "result_reviewed",
  "care_linked",
  "closed",
] as const;
export const latestScreening = (data: DataSet, patientId: string) =>
  [...data.screenings]
    .filter((s) => s.patient_id === patientId)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    )[0];
export function caseRecords(data: DataSet, patientId: string) {
  const screening = latestScreening(data, patientId);
  const reviews = data.clinical_reviews.filter(
    (r) => r.screening_id === screening?.id,
  );
  const referrals = data.referrals.filter((r) =>
    screening
      ? reviews.some((v) => v.id === r.review_id)
      : r.patient_id === patientId,
  );
  const linked = (id: string) => referrals.some((r) => r.id === id);
  return {
    screening,
    reviews,
    referrals,
    images: data.images.filter((i) => i.screening_id === screening?.id),
    appointments: data.appointments.filter((a) => linked(a.referral_id)),
    investigations: data.investigations.filter((i) => linked(i.referral_id)),
    treatments: data.treatments.filter((t) => linked(t.referral_id)),
    tasks: data.navigation_tasks.filter(
      (t) =>
        t.patient_id === patientId &&
        (t.referral_id
          ? linked(t.referral_id)
          : t.created_at >= (screening?.created_at || "")),
    ),
    decisions: [...(data.care_decisions || [])]
      .filter((d) => d.screening_id === screening?.id)
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      ),
  };
}
export function overallStage(data: DataSet, patientId: string) {
  const c = caseRecords(data, patientId);
  if (c.screening?.status === "closed") return "closed";
  if (c.investigations.some((i) => i.status !== "reviewed"))
    return "diagnostics_pending";
  if (c.treatments.length) return "care_linked";
  if (c.investigations.some((i) => i.status === "reviewed"))
    return "result_reviewed";
  if (
    c.appointments.some((a) =>
      ["confirmed", "requested", "rescheduled"].includes(a.status),
    )
  )
    return "appointed";
  if (c.appointments.some((a) => a.status === "completed")) return "assessed";
  if (c.referrals.some((r) => !["closed", "declined"].includes(r.status)))
    return "referral_planned";
  if (c.reviews.length) return "reviewed";
  return "awaiting_clinician";
}
export function syncStages(data: DataSet) {
  for (const patient of data.patients) {
    const s = latestScreening(data, patient.id);
    if (!s) continue;
    const status = overallStage(data, patient.id);
    if (s.status !== status) {
      s.status = status;
      s.revision++;
    }
  }
  return data;
}
export function closureBlockers(data: DataSet, patientId: string): string[] {
  const c = caseRecords(data, patientId),
    reasons: string[] = [];
  if (!c.reviews.length) reasons.push("review");
  if (
    c.appointments.some((a) =>
      ["requested", "confirmed", "rescheduled"].includes(a.status),
    )
  )
    reasons.push("appointments");
  if (c.investigations.some((i) => i.status !== "reviewed"))
    reasons.push("investigations");
  if (c.treatments.some((t) => ["planned", "active"].includes(t.status)))
    reasons.push("treatments");
  if (c.tasks.some((t) => t.status === "pending")) reasons.push("followups");
  if (c.referrals.length) {
    if (
      !c.investigations.length &&
      c.decisions.find((d) => d.category === "diagnostics")?.decision !==
        "not_required"
    )
      reasons.push("diagnostic_decision");
    if (
      !c.treatments.length &&
      c.decisions.find((d) => d.category === "treatment")?.decision !==
        "not_required"
    )
      reasons.push("treatment_decision");
  }
  return reasons;
}
export type JourneyTarget =
  "clinical" | "photos" | "care" | "appointments" | "reports";
export type StepState =
  | "complete"
  | "pending"
  | "attention"
  | "optional"
  | "not_required"
  | "unavailable"
  | "restricted"
  | "recorded"
  | "scheduled";
export function patientJourney(
  data: DataSet,
  patientId: string,
  role: Role,
  cloud: boolean,
  modelConfigured: boolean,
) {
  const c = caseRecords(data, patientId),
    clinical = role === "medical_officer" || role === "specialist",
    logistics = role === "navigator";
  const latestImage = [...c.images].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  const accepted = c.images.filter((i) => i.quality_status === "acceptable");
  const analyses = data.ai_analyses.filter(
    (a) =>
      a.status === "completed" && accepted.some((i) => i.id === a.image_id),
  );
  const decision = (category: string) =>
    c.decisions.find((d) => d.category === category)?.decision;
  const steps: { id: string; target: JourneyTarget; state: StepState }[] = [
    { id: "registration", target: "clinical", state: "complete" },
    {
      id: "photos",
      target: "photos",
      state: logistics
        ? "restricted"
        : c.images.length
          ? "complete"
          : "pending",
    },
    {
      id: "quality",
      target: "photos",
      state: logistics
        ? "restricted"
        : latestImage?.quality_status === "recapture"
          ? "attention"
          : accepted.length
            ? "complete"
            : "pending",
    },
    {
      id: "analysis",
      target: "photos",
      state: logistics
        ? "restricted"
        : analyses.some((a) => a.provider === "research")
          ? "complete"
          : analyses.length
            ? "recorded"
            : cloud && !modelConfigured
              ? "unavailable"
              : "optional",
    },
    {
      id: "review",
      target: "clinical",
      state: logistics
        ? "restricted"
        : c.reviews.length
          ? "complete"
          : "pending",
    },
    {
      id: "consultation",
      target: "appointments",
      state: c.appointments.some((a) => a.status === "completed")
        ? "complete"
        : c.appointments.some((a) =>
              ["confirmed", "rescheduled", "requested"].includes(a.status),
            )
          ? "scheduled"
          : c.appointments.some((a) => a.status === "missed")
            ? "attention"
            : c.referrals.length
              ? "pending"
              : c.reviews.length
                ? "not_required"
                : "pending",
    },
    {
      id: "diagnostics",
      target: "care",
      state: !clinical
        ? "restricted"
        : c.investigations.some((i) => i.status !== "reviewed")
          ? "pending"
          : c.investigations.length
            ? "complete"
            : decision("diagnostics") === "not_required"
              ? "not_required"
              : "pending",
    },
    {
      id: "treatment",
      target: "care",
      state: !clinical
        ? "restricted"
        : c.treatments.some((t) => ["active", "planned"].includes(t.status))
          ? "pending"
          : c.treatments.some((t) => t.status === "stopped")
            ? "attention"
            : c.treatments.length
              ? "complete"
              : decision("treatment") === "not_required"
                ? "not_required"
                : "pending",
    },
    { id: "dashboard", target: "reports", state: "recorded" },
  ];
  return steps;
}
