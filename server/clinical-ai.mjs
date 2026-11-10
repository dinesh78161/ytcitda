import { HttpError, requireValue } from "./validation.mjs";
import { validateGeminiFindings } from "./gemini.mjs";

const languages = new Set([
  "en",
  "te",
  "hi",
  "ta",
  "kn",
  "ml",
  "mr",
  "bn",
  "or",
]);

export function clinicalAIConfigured(env) {
  try {
    const url = new URL(env.CLINICAL_AI_URL);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      Boolean(env.CLINICAL_AI_KEY?.trim()) &&
      typeof env.CLINICAL_AI_MODEL_VERSION === "string" &&
      env.CLINICAL_AI_MODEL_VERSION.trim().length > 0 &&
      env.CLINICAL_AI_MODEL_VERSION.length <= 120
    );
  } catch {
    return false;
  }
}

export function validateClinicalAssistance(raw, expectedVersion) {
  requireValue(
    raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      Object.keys(raw).length === 3 &&
      raw.model_version === expectedVersion &&
      raw.intended_use === "clinician_assistance" &&
      raw.findings &&
      Object.keys(raw.findings).length === 5,
    502,
    "The clinical model returned an unexpected version or report contract. No AI draft was saved.",
  );
  // Reuse the bounded observations schema, not Gemini's endpoint or instructions.
  let findings;
  try {
    findings = validateGeminiFindings(raw.findings);
  } catch {
    throw new HttpError(
      502,
      "The clinical model returned invalid or inconsistent findings. No AI draft was saved.",
    );
  }
  findings.engine = "clinical";
  findings.prompt_version = "clinical-assistance-contract-v1";
  return {
    provider: "clinical_assistance",
    model_version: expectedVersion,
    research_label:
      findings.image_kind === "oral_photo"
        ? "clinician_assistance_draft"
        : findings.image_kind === "not_oral_photo"
          ? "not_an_oral_photo"
          : "image_not_assessable",
    findings,
    score: null,
    status: "completed",
    clinical_use: false,
    requires_clinician_review: true,
    warning: "AI DRAFT - CLINICIAN REVIEW REQUIRED",
  };
}

export async function analyzeWithClinicalModel({
  bytes,
  env,
  language = "en",
  fetcher = fetch,
  timeoutMs = 45000,
}) {
  requireValue(
    clinicalAIConfigured(env),
    503,
    "Configure a clinical-use model endpoint, private key and pinned model version.",
  );
  requireValue(
    languages.has(language),
    400,
    "Select a supported report language.",
  );
  const signal = AbortSignal.timeout(timeoutMs);
  let response, raw;
  try {
    response = await fetcher(env.CLINICAL_AI_URL, {
      method: "POST",
      redirect: "error",
      signal,
      headers: {
        Authorization: `Bearer ${env.CLINICAL_AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_version: env.CLINICAL_AI_MODEL_VERSION,
        intended_use: "clinician_assistance",
        language,
        mime_type: "image/jpeg",
        image_base64: Buffer.from(bytes).toString("base64"),
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(
        response.status === 429 ? 429 : 503,
        response.status === 429
          ? "Clinical model capacity reached. Try again later; no AI draft was saved."
          : "The clinical model is unavailable. Clinician review remains available.",
      );
    }
    requireValue(
      /application\/json/i.test(response.headers.get("content-type") || ""),
      502,
      "The clinical model returned an invalid response format.",
    );
    // Bound the response while streaming; do not buffer an unbounded provider body.
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      requireValue(
        length <= 128_000,
        502,
        "The clinical model report exceeded the response limit.",
      );
      chunks.push(chunk);
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (signal.aborted)
      throw new HttpError(
        504,
        "The clinical model timed out. No AI draft was saved.",
      );
    throw new HttpError(
      502,
      "The clinical model could not return a readable report. No AI draft was saved.",
    );
  }
  const result = validateClinicalAssistance(raw, env.CLINICAL_AI_MODEL_VERSION);
  result.findings.language = language;
  return result;
}
