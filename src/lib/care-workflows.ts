import type { Command, DataSet, Profile, Role, Treatment } from "./types.ts";
import { caseRecords, closureBlockers, latestScreening } from "./journey.ts";

export function checkBooking(
  data: DataSet,
  clinicianId: string,
  referralId: string,
  starts: string,
  now: string,
  exclude?: string,
) {
  const time = Date.parse(starts);
  if (!Number.isFinite(time) || time <= Date.parse(now))
    throw new Error("Choose a future appointment time.");
  const active = data.appointments.filter(
    (a) =>
      a.id !== exclude &&
      ["confirmed", "requested", "rescheduled"].includes(a.status),
  );
  if (active.some((a) => a.referral_id === referralId))
    throw new Error(
      "This referral already has an appointment. Reschedule the existing appointment.",
    );
  if (
    active.some(
      (a) =>
        a.clinician_id === clinicianId &&
        Date.parse(a.starts_at) < time + 1800000 &&
        Date.parse(a.ends_at) > time,
    )
  )
    throw new Error("The clinician already has an appointment at that time.");
}

export function hasConsent(data: DataSet, patient: string, purpose: string) {
  return (
    [...data.consents]
      .reverse()
      .filter((c) => c.patient_id === patient && c.purpose === purpose)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
      ?.granted === true
  );
}
export function scheduleReminder(
  data: DataSet,
  appointmentId: string,
  now: string,
) {
  const a = data.appointments.find((a) => a.id === appointmentId)!;
  for (const r of data.appointment_reminders)
    if (r.appointment_id === a.id && ["pending", "failed"].includes(r.status))
      r.status = "cancelled";
  if (!["requested", "confirmed", "rescheduled"].includes(a.status)) return;
  data.appointment_reminders.push({
    id: crypto.randomUUID(),
    patient_id: a.patient_id,
    appointment_id: a.id,
    due_at: new Date(
      Math.max(Date.parse(now), Date.parse(a.starts_at) - 86400000),
    ).toISOString(),
    status: "pending",
    attempts: 0,
    created_at: now,
  });
}

export function applyCareCommand(
  data: DataSet,
  actor: Profile,
  command: Command,
): boolean {
  const p = command.payload,
    now = command.created_at,
    uuid = () => crypto.randomUUID();
  const role = (...roles: Role[]) => {
    if (
      !actor.active ||
      command.actor !== actor.id ||
      !roles.includes(actor.role)
    )
      throw new Error("This action is not permitted for your role.");
  };
  const text = (value: unknown, max = 5000) => {
    const s = String(value ?? "").trim();
    if (!s || s.length > max)
      throw new Error(`Enter text between 1 and ${max} characters.`);
    return s;
  };
  const date = (value: unknown) => {
    const d = new Date(String(value));
    if (!Number.isFinite(+d)) throw new Error("Enter a valid date.");
    return d.toISOString();
  };
  const patient = () => {
    if (!data.patients.some((x) => x.id === p.patient_id))
      throw new Error("Patient not found.");
    return String(p.patient_id);
  };
  if (command.action === "care_decision") {
    role("medical_officer", "specialist");
    const person = patient(),
      s = latestScreening(data, person),
      c = caseRecords(data, person);
    if (!s || s.revision !== Number(p.revision))
      throw new Error("Case changed; refresh before recording a decision.");
    if (!c.reviews.length)
      throw new Error("A signed clinician review is required.");
    const category = String(p.category),
      decision = String(p.decision),
      notes = text(p.notes);
    if (
      !["diagnostics", "treatment", "case"].includes(category) ||
      !(
        category === "case" ? ["close", "reopen"] : ["required", "not_required"]
      ).includes(decision)
    )
      throw new Error("Invalid care decision.");
    if (
      s.status === "closed" &&
      !(category === "case" && decision === "reopen")
    )
      throw new Error("Reopen this case before making changes.");
    if (category === "case" && decision === "reopen" && s.status !== "closed")
      throw new Error("This case is already open.");
    if (
      category === "case" &&
      decision === "close" &&
      closureBlockers(data, person).length
    )
      throw new Error(
        "Resolve appointments, investigations, treatment decisions and follow-ups before closing this case.",
      );
    if (
      category === "diagnostics" &&
      decision === "not_required" &&
      c.investigations.some((i) => i.status !== "reviewed")
    )
      throw new Error("Review outstanding investigations first.");
    if (
      category === "treatment" &&
      decision === "not_required" &&
      c.treatments.some((t) => ["active", "planned"].includes(t.status))
    )
      throw new Error("Complete or stop the existing treatment first.");
    data.care_decisions.unshift({
      id: uuid(),
      patient_id: person,
      screening_id: s.id,
      clinician_id: actor.id,
      category: category as "diagnostics" | "treatment" | "case",
      decision: decision as "required" | "not_required" | "close" | "reopen",
      notes,
      created_at: now,
    });
    if (category === "case")
      s.status = decision === "close" ? "closed" : "reviewed";
    s.revision++;
  } else if (command.action === "reschedule") {
    role("medical_officer", "specialist", "navigator");
    const a = data.appointments.find((a) => a.id === p.appointment_id);
    if (
      !a ||
      !["confirmed", "requested", "rescheduled", "missed"].includes(a.status)
    )
      throw new Error("This appointment cannot be rescheduled.");
    if (a.starts_at !== p.previous_starts_at)
      throw new Error("Appointment changed; refresh before rescheduling.");
    const starts = date(p.starts_at);
    checkBooking(data, a.clinician_id, a.referral_id, starts, now, a.id);
    if (Date.parse(starts) <= Date.parse(now))
      throw new Error("Choose a future appointment time.");
    if (
      data.appointments.some(
        (other) =>
          other.id !== a.id &&
          other.clinician_id === a.clinician_id &&
          ["confirmed", "requested", "rescheduled"].includes(other.status) &&
          Date.parse(other.starts_at) < Date.parse(starts) + 1800000 &&
          Date.parse(other.ends_at) > Date.parse(starts),
      )
    )
      throw new Error("The clinician already has an appointment at that time.");
    a.starts_at = starts;
    a.ends_at = new Date(Date.parse(starts) + 1800000).toISOString();
    a.status = "rescheduled";
    scheduleReminder(data, a.id, now);
  } else if (
    command.action === "treatment" ||
    command.action === "treatment_update"
  ) {
    role("medical_officer", "specialist");
    const status = String(p.status) as Treatment["status"];
    if (!["planned", "active", "completed", "stopped"].includes(status))
      throw new Error("Invalid treatment status.");
    const notes = text(p.notes),
      next = p.next_review_at ? date(p.next_review_at) : null;
    let treatment;
    if (command.action === "treatment") {
      const r = data.referrals.find((r) => r.id === p.referral_id);
      if (!r || ["closed", "declined"].includes(r.status))
        throw new Error("An open referral is required.");
      treatment = {
        id: uuid(),
        patient_id: r.patient_id,
        referral_id: r.id,
        clinician_id: actor.id,
        plan: text(p.plan),
        status,
        next_review_at: next,
        revision: 1,
        created_at: now,
      };
      data.treatments.unshift(treatment);
    } else {
      treatment = data.treatments.find((t) => t.id === p.treatment_id);
      if (!treatment || treatment.revision !== Number(p.revision))
        throw new Error("Treatment changed; refresh before updating.");
      if (["completed", "stopped"].includes(treatment.status))
        throw new Error("This treatment is closed; create a new plan.");
      treatment.status = status;
      treatment.next_review_at = next;
      treatment.revision++;
    }
    data.treatment_events.unshift({
      id: uuid(),
      patient_id: treatment.patient_id,
      treatment_id: treatment.id,
      status,
      notes,
      created_at: now,
    });
  } else if (command.action === "investigation") {
    role("medical_officer", "specialist");
    const r = data.referrals.find((r) => r.id === p.referral_id);
    if (!r || !["biopsy", "pathology", "other"].includes(String(p.kind)))
      throw new Error("Select a referral and investigation type.");
    if (
      !["requested", "collected", "reported", "reviewed"].includes(
        String(p.status),
      )
    )
      throw new Error("Invalid investigation status.");
    const existing = p.investigation_id
      ? data.investigations.find(
          (i) => i.id === p.investigation_id && i.referral_id === r.id,
        )
      : null;
    if (p.investigation_id && !existing)
      throw new Error("Investigation not found.");
    if (existing && existing.status !== p.previous_status)
      throw new Error("Investigation changed; refresh before updating.");
    const order = ["requested", "collected", "reported", "reviewed"];
    if (
      existing &&
      (existing.status === "reviewed" ||
        order.indexOf(String(p.status)) < order.indexOf(existing.status))
    )
      throw new Error(
        "Investigation cannot move backwards or change after review.",
      );
    const result = ["reported", "reviewed"].includes(String(p.status))
      ? text(p.notes)
      : String(p.notes ?? "");
    if (existing) {
      existing.status = String(p.status);
      existing.clinician_diagnosis = result;
    } else
      data.investigations.unshift({
        id: uuid(),
        patient_id: r.patient_id,
        referral_id: r.id,
        kind: String(p.kind),
        status: String(p.status),
        clinician_diagnosis: result,
        created_at: now,
      });
  } else if (command.action === "document") {
    role("medical_officer", "specialist");
    const person = patient();
    if (!hasConsent(data, person, "screening"))
      throw new Error("Current screening consent is required.");
    if (
      p.investigation_id &&
      !data.investigations.some(
        (i) => i.id === p.investigation_id && i.patient_id === person,
      )
    )
      throw new Error("Investigation does not belong to this patient.");
    if (
      !String(p.preview).startsWith("data:application/pdf;base64,") &&
      !String(p.preview).startsWith("data:image/jpeg;base64,")
    )
      throw new Error("Use a PDF or JPEG report.");
    data.patient_documents.unshift({
      id: uuid(),
      patient_id: person,
      investigation_id: p.investigation_id ? String(p.investigation_id) : null,
      name: text(p.name, 150),
      mime_type: String(p.mime_type),
      size_bytes: Number(p.size_bytes),
      object_key: `demo/${uuid()}`,
      preview: String(p.preview),
      created_at: now,
    });
  } else if (command.action === "consent") {
    role("health_worker", "medical_officer", "specialist");
    const person = patient();
    if (
      !["screening", "image_capture", "teleconsultation"].includes(
        String(p.purpose),
      ) ||
      typeof p.granted !== "boolean"
    )
      throw new Error("Select a valid consent purpose and decision.");
    data.consents.push({
      id: uuid(),
      patient_id: person,
      purpose: String(p.purpose),
      granted: p.granted,
      recorded_at: now,
    });
  } else if (command.action === "outreach") {
    role("health_worker", "medical_officer");
    const attendees = Number(p.attendees),
      screened = Number(p.screened),
      held = date(p.held_on).slice(0, 10);
    if (
      !Number.isInteger(attendees) ||
      !Number.isInteger(screened) ||
      attendees < 0 ||
      attendees > 100000 ||
      screened < 0 ||
      screened > attendees
    )
      throw new Error(
        "Screened count must be between zero and the number attending.",
      );
    const localDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date(now));
    if (held > localDay)
      throw new Error("Record completed outreach events only.");
    data.outreach_events.unshift({
      id: uuid(),
      facility_id: actor.facility_id,
      village: text(p.village, 120),
      held_on: held,
      attendees,
      screened,
      created_at: now,
    });
  } else if (command.action === "reminder") {
    role("medical_officer", "specialist", "navigator");
    const reminder = data.appointment_reminders.find(
      (r) => r.id === p.reminder_id,
    );
    if (!reminder || !["pending", "failed", "sent"].includes(reminder.status))
      throw new Error("Reminder is no longer pending.");
    reminder.status = "acknowledged";
  } else return false;
  return true;
}
