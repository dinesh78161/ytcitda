import { localize } from "./lib/localize";
import { languageName } from "./lib/languages";
import { oralViewLabel } from "./lib/i18n";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Camera,
  ChevronDown,
  Eye,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useApp } from "./App";
import { isCloud, isClinical } from "./lib/client";
import { careApi, downloadUrl } from "./lib/services";
import type { OralImage } from "./lib/types";
import { hasConsent } from "./lib/care-workflows";
import { assessMedGemmaQuality } from "./lib/image-quality";

export default function OralAnalysis({
  image,
  consent,
  onRetake,
}: {
  image: OralImage;
  consent: boolean;
  onRetake?: () => void;
}) {
  const { w, t, lang, run } = useApp();
  const copy = (en: string, te: string) => localize(lang, en, te);
  const [source, setSource] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false),
    [previewAttempt, setPreviewAttempt] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [visibleLesion, setVisibleLesion] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const clinicalRole = ["medical_officer", "specialist"].includes(
    w.profile?.role || "",
  );
  const analyses = w.data.ai_analyses
    .filter(
      (a) =>
        a.image_id === image.id &&
        a.status === "completed" &&
        (!isClinical || (clinicalRole && a.provider === "clinical_assistance")),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const result = analyses[0];
  const localMode =
    !isClinical &&
    (w.services.ai_provider === "local" ||
      (w.services.oral_model_ready === true &&
        !["gemini", "medgemma", "research"].includes(
          w.services.ai_provider || "",
        )));
  const clinicalAvailable =
    isClinical &&
    w.services.ai &&
    w.services.ai_provider === "clinical" &&
    clinicalRole;
  const aiConsent =
    !isClinical || hasConsent(w.data, image.patient_id, "ai_assistance");

  useEffect(() => {
    if (result && !analyzing && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.top > 250 || rect.top < 0) {
        cardRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [result?.id, analyzing]);
  const researchAvailable =
    isCloud &&
    (localMode ||
      (w.services.ai &&
        ["local", "research", "gemini", "medgemma", "clinical"].includes(
          w.services.ai_provider || "",
        )));
  const geminiMode =
    !localMode && ["gemini", "medgemma"].includes(w.services.ai_provider || "");
  const medgemmaMode =
    w.services.ai_provider === "medgemma" ||
    result?.findings?.engine === "medgemma" ||
    result?.model_version?.includes("medgemma");
  const visionResult =
    result?.findings?.engine === "clinical" ||
    result?.findings?.engine === "gemini" ||
    result?.findings?.engine === "medgemma";
  const findings =
    consent && aiConsent && visionResult ? result.findings : null;
  const runMock = !isCloud || (!localMode && w.services.ai_provider === "mock");
  const mock = result
    ? result.provider === "mock"
    : !isCloud || (!localMode && w.services.ai_provider === "mock");
  const good = image.quality_status === "acceptable";
  const quality = image.quality_details;
  const captureGuidance =
    quality &&
    typeof quality.sharpness === "number" &&
    typeof quality.brightness === "number" &&
    typeof quality.glare_percent === "number"
      ? assessMedGemmaQuality({
          sharpness: quality.sharpness,
          brightness: quality.brightness,
          glare_percent: quality.glare_percent,
        })
      : null;
  const score =
    !mock &&
    result?.score !== null &&
    result?.score !== undefined &&
    Number.isFinite(Number(result.score)) &&
    Number(result.score) >= 0 &&
    Number(result.score) <= 1
      ? Number(result.score)
      : null;
  const analyze = async () => {
    setAnalyzing(true);
    try {
      await run(() =>
        w.execute("analyze", {
          image_id: image.id,
          language: lang,
          ...(localMode
            ? { engine: "bundled_oral", lesion_confirmed: visibleLesion }
            : {}),
        }),
      );
    } finally {
      setAnalyzing(false);
    }
  };
  useEffect(() => {
    let live = true;
    setSource(null);
    setPreviewError(false);
    if (
      consent &&
      isCloud &&
      !image.pending_sync &&
      w.online !== false &&
      !image.preview
    ) {
      void careApi<{ url: string }>("download", { kind: "oral", id: image.id })
        .then(({ url }) => {
          if (live) setSource(url);
        })
        .catch(() => {
          if (live) setPreviewError(true);
        });
    }
    return () => {
      live = false;
    };
  }, [
    image.id,
    consent,
    previewAttempt,
    image.pending_sync,
    image.preview,
    w.online,
  ]);
  const imageSource = consent && !previewError ? image.preview || source : null;
  const measurement = (key: string, unit = "") =>
    typeof quality?.[key] === "number" ? `${quality[key]}${unit}` : "—";

  const conditionTitle =
    findings?.oral_assessment === "no_visible_abnormality"
      ? copy(
          "No visible abnormality in this photo",
          "ఈ ఫోటోలో కనిపించే అసాధారణత లేదు",
        )
      : findings?.oral_assessment === "visible_changes"
        ? copy(
            "Visible changes — clinician review needed",
            "కనిపించే మార్పులు — వైద్య సమీక్ష అవసరం",
          )
        : findings?.oral_assessment === "not_assessable"
          ? copy("Photo cannot be assessed", "ఫోటోను అంచనా వేయలేము")
          : findings?.image_kind === "oral_photo"
            ? findings.possible_conditions[0]?.name ||
              findings.visible_findings[0]
            : consent && result && !mock && !visionResult
              ? result.research_label === "benign_lesion"
                ? copy(
                    "Model classification: benign lesion",
                    "మోడల్ వర్గీకరణ: నిరపాయమైన గాయం",
                  )
                : result.research_label === "malignant_lesion"
                  ? copy(
                      "Model classification: malignant lesion",
                      "మోడల్ వర్గీకరణ: ప్రాణాంతక గాయం",
                    )
                  : null
              : null;

  return (
    <article
      ref={cardRef}
      className="photo-card oral-analysis-card"
      aria-label={copy("Oral image analysis", "నోటి చిత్ర విశ్లేషణ")}
    >
      <div className="oral-image-column">
        {image.pending_sync && (
          <p className="form-notice" role="status">
            {t("draftQueued")}
          </p>
        )}
        <div className="analysis-image-heading">
          <Camera size={16} />
          <span>
            {image.pending_sync
              ? t("photos")
              : copy("Uploaded oral photograph", "అప్‌లోడ్ చేసిన నోటి చిత్రం")}
          </span>
        </div>
        {imageSource ? (
          <div className="image-with-overlays">
            <img
              className="oral-analysis-photo photo-reveal-animated"
              src={imageSource}
              alt={t("photos")}
              onError={() => {
                setSource(null);
                setPreviewError(true);
              }}
            />
          </div>
        ) : (
          <div className="photo-placeholder oral-preview-placeholder scanning-active">
            {!consent ? (
              <>
                <ShieldCheck size={28} />
                <span>{t("photoMissing")}</span>
              </>
            ) : previewError ? (
              <>
                <Camera size={28} />
                <span>
                  {copy("Preview unavailable", "ప్రివ్యూ అందుబాటులో లేదు")}
                </span>
                <button
                  className="text-button"
                  onClick={() => setPreviewAttempt((n) => n + 1)}
                >
                  <RefreshCw size={14} />
                  {t("retry")}
                </button>
              </>
            ) : (
              <div className="scanner-viewfinder">
                <div className="scanner-grid" />
                <div className="scanner-laser" />
                <div className="viewfinder-corner tl" />
                <div className="viewfinder-corner tr" />
                <div className="viewfinder-corner bl" />
                <div className="viewfinder-corner br" />
                <div className="scanner-center-content">
                  <div className="scanner-pulse-ring">
                    <Sparkles className="scanner-icon spin" size={24} />
                  </div>
                  <strong className="scanner-label">
                    {copy(
                      "Processing oral capture…",
                      "నోటి చిత్రాన్ని ప్రాసెస్ చేస్తోంది…",
                    )}
                  </strong>
                  <span className="scanner-sublabel">
                    {copy(
                      "Preparing photograph and image quality checks",
                      "అధిక నాణ్యత చిత్రాన్ని మరియు నాణ్యత ప్రమాణాలను సమన్వయం చేస్తోంది",
                    )}
                  </span>
                  <div className="scanner-progress-track">
                    <div className="scanner-progress-bar" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="analysis-image-actions">
          <small>
            {image.oral_view || image.quality_details?.subsite
              ? oralViewLabel(
                  (image.quality_details?.subsite as string) ||
                    image.oral_view ||
                    "",
                  lang,
                )
              : copy("Oral view", "నోటి భాగం")}
          </small>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {isCloud && (
              <button
                className="text-button"
                disabled={!consent || image.pending_sync || w.online === false}
                onClick={() =>
                  void run(async () => {
                    const file = await careApi<{ url: string }>("download", {
                      kind: "oral",
                      id: image.id,
                    });
                    downloadUrl(file.url, "oral-photo.jpg");
                  })
                }
              >
                {copy("Download photo", "చిత్రం డౌన్‌లోడ్")}
              </button>
            )}
            <button
              className="text-button"
              type="button"
              style={{
                color: "#dc2626",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontWeight: 600,
              }}
              disabled={w.busy}
              onClick={() => {
                if (
                  window.confirm(
                    copy(
                      "Delete this photo and retake?",
                      "ఈ చిత్రాన్ని తొలగించి మళ్లీ తీయాలా?",
                    ),
                  )
                ) {
                  void run(async () => {
                    await w.execute("delete_image", { image_id: image.id });
                  });
                }
              }}
            >
              <Trash2 size={14} />
              {copy("Delete photo", "చిత్రం తొలగించండి")}
            </button>
          </div>
        </div>
        <div className="analysis-quality-title">
          <span>
            <Activity size={16} />
            {copy("Image quality checks", "చిత్ర నాణ్యత తనిఖీలు")}
          </span>
          <span
            className={`badge ${good ? "badge-completed" : "badge-missed"}`}
          >
            {t(good ? "acceptable" : "recapture")}
          </span>
        </div>
        <dl className="analysis-quality-grid">
          {[
            [copy("Sharpness", "స్పష్టత"), measurement("sharpness")],
            [copy("Brightness", "ప్రకాశం"), measurement("brightness")],
            [copy("Glare", "మెరుపు"), measurement("glare_percent", "%")],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {!good && (
          <div className="form-notice" role="status">
            <p>
              {captureGuidance
                ? lang === "te"
                  ? captureGuidance.recommendation_te
                  : captureGuidance.recommendation
                : copy(
                    "Retake a close, well-lit photograph of the inside of the mouth. Hold steady and tap to focus on the tissue.",
                    "నోటి లోపలి భాగాన్ని దగ్గరగా, మంచి వెలుతురులో మళ్లీ తీయండి. కదలకుండా పట్టుకొని కణజాలంపై ఫోకస్ చేయండి.",
                  )}
            </p>
            <p className="small muted">
              {copy(
                "This checks photo quality, not whether the person is healthy.",
                "ఇది ఫోటో నాణ్యతను పరీక్షిస్తుంది, వ్యక్తి ఆరోగ్యాన్ని కాదు.",
              )}
            </p>
            {onRetake && (
              <button
                type="button"
                className="button secondary"
                onClick={onRetake}
              >
                <Camera size={16} />
                {copy("Retake oral photo", "నోటి ఫోటో మళ్లీ తీయండి")}
              </button>
            )}
          </div>
        )}
      </div>
      <section
        className="analysis-findings"
        aria-label={
          isClinical
            ? copy("Clinician image review", "వైద్యుని చిత్ర సమీక్ష")
            : copy("Image observations", "చిత్ర పరిశీలనలు")
        }
        aria-busy={analyzing}
      >
        {isClinical && !clinicalAvailable && !result ? (
          <>
            <h3>{copy("Clinician image review", "వైద్యుని చిత్ర సమీక్ష")}</h3>
            <p>
              {copy(
                "Review this photograph with the examination findings. Record and sign your assessment in the clinical record.",
                "ఈ చిత్రాన్ని పరీక్ష పరిశీలనలతో సమీక్షించండి. వైద్య రికార్డులో మీ అంచనాను నమోదు చేసి సంతకం చేయండి.",
              )}
            </p>
            <p className="small muted">
              {copy(
                "AI assistance requires a configured clinical model and an assigned clinician. Manual clinical review remains available.",
                "AI సహాయానికి క్లినికల్ మోడల్ మరియు నియమిత వైద్యుడు అవసరం. వైద్య సమీక్ష అందుబాటులో ఉంది.",
              )}
            </p>
          </>
        ) : (
          <>
            <div className="analysis-findings-heading">
              <div>
                <span className="analysis-eyebrow">
                  <Activity size={15} />
                  {copy("Image analysis", "చిత్ర విశ్లేషణ")}
                </span>
                <h3>{copy("Image observations", "చిత్ర పరిశీలనలు")}</h3>
              </div>
              {(isClinical || medgemmaMode || (!geminiMode && !visionResult)) &&
                !(
                  localMode &&
                  (!result || result.model_version === "oral-mendeley-v1")
                ) && (
                  <span className="analysis-mode">
                    {isClinical
                      ? copy(
                          "AI DRAFT · CLINICIAN REVIEW REQUIRED",
                          "AI ముసాయిదా · వైద్య సమీక్ష అవసరం",
                        )
                      : medgemmaMode
                        ? copy(
                            "RESEARCH MODEL · CLINICIAN REVIEW REQUIRED",
                            "పరిశోధన మోడల్ · వైద్య సమీక్ష అవసరం",
                          )
                        : mock
                          ? copy("SIMULATED ANALYSIS", "అనుకరణ విశ్లేషణ")
                          : copy("RESEARCH EVALUATION", "పరిశోధన మూల్యాంకనం")}
                  </span>
                )}
            </div>

            {/* Top action button: prominent and visible without scrolling */}
            {geminiMode && result?.model_version === "oral-mendeley-v1" && (
              <p className="form-notice" role="status">
                {copy(
                  "This saved result used a two-class lesion model that cannot assess a healthy mouth. Re-analyse this photo to obtain image observations.",
                  "ఈ ఫలితం ఆరోగ్యకరమైన నోటిని అంచనా వేయలేని రెండు వర్గాల గాయాల మోడల్ నుండి వచ్చింది. చిత్ర పరిశీలనల కోసం మళ్లీ విశ్లేషించండి.",
                )}
              </p>
            )}
            {localMode && (
              <label className="form-notice">
                <input
                  type="checkbox"
                  checked={visibleLesion}
                  onChange={(event) => setVisibleLesion(event.target.checked)}
                />
                {copy(
                  "A visible lesion is present in this photo. The two-class model cannot assess a healthy mouth.",
                  "ఈ ఫోటోలో కనిపించే గాయం ఉంది. రెండు వర్గాల మోడల్ ఆరోగ్యకరమైన నోటిని అంచనా వేయలేదు.",
                )}
              </label>
            )}
            {(!result || researchAvailable) && (
              <div className="analysis-action-bar-top">
                <button
                  className={`button primary analysis-run ${result ? "analysis-run-compact" : ""}`}
                  aria-label={runMock ? t("analyze") : undefined}
                  disabled={
                    image.pending_sync ||
                    w.online === false ||
                    w.busy ||
                    analyzing ||
                    !consent ||
                    !aiConsent ||
                    !good ||
                    (localMode && !visibleLesion) ||
                    (isCloud && !w.services.ai && !localMode)
                  }
                  onClick={() => void analyze()}
                >
                  {analyzing ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {analyzing
                    ? copy("Analysing image…", "చిత్రం విశ్లేషిస్తోంది…")
                    : isClinical
                      ? copy(
                          "Request AI assistance",
                          "AI సహాయాన్ని అభ్యర్థించండి",
                        )
                      : runMock
                        ? t("analyze")
                        : medgemmaMode
                          ? copy(
                              "Analyse with Google MedGemma",
                              "గూగుల్ మెడ్‌జెమ్మాతో విశ్లేషించండి",
                            )
                          : localMode
                            ? copy(
                                "Analyse with oral model",
                                "నోటి మోడల్‌తో విశ్లేషించండి",
                              )
                            : geminiMode
                              ? result
                                ? copy(
                                    "Re-analyse photograph",
                                    "ఫోటోను మళ్లీ విశ్లేషించండి",
                                  )
                                : copy(
                                    "Analyse oral photograph",
                                    "నోటి ఫోటోను విశ్లేషించండి",
                                  )
                              : copy(
                                  "Analyse image",
                                  "చిత్రాన్ని విశ్లేషించండి",
                                )}
                </button>
              </div>
            )}
            {isClinical && !aiConsent && (
              <p role="status" className="small muted">
                {copy(
                  "Record separate AI image assistance consent in Patient consent before requesting analysis.",
                  "విశ్లేషణ కోరే ముందు రోగి సమ్మతిలో AI చిత్ర సహాయానికి వేరు సమ్మతిని నమోదు చేయండి.",
                )}
              </p>
            )}
            {isClinical && (
              <p className="small muted">
                {copy(
                  "AI output is an unsigned draft. Examine the patient and record your own assessment in the clinical review; AI does not sign a diagnosis or change treatment.",
                  "AI ఫలితం సంతకం చేయని ముసాయిదా. రోగిని పరీక్షించి వైద్య సమీక్షలో మీ అంచనాను నమోదు చేయండి; AI నిర్ధారణకు సంతకం చేయదు లేదా చికిత్సను మార్చదు.",
                )}
              </p>
            )}

            {result && conditionTitle && (
              <div className="ai-detected-condition-card">
                <div className="ai-detected-condition-header">
                  <span className="ai-detected-condition-badge-title">
                    <Sparkles size={15} />
                    {copy("For clinician review", "వైద్యుని సమీక్ష కోసం")}
                  </span>
                </div>
                <div className="ai-detected-condition-name">
                  {conditionTitle}
                </div>
              </div>
            )}

            <div className="analysis-findings-scroll-container">
              <div
                className={`analysis-result-box ${result && !mock ? "has-research-result" : ""}`}
              >
                <span className="analysis-eyebrow">
                  {copy("Image observations", "చిత్ర పరిశీలనలు")}
                </span>
                <h4>
                  {!consent
                    ? copy("Photo consent required", "చిత్ర సమ్మతి అవసరం")
                    : !good
                      ? copy(
                          "Retake before analysis",
                          "విశ్లేషణకు ముందు మళ్లీ తీయండి",
                        )
                      : result
                        ? mock
                          ? copy(
                              "Mock result · clinician review required",
                              "మాక్ ఫలితం · వైద్య సమీక్ష అవసరం",
                            )
                          : result.research_label === "demo_review_required"
                            ? copy(
                                "Clinical evaluation required",
                                "క్లినికల్ మూల్యాంకనం అవసరం",
                              )
                            : copy("Image observations", "చిత్ర పరిశీలనలు")
                        : copy(
                            "Ready for image analysis",
                            "చిత్ర విశ్లేషణకు సిద్ధం",
                          )}
                </h4>
                {result && !isClinical && !visionResult && (
                  <div className="analysis-score">
                    <span>
                      {copy("Model class score", "మోడల్ వర్గ స్కోర్")}
                    </span>
                    <strong>
                      {consent && score !== null
                        ? `${(score * 100).toFixed(1)}%`
                        : "—"}
                    </strong>
                  </div>
                )}
                {!isClinical && !visionResult && consent && score !== null && (
                  <meter
                    min={0}
                    max={1}
                    value={score}
                    aria-label={copy("Model class score", "మోడల్ వర్గ స్కోర్")}
                  />
                )}
                <p>
                  {isClinical
                    ? copy(
                        "AI draft observations require independent clinician examination and review. A photograph alone cannot establish a diagnosis.",
                        "AI ముసాయిదా పరిశీలనలకు స్వతంత్ర వైద్య పరీక్ష మరియు సమీక్ష అవసరం. ఫోటో ఒక్కటే నిర్ధారణ చేయలేదు.",
                      )
                    : visionResult
                      ? copy(
                          "Research observations only. A photograph cannot establish a diagnosis; independent clinician examination is required.",
                          "వైద్య సమీక్ష కోసం AI పరిశీలనలు. తుది నిర్ధారణను వైద్య అధికారి ధృవీకరిస్తారు.",
                        )
                      : mock
                        ? result
                          ? copy(
                              "No medical prediction was made. Independent clinician examination required.",
                              "వైద్య అంచనా చేయలేదు. స్వతంత్ర వైద్య పరీక్ష అవసరం.",
                            )
                          : copy(
                              "Workflow test only. No medical prediction is produced.",
                              "వర్క్‌ఫ్లో పరీక్ష మాత్రమే. వైద్య అంచనా ఇవ్వబడదు.",
                            )
                        : copy(
                            "Uncalibrated research model score; it is not a disease probability. Independent clinician examination is required.",
                            "క్రమాంకనం చేయని పరిశోధన మోడల్ స్కోర్; ఇది వ్యాధి సంభావ్యత కాదు. స్వతంత్ర వైద్య పరీక్ష అవసరం.",
                          )}
                </p>
              </div>
              {findings && (
                <div className="vision-report">
                  <p className="muted">
                    {copy("Report language", "నివేదిక భాష")}:{" "}
                    {languageName(findings.language ?? "en")}
                  </p>
                  <p className="vision-summary">{findings.summary}</p>
                  <h5>{copy("Visible findings", "కనిపిస్తున్న పరిశీలనలు")}</h5>
                  {findings.visible_findings.length ? (
                    <ul>
                      {findings.visible_findings.map((finding, i) => (
                        <li key={i}>{finding}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {copy(
                        "No assessable oral findings returned.",
                        "అంచనా వేయగల నోటి పరిశీలనలు అందలేదు.",
                      )}
                    </p>
                  )}
                  {findings.possible_conditions.length > 0 && (
                    <>
                      <h5>
                        {copy(
                          "Possibilities for clinician review",
                          "వైద్య సమీక్షకు సాధ్యమైన కారణాలు",
                        )}
                      </h5>
                      <ul>
                        {findings.possible_conditions.map((condition, i) => (
                          <li key={i}>
                            <strong>{condition.name}</strong>
                            <span>{condition.visual_basis}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {findings.limitations.length > 0 && (
                    <details className="findings-limitations-toggle">
                      <summary>
                        <span>
                          {copy(
                            "Imaging limitations & clinical scope",
                            "చిత్ర పరిమితులు & క్లినికల్ పరిధి",
                          )}
                        </span>
                        <ChevronDown size={14} />
                      </summary>
                      <ul>
                        {findings.limitations.map((limitation, i) => (
                          <li key={i}>{limitation}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
            <span className="sr-only">
              {copy(
                "Independent clinician examination required. Dental and periodontal findings: Not assessed.",
                "స్వతంత్ర వైద్య పరీక్ష అవసరం. దంత మరియు చిగుళ్ల పరిశీలనలు: పరిశీలించలేదు.",
              )}
            </span>
          </>
        )}
      </section>
    </article>
  );
}
