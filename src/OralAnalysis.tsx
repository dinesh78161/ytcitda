import { localize } from "./lib/localize";
import { languageName } from "./lib/languages";
import { oralViewLabel } from "./lib/i18n";
import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  ChevronDown,
  Eye,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "./App";
import { isCloud, isClinical } from "./lib/client";
import { careApi, downloadUrl } from "./lib/services";
import type { OralImage } from "./lib/types";

export default function OralAnalysis({
  image,
  consent,
}: {
  image: OralImage;
  consent: boolean;
}) {
  const { w, t, lang, run } = useApp();
  const copy = (en: string, te: string) => localize(lang, en, te);
  const [source, setSource] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false),
    [previewAttempt, setPreviewAttempt] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const analyses = w.data.ai_analyses
    .filter((a) => a.image_id === image.id && a.status === "completed")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const result = analyses[0];
  const researchAvailable =
    isCloud &&
    w.services.ai &&
    ["research", "gemini", "medgemma"].includes(w.services.ai_provider || "");
  const geminiMode = ["gemini", "medgemma"].includes(
    w.services.ai_provider || "",
  );
  const medgemmaMode =
    w.services.ai_provider === "medgemma" ||
    result?.findings?.engine === "medgemma" ||
    result?.model_version?.includes("medgemma");
  const visionResult =
    result?.findings?.engine === "gemini" ||
    result?.findings?.engine === "medgemma";
  const findings = consent && visionResult ? result.findings : null;
  const runMock = !isCloud || w.services.ai_provider === "mock";
  const mock = result
    ? result.provider === "mock"
    : !isCloud || w.services.ai_provider === "mock";
  const good = image.quality_status === "acceptable";
  const quality = image.quality_details;
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
        w.execute("analyze", { image_id: image.id, language: lang }),
      );
    } finally {
      setAnalyzing(false);
    }
  };
  useEffect(() => {
    let live = true;
    setSource(null);
    setPreviewError(false);
    if (consent && isCloud) {
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
  }, [image.id, consent, previewAttempt]);
  const imageSource = consent && !previewError ? image.preview || source : null;
  const measurement = (key: string, unit = "") =>
    typeof quality?.[key] === "number" ? `${quality[key]}${unit}` : "—";
  return (
    <article
      className="photo-card oral-analysis-card"
      aria-label={copy("Oral image analysis", "నోటి చిత్ర విశ్లేషణ")}
    >
      <div className="oral-image-column">
        <div className="analysis-image-heading">
          <Camera size={16} />
          <span>
            {copy("Uploaded oral photograph", "అప్‌లోడ్ చేసిన నోటి చిత్రం")}
          </span>
        </div>
        {imageSource ? (
          <img
            className="oral-analysis-photo photo-reveal-animated"
            src={imageSource}
            alt={t("photos")}
            onError={() => {
              setSource(null);
              setPreviewError(true);
            }}
          />
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
            {image.oral_view
              ? oralViewLabel(image.oral_view, lang)
              : copy("Oral view", "నోటి భాగం")}
          </small>
          {isCloud && (
            <button
              className="text-button"
              disabled={!consent}
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
      </div>
      <section
        className="analysis-findings"
        aria-label={
          isClinical
            ? copy("Clinician image review", "వైద్యుని చిత్ర సమీక్ష")
            : copy(
                "Research image observations",
                "క్లినికల్ స్క్రీనింగ్ AI పరిశీలనలు",
              )
        }
        aria-busy={analyzing}
      >
        {isClinical ? (
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
                "Automated disease analysis is not enabled in this clinical workspace.",
                "ఈ వైద్య కార్యస్థలంలో స్వయంచాలక వ్యాధి విశ్లేషణ ప్రారంభించబడలేదు.",
              )}
            </p>
          </>
        ) : (
          <>
            <div className="analysis-findings-heading">
              <div>
                <span className="analysis-eyebrow">
                  <Activity size={15} />
                  {copy("RESEARCH IMAGE REVIEW", "క్లినికల్ AI వర్క్‌స్పేస్")}
                </span>
                <h3>
                  {copy(
                    "Research image observations",
                    "క్లినికల్ స్క్రీనింగ్ AI పరిశీలనలు",
                  )}
                </h3>
              </div>
              <span className="analysis-mode">
                {medgemmaMode
                  ? copy(
                      "RESEARCH MODEL · CLINICIAN REVIEW REQUIRED",
                      "గూగుల్ మెడ్‌జెమ్మా · క్లినికల్ CDSS",
                    )
                  : visionResult
                    ? copy("GEMINI · RESEARCH ONLY", "జెమిని · క్లినికల్ CDSS")
                    : mock
                      ? copy("MOCK WORKFLOW TEST", "క్లినికల్ ట్రయాజ్ మోడ్")
                      : copy("RESEARCH EVALUATION", "క్లినికల్ AI మోడ్")}
              </span>
            </div>
            <div
              className={`analysis-result-box ${result && !mock ? "has-research-result" : ""}`}
            >
              <span className="analysis-eyebrow">
                {copy("IMAGE OBSERVATIONS", "క్లినికల్ AI మూల్యాంకనం")}
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
                          : result.research_label.replaceAll("_", " ")
                      : copy(
                          "Ready for image analysis",
                          "చిత్ర విశ్లేషణకు సిద్ధం",
                        )}
              </h4>
              {!visionResult && (
                <div className="analysis-score">
                  <span>{copy("Model class score", "మోడల్ వర్గ స్కోర్")}</span>
                  <strong>
                    {consent && score !== null
                      ? `${(score * 100).toFixed(1)}%`
                      : "—"}
                  </strong>
                </div>
              )}
              {!visionResult && consent && score !== null && (
                <meter
                  min={0}
                  max={1}
                  value={score}
                  aria-label={copy("Model class score", "మోడల్ వర్గ స్కోర్")}
                />
              )}
              <p>
                {visionResult
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
                          "ప్రామాణిక నిర్ణయ మద్దతు మోడ్ క్రియాశీలకంగా ఉంది. వైద్య అధికారి ఆమోదం కోసం వేచి ఉంది.",
                        )
                    : copy(
                        "Uncalibrated research model score; it is not a disease probability. Independent clinician examination is required.",
                        "ప్రామాణిక క్లినికల్ స్క్రీనింగ్ విశ్వసనీయత స్కోర్. తుది నిర్ధారణను వైద్య అధికారి ధృవీకరిస్తారు.",
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
            {(!result || researchAvailable) && (
              <button
                className="button primary analysis-run"
                aria-label={runMock ? t("analyze") : undefined}
                disabled={
                  w.busy ||
                  analyzing ||
                  !consent ||
                  !good ||
                  (isCloud && !w.services.ai)
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
                  : runMock
                    ? t("analyze")
                    : medgemmaMode
                      ? copy(
                          "Analyse with Google MedGemma",
                          "గూగుల్ మెడ్‌జెమ్మాతో విశ్లేషించండి",
                        )
                      : geminiMode
                        ? copy("Analyse with Gemini", "జెమినితో విశ్లేషించండి")
                        : copy(
                            "Run research image analysis",
                            "క్లినికల్ AI విశ్లేషణను ప్రారంభించండి",
                          )}
              </button>
            )}
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
