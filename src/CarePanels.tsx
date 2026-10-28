import { useEffect, useState } from "react";
import { CalendarDays, Download, FileText, Plus, Video } from "lucide-react";
import { Badge, Field, Modal, useApp } from "./App";
import { isCloud } from "./lib/client";
import { hasConsent } from "./lib/care-workflows";
import { careApi, downloadUrl, fileDataUrl } from "./lib/services";
import { inspectImage } from "./lib/image-quality";
import { latestScreening } from "./lib/journey";
import type { Appointment, Patient } from "./lib/types";

const localDateTime = (date: string) => {
  const d = new Date(date);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
function useWords() {
  const { lang } = useApp();
  return (en: string, te: string) => (lang === "te" ? te : en);
}

export function ConsentPanel({ patient }: { patient: Patient }) {
  const { w, run, lang } = useApp(),
    l = useWords();
  return (
    <section className="panel detail-card">
      <h3>{l("Patient consent", "రోగి సమ్మతి")}</h3>
      <p className="small muted">
        {l(
          "Record the patient's decision. Every change is retained in the consent history.",
          "రోగి నిర్ణయాన్ని నమోదు చేయండి. ప్రతి మార్పు చరిత్రలో ఉంటుంది.",
        )}
      </p>
      {[
        ["screening", l("Screening and records", "పరీక్షలు మరియు రికార్డులు")],
        ["image_capture", l("Oral photographs", "నోటి చిత్రాలు")],
        ["teleconsultation", l("Video consultation", "వీడియో సంప్రదింపు")],
      ].map(([purpose, label]) => {
        const granted = hasConsent(w.data, patient.id, purpose);
        return (
          <div className="consent-row" key={purpose}>
            <span>
              {label}
              <small>
                {granted
                  ? l("Granted", "అంగీకరించారు")
                  : l("Not granted", "అంగీకారం లేదు")}
              </small>
            </span>
            <button
              className="button subtle"
              disabled={w.busy}
              onClick={() =>
                void run(() =>
                  w.execute("consent", {
                    patient_id: patient.id,
                    purpose,
                    granted: !granted,
                    language: lang,
                  }),
                )
              }
            >
              {granted
                ? l("Withdraw", "ఉపసంహరించు")
                : l("Record consent", "సమ్మతి నమోదు")}
            </button>
          </div>
        );
      })}
    </section>
  );
}

export function PatientCare({ patient }: { patient: Patient }) {
  const { w, run } = useApp(),
    l = useWords();
  const referrals = w.data.referrals.filter((r) => r.patient_id === patient.id),
    treatments = w.data.treatments.filter((t) => t.patient_id === patient.id),
    investigations = w.data.investigations.filter(
      (i) => i.patient_id === patient.id,
    );
  const [referral, setReferral] = useState(referrals[0]?.id || ""),
    [treatmentId, setTreatmentId] = useState(""),
    [plan, setPlan] = useState(""),
    [notes, setNotes] = useState(""),
    [status, setStatus] = useState("planned"),
    [reviewAt, setReviewAt] = useState("");
  const [investigationId, setInvestigationId] = useState(""),
    [kind, setKind] = useState("biopsy"),
    [stage, setStage] = useState("requested"),
    [result, setResult] = useState(""),
    [fileBusy, setFileBusy] = useState(false);
  const selectedTreatment = treatments.find((t) => t.id === treatmentId),
    selectedInvestigation = investigations.find(
      (i) => i.id === investigationId,
    );
  const reportConsent = hasConsent(w.data, patient.id, "screening");
  const closed = latestScreening(w.data, patient.id)?.status === "closed";
  async function upload(file?: File) {
    if (!file) return;
    setFileBusy(true);
    await run(async () => {
      let preview: string, mime_type: string;
      if (file.type === "application/pdf") {
        preview = await fileDataUrl(file);
        const { PDFDocument } = await import("pdf-lib");
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        if (pdf.getPageCount() < 1 || pdf.getPageCount() > 100)
          throw new Error("Use a PDF with 1–100 pages.");
        mime_type = "application/pdf";
      } else {
        preview = (await inspectImage(file)).preview;
        mime_type = "image/jpeg";
      }
      await w.execute("document", {
        patient_id: patient.id,
        investigation_id: investigationId || null,
        name: file.name,
        mime_type,
        preview,
        size_bytes: Math.floor((preview.split(",")[1].length * 3) / 4),
      });
    });
    setFileBusy(false);
  }
  return (
    <div className="care-workspace">
      {closed && (
        <p className="form-notice">
          {l(
            "This case is closed. Reopen it below before changing the care plan.",
            "ఈ కేసు ముగిసింది. చికిత్స ప్రణాళిక మార్చడానికి కేసు మళ్లీ తెరవండి.",
          )}
        </p>
      )}
      <div className="section-intro">
        <span className="eyebrow">
          {l("CONTINUITY OF CARE", "నిరంతర సంరక్షణ")}
        </span>
        <h2>{l("Diagnostics & treatment", "పరీక్షలు మరియు చికిత్స")}</h2>
        <p className="muted">
          {l(
            "Track investigations, attach reports and record the care team's treatment plan.",
            "పరీక్షలు, నివేదికలు మరియు వైద్య బృందం చికిత్స ప్రణాళికను నమోదు చేయండి.",
          )}
        </p>
      </div>
      {referrals.length > 0 ? (
        <>
          <Field
            label={l("Referral for new records", "కొత్త రికార్డులకు సిఫార్సు")}
          >
            <select
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
            >
              {referrals.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.specialty} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("en-IN")} ·{" "}
                  {r.status}
                </option>
              ))}
            </select>
          </Field>
          <form
            className="review-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(() =>
                  w.execute("investigation", {
                    referral_id: selectedInvestigation?.referral_id || referral,
                    investigation_id: investigationId || null,
                    previous_status: selectedInvestigation?.status,
                    kind,
                    status: stage,
                    notes: result,
                  }),
                )
              ) {
                setInvestigationId("");
                setStage("requested");
                setResult("");
              }
            }}
          >
            <h3>{l("Investigation tracker", "పరీక్షల పురోగతి")}</h3>
            <Field label={l("Investigation record", "పరీక్ష రికార్డు")}>
              <select
                value={investigationId}
                onChange={(e) => {
                  setInvestigationId(e.target.value);
                  const i = investigations.find((i) => i.id === e.target.value);
                  setKind(i?.kind || "biopsy");
                  setStage(i?.status || "requested");
                  setResult(i?.clinician_diagnosis || "");
                }}
              >
                <option value="">
                  {l("New investigation", "కొత్త పరీక్ష")}
                </option>
                {investigations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.kind} · {i.status} · {i.id.slice(-6)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="care-grid">
              <Field label={l("Investigation type", "పరీక్ష రకం")}>
                <select
                  value={kind}
                  disabled={!!investigationId}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="biopsy">{l("Biopsy", "బయాప్సీ")}</option>
                  <option value="pathology">{l("Pathology", "పాథాలజీ")}</option>
                  <option value="other">{l("Other", "ఇతర")}</option>
                </select>
              </Field>
              <Field label={l("Investigation stage", "పరీక్ష దశ")}>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  {[
                    ["requested", "Requested", "అభ్యర్థించారు"],
                    ["collected", "Sample collected", "నమూనా సేకరించారు"],
                    ["reported", "Result reported", "ఫలితం వచ్చింది"],
                    ["reviewed", "Clinician reviewed", "వైద్యుడు సమీక్షించారు"],
                  ].map(([v, en, te]) => (
                    <option key={v} value={v}>
                      {l(en, te)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label={l(
                "Investigation notes / result",
                "పరీక్ష గమనికలు / ఫలితం",
              )}
            >
              <textarea
                rows={3}
                maxLength={5000}
                value={result}
                required={["reported", "reviewed"].includes(stage)}
                onChange={(e) => setResult(e.target.value)}
              />
            </Field>
            <button
              className="button secondary"
              disabled={
                w.busy || closed || selectedInvestigation?.status === "reviewed"
              }
            >
              {l("Save investigation", "పరీక్షను సేవ్ చేయండి")}
            </button>
          </form>
          <form
            className="review-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(() =>
                  w.execute(treatmentId ? "treatment_update" : "treatment", {
                    referral_id: referral,
                    treatment_id: treatmentId,
                    revision: selectedTreatment?.revision,
                    plan,
                    notes,
                    status,
                    next_review_at: reviewAt
                      ? new Date(reviewAt).toISOString()
                      : null,
                  }),
                )
              ) {
                setNotes("");
                setPlan("");
                setTreatmentId("");
                setStatus("planned");
                setReviewAt("");
              }
            }}
          >
            <h3>
              {l("Treatment plan & progress", "చికిత్స ప్రణాళిక మరియు పురోగతి")}
            </h3>
            <Field label={l("Treatment record", "చికిత్స రికార్డు")}>
              <select
                value={treatmentId}
                onChange={(e) => {
                  setTreatmentId(e.target.value);
                  const t = treatments.find((t) => t.id === e.target.value);
                  setStatus(t?.status || "planned");
                  setPlan(t?.plan || "");
                  setReviewAt(
                    t?.next_review_at ? localDateTime(t.next_review_at) : "",
                  );
                }}
              >
                <option value="">
                  {l("New treatment plan", "కొత్త చికిత్స ప్రణాళిక")}
                </option>
                {treatments.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.plan.slice(0, 70)} · {t.status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={l("Treatment plan", "చికిత్స ప్రణాళిక")}>
              <textarea
                rows={3}
                required
                maxLength={5000}
                value={plan}
                readOnly={!!treatmentId}
                onChange={(e) => setPlan(e.target.value)}
              />
            </Field>
            <div className="care-grid">
              <Field label={l("Treatment status", "చికిత్స స్థితి")}>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {[
                    ["planned", "Planned", "ప్రణాళిక సిద్ధం"],
                    ["active", "Active", "కొనసాగుతోంది"],
                    ["completed", "Completed", "పూర్తయింది"],
                    ["stopped", "Stopped", "నిలిపివేశారు"],
                  ].map(([v, en, te]) => (
                    <option value={v} key={v}>
                      {l(en, te)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={l("Next review", "తదుపరి సమీక్ష")}>
                <input
                  type="datetime-local"
                  value={reviewAt}
                  onChange={(e) => setReviewAt(e.target.value)}
                />
              </Field>
            </div>
            <Field label={l("Progress notes", "పురోగతి గమనికలు")}>
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
                closed ||
                (!!selectedTreatment &&
                  ["completed", "stopped"].includes(selectedTreatment.status))
              }
            >
              {l("Save treatment progress", "చికిత్స పురోగతిని సేవ్ చేయండి")}
            </button>
          </form>
        </>
      ) : (
        <p className="form-notice">
          {l(
            "Sign a referral before adding investigations or treatment plans.",
            "పరీక్షలు లేదా చికిత్స ప్రణాళికలకు ముందుగా సిఫార్సు చేయండి.",
          )}
        </p>
      )}
      {treatments.map((t) => (
        <article className="review-card" key={t.id}>
          <Badge status={t.status} />
          <h3>{t.plan}</h3>
          {t.next_review_at && (
            <p className="muted">
              {l("Next review", "తదుపరి సమీక్ష")}:{" "}
              {new Date(t.next_review_at).toLocaleString("en-IN")}
            </p>
          )}
          {w.data.treatment_events
            .filter((e) => e.treatment_id === t.id)
            .map((e) => (
              <div className="treatment-event" key={e.id}>
                <small>
                  {new Date(e.created_at).toLocaleString("en-IN")} ·{" "}
                  <Badge status={e.status} />
                </small>
                <p>{e.notes}</p>
              </div>
            ))}
        </article>
      ))}
      <section className="review-form">
        <h3>{l("Diagnostic reports", "పరీక్ష నివేదికలు")}</h3>
        <p className="small muted">
          {l(
            "PDF or image, up to 10 MB. Select an investigation above to link the report.",
            "PDF లేదా చిత్రం, 10 MB వరకు. నివేదికను అనుసంధానించడానికి పైన పరీక్షను ఎంచుకోండి.",
          )}
        </p>
        {!reportConsent && (
          <p className="form-notice">
            {l(
              "Current screening consent is required to access reports.",
              "నివేదికలకు ప్రస్తుత పరీక్ష సమ్మతి అవసరం.",
            )}
          </p>
        )}
        <Field
          label={l("Attach diagnostic report", "పరీక్ష నివేదిక జోడించండి")}
        >
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            disabled={
              fileBusy ||
              closed ||
              w.busy ||
              !reportConsent ||
              (isCloud && !w.services.files)
            }
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </Field>
        {w.data.patient_documents
          .filter((d) => d.patient_id === patient.id)
          .map((d) => (
            <div className="document-row" key={d.id}>
              <FileText size={20} />
              <span>
                <strong>{d.name}</strong>
                <small>
                  {Math.ceil(d.size_bytes / 1024)} KB ·{" "}
                  {new Date(d.created_at).toLocaleDateString("en-IN")}
                </small>
              </span>
              <button
                className="button subtle"
                disabled={!reportConsent}
                onClick={() =>
                  void run(async () => {
                    if (isCloud) {
                      const r = await careApi<{ url: string }>("download", {
                        kind: "report",
                        id: d.id,
                      });
                      downloadUrl(r.url, d.name);
                    } else if (d.preview) {
                      const blob = await (await fetch(d.preview)).blob();
                      const url = URL.createObjectURL(blob);
                      downloadUrl(url, d.name);
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                  })
                }
              >
                <Download size={16} />
                {l("Download", "డౌన్‌లోడ్")}
              </button>
            </div>
          ))}
      </section>
    </div>
  );
}

export function AppointmentTools({
  appointment: a,
}: {
  appointment: Appointment;
}) {
  const { w, run } = useApp(),
    l = useWords();
  const [editing, setEditing] = useState(false),
    [starts, setStarts] = useState(localDateTime(a.starts_at)),
    [video, setVideo] = useState(""),
    [joining, setJoining] = useState(false);
  const canEdit = ["medical_officer", "specialist", "navigator"].includes(
      w.profile?.role || "",
    ),
    canJoin = ["medical_officer", "specialist", "health_worker"].includes(
      w.profile?.role || "",
    );
  async function join() {
    setJoining(true);
    await run(async () => {
      const result = await careApi<{ url: string }>("video", {
        appointment_id: a.id,
      });
      setVideo(result.url);
    });
    setJoining(false);
  }
  function calendar() {
    const stamp = (s: string) =>
      new Date(s)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aarogya Drishti//Appointments//EN",
      "BEGIN:VEVENT",
      `UID:${a.id}@aarogya.local`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(a.starts_at)}`,
      `DTEND:${stamp(a.ends_at)}`,
      "SUMMARY:Care appointment",
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Upcoming care appointment",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/calendar" }),
    );
    downloadUrl(url, "care-appointment.ics");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="care-actions">
        {canEdit &&
          ["confirmed", "requested", "rescheduled", "missed"].includes(
            a.status,
          ) && (
            <button className="button subtle" onClick={() => setEditing(true)}>
              {l("Reschedule", "సమయం మార్చండి")}
            </button>
          )}
        {canEdit &&
          ["confirmed", "requested", "rescheduled"].includes(a.status) && (
            <button
              className="button subtle"
              disabled={w.busy}
              onClick={() =>
                void run(() =>
                  w.execute("attendance", {
                    appointment_id: a.id,
                    status: "cancelled",
                  }),
                )
              }
            >
              {l("Cancel appointment", "అపాయింట్‌మెంట్ రద్దు")}
            </button>
          )}
        {["confirmed", "requested", "rescheduled"].includes(a.status) && (
          <button className="button subtle" onClick={calendar}>
            <CalendarDays size={15} />
            {l("Add to calendar", "క్యాలెండర్‌కు జోడించండి")}
          </button>
        )}
        {a.mode === "video" &&
          canJoin &&
          ["confirmed", "rescheduled"].includes(a.status) && (
            <button
              className="button secondary"
              disabled={!isCloud || !w.services.video || joining}
              onClick={() => void join()}
            >
              <Video size={16} />
              {l("Join consultation", "సంప్రదింపులో చేరండి")}
            </button>
          )}
      </div>
      {editing && (
        <Modal
          title={l("Reschedule appointment", "అపాయింట్‌మెంట్ సమయం మార్చండి")}
          onClose={() => setEditing(false)}
        >
          <form
            className="registration-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(() =>
                  w.execute("reschedule", {
                    appointment_id: a.id,
                    previous_starts_at: a.starts_at,
                    starts_at: new Date(starts).toISOString(),
                  }),
                )
              )
                setEditing(false);
            }}
          >
            <Field label={l("New date and time", "కొత్త తేదీ మరియు సమయం")}>
              <input
                type="datetime-local"
                required
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
              />
            </Field>
            <p className="small muted">
              {l(
                "The previous reminder is cancelled and a new reminder is scheduled.",
                "పాత రిమైండర్ రద్దవుతుంది. కొత్త రిమైండర్ సిద్ధమవుతుంది.",
              )}
            </p>
            <button className="button primary" disabled={w.busy}>
              {l("Save new time", "కొత్త సమయం సేవ్ చేయండి")}
            </button>
          </form>
        </Modal>
      )}
      {video && (
        <Modal
          title={l("Private consultation", "వ్యక్తిగత సంప్రదింపు")}
          onClose={() => setVideo("")}
        >
          <iframe
            className="video-room"
            src={video}
            title="Video consultation"
            allow="camera; microphone; fullscreen; speaker-selection"
            referrerPolicy="no-referrer"
          />
          <button className="button secondary" onClick={() => setVideo("")}>
            {l("Leave consultation", "సంప్రదింపు ముగించు")}
          </button>
        </Modal>
      )}
    </>
  );
}

export function RemindersPanel() {
  const { w, run } = useApp(),
    l = useWords();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const reminders = w.data.appointment_reminders
    .filter(
      (r) =>
        ["pending", "failed", "sent"].includes(r.status) &&
        w.data.appointments.some(
          (a) =>
            a.id === r.appointment_id &&
            ["confirmed", "rescheduled", "requested"].includes(a.status),
        ),
    )
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  return (
    <section className="panel care-panel">
      <h2>{l("Appointment reminders", "అపాయింట్‌మెంట్ రిమైండర్లు")}</h2>
      <p className="small muted">
        {isCloud && w.services.reminders
          ? l(
              "Automatic delivery is enabled. Sent means the delivery service accepted the reminder.",
              "ఆటోమేటిక్ పంపిణీ ప్రారంభమైంది. పంపబడింది అంటే సేవ అంగీకరించింది.",
            )
          : l(
              "Reminders appear here automatically. External delivery is not configured.",
              "రిమైండర్లు ఇక్కడ స్వయంచాలకంగా కనిపిస్తాయి. బాహ్య పంపిణీ అనుసంధానం కాలేదు.",
            )}
      </p>
      {reminders.length === 0 && (
        <p className="muted">
          {l("No pending reminders.", "పెండింగ్ రిమైండర్లు లేవు.")}
        </p>
      )}
      {reminders.map((r) => (
        <div className="document-row" key={r.id}>
          <span>
            <strong>
              {w.data.patients.find((p) => p.id === r.patient_id)?.display_name}
            </strong>
            <small>
              {Date.parse(r.due_at) <= now
                ? l("Due now", "ఇప్పుడు చేయాలి")
                : new Date(r.due_at).toLocaleString("en-IN")}{" "}
              · <Badge status={r.status} />
            </small>
          </span>
          {["medical_officer", "specialist", "navigator"].includes(
            w.profile?.role || "",
          ) && (
            <button
              className="button subtle"
              disabled={w.busy}
              onClick={() =>
                void run(() => w.execute("reminder", { reminder_id: r.id }))
              }
            >
              {l("Mark contacted", "సంప్రదించినట్లు నమోదు")}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

export function OutreachPanel() {
  const { w, run } = useApp(),
    l = useWords(),
    [village, setVillage] = useState(""),
    [held, setHeld] = useState(today()),
    [attendees, setAttendees] = useState(""),
    [screened, setScreened] = useState("");
  const s = w.summary,
    canEdit = ["health_worker", "medical_officer"].includes(
      w.profile?.role || "",
    );
  return (
    <>
      <div className="care-metrics">
        {[
          [
            `${s.follow_up_completion_rate}%`,
            l("Follow-up completion", "ఫాలో అప్ పూర్తి"),
            `${s.completed_follow_ups} / ${s.total_follow_ups}`,
          ],
          [
            String(s.outreach_events),
            l("Outreach events", "అవగాహన కార్యక్రమాలు"),
            l("Recorded events", "నమోదైన కార్యక్రమాలు"),
          ],
          [
            String(s.outreach_screened),
            l("Screened at outreach", "కార్యక్రమాల్లో పరీక్షలు"),
            `${s.outreach_attendees} ${l("attendees", "హాజరైనవారు")}`,
          ],
          [
            String(s.active_treatments),
            l("Active treatments", "కొనసాగుతున్న చికిత్సలు"),
            l("Clinician-entered plans", "వైద్యుడు నమోదు చేసిన ప్రణాళికలు"),
          ],
        ].map(([value, label, detail]) => (
          <article className="panel care-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>
      <p className="small muted">
        {l(
          "Completion rate = completed follow-up tasks / all follow-up tasks. Outreach totals count attendances, not unique patients.",
          "పూర్తి శాతం = పూర్తయిన ఫాలో అప్ పనులు / మొత్తం పనులు. కార్యక్రమ గణాంకాలు హాజరులను లెక్కిస్తాయి.",
        )}
      </p>
      {canEdit && (
        <form
          className="panel care-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(() =>
                w.execute("outreach", {
                  village,
                  held_on: held,
                  attendees: Number(attendees),
                  screened: Number(screened),
                }),
              )
            ) {
              setVillage("");
              setAttendees("");
              setScreened("");
            }
          }}
        >
          <h2>{l("Record outreach event", "అవగాహన కార్యక్రమం నమోదు")}</h2>
          <div className="care-grid">
            <Field label={l("Outreach village", "కార్యక్రమ గ్రామం")}>
              <input
                required
                maxLength={120}
                value={village}
                onChange={(e) => setVillage(e.target.value)}
              />
            </Field>
            <Field label={l("Event date", "కార్యక్రమ తేదీ")}>
              <input
                type="date"
                required
                max={today()}
                value={held}
                onChange={(e) => setHeld(e.target.value)}
              />
            </Field>
            <Field label={l("People attending", "హాజరైనవారు")}>
              <input
                type="number"
                required
                min={0}
                max={100000}
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
              />
            </Field>
            <Field label={l("People screened", "పరీక్షించినవారు")}>
              <input
                type="number"
                required
                min={0}
                max={Number(attendees) || 0}
                value={screened}
                onChange={(e) => setScreened(e.target.value)}
              />
            </Field>
          </div>
          <button className="button primary" disabled={w.busy}>
            <Plus size={16} />
            {l("Save outreach event", "కార్యక్రమం సేవ్ చేయండి")}
          </button>
        </form>
      )}
      {w.data.outreach_events.length > 0 && (
        <section className="panel care-panel">
          <h3>{l("Outreach history", "కార్యక్రమాల చరిత్ర")}</h3>
          {w.data.outreach_events.map((e) => (
            <div className="document-row" key={e.id}>
              <span>
                <strong>{e.village}</strong>
                <small>{e.held_on}</small>
              </span>
              <span>
                {e.screened} / {e.attendees} {l("screened", "పరీక్షించారు")}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

export function IntegrationStatus() {
  const { w, run } = useApp(),
    l = useWords();
  return (
    <section className="panel settings-card">
      <h2>{l("Connected services", "అనుసంధాన సేవలు")}</h2>
      <p className="small muted">
        {l(
          "Live services require cloud mode and server configuration. Demo mode stores synthetic data on this device.",
          "ప్రత్యక్ష సేవలకు క్లౌడ్ మోడ్ మరియు సర్వర్ అమరిక అవసరం. డెమో డేటా ఈ పరికరంలో ఉంటుంది.",
        )}
      </p>
      {(
        [
          ["database", "Database", "డేటాబేస్"],
          ["files", "Private files", "వ్యక్తిగత ఫైళ్లు"],
          ["video", "Video consultation", "వీడియో సంప్రదింపు"],
          ["ai", "Research screening model", "పరిశోధన పరీక్ష మోడల్"],
          ["reminders", "Reminder delivery", "రిమైండర్ పంపిణీ"],
        ] as const
      ).map(([key, en, te]) => (
        <div className="consent-row" key={key}>
          <span>{l(en, te)}</span>
          <span className="badge">
            {w.services[key]
              ? l("Configured", "అమర్చబడింది")
              : l("Not configured", "అమర్చలేదు")}
          </span>
        </div>
      ))}
      <button
        className="button secondary"
        onClick={() => void run(w.refreshServices)}
      >
        {l("Check connections", "అనుసంధానాలు తనిఖీ")}
      </button>
    </section>
  );
}
