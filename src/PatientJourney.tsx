import { localize } from "./lib/localize";
import { localeForLanguage } from "./lib/languages";
import { useState } from "react";
import { ArrowRight, Check, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Badge, Field, useApp } from "./App";
import { AppointmentTools } from "./CarePanels";
import { isCloud, isClinical } from "./lib/client";
import {
  caseRecords,
  closureBlockers,
  patientJourney,
  stages,
  type JourneyTarget,
  type StepState,
} from "./lib/journey";
import { statusLabel } from "./lib/i18n";
import type { Patient } from "./lib/types";

const titles: Record<string, [string, string]> = {
  registration: ["Register patient", "రోగి నమోదు"],
  photos: ["Take oral photos", "నోటి చిత్రాలు"],
  quality: ["Image quality check", "చిత్ర నాణ్యత"],
  analysis: ["Image analysis (optional)", "చిత్ర విశ్లేషణ (ఐచ్ఛికం)"],
  review: ["Officer review / referral", "వైద్య సమీక్ష / సిఫార్సు"],
  consultation: ["Consultation", "సంప్రదింపు"],
  diagnostics: ["Biopsy / histopathology", "బయాప్సీ / పాథాలజీ"],
  treatment: ["Treatment tracking", "చికిత్స పురోగతి"],
  dashboard: ["District dashboard", "జిల్లా డాష్‌బోర్డ్"],
};
const stateLabels: Record<StepState, [string, string]> = {
  complete: ["Complete", "పూర్తయింది"],
  pending: ["Pending", "పెండింగ్"],
  attention: ["Needs attention", "శ్రద్ధ అవసరం"],
  optional: ["Optional", "ఐచ్ఛికం"],
  not_required: ["Not required", "అవసరం లేదు"],
  unavailable: ["Not connected", "అనుసంధానం లేదు"],
  restricted: ["Care team only", "వైద్య బృందం మాత్రమే"],
  recorded: ["Recorded", "నమోదైంది"],
  scheduled: ["Scheduled", "నిర్ణయించారు"],
};
const reasons: Record<string, [string, string]> = {
  review: ["Sign the clinician review.", "వైద్య సమీక్షపై సంతకం చేయండి."],
  appointments: [
    "Resolve scheduled appointments.",
    "అపాయింట్‌మెంట్‌లను పూర్తి చేయండి.",
  ],
  investigations: [
    "Review outstanding investigation results.",
    "పరీక్ష ఫలితాలను సమీక్షించండి.",
  ],
  treatments: [
    "Complete or stop active treatment plans.",
    "చికిత్స ప్రణాళికలను పూర్తి చేయండి లేదా నిలిపివేయండి.",
  ],
  followups: [
    "Resolve pending follow-up tasks.",
    "పెండింగ్ ఫాలో అప్ పనులను పూర్తి చేయండి.",
  ],
  diagnostic_decision: [
    "Record whether diagnostics are required.",
    "పరీక్షలు అవసరమా అనే నిర్ణయాన్ని నమోదు చేయండి.",
  ],
  treatment_decision: [
    "Record whether treatment is required.",
    "చికిత్స అవసరమా అనే నిర్ణయాన్ని నమోదు చేయండి.",
  ],
};

export function GuidedJourney({
  patient,
  onNavigate,
}: {
  patient: Patient;
  onNavigate: (target: JourneyTarget) => void;
}) {
  const { w, lang } = useApp(),
    clinical = ["medical_officer", "specialist"].includes(w.profile!.role);
  const steps = patientJourney(
      w.data,
      patient.id,
      w.profile!.role,
      isCloud,
      w.services.ai,
    ).filter((step) => !isClinical || step.id !== "analysis"),
    c = caseRecords(w.data, patient.id);
  const next = steps.find(
    (s) =>
      ["pending", "attention"].includes(s.state) &&
      s.state !== "restricted" &&
      (s.target !== "care" || clinical),
  );
  return (
    <section
      className="panel patient-journey"
      aria-label={localize(
        lang,
        "Patient care journey",
        "రోగి సంరక్షణ ప్రయాణం",
      )}
    >
      <div className="journey-heading">
        <div>
          <span className="eyebrow">
            {localize(lang, "CORE PATIENT WORKFLOW", "ప్రధాన రోగి ప్రక్రియ")}
          </span>
          <h2>
            {localize(
              lang,
              "From registration to continuing care",
              "నమోదు నుండి తదుపరి సంరక్షణ వరకు",
            )}
          </h2>
        </div>
        {c.screening && <Badge status={c.screening.status} />}
      </div>
      <ol className="journey-grid">
        {steps.map((step, i) => (
          <li key={step.id} data-step={step.id} data-state={step.state}>
            <button
              className={`journey-step state-${step.state}`}
              disabled={step.state === "restricted"}
              onClick={() => onNavigate(step.target)}
            >
              <span className="journey-number">
                {step.state === "complete" ? <Check size={16} /> : i + 1}
              </span>
              <strong>
                {localize(lang, titles[step.id][0], titles[step.id][1])}
              </strong>
              <span className="journey-state">
                {step.id === "analysis" && step.state === "recorded"
                  ? localize(
                      lang,
                      "AI assessment recorded",
                      "AI పరిశీలనలు నమోదయ్యాయి",
                    )
                  : localize(
                      lang,
                      stateLabels[step.state][0],
                      stateLabels[step.state][1],
                    )}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="journey-next">
        <p>
          {c.screening?.status === "closed"
            ? localize(
                lang,
                "Case closed. The complete history is retained.",
                "కేసు ముగిసింది. చరిత్ర భద్రపరచబడింది.",
              )
            : localize(
                lang,
                "AI is optional and does not block clinician review. The clinician records whether diagnostics and treatment are needed.",
                "AI ఐచ్ఛికం. వైద్య సమీక్షను కొనసాగించవచ్చు. అవసరాన్ని బట్టి పరీక్షలు, చికిత్సను వైద్యుడు నిర్ణయిస్తారు.",
              )}
        </p>
        {next && c.screening?.status !== "closed" && (
          <button
            className="button secondary"
            onClick={() => onNavigate(next.target)}
          >
            {localize(lang, "Next action", "తదుపరి చర్య")}:{" "}
            {localize(lang, titles[next.id][0], titles[next.id][1])}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

export function CaseDecisions({ patient }: { patient: Patient }) {
  const { w, lang, run } = useApp(),
    l = (en: string, te: string) => localize(lang, en, te);
  const c = caseRecords(w.data, patient.id),
    closed = c.screening?.status === "closed",
    blockers = closureBlockers(w.data, patient.id);
  const [category, setCategory] = useState("diagnostics"),
    [decision, setDecision] = useState("required"),
    [notes, setNotes] = useState("");
  if (!["medical_officer", "specialist"].includes(w.profile?.role || ""))
    return null;
  return (
    <section className="panel care-panel case-decisions">
      <h2>
        <ShieldCheck size={20} />{" "}
        {l(
          "Clinical decisions & case closure",
          "వైద్య నిర్ణయాలు మరియు కేసు ముగింపు",
        )}
      </h2>
      <p className="small muted">
        {l(
          "Use a signed rationale to record optional care or close a resolved case. Previous decisions remain in the history.",
          "ఐచ్ఛిక సంరక్షణ లేదా కేసు ముగింపుకు కారణాన్ని నమోదు చేయండి. పాత నిర్ణయాలు చరిత్రలో ఉంటాయి.",
        )}
      </p>
      {!closed && blockers.length > 0 && (
        <div className="closure-checklist">
          <strong>{l("Before closing this case", "కేసు ముగించే ముందు")}</strong>
          <ul>
            {blockers.map((reason) => (
              <li key={reason}>
                {localize(lang, reasons[reason][0], reasons[reason][1])}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        className="review-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(() =>
              w.execute("care_decision", {
                patient_id: patient.id,
                revision: c.screening?.revision,
                category: closed ? "case" : category,
                decision: closed ? "reopen" : decision,
                notes,
              }),
            )
          ) {
            setNotes("");
            setCategory("diagnostics");
            setDecision("required");
          }
        }}
      >
        {!closed && (
          <div className="care-grid">
            <Field label={l("Decision area", "నిర్ణయ విభాగం")}>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setDecision(e.target.value === "case" ? "close" : "required");
                }}
              >
                <option value="diagnostics">
                  {l("Diagnostics", "పరీక్షలు")}
                </option>
                <option value="treatment">{l("Treatment", "చికిత్స")}</option>
                <option value="case">
                  {l("Case closure", "కేసు ముగింపు")}
                </option>
              </select>
            </Field>
            <Field label={l("Care decision", "సంరక్షణ నిర్ణయం")}>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                {category === "case" ? (
                  <option value="close">
                    {l("Close case", "కేసు ముగించు")}
                  </option>
                ) : (
                  <>
                    <option value="required">{l("Required", "అవసరం")}</option>
                    <option value="not_required">
                      {l("Not required", "అవసరం లేదు")}
                    </option>
                  </>
                )}
              </select>
            </Field>
          </div>
        )}
        <Field label={l("Clinical rationale", "వైద్య కారణం")}>
          <textarea
            required
            maxLength={5000}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <button
          className="button primary"
          disabled={
            w.busy ||
            !c.reviews.length ||
            (!closed && category === "case" && blockers.length > 0)
          }
        >
          {closed
            ? l("Reopen case", "కేసు మళ్లీ తెరవండి")
            : category === "case"
              ? l("Close case", "కేసు ముగించు")
              : l("Record clinical decision", "వైద్య నిర్ణయం నమోదు")}
        </button>
      </form>
      {c.decisions.map((d) => (
        <article className="review-card" key={d.id}>
          <strong>
            {d.category === "case"
              ? l("Case decision", "కేసు నిర్ణయం")
              : d.category === "diagnostics"
                ? l("Diagnostic decision", "పరీక్ష నిర్ణయం")
                : l("Treatment decision", "చికిత్స నిర్ణయం")}{" "}
            · {d.decision.replaceAll("_", " ")}
          </strong>
          <p>{d.notes}</p>
          <small>
            {new Date(d.created_at).toLocaleString(localeForLanguage(lang), {
              timeZone: "Asia/Kolkata",
            })}{" "}
            {localize(lang, "IST")}
          </small>
        </article>
      ))}
    </section>
  );
}

export function PatientAppointments({
  patient,
  onBook,
}: {
  patient: Patient;
  onBook: () => void;
}) {
  const { w, run, lang } = useApp(),
    l = (en: string, te: string) => localize(lang, en, te),
    c = caseRecords(w.data, patient.id),
    canEdit = ["medical_officer", "specialist", "navigator"].includes(
      w.profile!.role,
    );
  return (
    <div className="care-workspace">
      <div className="section-intro">
        <h2>{l("Consultations & follow-up", "సంప్రదింపులు మరియు ఫాలో అప్")}</h2>
        <p className="muted">
          {l(
            "Book an in-person or video appointment, record attendance and resolve the patient's follow-up tasks.",
            "ప్రత్యక్ష లేదా వీడియో అపాయింట్‌మెంట్, హాజరు మరియు ఫాలో అప్ పనులను నమోదు చేయండి.",
          )}
        </p>
        {canEdit &&
          c.referrals.length > 0 &&
          c.screening?.status !== "closed" && (
            <button className="button primary" onClick={onBook}>
              {l("Book appointment", "అపాయింట్‌మెంట్ బుక్ చేయండి")}
            </button>
          )}
      </div>
      {!c.referrals.length && (
        <p className="form-notice">
          {l(
            "The clinician must sign a referral before booking specialist care.",
            "నిపుణుడి అపాయింట్‌మెంట్‌కు ముందు వైద్య సిఫార్సు అవసరం.",
          )}
        </p>
      )}
      {c.appointments.map((a) => (
        <article key={a.id} className="review-card">
          <Badge status={a.status} />
          <h3>
            {a.mode === "video"
              ? l("Video consultation", "వీడియో సంప్రదింపు")
              : l("In-person consultation", "ప్రత్యక్ష సంప్రదింపు")}
          </h3>
          <p>
            {new Date(a.starts_at).toLocaleString(localeForLanguage(lang), {
              timeZone: "Asia/Kolkata",
            })}{" "}
            {localize(lang, "IST")}
          </p>
          {a.mode === "video" && (!isCloud || !w.services.video) && (
            <p className="small muted">
              {l(
                "Video provider not connected. In-person appointments remain available.",
                "వీడియో సేవ అనుసంధానం కాలేదు. ప్రత్యక్ష అపాయింట్‌మెంట్‌లు అందుబాటులో ఉన్నాయి.",
              )}
            </p>
          )}
          {canEdit &&
            ["confirmed", "requested", "rescheduled"].includes(a.status) && (
              <div className="care-actions">
                <button
                  className="button secondary"
                  disabled={w.busy}
                  onClick={() =>
                    void run(() =>
                      w.execute("attendance", {
                        appointment_id: a.id,
                        status: "completed",
                      }),
                    )
                  }
                >
                  {l("Mark attended", "హాజరు నమోదు చేయండి")}
                </button>
                <button
                  className="button subtle"
                  disabled={w.busy}
                  onClick={() =>
                    void run(() =>
                      w.execute("attendance", {
                        appointment_id: a.id,
                        status: "missed",
                      }),
                    )
                  }
                >
                  {l("Mark missed", "హాజరుకాలేదని నమోదు చేయండి")}
                </button>
              </div>
            )}
          <AppointmentTools appointment={a} />
        </article>
      ))}
      <h3>{l("Patient follow-up tasks", "రోగి ఫాలో అప్ పనులు")}</h3>
      {c.tasks.length === 0 && (
        <p className="muted">
          {l("No follow-up tasks recorded.", "ఫాలో అప్ పనులు లేవు.")}
        </p>
      )}
      {c.tasks.map((task) => (
        <article className="review-card" key={task.id}>
          <Badge status={task.status} />
          <h4>{statusLabel(task.task_type, lang)}</h4>
          <p>
            {new Date(task.due_at).toLocaleString(localeForLanguage(lang), {
              timeZone: "Asia/Kolkata",
            })}{" "}
            {localize(lang, "IST")}
          </p>
          {canEdit && task.status === "pending" && (
            <div className="care-actions">
              {["completed", "declined", "lost_contact"].map((status) => (
                <button
                  className="button subtle"
                  key={status}
                  disabled={w.busy}
                  onClick={() =>
                    void run(() =>
                      w.execute("followup", { task_id: task.id, status }),
                    )
                  }
                >
                  {status === "completed"
                    ? l("Complete follow-up", "ఫాలో అప్ పూర్తి చేయండి")
                    : statusLabel(status, lang)}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function JourneyMetrics() {
  const { w, lang } = useApp();
  return (
    <section className="panel care-panel">
      <h2>
        <ClipboardCheck size={20} />{" "}
        {localize(lang, "Patient workflow stages", "రోగుల సంరక్షణ దశలు")}
      </h2>
      <p className="small muted">
        {localize(
          lang,
          "Current stages derived from recorded care. District totals contain no patient identifiers.",
          "నమోదైన సంరక్షణ ఆధారంగా ప్రస్తుత దశలు. గుర్తింపు వివరాలు ప్రదర్శించబడవు.",
        )}
      </p>
      <div className="stage-distribution">
        {stages.map((stage) => (
          <div className="stage-row" key={stage}>
            <span>{statusLabel(stage, lang)}</span>
            <div className="stage-track">
              <span
                style={{
                  width: `${Math.min(100, (100 * (w.summary.stage_counts?.[stage] || 0)) / Math.max(1, w.summary.screenings))}%`,
                }}
              />
            </div>
            <strong>{w.summary.stage_counts?.[stage] || 0}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
