export type Role =
  | "health_worker"
  | "medical_officer"
  | "specialist"
  | "navigator"
  | "district_admin";
import type { Language } from "./languages";
export type { Language } from "./languages";
export type Page =
  | "overview"
  | "patients"
  | "screenings"
  | "appointments"
  | "followups"
  | "reports"
  | "settings";
export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  facility_id: string;
  active: boolean;
}
export interface Patient {
  id: string;
  display_name: string;
  age_years: number;
  village: string;
  mandal?: string | null;
  habitation?: string | null;
  subcenter?: string | null;
  abha_id?: string | null;
  aadhaar_last4?: string | null;
  contact_phone?: string | null;
  preferred_language: Language;
  facility_id: string;
  registered_by: string;
  is_synthetic: boolean;
  created_at: string;
}
export interface Screening {
  id: string;
  patient_id: string;
  examiner_id: string;
  status: string;
  examination_notes: string;
  symptoms: Record<string, unknown>;
  tobacco_history: Record<string, unknown>;
  revision: number;
  created_at: string;
}
export interface Consent {
  id: string;
  patient_id: string;
  purpose: string;
  granted: boolean;
  language?: Language;
  recorded_at: string;
}
export interface OralImage {
  pending_sync?: boolean;
  id: string;
  patient_id: string;
  screening_id: string;
  quality_status: "acceptable" | "recapture" | "pending";
  object_key: string;
  created_at: string;
  preview?: string;
  quality_details?: {
    sharpness?: number;
    brightness?: number;
    glare_percent?: number;
    method?: string;
    medgemma?: import("./image-quality").MedGemmaQualityAssessment;
    [key: string]: unknown;
  };
  oral_view?: string;
}
export interface Analysis {
  id: string;
  image_id: string;
  provider: string;
  model_version: string;
  research_label: string;
  score?: number | null;
  findings?: {
    engine: "gemini" | "medgemma" | "clinical";
    language?: Language;
    prompt_version: string;
    image_kind: "oral_photo" | "not_oral_photo" | "uncertain";
    oral_assessment?:
      "no_visible_abnormality" | "visible_changes" | "not_assessable";
    summary: string;
    visible_findings: string[];
    possible_conditions: { name: string; visual_basis: string }[];
    limitations: string[];
  } | null;
  status: string;
  clinical_use: false;
  requires_clinician_review: true;
  created_at: string;
}
export interface Review {
  id: string;
  patient_id: string;
  screening_id: string;
  findings: string;
  clinical_decision: string;
  signed_at: string;
}
export interface Referral {
  id: string;
  patient_id: string;
  review_id: string;
  destination_facility_id: string;
  priority: string;
  specialty: string;
  status: string;
  created_at: string;
}
export interface Appointment {
  id: string;
  patient_id: string;
  referral_id: string;
  clinician_id: string;
  starts_at: string;
  ends_at: string;
  mode: string;
  status: string;
  created_at: string;
}
export interface Investigation {
  id: string;
  patient_id: string;
  referral_id: string;
  clinician_diagnosis: string;
  status: string;
  kind: string;
  created_at: string;
}
export interface Treatment {
  id: string;
  patient_id: string;
  referral_id: string;
  clinician_id: string;
  plan: string;
  status: "planned" | "active" | "completed" | "stopped";
  next_review_at: string | null;
  revision: number;
  created_at: string;
}
export interface TreatmentEvent {
  id: string;
  patient_id: string;
  treatment_id: string;
  notes: string;
  status: Treatment["status"];
  created_at: string;
}
export interface PatientDocument {
  id: string;
  patient_id: string;
  investigation_id: string | null;
  name: string;
  mime_type: string;
  object_key: string;
  size_bytes: number;
  created_at: string;
  preview?: string;
}
export interface OutreachEvent {
  id: string;
  facility_id: string;
  village: string;
  held_on: string;
  attendees: number;
  screened: number;
  created_at: string;
}
export interface AppointmentReminder {
  id: string;
  patient_id: string;
  appointment_id: string;
  due_at: string;
  status: "pending" | "sent" | "acknowledged" | "cancelled" | "failed";
  attempts: number;
  created_at: string;
}
export interface NavigationTask {
  id: string;
  patient_id: string;
  referral_id: string | null;
  owner_id: string;
  task_type: string;
  due_at: string;
  status: string;
  created_at: string;
}
export interface CareDecision {
  id: string;
  patient_id: string;
  screening_id: string;
  clinician_id: string;
  category: "diagnostics" | "treatment" | "case";
  decision: "required" | "not_required" | "close" | "reopen";
  notes: string;
  created_at: string;
}
export interface DataSet {
  care_decisions: CareDecision[];
  patients: Patient[];
  screenings: Screening[];
  consents: Consent[];
  images: OralImage[];
  ai_analyses: Analysis[];
  clinical_reviews: Review[];
  referrals: Referral[];
  appointments: Appointment[];
  investigations: Investigation[];
  navigation_tasks: NavigationTask[];
  treatments: Treatment[];
  treatment_events: TreatmentEvent[];
  patient_documents: PatientDocument[];
  outreach_events: OutreachEvent[];
  appointment_reminders: AppointmentReminder[];
  facilities: {
    id: string;
    name: string;
    district: string;
    facility_type: string;
  }[];
}
export interface Summary {
  stage_counts: Record<string, number>;
  completed_cases: number;
  patients: number;
  screenings: number;
  referrals: number;
  missed_appointments: number;
  pending_follow_ups: number;
  completed_follow_ups: number;
  total_follow_ups: number;
  follow_up_completion_rate: number;
  outreach_events: number;
  outreach_attendees: number;
  outreach_screened: number;
  active_treatments: number;
}
export interface Command {
  id: string;
  actor: string;
  action:
    | "register"
    | "review"
    | "appoint"
    | "attendance"
    | "diagnosis"
    | "followup"
    | "image"
    | "delete_image"
    | "analyze"
    | "reschedule"
    | "treatment"
    | "treatment_update"
    | "investigation"
    | "document"
    | "outreach"
    | "consent"
    | "reminder"
    | "care_decision";
  payload: Record<string, unknown>;
  created_at: string;
}
export interface Draft {
  action?: "register" | "image";
  id: string;
  actor: string;
  payload: Record<string, unknown>;
  created_at: string;
  status: "pending" | "uploading" | "failed";
  error?: string;
}
export const emptyData = (): DataSet => ({
  care_decisions: [],
  patients: [],
  screenings: [],
  consents: [],
  images: [],
  ai_analyses: [],
  clinical_reviews: [],
  referrals: [],
  appointments: [],
  investigations: [],
  navigation_tasks: [],
  treatments: [],
  treatment_events: [],
  patient_documents: [],
  outreach_events: [],
  appointment_reminders: [],
  facilities: [],
});
