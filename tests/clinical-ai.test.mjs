import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeWithClinicalModel,
  clinicalAIConfigured,
  validateClinicalAssistance,
} from "../server/clinical-ai.mjs";

const env = {
  CLINICAL_AI_URL: "https://clinical-model.example.invalid/infer",
  CLINICAL_AI_KEY: "fixture-key",
  CLINICAL_AI_MODEL_VERSION: "clinical-fixture-v1",
};
const report = () => ({
  model_version: env.CLINICAL_AI_MODEL_VERSION,
  intended_use: "clinician_assistance",
  findings: {
    image_kind: "oral_photo",
    summary: "Synthetic fixture observation for clinician review.",
    visible_findings: ["Synthetic fixture visible patch."],
    possible_conditions: [],
    limitations: ["A photograph alone does not establish a diagnosis."],
  },
});

test("clinical configuration requires HTTPS, a private key and a pinned version", () => {
  assert.equal(clinicalAIConfigured(env), true);
  for (const changes of [
    { CLINICAL_AI_KEY: "" },
    { CLINICAL_AI_MODEL_VERSION: "" },
    { CLINICAL_AI_URL: "http://model.invalid/infer" },
    { CLINICAL_AI_URL: "https://key@model.invalid/infer" },
    { CLINICAL_AI_URL: "https://model.invalid/infer?key=secret" },
  ])
    assert.equal(clinicalAIConfigured({ ...env, ...changes }), false);
});

test("clinical contract produces an unsigned draft without probabilities", () => {
  const result = validateClinicalAssistance(
    report(),
    env.CLINICAL_AI_MODEL_VERSION,
  );
  assert.equal(result.provider, "clinical_assistance");
  assert.equal(result.findings.engine, "clinical");
  assert.equal(result.score, null);
  assert.equal(result.requires_clinician_review, true);
  assert.equal(result.clinical_use, false);
  assert.equal(result.warning, "AI DRAFT - CLINICIAN REVIEW REQUIRED");
});

test("research classifiers, wrong model versions, unsupported scores and inconsistent reports are rejected", () => {
  for (const value of [
    null,
    {},
    {
      model_version: env.CLINICAL_AI_MODEL_VERSION,
      label: "malignant_lesion",
      score: 0.99,
    },
    { ...report(), model_version: "wrong" },
    { ...report(), score: 0.9 },
    {
      ...report(),
      findings: { ...report().findings, image_kind: "not_oral_photo" },
    },
  ])
    assert.throws(
      () => validateClinicalAssistance(value, env.CLINICAL_AI_MODEL_VERSION),
      (e) => e.status === 502,
    );
});

test("clinical inference sends only image, language and version metadata with bounded output", async () => {
  let sent;
  const result = await analyzeWithClinicalModel({
    bytes: Buffer.from("synthetic-image"),
    env,
    language: "te",
    fetcher: async (url, options) => {
      assert.equal(url, env.CLINICAL_AI_URL);
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, "Bearer fixture-key");
      sent = JSON.parse(options.body);
      return Response.json(report());
    },
  });
  assert.deepEqual(Object.keys(sent).sort(), [
    "image_base64",
    "intended_use",
    "language",
    "mime_type",
    "model_version",
  ]);
  assert.equal(result.findings.language, "te");
  assert.equal(
    sent.image_base64,
    Buffer.from("synthetic-image").toString("base64"),
  );
});

test("clinical provider errors, redirects, oversized bodies and timeouts produce no draft", async () => {
  for (const [fetcher, status] of [
    [async () => new Response("unavailable", { status: 503 }), 503],
    [async () => new Response("busy", { status: 429 }), 429],
    [async () => new Response("redirect", { status: 302 }), 503],
    [
      async () =>
        new Response("<html>bad</html>", {
          headers: { "Content-Type": "text/html" },
        }),
      502,
    ],
    [
      async () =>
        new Response("x".repeat(128001), {
          headers: { "Content-Type": "application/json" },
        }),
      502,
    ],
    [async () => Response.json({}), 502],
    [
      async (_, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        ),
      504,
    ],
  ]) {
    const keepAlive = setTimeout(() => {}, 100);
    try {
      await assert.rejects(
        () =>
          analyzeWithClinicalModel({
            bytes: Buffer.from("fixture"),
            env,
            fetcher,
            timeoutMs: 20,
          }),
        (e) => e.status === status,
      );
    } finally {
      clearTimeout(keepAlive);
    }
  }
});
