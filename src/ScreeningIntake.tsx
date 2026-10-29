import { supportedLanguages, languageName } from "./lib/languages";
import { localize } from "./lib/localize";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Cloud,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Field, Modal, useApp } from "./App";
import { message } from "./lib/use-workspace";
import { isClinical } from "./lib/client";
import { habits, normalizeIntake, optionLabel, symptoms } from "./lib/intake";

export default function ScreeningIntake({ onClose }: { onClose: () => void }) {
  const { w, t, lang, notify } = useApp();
  const copy = (en: string, te: string) => localize(lang, en, te);
  const initial = useRef<Record<string, unknown>>({
    patient_id: crypto.randomUUID(),
    screening_id: crypto.randomUUID(),
    display_name: "",
    age_years: "",
    village: "",
    contact_phone: "",
    language: lang,
    tobacco: "never",
    habits: [],
    duration_years: "",
    frequency_per_day: "",
    discomfort: false,
    reported_symptoms: [],
    mouth_opening_mm: "",
    lymph_nodes: "not_assessed",
    notes: "",
    consent: false,
    photo_consent: false,
    intake_step: 0,
    intake_version: 1,
  });
  const [form, setForm] = useState(initial.current);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [saving, setSaving] = useState(false),
    [submitting, setSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const draft = useRef(initial.current),
    writes = useRef(Promise.resolve());
  const heading = useRef<HTMLHeadingElement>(null);
  const step = Number(form.intake_step) || 0;
  const busy = w.busy || submitting || !ready;
  const steps = [
    copy("Patient & consent", "రోగి & సమ్మతి"),
    copy("Habits & findings", "అలవాట్లు & పరిశీలనలు"),
    copy("Review & submit", "సమీక్ష & సమర్పణ"),
  ];
  useEffect(() => {
    let live = true;
    void w
      .loadForm()
      .then((saved) => {
        if (!live) return;
        draft.current = { ...initial.current, ...saved };
        draft.current.intake_step = Math.max(
          0,
          Math.min(2, Number(draft.current.intake_step) || 0),
        );
        setForm(draft.current);
        setDraftSaved(Boolean(saved));
        setReady(true);
      })
      .catch((e) => {
        if (live) {
          setError(message(e));
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (ready) heading.current?.focus();
  }, [step, ready]);
  const update = (patch: Record<string, unknown>) => {
    const next = { ...draft.current, ...patch };
    draft.current = next;
    setForm(next);
    setSaving(true);
    setDraftSaved(false);
    writes.current = writes.current
      .catch(() => {})
      .then(() => w.saveForm(next));
    const current = writes.current;
    void current
      .then(() => {
        if (current === writes.current) {
          setSaving(false);
          setDraftSaved(true);
        }
      })
      .catch((e) => {
        setError(message(e));
        setSaving(false);
      });
  };
  const change = (key: string, value: unknown) => update({ [key]: value });
  const toggle = (key: string, id: string, checked: boolean) => {
    const values = Array.isArray(form[key]) ? (form[key] as string[]) : [];
    change(key, checked ? [...values, id] : values.filter((v) => v !== id));
  };
  const close = async () => {
    if (submitting || w.busy) return;
    try {
      await writes.current;
      onClose();
    } catch (e) {
      setError(message(e));
    }
  };
  const normalize = (value: unknown) =>
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
  const duplicates = w.data.patients.filter(
    (p) =>
      normalize(form.display_name).length > 1 &&
      normalize(p.display_name) === normalize(form.display_name) &&
      (normalize(p.village) === normalize(form.village) ||
        p.age_years === Number(form.age_years)),
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (step < 2) {
      try {
        if (step === 1) normalizeIntake(form);
        update({ intake_step: step + 1 });
      } catch (e) {
        setError(message(e));
      }
      return;
    }
    if (
      !String(form.display_name).trim() ||
      !String(form.village).trim() ||
      form.age_years === "" ||
      form.consent !== true
    ) {
      update({ intake_step: 0 });
      return;
    }
    setSubmitting(true);
    try {
      normalizeIntake(form);
      await writes.current;
      const state = await w.execute("register", {
        ...form,
        age_years: Number(form.age_years),
      });
      await w.saveForm(null);
      notify(t(state === "queued" ? "draftQueued" : "saved"));
      onClose();
    } catch (e) {
      setError(message(e));
      setSubmitting(false);
    }
  };
  const checklist = (
    key: string,
    options: readonly (readonly [string, string, string])[],
  ) => (
    <div className="intake-checklist">
      {options.map((option) => (
        <label
          className={`intake-option ${(form[key] as string[]).includes(option[0]) ? "is-selected" : ""}`}
          key={option[0]}
        >
          <input
            type="checkbox"
            checked={(form[key] as string[]).includes(option[0])}
            onChange={(e) => toggle(key, option[0], e.target.checked)}
          />
          <span>{optionLabel(option, lang)}</span>
        </label>
      ))}
    </div>
  );
  return (
    <Modal title={t("newPatient")} onClose={close}>
      <form
        onSubmit={submit}
        className="registration-form guided-intake"
        aria-busy={busy}
      >
        <ol
          className="intake-progress"
          aria-label={copy("Screening progress", "పరీక్ష పురోగతి")}
        >
          {steps.map((label, i) => (
            <li
              key={label}
              aria-current={step === i ? "step" : undefined}
              className={step === i ? "current" : step > i ? "complete" : ""}
            >
              <button
                type="button"
                disabled={i >= step || busy}
                onClick={() => update({ intake_step: i })}
              >
                <span>{step > i ? <Check size={15} /> : i + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <h3 className="intake-title" ref={heading} tabIndex={-1}>
          {copy("Step {n}:", "దశ {n}:").replace("{n}", String(step + 1))}{" "}
          {steps[step]}
        </h3>
        {!ready ? (
          <p className="muted">{t("loading")}</p>
        ) : (
          <fieldset className="intake-step" disabled={busy}>
            {step === 0 && (
              <>
                <div className="form-notice">
                  <ShieldCheck size={18} />
                  {t("consentHelp")}
                </div>
                <div className="form-grid">
                  <Field label={localize(lang, "Full name", "పూర్తి పేరు")}>
                    <input
                      required
                      maxLength={120}
                      autoComplete="off"
                      value={String(form.display_name)}
                      onChange={(e) => change("display_name", e.target.value)}
                    />
                  </Field>
                  <Field label={t("age")}>
                    <input
                      type="number"
                      required
                      min="0"
                      max="120"
                      step="1"
                      value={String(form.age_years)}
                      onChange={(e) => change("age_years", e.target.value)}
                    />
                  </Field>
                  <Field label={t("village")}>
                    <input
                      required
                      maxLength={120}
                      value={String(form.village)}
                      onChange={(e) => change("village", e.target.value)}
                    />
                  </Field>
                  <Field label={t("phone")}>
                    <input
                      type="tel"
                      maxLength={20}
                      value={String(form.contact_phone)}
                      onChange={(e) => change("contact_phone", e.target.value)}
                    />
                  </Field>
                  <Field label={t("language")}>
                    <select
                      aria-label={t("language")}
                      value={String(form.language)}
                      onChange={(e) => change("language", e.target.value)}
                    >
                      {supportedLanguages.map((item) => (
                        <option
                          key={item.code}
                          value={item.code}
                          lang={item.code}
                        >
                          {item.nativeName}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {duplicates.length > 0 && (
                  <div className="form-notice" role="status">
                    {t("duplicateWarning")}{" "}
                    {duplicates
                      .map(
                        (p) =>
                          `${p.display_name} (AD-${p.id.slice(-6).toUpperCase()})`,
                      )
                      .join(", ")}
                  </div>
                )}
                <div className="consent-box">
                  <label className="check-field">
                    <input
                      type="checkbox"
                      required
                      checked={Boolean(form.consent)}
                      onChange={(e) => change("consent", e.target.checked)}
                    />
                    {t("consent")}
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={Boolean(form.photo_consent)}
                      onChange={(e) =>
                        change("photo_consent", e.target.checked)
                      }
                    />
                    {t("photoConsent")}
                  </label>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <p className="muted intake-help">
                  {copy(
                    "Record reported habits and observed findings. Leave measurements blank when not assessed.",
                    "నివేదించిన అలవాట్లు, పరిశీలనలు నమోదు చేయండి. కొలవకపోతే ఖాళీగా ఉంచండి.",
                  )}
                </p>
                <fieldset className="intake-group">
                  <legend>
                    {copy(
                      "Habit & substance checklist",
                      "అలవాట్లు & పదార్థాల జాబితా",
                    )}
                  </legend>
                  {checklist("habits", habits)}
                </fieldset>
                <div className="form-grid intake-measurements">
                  <Field label={t("tobacco")}>
                    <select
                      aria-label={t("tobacco")}
                      value={String(form.tobacco)}
                      onChange={(e) => change("tobacco", e.target.value)}
                    >
                      {(["never", "former", "current"] as const).map((key) => (
                        <option key={key} value={key}>
                          {t(key)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={copy(
                      "Habit duration (years)",
                      "అలవాటు వ్యవధి (సంవత్సరాలు)",
                    )}
                  >
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="0.1"
                      value={String(form.duration_years)}
                      onChange={(e) => change("duration_years", e.target.value)}
                    />
                  </Field>
                  <Field
                    label={copy(
                      "Daily frequency (times/day)",
                      "రోజువారీ వినియోగం (సార్లు/రోజు)",
                    )}
                  >
                    <input
                      type="number"
                      min="0"
                      max="200"
                      step="0.1"
                      value={String(form.frequency_per_day)}
                      onChange={(e) =>
                        change("frequency_per_day", e.target.value)
                      }
                    />
                  </Field>
                </div>
                <fieldset className="intake-group">
                  <legend>
                    {copy("Reported symptoms", "నివేదించిన లక్షణాలు")}
                  </legend>
                  {checklist("reported_symptoms", symptoms)}
                  <label className="check-field intake-discomfort">
                    <input
                      type="checkbox"
                      checked={Boolean(form.discomfort)}
                      onChange={(e) => change("discomfort", e.target.checked)}
                    />
                    {t("discomfort")}
                  </label>
                </fieldset>
                <div className="form-grid">
                  <Field
                    label={copy(
                      "Mouth opening (mm)",
                      "నోరు తెరిచిన కొలత (మి.మీ.)",
                    )}
                  >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder={copy("Not assessed", "పరిశీలించలేదు")}
                      value={String(form.mouth_opening_mm)}
                      onChange={(e) =>
                        change("mouth_opening_mm", e.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label={copy("Cervical lymph nodes", "మెడలో లింఫ్ గ్రంథులు")}
                  >
                    <select
                      aria-label={copy(
                        "Cervical lymph nodes",
                        "మెడలో లింఫ్ గ్రంథులు",
                      )}
                      value={String(form.lymph_nodes)}
                      onChange={(e) => change("lymph_nodes", e.target.value)}
                    >
                      <option value="not_assessed">
                        {copy("Not assessed", "పరిశీలించలేదు")}
                      </option>
                      <option value="palpable">
                        {copy("Palpable", "తాకితే తెలుస్తున్నాయి")}
                      </option>
                      <option value="not_palpable">
                        {copy("Not palpable", "తాకితే తెలియడం లేదు")}
                      </option>
                    </select>
                  </Field>
                </div>
                <Field label={t("notes")}>
                  <textarea
                    maxLength={5000}
                    rows={3}
                    value={String(form.notes)}
                    onChange={(e) => change("notes", e.target.value)}
                  />
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <p className="muted intake-help">
                  {copy(
                    "Check the intake before submitting for independent clinician review.",
                    "స్వతంత్ర వైద్య సమీక్షకు సమర్పించే ముందు వివరాలు తనిఖీ చేయండి.",
                  )}
                </p>
                <div className="intake-review-section">
                  <div>
                    <h4>{steps[0]}</h4>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => update({ intake_step: 0 })}
                    >
                      {copy("Edit patient details", "రోగి వివరాలు మార్చండి")}
                    </button>
                  </div>
                  <dl className="intake-summary">
                    <div>
                      <dt>{t("patient")}</dt>
                      <dd>
                        {String(form.display_name)} · {String(form.age_years)}{" "}
                        {t("years")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("village")}</dt>
                      <dd>{String(form.village)}</dd>
                    </div>
                    <div>
                      <dt>{t("phone")}</dt>
                      <dd>{String(form.contact_phone) || "—"}</dd>
                    </div>
                    <div>
                      <dt>{t("language")}</dt>
                      <dd>{languageName(String(form.language))}</dd>
                    </div>
                    <div>
                      <dt>{t("consent")}</dt>
                      <dd>
                        {form.consent
                          ? copy("Recorded", "నమోదైంది")
                          : copy("Missing", "నమోదు కాలేదు")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("photoConsent")}</dt>
                      <dd>
                        {form.photo_consent
                          ? copy("Recorded", "నమోదైంది")
                          : copy("Not granted", "అంగీకరించలేదు")}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="intake-review-section">
                  <div>
                    <h4>{steps[1]}</h4>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => update({ intake_step: 1 })}
                    >
                      {copy("Edit findings", "పరిశీలనలు మార్చండి")}
                    </button>
                  </div>
                  <IntakeFacts
                    tobacco={normalizeIntake(form).tobacco_history}
                    findings={normalizeIntake(form).symptoms}
                  />
                  <p className="intake-notes">
                    {String(form.notes) ||
                      copy(
                        "No additional observations",
                        "అదనపు పరిశీలనలు లేవు",
                      )}
                  </p>
                </div>
                <div className="form-notice">
                  {copy(
                    "Next: open the saved patient record to capture educational photographs. Photos require separate consent. Offline intakes wait in the registration queue until reconnecting.",
                    "తదుపరి: విద్యాపరమైన చిత్రాల కోసం సేవ్ చేసిన రోగి రికార్డు తెరవండి. చిత్రాలకు ప్రత్యేక సమ్మతి అవసరం. ఆఫ్‌లైన్ వివరాలు కనెక్షన్ వచ్చే వరకు క్యూలో ఉంటాయి.",
                  )}
                </div>
              </>
            )}
          </fieldset>
        )}
        {error && (
          <div className="error-box" role="alert">
            {localize(lang, error)}
          </div>
        )}
        <div className="modal-footer intake-footer">
          <span role="status">
            <Cloud size={15} />
            {saving
              ? t("saving")
              : draftSaved
                ? t("draftSaved")
                : isClinical
                  ? t("draftSaved")
                  : copy(
                      "Draft saves as you type",
                      "నమోదు చేస్తున్నప్పుడు డ్రాఫ్ట్ సేవ్ అవుతుంది",
                    )}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            {t("cancel")}
          </button>
          {step > 0 && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => update({ intake_step: step - 1 })}
            >
              <ChevronLeft size={16} />
              {copy("Back", "వెనుకకు")}
            </button>
          )}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : step === 2 ? (
              <Check size={17} />
            ) : (
              <ArrowRight size={17} />
            )}
            {step === 2
              ? t(submitting ? "saving" : "save")
              : copy("Continue", "కొనసాగించండి")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function IntakeFacts({
  tobacco,
  findings,
}: {
  tobacco: Record<string, unknown>;
  findings: Record<string, unknown>;
}) {
  const { lang, t } = useApp();
  const copy = (en: string, te: string) => localize(lang, en, te);
  const picked = (
    value: unknown,
    options: readonly (readonly [string, string, string])[],
  ) =>
    Array.isArray(value)
      ? options
          .filter(([id]) => value.includes(id))
          .map((o) => optionLabel(o, lang))
          .join(", ") || copy("None reported", "ఏవీ నివేదించలేదు")
      : copy("Not recorded", "నమోదు కాలేదు");
  const measured = (value: unknown) =>
    value === null || value === undefined || value === ""
      ? copy("Not assessed", "పరిశీలించలేదు")
      : String(value);
  const use = String(tobacco.use);
  return (
    <dl className="intake-summary">
      <div>
        <dt>{t("tobacco")}</dt>
        <dd>
          {["never", "former", "current"].includes(use)
            ? t(use as "never" | "former" | "current")
            : "—"}
        </dd>
      </div>
      <div>
        <dt>{copy("Reported habits", "నివేదించిన అలవాట్లు")}</dt>
        <dd>{picked(tobacco.habits, habits)}</dd>
      </div>
      <div>
        <dt>{copy("Habit duration (years)", "అలవాటు వ్యవధి (సంవత్సరాలు)")}</dt>
        <dd>{measured(tobacco.duration_years)}</dd>
      </div>
      <div>
        <dt>
          {copy(
            "Daily frequency (times/day)",
            "రోజువారీ వినియోగం (సార్లు/రోజు)",
          )}
        </dt>
        <dd>{measured(tobacco.frequency_per_day)}</dd>
      </div>
      <div>
        <dt>{copy("Reported symptoms", "నివేదించిన లక్షణాలు")}</dt>
        <dd>{picked(findings.reported, symptoms)}</dd>
      </div>
      <div>
        <dt>{t("discomfort")}</dt>
        <dd>
          {findings.discomfort === undefined
            ? copy("Not recorded", "నమోదు కాలేదు")
            : findings.discomfort
              ? copy("Yes", "అవును")
              : copy("No", "లేదు")}
        </dd>
      </div>
      <div>
        <dt>{copy("Mouth opening (mm)", "నోరు తెరిచిన కొలత (మి.మీ.)")}</dt>
        <dd>{measured(findings.mouth_opening_mm)}</dd>
      </div>
      <div>
        <dt>{copy("Cervical lymph nodes", "మెడలో లింఫ్ గ్రంథులు")}</dt>
        <dd>
          {findings.lymph_nodes === "palpable"
            ? copy("Palpable", "తాకితే తెలుస్తున్నాయి")
            : findings.lymph_nodes === "not_palpable"
              ? copy("Not palpable", "తాకితే తెలియడం లేదు")
              : copy("Not assessed", "పరిశీలించలేదు")}
        </dd>
      </div>
    </dl>
  );
}
