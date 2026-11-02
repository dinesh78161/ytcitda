import { useEffect, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { useApp } from "./App";
import { fetchPatientRegistrationStaff, isCloud } from "./lib/client";
import { demoProfiles } from "./lib/demo";
import { localize } from "./lib/localize";
import { localeForLanguage } from "./lib/languages";
import { statusLabel } from "./lib/i18n";
import { patientReportCsv, patientReportDetails } from "./lib/patient-report";

export default function PatientReport() {
  const { w, lang, t } = useApp();
  const copy = (en: string, te: string) => localize(lang, en, te);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [staffError, setStaffError] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(isCloud);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isCloud) return;
    let active = true;
    setLoadingStaff(true);
    setStaffError(false);
    void fetchPatientRegistrationStaff()
      .then((names) => {
        if (active) setStaff(names);
      })
      .catch(() => {
        if (active) setStaffError(true);
      })
      .finally(() => {
        if (active) setLoadingStaff(false);
      });
    return () => {
      active = false;
    };
  }, [w.profile?.id, w.data.patients, attempt]);

  const missing = copy("Not recorded", "నమోదు కాలేదు");
  const title = copy("Patient report", "రోగుల నివేదిక");
  const headers = [
    copy("Name of the patient", "రోగి పేరు"),
    copy("Age", "వయస్సు"),
    copy("Habitation", "ఆవాసం"),
    copy("ASHA / ANM name", "ఆశా / ఏఎన్‌ఎం పేరు"),
    copy("Mandal", "మండలం"),
    copy("Risk level", "ప్రమాద స్థాయి"),
    copy("Date of registration", "నమోదు తేదీ"),
    copy("Mobile Number", "మొబైల్ నంబర్"),
    copy("Follow-up actions", "తదుపరి చర్యలు"),
  ];
  const date = (value: string) =>
    new Intl.DateTimeFormat(localeForLanguage(lang), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(value));
  const rows = w.data.patients.map((patient) => {
    const details = patientReportDetails(w.data, patient);
    const worker = isCloud
      ? staff[patient.id]
      : demoProfiles.find(
          (profile) =>
            profile.id === patient.registered_by &&
            profile.role === "health_worker",
        )?.display_name;
    return [
      patient.display_name,
      String(patient.age_years),
      patient.habitation?.trim() || patient.village?.trim() || missing,
      worker ||
        (loadingStaff
          ? t("loading")
          : staffError
            ? copy("Unavailable", "అందుబాటులో లేదు")
            : missing),
      patient.mandal?.trim() || missing,
      details.priority === "priority"
        ? t("priorityValue")
        : details.priority === "routine"
          ? t("routine")
          : missing,
      date(patient.created_at),
      patient.contact_phone?.trim() || missing,
      details.tasks
        .map(
          (task) =>
            `${statusLabel(task.task_type, lang)} · ${statusLabel(task.status, lang)} · ${date(task.due_at)}`,
        )
        .join("; ") ||
        copy("No follow-up actions recorded", "తదుపరి చర్యలు నమోదు కాలేదు"),
    ];
  });
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([patientReportCsv(headers, rows)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "aarogya-patient-report.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      className="panel patient-report"
      aria-labelledby="patient-report-title"
    >
      <div className="panel-heading">
        <h2 id="patient-report-title">{title}</h2>
        <button
          className="button secondary"
          onClick={download}
          disabled={!rows.length || loadingStaff || staffError}
        >
          <ArrowDownToLine size={18} />
          {copy("Export patient report CSV", "రోగుల నివేదిక CSV ఎగుమతి")}
        </button>
      </div>
      <p className="small muted patient-report-help">
        {copy(
          "ASHA / ANM name shows the registering health worker. Risk level uses the recorded referral priority for the latest screening.",
          "ఆశా / ఏఎన్‌ఎం పేరు నమోదు చేసిన ఆరోగ్య కార్యకర్తను చూపిస్తుంది. ప్రమాద స్థాయి తాజా పరీక్షలో నమోదైన సిఫార్సు ప్రాధాన్యతను ఉపయోగిస్తుంది.",
        )}
      </p>
      {staffError && (
        <p className="error-text patient-report-help" role="alert">
          {copy(
            "Staff names could not be loaded. Contact your administrator if retrying does not help.",
            "సిబ్బంది పేర్లు లోడ్ కాలేదు. మళ్లీ ప్రయత్నించినా సమస్య ఉంటే నిర్వాహకుడిని సంప్రదించండి.",
          )}{" "}
          <button
            className="text-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t("retry")}
          </button>
        </p>
      )}
      {rows.length ? (
        <div
          className="table-scroll"
          role="region"
          aria-label={title}
          tabIndex={0}
        >
          <table aria-label={title}>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th scope="col" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={w.data.patients[index].id}>
                  {row.map((value, cell) => (
                    <td key={cell}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="patient-report-help">{t("noRecords")}</p>
      )}
    </section>
  );
}
