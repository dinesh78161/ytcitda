// Explicit, retained presentation fixture in an evaluation workspace only.
// No messages, password changes, MFA bypasses or real-patient data are involved.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { hostedClients, demoSession, checked } from "./hosted-session.mjs";

const base = process.argv[2]?.replace(/\/$/, "");
if (
  ![
    "https://aarogya-drishti-om9g.onrender.com",
    "http://127.0.0.1:8792",
  ].includes(base)
)
  throw new Error(
    "Use the documented hosted app or the isolated local production server on port 8792.",
  );
const status = await (
  await fetch(base + "/api/status", { signal: AbortSignal.timeout(60000) })
).json();
assert.equal(
  status.workspace_mode,
  "evaluation",
  "This check only creates a labelled evaluation fixture.",
);
assert.equal(
  status.oral_model_ready,
  true,
  "Deploy the bundled-model release before running this check.",
);
const clients = hostedClients();
let actor;
try {
  actor = await demoSession(clients, "health_worker");
  const policy = await actor.client.rpc("workspace_policy");
  if (policy.error)
    assert.ok(
      ["PGRST202", "42883"].includes(policy.error.code),
      "Workspace policy check must succeed or identify the legacy evaluation schema.",
    );
  else assert.equal(policy.data.mode, "evaluation");
  const call = async (path, body) => {
    const response = await fetch(base + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${actor.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        `${path} failed (${response.status}): ${result.error || "request failed"}`,
      );
    return result;
  };
  const file = new URL(
    "../test-results/live-oral-presentation-case.json",
    import.meta.url,
  );
  let fixture;
  try {
    fixture = JSON.parse(await readFile(file, "utf8"));
  } catch {
    if (!process.argv.includes("--create-case"))
      throw new Error(
        "Pass --create-case once to create the retained, clearly labelled presentation test case.",
      );
    fixture = {
      patient_id: crypto.randomUUID(),
      screening_id: crypto.randomUUID(),
      image_id: crypto.randomUUID(),
      name: "PRESENTATION TEST - Oral AI 12 Nov",
    };
    await mkdir(new URL("../test-results/", import.meta.url), {
      recursive: true,
    });
    await writeFile(file, JSON.stringify(fixture, null, 2) + "\n");
  }
  checked(
    await actor.client.rpc("submit_workflow", {
      request_id: fixture.patient_id,
      action: "register",
      payload: {
        patient_id: fixture.patient_id,
        screening_id: fixture.screening_id,
        display_name: fixture.name,
        age_years: 46,
        village: "Presentation test case",
        consent: true,
        photo_consent: true,
        language: "en",
      },
    }),
    "Presentation registration",
  );
  const patient = checked(
    await actor.client
      .from("patients")
      .select("id,is_synthetic")
      .eq("id", fixture.patient_id)
      .single(),
    "Presentation record",
  );
  assert.equal(patient.is_synthetic, true);
  const bytes = await readFile(
    new URL("../public/samples/left_buccal_mucosa.jpg", import.meta.url),
  );
  const upload = await call("/api/upload", {
    kind: "oral",
    patient_id: fixture.patient_id,
    oral_view: "left_buccal_mucosa",
    request_id: fixture.image_id,
    data_url: `data:image/jpeg;base64,${bytes.toString("base64")}`,
  });
  const started = performance.now();
  const result = await call("/api/analyze", {
    image_id: fixture.image_id,
    engine: "bundled_oral",
    lesion_confirmed: true,
    language: "en",
  });
  assert.equal(result.model_version, "oral-mendeley-v1");
  assert.equal(result.clinical_use, false);
  assert.equal(result.requires_clinician_review, true);
  const saved = checked(
    await actor.client
      .from("ai_analyses")
      .select("id,model_version,research_label,score")
      .eq("id", result.id)
      .single(),
    "Saved model result",
  );
  assert.equal(saved.model_version, result.model_version);
  const report = {
    passed: true,
    base,
    patient_id: fixture.patient_id,
    image_id: fixture.image_id,
    analysis_id: result.id,
    model_version: result.model_version,
    label: result.research_label,
    score: result.score,
    elapsed_milliseconds: Math.round(performance.now() - started),
    case_name: fixture.name,
    scope:
      "Retained synthetic presentation case. Real inference and persistence; no medical accuracy claim.",
  };
  await writeFile(
    new URL("../test-results/live-oral-verification.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await actor?.client.auth.signOut({ scope: "local" });
}
