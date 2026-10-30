import {
  emptyData,
  type Command,
  type DataSet,
  type Profile,
  type Role,
  type Summary,
} from "./types.ts";
import {
  applyCareCommand,
  hasConsent,
  scheduleReminder,
  checkBooking,
} from "./care-workflows.ts";
import {
  syncStages,
  latestScreening,
  closureBlockers,
  stages,
} from "./journey.ts";
import { normalizeIntake } from "./intake.ts";
import { isLanguage } from "./languages.ts";

export const DEMO_FACILITY = "10000000-0000-4000-8000-000000000001";
const id = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const demoProfiles: Profile[] = [
  ["health_worker", "Health Worker"],
  ["medical_officer", "Medical Officer"],
  ["specialist", "Specialist"],
  ["navigator", "Care Navigator"],
  ["district_admin", "District Administrator"],
].map(([role, name], index) => ({
  id: id("0", index + 1),
  display_name: `Demo ${name}`,
  role: role as Role,
  facility_id: DEMO_FACILITY,
  active: true,
}));

export function createDemo(): DataSet {
  const data = emptyData();
  data.facilities = [
    {
      id: DEMO_FACILITY,
      name: "G. Madugula PHC · Demo",
      district: "ASR District",
      facility_type: "phc",
    },
    {
      id: id("1", 2),
      name: "Paderu Referral Hospital · Demo",
      district: "ASR District",
      facility_type: "hospital",
    },
  ];
  const villages = ["G. Madugula", "Paderu", "Hukumpeta", "Chintapalle"];
  for (let n = 1; n <= 12; n++) {
    const date = new Date(
      Date.UTC(2026, 9, 20 + Math.floor(n / 2), 4, 30),
    ).toISOString();
    data.patients.push({
      id: id("2", n),
      display_name: `Demo Resident ${String(n).padStart(2, "0")}`,
      age_years: 32 + n,
      village: villages[(n - 1) % 4],
      preferred_language: "te",
      facility_id: DEMO_FACILITY,
      registered_by: demoProfiles[0].id,
      is_synthetic: true,
      created_at: date,
    });
    data.consents.push({
      id: id("3", n),
      patient_id: id("2", n),
      purpose: "screening",
      granted: true,
      recorded_at: date,
    });
    data.screenings.push({
      id: id("4", n),
      patient_id: id("2", n),
      examiner_id: demoProfiles[0].id,
      status: n <= 4 ? "referral_planned" : "awaiting_clinician",
      examination_notes:
        "Initial clinical intake. Medical officer review requested.",
      symptoms: { discomfort: n % 2 === 0 },
      tobacco_history: { use: n % 3 === 0 ? "current" : "never" },
      revision: 1,
      created_at: date,
    });
    if (n <= 4) {
      data.clinical_reviews.push({
        id: id("5", n),
        patient_id: id("2", n),
        screening_id: id("4", n),
        findings:
          "Simulated independent review. Specialist assessment requested.",
        clinical_decision: "refer",
        signed_at: date,
      });
      data.referrals.push({
        id: id("6", n),
        patient_id: id("2", n),
        review_id: id("5", n),
        destination_facility_id: id("1", 2),
        priority: n === 1 ? "priority" : "routine",
        specialty: "Oral medicine",
        status: "booked",
        created_at: date,
      });
      const starts = `2026-11-0${n}T04:30:00.000Z`;
      data.appointments.push({
        id: id("7", n),
        patient_id: id("2", n),
        referral_id: id("6", n),
        clinician_id: demoProfiles[2].id,
        starts_at: starts,
        ends_at: `2026-11-0${n}T05:00:00.000Z`,
        mode: n % 2 ? "video" : "in_person",
        status: n === 1 ? "missed" : "confirmed",
        created_at: date,
      });
      data.navigation_tasks.push({
        id: id("8", n),
        patient_id: id("2", n),
        referral_id: id("6", n),
        owner_id: demoProfiles[3].id,
        task_type: n === 1 ? "missed_visit" : "follow_up",
        due_at: "2026-11-02T04:30:00.000Z",
        status: "pending",
        created_at: date,
      });
    }
  }
  for (const appointment of data.appointments)
    scheduleReminder(data, appointment.id, appointment.created_at);
  return syncStages(data);
}

export function summarize(data: DataSet): Summary {
  return {
    stage_counts: Object.fromEntries(
      stages.map((stage) => [
        stage,
        data.screenings.filter((s) => s.status === stage).length,
      ]),
    ),
    completed_cases: data.screenings.filter((s) => s.status === "closed")
      .length,
    patients: data.patients.length,
    screenings: data.screenings.length,
    referrals: data.referrals.length,
    missed_appointments: data.appointments.filter((a) => a.status === "missed")
      .length,
    pending_follow_ups: data.navigation_tasks.filter(
      (t) => t.status === "pending",
    ).length,
    completed_follow_ups: data.navigation_tasks.filter(
      (t) => t.status === "completed",
    ).length,
    total_follow_ups: data.navigation_tasks.length,
    follow_up_completion_rate: data.navigation_tasks.length
      ? Math.round(
          (100 *
            data.navigation_tasks.filter((t) => t.status === "completed")
              .length) /
            data.navigation_tasks.length,
        )
      : 0,
    outreach_events: data.outreach_events.length,
    outreach_attendees: data.outreach_events.reduce(
      (sum, e) => sum + e.attendees,
      0,
    ),
    outreach_screened: data.outreach_events.reduce(
      (sum, e) => sum + e.screened,
      0,
    ),
    active_treatments: data.treatments.filter((t) => t.status === "active")
      .length,
  };
}

export function visibleDemo(data: DataSet, role: Role): DataSet {
  const result = structuredClone(data);
  if (role === "district_admin")
    return { ...emptyData(), facilities: result.facilities };
  if (role === "specialist") {
    const ids = new Set(result.referrals.map((r) => r.patient_id));
    for (const key of [
      "patients",
      "screenings",
      "consents",
      "images",
      "clinical_reviews",
      "referrals",
      "appointments",
      "investigations",
      "navigation_tasks",
      "treatments",
      "treatment_events",
      "patient_documents",
      "appointment_reminders",
      "care_decisions",
    ] as const) {
      (result[key] as { id: string; patient_id?: string }[]) = (
        result[key] as { id: string; patient_id?: string }[]
      ).filter((row) => ids.has(key === "patients" ? row.id : row.patient_id!));
    }
    result.ai_analyses = result.ai_analyses.filter((a) =>
      result.images.some((i) => i.id === a.image_id),
    );
  }
  if (role === "navigator") {
    result.care_decisions = [];
    result.screenings = [];
    result.consents = [];
    result.images = [];
    result.ai_analyses = [];
    result.clinical_reviews = [];
    result.investigations = [];
    result.treatments = [];
    result.treatment_events = [];
    result.patient_documents = [];
  }
  if (role === "health_worker") {
    result.care_decisions = [];
    result.investigations = [];
    result.treatments = [];
    result.treatment_events = [];
    result.patient_documents = [];
  }
  return result;
}

/** Local synthetic simulation only. Production authorization is in the SQL RPC. */
export function applyDemoCommand(
  original: DataSet,
  profile: Profile,
  command: Command,
): DataSet {
  const data = { ...emptyData(), ...structuredClone(original) },
    p = command.payload,
    now = command.created_at;
  const requireRole = (roles: Role[]) => {
    if (
      !profile.active ||
      !roles.includes(profile.role) ||
      command.actor !== profile.id
    )
      throw new Error("This action is not permitted for your role.");
  };
  const uuid = () => crypto.randomUUID();
  const getScreen = () => {
    const s = latestScreening(data, String(p.patient_id));
    if (!s) throw new Error("Screening not found.");
    return s;
  };
  const person =
    p.patient_id ||
    data.referrals.find((r) => r.id === p.referral_id)?.patient_id ||
    data.appointments.find((a) => a.id === p.appointment_id)?.patient_id ||
    data.treatments.find((t) => t.id === p.treatment_id)?.patient_id ||
    data.investigations.find((i) => i.id === p.investigation_id)?.patient_id;
  if (
    person &&
    latestScreening(data, String(person))?.status === "closed" &&
    !["care_decision", "consent", "reminder"].includes(command.action)
  )
    throw new Error("Reopen this case before making changes.");
  if (applyCareCommand(data, profile, command)) return syncStages(data);
  if (command.action === "register") {
    requireRole(["health_worker"]);
    const intake = normalizeIntake(p);
    const name = String(p.display_name ?? "").trim(),
      village = String(p.village ?? "").trim(),
      age = Number(p.age_years);
    if (
      !name ||
      !village ||
      !Number.isInteger(age) ||
      age < 0 ||
      age > 120 ||
      p.consent !== true
    )
      throw new Error(
        "Complete the patient details and record screening consent.",
      );
    const patient_id = String(p.patient_id),
      screening_id = String(p.screening_id);
    if (data.patients.some((x) => x.id === patient_id)) return data;
    data.patients.unshift({
      id: patient_id,
      display_name: name,
      age_years: age,
      village,
      mandal: p.mandal ? String(p.mandal).trim() : null,
      habitation: p.habitation ? String(p.habitation).trim() : null,
      subcenter: p.subcenter ? String(p.subcenter).trim() : null,
      abha_id: p.abha_id ? String(p.abha_id).trim() : null,
      aadhaar_last4: p.aadhaar_last4 ? String(p.aadhaar_last4).trim() : null,
      contact_phone: String(p.contact_phone ?? ""),
      preferred_language: isLanguage(p.language) ? p.language : "en",
      facility_id: profile.facility_id,
      registered_by: profile.id,
      is_synthetic: true,
      created_at: now,
    });
    data.consents.push({
      id: uuid(),
      patient_id,
      purpose: "screening",
      granted: true,
      language: isLanguage(p.language) ? p.language : "en",
      recorded_at: now,
    });
    if (p.photo_consent === true)
      data.consents.push({
        id: uuid(),
        patient_id,
        purpose: "image_capture",
        granted: true,
        language: isLanguage(p.language) ? p.language : "en",
        recorded_at: now,
      });
    data.screenings.unshift({
      id: screening_id,
      patient_id,
      examiner_id: profile.id,
      status: "awaiting_clinician",
      examination_notes: String(p.notes ?? ""),
      ...intake,
      revision: 1,
      created_at: now,
    });
  } else if (command.action === "review") {
    requireRole(["medical_officer", "specialist"]);
    const s = getScreen();
    if (s.revision !== Number(p.revision))
      throw new Error("This record changed. Refresh before reviewing.");
    if (
      p.decision === "close" &&
      closureBlockers(data, s.patient_id).filter(
        (reason) => reason !== "review",
      ).length
    )
      throw new Error("Resolve outstanding care before closing this case.");
    if (
      p.decision === "follow_up" &&
      (!p.followup_at ||
        !Number.isFinite(Date.parse(String(p.followup_at))) ||
        Date.parse(String(p.followup_at)) <= Date.parse(now))
    )
      throw new Error("Choose a future follow-up date.");
    if (
      !String(p.findings ?? "").trim() ||
      !["refer", "follow_up", "close"].includes(String(p.decision))
    )
      throw new Error("Enter findings and a valid decision.");
    const review_id = uuid();
    data.clinical_reviews.unshift({
      id: review_id,
      patient_id: s.patient_id,
      screening_id: s.id,
      findings: String(p.findings),
      clinical_decision: String(p.decision),
      signed_at: now,
    });
    s.status =
      p.decision === "refer"
        ? "referral_planned"
        : p.decision === "close"
          ? "closed"
          : "reviewed";
    s.revision++;
    if (p.decision === "follow_up")
      data.navigation_tasks.unshift({
        id: uuid(),
        patient_id: s.patient_id,
        referral_id: null,
        owner_id: demoProfiles[3].id,
        task_type: "follow_up",
        status: "pending",
        due_at: new Date(String(p.followup_at)).toISOString(),
        created_at: now,
      });
    if (p.decision === "refer") {
      const referral_id = uuid();
      data.referrals.unshift({
        id: referral_id,
        patient_id: s.patient_id,
        review_id,
        destination_facility_id: id("1", 2),
        specialty: "Oral medicine",
        priority: String(p.priority ?? "routine"),
        status: "planned",
        created_at: now,
      });
      data.navigation_tasks.unshift({
        id: uuid(),
        patient_id: s.patient_id,
        referral_id,
        owner_id: demoProfiles[3].id,
        task_type: "follow_up",
        status: "pending",
        due_at: new Date(Date.parse(now) + 86400000).toISOString(),
        created_at: now,
      });
    }
  } else if (command.action === "appoint") {
    requireRole(["medical_officer", "specialist", "navigator"]);
    const r = data.referrals.find((r) => r.id === p.referral_id);
    if (!r) throw new Error("Referral not found.");
    const date = new Date(String(p.starts_at));
    if (Number.isNaN(+date))
      throw new Error("Select a valid appointment date.");
    if (!["in_person", "video"].includes(String(p.mode)))
      throw new Error("Select an appointment mode.");
    checkBooking(data, demoProfiles[2].id, r.id, date.toISOString(), now);
    data.appointments.unshift({
      id: uuid(),
      patient_id: r.patient_id,
      referral_id: r.id,
      clinician_id: demoProfiles[2].id,
      starts_at: date.toISOString(),
      ends_at: new Date(+date + 1800000).toISOString(),
      mode: String(p.mode),
      status: "confirmed",
      created_at: now,
    });
    scheduleReminder(data, data.appointments[0].id, now);
    r.status = "booked";
  } else if (command.action === "attendance") {
    requireRole(["medical_officer", "specialist", "navigator"]);
    const a = data.appointments.find((a) => a.id === p.appointment_id);
    if (!a) throw new Error("Appointment not found.");
    if (
      !["requested", "confirmed", "rescheduled"].includes(a.status) ||
      !["completed", "missed", "cancelled"].includes(String(p.status))
    )
      throw new Error("Invalid appointment transition.");
    a.status = String(p.status);
    scheduleReminder(data, a.id, now);
    if (p.status === "missed")
      data.navigation_tasks.unshift({
        id: uuid(),
        patient_id: a.patient_id,
        referral_id: a.referral_id,
        owner_id: demoProfiles[3].id,
        task_type: "missed_visit",
        status: "pending",
        due_at: now,
        created_at: now,
      });
  } else if (command.action === "diagnosis") {
    requireRole(["medical_officer", "specialist"]);
    const r = data.referrals.find((r) => r.id === p.referral_id);
    if (!r || !String(p.diagnosis ?? "").trim())
      throw new Error(
        "A referral and simulated clinician outcome are required.",
      );
    data.investigations.unshift({
      id: uuid(),
      patient_id: r.patient_id,
      referral_id: r.id,
      kind: "pathology",
      status: "reviewed",
      clinician_diagnosis: String(p.diagnosis),
      created_at: now,
    });
    const s = data.screenings.find((s) => s.patient_id === r.patient_id);
    if (s) {
      s.status = "result_reviewed";
      s.revision++;
    }
  } else if (command.action === "followup") {
    requireRole(["navigator", "medical_officer", "specialist"]);
    const task = data.navigation_tasks.find((t) => t.id === p.task_id);
    if (!task) throw new Error("Task not found.");
    if (
      task.status !== "pending" ||
      !["completed", "declined", "lost_contact"].includes(String(p.status))
    )
      throw new Error("Invalid follow-up transition.");
    task.status = String(p.status);
  } else if (command.action === "image") {
    requireRole(["health_worker", "medical_officer", "specialist"]);
    const s = getScreen();
    if (!hasConsent(data, s.patient_id, "image_capture"))
      throw new Error("Photo consent was not recorded for this screening.");
    data.images.unshift({
      id: uuid(),
      patient_id: s.patient_id,
      screening_id: s.id,
      object_key: `demo/${uuid()}`,
      quality_status:
        p.quality_status === "acceptable" ? "acceptable" : "recapture",
      preview: String(p.preview),
      quality_details: p.quality_details as Record<string, unknown>,
      oral_view: String(p.oral_view ?? "cheek"),
      created_at: now,
    });
  } else if (command.action === "delete_image") {
    requireRole(["health_worker", "medical_officer", "specialist"]);
    const idToDelete = String(p.image_id ?? p.id);
    data.images = data.images.filter((i) => i.id !== idToDelete);
    data.ai_analyses = data.ai_analyses.filter((a) => a.image_id !== idToDelete);
  } else if (command.action === "analyze") {
    requireRole(["health_worker", "medical_officer", "specialist"]);
    const image = data.images.find((i) => i.id === p.image_id);
    if (!image || image.quality_status !== "acceptable")
      throw new Error("An acceptable image is required.");
    if (!hasConsent(data, image.patient_id, "image_capture"))
      throw new Error("Current photo consent is required.");
    data.ai_analyses.unshift({
      id: uuid(),
      image_id: image.id,
      provider: "mock",
      model_version: "mock-v1",
      research_label: "demo_review_required",
      score: null,
      status: "completed",
      clinical_use: false,
      requires_clinician_review: true,
      created_at: now,
    });
  }
  return syncStages(data);
}
