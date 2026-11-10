// Render the real photo component with an evaluation-workspace fixture.
// These verify presentation and provider selection, not model accuracy.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server, OralAnalysis;
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
        name: "oral-observation-fixture",
        enforce: "pre",
        resolveId(source) {
          if (source === "./App") return "\0oral-test-context";
          if (source === "./lib/client" || source === "./client")
            return "\0oral-test-client";
        },
        load(id) {
          if (id === "\0oral-test-context")
            return "export function useApp(){return globalThis.__oralObservationUiFixture;}";
          if (id === "\0oral-test-client")
            return "export const isClinical=false; export const isCloud=true; export const supabase=null;";
        },
      },
    ],
  });
  OralAnalysis = (await server.ssrLoadModule("/src/OralAnalysis.tsx")).default;
});
after(async () => {
  delete globalThis.__oralObservationUiFixture;
  await server?.close();
});

const image = {
  id: "test-image",
  patient_id: "test-patient",
  quality_status: "acceptable",
  quality_details: { sharpness: 95, brightness: 125, glare_percent: 0 },
};
function render({
  assessment,
  provider = "gemini",
  photo = image,
  consent = true,
} = {}) {
  const findings = assessment
    ? {
        engine: "gemini",
        image_kind:
          assessment === "not_assessable" ? "uncertain" : "oral_photo",
        oral_assessment: assessment,
        summary: "Fixture observations from the submitted photo.",
        visible_findings:
          assessment === "visible_changes"
            ? ["Visible patch in the photographed tissue."]
            : [],
        possible_conditions: [],
        limitations: ["A photograph cannot rule out disease."],
      }
    : null;
  globalThis.__oralObservationUiFixture = {
    lang: "en",
    t: (x) => x,
    run: async (f) => f(),
    w: {
      profile: { role: "health_worker" },
      busy: false,
      execute: async () => {},
      services: { ai: true, ai_provider: provider, oral_model_ready: true },
      data: {
        ai_analyses: findings
          ? [
              {
                id: "test-result",
                image_id: image.id,
                provider: "research",
                status: "completed",
                created_at: "2026-11-10T00:00:00Z",
                findings,
                score: null,
              },
            ]
          : [],
        consents: [],
      },
    },
  };
  return renderToStaticMarkup(
    React.createElement(OralAnalysis, {
      image: photo,
      consent,
      onRetake: () => {},
    }),
  );
}

test("configured image understanding remains the default when the lesion classifier is loaded", () => {
  const html = render();
  assert.match(html, /Analyse oral photograph/);
  assert.match(html, /GEMINI/);
  assert.doesNotMatch(
    html,
    /Analyse with oral model|Model class score|visible lesion is present/,
  );
  const button = html.match(
    /<button[^>]*class="button primary analysis-run[^>]*>/,
  )?.[0];
  assert.ok(button);
  assert.doesNotMatch(button, /disabled/);
});

test("healthy-looking, visibly changed and unassessable findings have distinct conclusions", () => {
  const clear = render({ assessment: "no_visible_abnormality" });
  assert.match(clear, /No visible abnormality in this photo/);
  assert.doesNotMatch(
    clear,
    /Model classification:|Model class score|Possible conditions/,
  );
  assert.match(clear, /cannot rule out disease/);
  const changes = render({ assessment: "visible_changes" });
  assert.match(changes, /Visible changes — clinician review needed/);
  assert.match(changes, /Visible patch in the photographed tissue/);
  assert.match(
    render({ assessment: "not_assessable" }),
    /Photo cannot be assessed/,
  );
});

test("a sharpness-22 photo gives retake instructions and never a healthy or lesion conclusion", () => {
  const html = render({
    photo: {
      ...image,
      quality_status: "recapture",
      quality_details: { sharpness: 22, brightness: 125, glare_percent: 0 },
    },
  });
  assert.match(html, /Hold device steady and focus/);
  assert.match(html, /Retake oral photo/);
  assert.match(html, /photo quality, not whether the person is healthy/);
  assert.doesNotMatch(
    html,
    /Model class score|No visible abnormality in this photo|Model classification:/,
  );
  assert.match(
    html.match(/<button[^>]*class="button primary analysis-run[^>]*>/)?.[0] ||
      "",
    /disabled/,
  );
});

test("local-only classification requires visible-lesion confirmation and cannot silently screen a healthy mouth", () => {
  const html = render({ provider: "local" });
  assert.match(html, /two-class model cannot assess a healthy mouth/);
  assert.match(html, /<input[^>]*type="checkbox"/);
  assert.match(
    html.match(/<button[^>]*class="button primary analysis-run[^>]*>/)?.[0] ||
      "",
    /disabled/,
  );
});

test("withdrawn photo consent hides image observations", () => {
  const html = render({ assessment: "no_visible_abnormality", consent: false });
  assert.doesNotMatch(
    html,
    /No visible abnormality in this photo|Fixture observations from the submitted photo/,
  );
});
