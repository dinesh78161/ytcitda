// Render the actual clinical photo/consent components with synthetic context.
// No browser, patient records, provider requests or real credentials are used.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server, OralAnalysis, ConsentPanel;
before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    appType: "custom",
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    ssr: {
      external: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "lucide-react",
      ],
    },
    plugins: [
      react(),
      {
        name: "synthetic-clinical-ui-context",
        enforce: "pre",
        resolveId(source, importer) {
          if (
            source === "./App" ||
            /[\\/]src[\\/]App\.tsx(?:\?.*)?$/.test(source)
          )
            return "\0clinical-ui-context";
          if (
            source === "./lib/client" ||
            source === "./client" ||
            /[\\/]src[\\/]lib[\\/]client\.ts(?:\?.*)?$/.test(source)
          )
            return "\0clinical-ui-client";
        },
        load(id) {
          if (id === "\0clinical-ui-context")
            return "export function useApp(){return globalThis.__clinicalAiUiFixture;} export function Badge(){return null;} export function Field(){return null;} export function Modal(){return null;}";
          if (id === "\0clinical-ui-client")
            return "export const isClinical=true; export const isCloud=true; export const supabase=null;";
        },
      },
    ],
  });
  OralAnalysis = (await server.ssrLoadModule("/src/OralAnalysis.tsx")).default;
  ConsentPanel = (await server.ssrLoadModule("/src/CarePanels.tsx"))
    .ConsentPanel;
});
after(async () => {
  delete globalThis.__clinicalAiUiFixture;
  await server?.close();
});

const image = {
  id: "fixture-image",
  patient_id: "fixture-patient",
  quality_status: "acceptable",
  quality_details: {},
  created_at: "2026-11-10T00:00:00Z",
};
const draft = {
  id: "fixture-draft",
  image_id: image.id,
  provider: "clinical_assistance",
  status: "completed",
  model_version: "fixture-v1",
  created_at: "2026-11-10T00:00:00Z",
  score: null,
  findings: {
    engine: "clinical",
    image_kind: "oral_photo",
    summary: "Synthetic clinical draft summary",
    visible_findings: ["Synthetic visible finding"],
    possible_conditions: [],
    limitations: ["Independent examination required"],
  },
};
function setup({
  consent = true,
  role = "medical_officer",
  results = [],
} = {}) {
  globalThis.__clinicalAiUiFixture = {
    lang: "en",
    t: (x) => x,
    run: async (f) => f(),
    w: {
      profile: { role },
      busy: false,
      services: { ai: true, ai_provider: "clinical" },
      execute: async () => {},
      data: {
        ai_analyses: results,
        consents: consent
          ? [
              {
                patient_id: image.patient_id,
                purpose: "ai_assistance",
                granted: true,
                recorded_at: "2026-11-10T00:00:00Z",
              },
            ]
          : [],
      },
    },
  };
}
const renderPhoto = () =>
  renderToStaticMarkup(
    React.createElement(OralAnalysis, { image, consent: true }),
  );

test("clinical photo assistance is available to a clinician with separate AI consent", () => {
  setup();
  const html = renderPhoto();
  assert.match(html, /Request AI assistance/);
  assert.match(html, /AI output is an unsigned draft/);
  const button = html.match(
    /<button[^>]*class="button primary analysis-run[^>]*>/,
  )?.[0];
  assert.ok(button);
  assert.doesNotMatch(button, /disabled/);
  assert.doesNotMatch(html, /Model class score/);
});

test("missing AI consent disables the request and hides existing draft findings", () => {
  setup({ consent: false, results: [draft] });
  const html = renderPhoto();
  assert.match(html, /Record separate AI image assistance consent/);
  assert.match(
    html.match(/<button[^>]*class="button primary analysis-run[^>]*>/)?.[0] ||
      "",
    /disabled/,
  );
  assert.doesNotMatch(html, /Synthetic clinical draft summary/);
});

test("clinical drafts render as unsigned observations and research results stay out", () => {
  setup({ results: [draft] });
  assert.match(renderPhoto(), /Synthetic clinical draft summary/);
  assert.match(renderPhoto(), /AI DRAFT/);
  setup({ results: [{ ...draft, provider: "research" }] });
  assert.doesNotMatch(renderPhoto(), /Synthetic clinical draft summary/);
  setup({ role: "health_worker", results: [draft] });
  assert.doesNotMatch(
    renderPhoto(),
    /Synthetic clinical draft summary|Request AI assistance/,
  );
});

test("consent panel explains model processing separately from taking a photo", () => {
  setup({ consent: false });
  const html = renderToStaticMarkup(
    React.createElement(ConsentPanel, { patient: { id: image.patient_id } }),
  );
  assert.match(html, /AI image assistance/);
  assert.match(
    html,
    /photograph is sent to the configured clinical model service/,
  );
  assert.match(html, /separately from photo consent/);
});
