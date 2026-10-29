import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  ChevronDown,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useApp } from "./App";
import { isCloud } from "./lib/client";
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
  const copy = (en: string, te: string) => (lang === "te" ? te : en);
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
    ["research", "gemini"].includes(w.services.ai_provider || "");
  const geminiMode = w.services.ai_provider === "gemini";
  const visionResult = result?.findings?.engine === "gemini";
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
      await run(() => w.execute("analyze", { image_id: image.id }));
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
            className="oral-analysis-photo"
            src={imageSource}
            alt={t("photos")}
            onError={() => {
              setSource(null);
              setPreviewError(true);
            }}
          />
        ) : (
          <div className="photo-placeholder oral-preview-placeholder">
            {!consent ? (
              <>
                <ShieldCheck />
                <span>{t("photoMissing")}</span>
              </>
            ) : previewError ? (
              <>
                <Camera />
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
              <>
                <LoaderCircle className="spin" />
                <span>{t("loading")}</span>
              </>
            )}
          </div>
        )}
        <div className="analysis-image-actions">
          <small>
            {image.oral_view
              ? image.oral_view.replaceAll("_", " ")
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
        <p className="analysis-quality-note">
          {copy(
            "Prototype quality measurements; they do not detect disease or confirm that an image is oral.",
            "ఇవి ప్రాథమిక నాణ్యత కొలతలు మాత్రమే; వ్యాధిని లేదా నోటి చిత్రమని నిర్ధారించవు.",
          )}
        </p>
      </div>
      <section
        className="analysis-findings"
        aria-label={copy(
          "Experimental image findings",
          "ప్రయోగాత్మక చిత్ర పరిశీలనలు",
        )}
        aria-busy={analyzing}
      >
        <div className="analysis-findings-heading">
          <div>
            <span className="analysis-eyebrow">
              <FlaskConical size={15} />
              {copy("RESEARCH WORKSPACE", "పరిశోధన వర్క్‌స్పేస్")}
            </span>
            <h3>
              {copy(
                "Experimental image findings",
                "ప్రయోగాత్మక చిత్ర పరిశీలనలు",
              )}
            </h3>
          </div>
          <span className="analysis-mode">
            {visionResult
              ? copy("GEMINI · RESEARCH", "జెమిని · పరిశోధన")
              : mock
                ? copy("MOCK MODE", "మాక్ మోడ్")
                : copy("RESEARCH MODE", "పరిశోధన మోడ్")}
          </span>
        </div>
        <div
          className={`analysis-result-box ${result && !mock ? "has-research-result" : ""}`}
        >
          <span className="analysis-eyebrow">
            {copy("MODEL OUTPUT", "మోడల్ ఫలితం")}
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
                        "Demonstration · review required",
                        "ప్రదర్శన · సమీక్ష అవసరం",
                      )
                    : result.research_label.replaceAll("_", " ")
                  : copy("Ready for image analysis", "చిత్ర విశ్లేషణకు సిద్ధం")}
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
                  "AI-generated observations for clinician review. This report does not confirm or exclude disease.",
                  "వైద్య సమీక్ష కోసం AI పరిశీలనలు. ఈ నివేదిక వ్యాధిని నిర్ధారించదు లేదా లేదని చెప్పదు.",
                )
              : mock
                ? result
                  ? t("mockResult")
                  : copy(
                      "No trained model is connected. Mock mode demonstrates the workflow without making a medical prediction.",
                      "శిక్షణ పొందిన మోడల్ అనుసంధానం కాలేదు. మాక్ మోడ్ వైద్య అంచనా లేకుండా ప్రక్రియను చూపిస్తుంది.",
                    )
                : copy(
                    "This score is the model’s output for its predicted class, not the probability of cancer. Independent clinician review is required.",
                    "ఇది అంచనా వర్గానికి మోడల్ స్కోర్ మాత్రమే; క్యాన్సర్ సంభావ్యత కాదు. స్వతంత్ర వైద్య సమీక్ష అవసరం.",
                  )}
          </p>
        </div>
        {findings && (
          <div className="vision-report">
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
            <h5>{copy("Limitations", "పరిమితులు")}</h5>
            <ul>
              {findings.limitations.map((limitation, i) => (
                <li key={i}>{limitation}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="analysis-scope-grid">
          <div>
            <span>
              {copy("Dental / periodontal findings", "దంత / చిగుళ్ల పరిశీలనలు")}
            </span>
            <strong>{copy("Not assessed", "పరిశీలించలేదు")}</strong>
            <p>
              {copy(
                "This workflow does not diagnose cavities, gum disease, or bone loss.",
                "ఈ ప్రక్రియ పంటి రంధ్రాలు, చిగుళ్ల వ్యాధి లేదా ఎముక నష్టాన్ని నిర్ధారించదు.",
              )}
            </p>
          </div>
          <div>
            <span>
              {copy("Oral mucosa analysis", "నోటి శ్లేష్మ పొర విశ్లేషణ")}
            </span>
            <strong>
              {result && !mock && consent
                ? copy(
                    "Research result available",
                    "పరిశోధన ఫలితం అందుబాటులో ఉంది",
                  )
                : copy(
                    "Awaiting trained model",
                    "శిక్షణ పొందిన మోడల్ కోసం వేచి ఉంది",
                  )}
            </strong>
            <p>
              {visionResult || geminiMode
                ? copy(
                    "General-purpose vision AI observations. Clinical accuracy has not been measured for this project.",
                    "సాధారణ చిత్ర AI పరిశీలనలు. ఈ ప్రాజెక్టులో వైద్య ఖచ్చితత్వాన్ని కొలవలేదు.",
                  )
                : copy(
                    "Only conditions supported by the model’s labelled training data can be assessed.",
                    "లేబుల్ చేసిన శిక్షణ డేటాలో ఉన్న వర్గాలనే మోడల్ అంచనా వేయగలదు.",
                  )}
            </p>
          </div>
        </div>
        <div className="analysis-clinician-notice">
          <Stethoscope size={20} />
          <div>
            <strong>
              {copy("Clinician examination required", "వైద్య పరీక్ష అవసరం")}
            </strong>
            <p>
              {copy(
                "An image result does not establish a diagnosis. Continue with the independent clinical review in this patient record.",
                "చిత్ర ఫలితం వ్యాధి నిర్ధారణ కాదు. రోగి రికార్డులో స్వతంత్ర వైద్య సమీక్ష కొనసాగించండి.",
              )}
            </p>
          </div>
        </div>
        {geminiMode && (
          <p className="analysis-transfer-note">
            {copy(
              "Running this analysis sends the educational photograph to Google Gemini. Patient names, phone numbers, and record IDs are not included in the request.",
              "విశ్లేషణ కోసం విద్యాపరమైన చిత్రం Google Geminiకి పంపబడుతుంది. రోగి పేరు, ఫోన్ నంబరు, రికార్డు IDలు అభ్యర్థనలో పంపబడవు.",
            )}
          </p>
        )}
        {(!result || researchAvailable) && (
          <button
            className="button primary analysis-run"
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
                : geminiMode
                  ? copy("Analyse with Gemini", "జెమినితో విశ్లేషించండి")
                  : copy("Run research analysis", "పరిశోధన విశ్లేషణ")}
          </button>
        )}
        <details className="analysis-diagnostics">
          <summary>
            {copy(
              "Model details & supported conditions",
              "మోడల్ వివరాలు & అందుబాటులోని వర్గాలు",
            )}
            <ChevronDown size={15} />
          </summary>
          <dl>
            <div>
              <dt>{copy("Provider", "ప్రదాత")}</dt>
              <dd>
                {visionResult
                  ? "Google Gemini"
                  : result?.provider || (mock ? "mock" : "research")}
              </dd>
            </div>
            <div>
              <dt>{copy("Model version", "మోడల్ వెర్షన్")}</dt>
              <dd>
                {result?.model_version || copy("Not run", "అమలు చేయలేదు")}
              </dd>
            </div>
            <div>
              <dt>{copy("Supported conditions", "అందుబాటులోని వర్గాలు")}</dt>
              <dd>
                {visionResult
                  ? copy(
                      "General image observations; no validated disease classifier or calibrated probabilities.",
                      "సాధారణ చిత్ర పరిశీలనలు; ధృవీకరించిన వ్యాధి వర్గీకరణ లేదా సంభావ్యతలు లేవు.",
                    )
                  : mock
                    ? copy(
                        "None · no trained classifier",
                        "ఏవీ లేవు · శిక్షణ పొందిన వర్గీకరణ మోడల్ లేదు",
                      )
                    : copy(
                        "Defined by the connected model card; no additional diagnoses are inferred.",
                        "అనుసంధానించిన మోడల్ కార్డు ప్రకారం; అదనపు నిర్ధారణలు చేయదు.",
                      )}
              </dd>
            </div>
          </dl>
        </details>
      </section>
    </article>
  );
}
