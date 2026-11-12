import { supportedLanguages, languageName } from "./lib/languages";
import { localize } from "./lib/localize";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Cloud,
  LoaderCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Field, Modal, useApp } from "./App";
import { message } from "./lib/use-workspace";
import { habits, normalizeIntake, optionLabel, symptoms } from "./lib/intake";
import { ASR_MANDALS, type HabitationItem } from "./lib/asr-districts";

export default function ScreeningIntake({ onClose }: { onClose: () => void }) {
  const { w, t, lang, notify } = useApp();
  const copy = (en: string, te: string) => localize(lang, en, te);
  const initial = useRef<Record<string, unknown>>({
    patient_id: crypto.randomUUID(),
    screening_id: crypto.randomUUID(),
    display_name: "",
    age_years: "",
    village: "",
    mandal: "paderu",
    habitation: "",
    custom_habitation: "",
    subcenter: "",
    abha_id: "",
    aadhaar_last4: "",
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
  const currentMandal =
    ASR_MANDALS.find((m) => m.id === form.mandal) || ASR_MANDALS[0];
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
    const finalHabitation =
      form.habitation === "other"
        ? String(form.custom_habitation || "").trim()
        : String(form.habitation || "").trim();
    const mandalObj =
      ASR_MANDALS.find((m) => m.id === form.mandal) || ASR_MANDALS[0];
    const effectiveVillage =
      String(form.village || "").trim() ||
      (finalHabitation
        ? `${finalHabitation}, ${mandalObj.nameEn}`
        : mandalObj.nameEn);

    if (
      !String(form.display_name).trim() ||
      !effectiveVillage ||
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
        village: effectiveVillage,
        mandal: mandalObj.nameEn,
        habitation: finalHabitation,
        subcenter: String(form.subcenter || "").trim(),
        abha_id: String(form.abha_id || "").trim(),
        aadhaar_last4: String(form.aadhaar_last4 || "").trim(),
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
                  {localize(
                    lang,
                    "Informed consent required under Ayushman Bharat Digital Mission (ABDM) protocols.",
                    "ఆయుష్మాన్ భారత్ డిజిటల్ మిషన్ (ABDM) నిబంధనల ప్రకారం సమాచార సమ్మతి అవసరం.",
                  )}
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
                      inputMode="numeric"
                      required
                      min="0"
                      max="120"
                      step="1"
                      value={String(form.age_years)}
                      onChange={(e) => change("age_years", e.target.value)}
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
                  <Field label={t("phone")}>
                    <input
                      type="tel"
                      maxLength={20}
                      value={String(form.contact_phone)}
                      placeholder={copy(
                        "10-digit mobile number",
                        "10 అంకెల మొబైల్ సంఖ్య",
                      )}
                      onChange={(e) => change("contact_phone", e.target.value)}
                    />
                  </Field>

                  <Field
                    label={copy(
                      "ASR District Mandal (11 Mandals)",
                      "ASR జిల్లా మండలం (11 మండలాలు)",
                    )}
                  >
                    <select
                      value={String(form.mandal || "paderu")}
                      onChange={(e) => {
                        const newMandalId = e.target.value;
                        const mandalInfo =
                          ASR_MANDALS.find((m) => m.id === newMandalId) ||
                          ASR_MANDALS[0];
                        update({
                          mandal: newMandalId,
                          habitation: "",
                          custom_habitation: "",
                          village: form.village
                            ? form.village
                            : mandalInfo.nameEn,
                        });
                      }}
                    >
                      {ASR_MANDALS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nameEn} · {m.nameTe}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label={copy(
                      "Habitation (Tribal Hamlet)",
                      "నివాసం / హ్యాబిటేషన్ (ఆవాసం)",
                    )}
                  >
                    <select
                      value={String(form.habitation || "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = currentMandal.habitations.find(
                          (h: HabitationItem) => h.nameEn === val,
                        );
                        update({
                          habitation: val,
                          ...(val && val !== "other"
                            ? {
                                village: `${val}, ${currentMandal.nameEn}`,
                                ...(match?.phc && !form.subcenter
                                  ? { subcenter: `${match.phc} PHC` }
                                  : {}),
                              }
                            : {}),
                        });
                      }}
                    >
                      <option value="">
                        {copy("Select Habitation…", "ఆవాసం ఎంచుకోండి…")}
                      </option>
                      {currentMandal.habitations.map((h: HabitationItem) => (
                        <option key={h.nameEn} value={h.nameEn}>
                          {h.nameEn} {h.phc ? `(${h.phc} PHC)` : ""}
                        </option>
                      ))}
                      <option value="other">
                        {copy(
                          "Other / Custom Habitation",
                          "ఇతర నివాసం (టైప్ చేయండి)",
                        )}
                      </option>
                    </select>
                  </Field>

                  {form.habitation === "other" && (
                    <Field
                      label={copy(
                        "Custom Habitation Name",
                        "నివాసం పేరు రాయండి",
                      )}
                    >
                      <input
                        maxLength={120}
                        value={String(form.custom_habitation || "")}
                        placeholder={copy(
                          "Enter tribal hamlet name",
                          "ఆవాసం పేరు",
                        )}
                        onChange={(e) => {
                          const val = e.target.value;
                          update({
                            custom_habitation: val,
                            village: val
                              ? `${val}, ${currentMandal.nameEn}`
                              : currentMandal.nameEn,
                          });
                        }}
                      />
                    </Field>
                  )}

                  <Field
                    label={copy(
                      "Sub-centre (Ayushman Arogya Mandir)",
                      "ఉప కేంద్రం / ఆయుష్మాన్ ఆరోగ్య మందిరం",
                    )}
                  >
                    <input
                      maxLength={120}
                      value={String(form.subcenter || "")}
                      placeholder={copy(
                        "e.g. Minumuluru Sub-centre",
                        "ఉదా: మినుములూరు ఉప కేంద్రం",
                      )}
                      onChange={(e) => change("subcenter", e.target.value)}
                    />
                  </Field>

                  <Field label={t("village")}>
                    <input
                      aria-label={t("village")}
                      required
                      maxLength={120}
                      value={String(form.village)}
                      placeholder={copy(
                        "Village or Gram Panchayat",
                        "గ్రామం లేదా పంచాయతీ",
                      )}
                      onChange={(e) => change("village", e.target.value)}
                    />
                  </Field>

                  <Field
                    label={copy(
                      "ABHA ID (Ayushman Bharat Health Account)",
                      "ABHA ఐడీ (ఆయుష్మాన్ భారత్ హెల్త్ ఖాతా)",
                    )}
                  >
                    <input
                      maxLength={32}
                      value={String(form.abha_id || "")}
                      placeholder={copy(
                        "14-digit ABHA or name@abdm",
                        "14 అంకెల ABHA లేదా @abdm",
                      )}
                      onChange={(e) => {
                        let val = e.target.value;
                        const digits = val.replace(/\D/g, "");
                        if (
                          digits.length > 0 &&
                          digits.length <= 14 &&
                          !val.includes("@")
                        ) {
                          const p1 = digits.slice(0, 2);
                          const p2 = digits.slice(2, 6);
                          const p3 = digits.slice(6, 10);
                          const p4 = digits.slice(10, 14);
                          val = [p1, p2, p3, p4].filter(Boolean).join("-");
                        }
                        change("abha_id", val);
                      }}
                    />
                  </Field>

                  <Field
                    label={copy(
                      "Aadhaar (Last 4 digits · UIDAI compliant)",
                      "ఆధార్ (చివరి 4 అంకెలు)",
                    )}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      value={String(form.aadhaar_last4 || "")}
                      placeholder="•••• 4829"
                      onChange={(e) =>
                        change(
                          "aadhaar_last4",
                          e.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                    />
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
                    {localize(
                      lang,
                      "Separate consent for intraoral clinical photographs",
                      "ఇంట్రాఓరల్ క్లినికల్ చిత్రాల కోసం ప్రత్యేక సమ్మతి",
                    )}
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
                      inputMode="decimal"
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
                      <dt>{copy("ASR Mandal", "మండలం")}</dt>
                      <dd>
                        {currentMandal.nameEn} · {currentMandal.nameTe}
                      </dd>
                    </div>
                    <div>
                      <dt>{copy("Habitation", "నివాసం")}</dt>
                      <dd>
                        {String(
                          (form.habitation === "other"
                            ? form.custom_habitation
                            : form.habitation) || "—",
                        )}
                      </dd>
                    </div>
                    {Boolean(form.subcenter) && (
                      <div>
                        <dt>{copy("Sub-centre", "ఉప కేంద్రం")}</dt>
                        <dd>{String(form.subcenter)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{t("village")}</dt>
                      <dd>{String(form.village)}</dd>
                    </div>
                    {Boolean(form.abha_id) && (
                      <div>
                        <dt>{copy("ABHA ID", "ABHA ఐడీ")}</dt>
                        <dd>{String(form.abha_id)}</dd>
                      </div>
                    )}
                    {Boolean(form.aadhaar_last4) && (
                      <div>
                        <dt>{copy("Aadhaar", "ఆధార్")}</dt>
                        <dd>•••• •••• {String(form.aadhaar_last4)}</dd>
                      </div>
                    )}
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
                    "After saving, open the patient record to add oral photographs. Record photo consent before uploading.",
                    "సేవ్ చేసిన తర్వాత నోటి చిత్రాలను జోడించడానికి రోగి రికార్డు తెరవండి. అప్‌లోడ్ చేయడానికి ముందు చిత్ర సమ్మతి నమోదు చేయండి.",
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
