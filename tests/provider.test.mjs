import { test } from "node:test";
import assert from "node:assert/strict";
import { createServices } from "../server/index.mjs";
import { TokenVerifier } from "livekit-server-sdk";
test("Gemini mode starts without rejecting the configured AI mode", () => {
  const services = createServices({ SCREENING_AI_MODE: "gemini" });
  assert.equal(services.status().ai, false);
  assert.equal(services.status().ai_provider, "disabled");
});
function harness(overrides = {}, providerResponse) {
  const person = crypto.randomUUID(),
    actor = crypto.randomUUID(),
    appointment = crypto.randomUUID(),
    image = crypto.randomUUID();
  const profile = {
    id: actor,
    active: true,
    role: "medical_officer",
    display_name: "Synthetic Clinician",
  };
  const rows = {
    profiles: [profile],
    patients: [{ id: person }],
    consents: [
      { patient_id: person, purpose: "teleconsultation", granted: true },
      { patient_id: person, purpose: "image_capture", granted: true },
    ],
    appointments: [
      {
        id: appointment,
        patient_id: person,
        mode: "video",
        status: "confirmed",
        starts_at: new Date(Date.now() - 60000).toISOString(),
        ends_at: new Date(Date.now() + 1800000).toISOString(),
      },
    ],
    images: [
      {
        id: image,
        patient_id: person,
        quality_status: "acceptable",
        object_key: `${person}/image.jpg`,
      },
    ],
  };
  const writes = [],
    calls = [];
  const validToken = `test.${Buffer.from(JSON.stringify({ sub: actor, aal: "aal2" })).toString("base64url")}.verified-by-test-stub`;
  const client = {
    rpc: async () => ({ data: { version: 1 }, error: null }),
    auth: {
      getUser: async (token) => ({
        data: { user: token === validToken ? { id: actor } : null },
        error: token === validToken ? null : new Error("Invalid"),
      }),
    },
    from(table) {
      let filters = [],
        inserted = null;
      const result = () => ({
        data: inserted
          ? [{ id: crypto.randomUUID(), ...inserted }]
          : (rows[table] || []).filter((r) =>
              filters.every(([k, v]) => r[k] === v),
            ),
        error: null,
      });
      const q = {
        select: () => q,
        eq: (k, v) => {
          filters.push([k, v]);
          return q;
        },
        order: () => q,
        limit: () => q,
        insert: (value) => {
          inserted = value;
          writes.push({ table, value });
          return q;
        },
        single: async () => ({ ...result(), data: result().data[0] || null }),
        maybeSingle: async () => ({
          ...result(),
          data: result().data[0] || null,
        }),
        then: (resolve, reject) =>
          Promise.resolve(result()).then(resolve, reject),
      };
      return q;
    },
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob(["synthetic-jpeg"]),
          error: null,
        }),
      }),
    },
  };
  const env = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-key",
    SUPABASE_PUBLISHABLE_KEY: "public-key",
    DAILY_API_KEY: "daily-test-key",
    SCREENING_MODEL_URL: "https://model.example.invalid/infer",
    SCREENING_MODEL_KEY: "model-test-key",
    SCREENING_MODEL_VERSION: "test-v1",
    ...overrides,
  };
  const remote = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, options, body });
    if (
      providerResponse &&
      url.startsWith("https://generativelanguage.googleapis.com/")
    )
      return providerResponse(body, options);
    if (options.method === "GET") return new Response("{}", { status: 404 });
    if (url.endsWith("/rooms"))
      return Response.json({
        privacy: "private",
        url: `https://synthetic.daily.co/${body.name}`,
      });
    if (url.endsWith("/meeting-tokens"))
      return Response.json({ token: "scoped-test-token" });
    return Response.json({
      model_version: "test-v1",
      label: "review_required",
      score: 0.75,
    });
  };
  const services = createServices(env, remote, () => client);
  return {
    services,
    client,
    ctx: { user: client, profile },
    rows,
    calls,
    writes,
    person,
    appointment,
    image,
    validToken,
  };
}

const geminiReport = () => ({
  image_kind: "oral_photo",
  summary:
    "Synthetic report fixture: a visible patch requires clinician review.",
  visible_findings: ["Synthetic pale patch description."],
  possible_conditions: [
    {
      name: "Possible irritation",
      visual_basis: "Synthetic surface change; not a diagnosis.",
    },
  ],
  limitations: ["A photograph cannot establish a diagnosis."],
});
const geminiResponse = (report = geminiReport()) =>
  Response.json({
    modelVersion: "gemini-3.8-flash",
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(report) }] },
      },
    ],
  });

test("Gemini receives only image data and returns persisted observations without a fabricated score", async () => {
  const h = harness(
    { SCREENING_AI_MODE: "gemini", GEMINI_API_KEY: "synthetic-gemini-key" },
    () => geminiResponse(),
  );
  assert.equal(h.services.status().ai_provider, "gemini");
  const result = await h.services.handle(
    "/api/analyze",
    { image_id: h.image },
    h.ctx,
  );
  assert.equal(result.provider, "research");
  assert.equal(result.score, null);
  assert.equal(result.findings.engine, "gemini");
  assert.equal(result.findings.visible_findings.length, 1);
  assert.equal(result.clinical_use, false);
  assert.equal(result.requires_clinician_review, true);
  const call = h.calls[0];
  assert.ok(call.url.endsWith(":generateContent"));
  assert.ok(!call.url.includes("synthetic-gemini-key"));
  assert.equal(call.options.headers["x-goog-api-key"], "synthetic-gemini-key");
  assert.equal(
    call.body.contents[0].parts[0].inlineData.data,
    Buffer.from("synthetic-jpeg").toString("base64"),
  );
  assert.ok(!JSON.stringify(call.body).includes(h.person));
  assert.ok(!JSON.stringify(call.body).includes(h.ctx.profile.display_name));
  assert.deepEqual(
    h.writes.find((w) => w.table === "ai_analyses").value.findings,
    result.findings,
  );
});

test("Gemini refuses missing configuration and missing findings migration before sending an image", async () => {
  const missing = harness({ SCREENING_AI_MODE: "gemini", GEMINI_API_KEY: "" });
  assert.equal(missing.services.status().ai, false);
  await assert.rejects(
    () =>
      missing.services.handle(
        "/api/analyze",
        { image_id: missing.image },
        missing.ctx,
      ),
    (e) => e.status === 503,
  );
  assert.equal(missing.calls.length, 0);
  const oldSchema = harness({
    SCREENING_AI_MODE: "gemini",
    GEMINI_API_KEY: "synthetic-key",
  });
  oldSchema.client.rpc = async () => ({
    data: null,
    error: new Error("Missing migration"),
  });
  await assert.rejects(
    () =>
      oldSchema.services.handle(
        "/api/analyze",
        { image_id: oldSchema.image },
        oldSchema.ctx,
      ),
    (e) => e.status === 503,
  );
  assert.equal(oldSchema.calls.length, 0);
});

test("Gemini failures, blocked content, invalid schemas and truncated responses never create a mock or saved result", async () => {
  for (const response of [
    () => new Response("{}", { status: 429 }),
    () => new Response("{}", { status: 503 }),
    () => new Response("{}", { status: 403 }),
    () => {
      throw new Error("Connection failed");
    },
    () => Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
    () =>
      Response.json({
        candidates: [
          { finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } },
        ],
      }),
    () =>
      Response.json({
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "not JSON" }] } },
        ],
      }),
    () => geminiResponse({ ...geminiReport(), summary: "" }),
    () => geminiResponse({ ...geminiReport(), image_kind: "not_oral_photo" }),
    () => geminiResponse({ ...geminiReport(), score: 0.99 }),
  ]) {
    const h = harness(
      { SCREENING_AI_MODE: "gemini", GEMINI_API_KEY: "synthetic-key" },
      response,
    );
    await assert.rejects(() =>
      h.services.handle("/api/analyze", { image_id: h.image }, h.ctx),
    );
    assert.equal(h.writes.filter((w) => w.table === "ai_analyses").length, 0);
  }
});

test("Gemini retains unsuitable-image reports without invented oral findings and rechecks consent after inference", async () => {
  const report = {
    image_kind: "not_oral_photo",
    summary: "A test pattern is not an oral photograph.",
    visible_findings: [],
    possible_conditions: [],
    limitations: ["Upload an original educational oral photograph."],
  };
  const h = harness(
    { SCREENING_AI_MODE: "gemini", GEMINI_API_KEY: "synthetic-key" },
    () => geminiResponse(report),
  );
  const result = await h.services.handle(
    "/api/analyze",
    { image_id: h.image },
    h.ctx,
  );
  assert.equal(result.research_label, "not_an_oral_photo");
  assert.equal(result.score, null);
  const revoked = harness(
    { SCREENING_AI_MODE: "gemini", GEMINI_API_KEY: "synthetic-key" },
    () => {
      revoked.rows.consents[1].granted = false;
      return geminiResponse();
    },
  );
  await assert.rejects(
    () =>
      revoked.services.handle(
        "/api/analyze",
        { image_id: revoked.image },
        revoked.ctx,
      ),
    (e) => e.status === 403,
  );
  assert.equal(
    revoked.writes.filter((w) => w.table === "ai_analyses").length,
    0,
  );
});
test("video handler verifies consent, creates a private room and scopes expiring tokens", async () => {
  const h = harness();
  await assert.rejects(
    () => h.services.authenticate("invalid"),
    (e) => e.status === 401,
  );
  const ctx = await h.services.authenticate(h.validToken);
  const result = await h.services.handle(
    "/api/video",
    { appointment_id: h.appointment },
    ctx,
  );
  assert.match(result.url, /^https:\/\/synthetic\.daily\.co\/ad-/);
  const room = h.calls.find((c) => c.url.endsWith("/rooms")),
    token = h.calls.find((c) => c.url.endsWith("/meeting-tokens"));
  assert.equal(room.body.privacy, "private");
  assert.equal(token.body.properties.room_name, room.body.name);
  assert.equal(token.body.properties.is_owner, false);
  assert.equal(token.body.properties.eject_at_token_exp, true);
  assert.ok(
    h.writes.some(
      (w) =>
        w.table === "audit_events" &&
        w.value.action === "JOIN_VIDEO" &&
        w.value.actor_id === ctx.profile.id,
    ),
  );
});
test("hosted mock analysis is labelled, stored and never contacts a model provider", async () => {
  const h = harness({ SCREENING_AI_MODE: "mock" });
  assert.equal(h.services.status().ai_provider, "mock");
  const result = await h.services.handle(
    "/api/analyze",
    { image_id: h.image },
    h.ctx,
  );
  assert.equal(result.provider, "mock");
  assert.equal(result.score, null);
  assert.equal(result.clinical_use, false);
  assert.equal(result.requires_clinician_review, true);
  assert.equal(result.warning, "NOT FOR CLINICAL USE");
  assert.equal(h.calls.length, 0);
  assert.ok(
    h.writes.some(
      (w) => w.table === "ai_analyses" && w.value.provider === "mock",
    ),
  );
  h.rows.images[0].quality_status = "recapture";
  await assert.rejects(
    () => h.services.handle("/api/analyze", { image_id: h.image }, h.ctx),
    (e) => e.status === 409,
  );
  h.rows.images[0].quality_status = "acceptable";
  h.rows.consents[1].granted = false;
  await assert.rejects(
    () => h.services.handle("/api/analyze", { image_id: h.image }, h.ctx),
    (e) => e.status === 403,
  );
});
test("LiveKit tokens are verified, appointment-scoped and grant no recording or administration", async () => {
  const h = harness({
    VIDEO_PROVIDER: "livekit",
    LIVEKIT_URL: "wss://demo.livekit.cloud",
    LIVEKIT_API_KEY: "test-key",
    LIVEKIT_API_SECRET: "synthetic-test-secret-at-least-32-characters",
  });
  const result = await h.services.handle(
    "/api/video",
    { appointment_id: h.appointment },
    h.ctx,
  );
  assert.equal(result.provider, "livekit");
  assert.equal(result.server_url, "wss://demo.livekit.cloud");
  const claims = await new TokenVerifier(
    "test-key",
    "synthetic-test-secret-at-least-32-characters",
  ).verify(result.token);
  assert.equal(claims.sub, h.ctx.profile.id);
  assert.equal(claims.video.room, result.room_name);
  assert.equal(claims.video.roomJoin, true);
  assert.equal(claims.video.roomAdmin, false);
  assert.equal(claims.video.roomRecord, false);
  assert.equal(claims.video.canPublishData, false);
  assert.deepEqual(claims.video.canPublishSources, ["camera", "microphone"]);
  assert.ok(Math.abs(claims.exp - result.expires_at) <= 1);
  assert.equal(h.calls.length, 0);
  assert.ok(!JSON.stringify(claims).includes(h.person));
  h.rows.consents[0].granted = false;
  await assert.rejects(
    () =>
      h.services.handle("/api/video", { appointment_id: h.appointment }, h.ctx),
    (e) => e.status === 403,
  );
  h.rows.consents[0].granted = true;
  h.ctx.profile.role = "navigator";
  await assert.rejects(
    () =>
      h.services.handle("/api/video", { appointment_id: h.appointment }, h.ctx),
    (e) => e.status === 403,
  );
});
test("disabled or missing research configuration never silently falls back to mock", async () => {
  for (const config of [
    { SCREENING_AI_MODE: "disabled" },
    { SCREENING_AI_MODE: "research", SCREENING_MODEL_KEY: "" },
  ]) {
    const h = harness(config);
    assert.equal(h.services.status().ai, false);
    await assert.rejects(
      () => h.services.handle("/api/analyze", { image_id: h.image }, h.ctx),
      (e) => e.status === 503,
    );
    assert.equal(h.writes.length, 0);
    assert.equal(h.calls.length, 0);
  }
});
test("unassigned and withdrawn-consent calls fail before contacting any provider", async () => {
  const h = harness();
  h.rows.consents[0].granted = false;
  await assert.rejects(
    () =>
      h.services.handle("/api/video", { appointment_id: h.appointment }, h.ctx),
    (e) => e.status === 403,
  );
  assert.equal(h.calls.length, 0);
  h.rows.consents[0].granted = true;
  h.rows.patients = [];
  await assert.rejects(
    () =>
      h.services.handle("/api/video", { appointment_id: h.appointment }, h.ctx),
    (e) => e.status === 403,
  );
  assert.equal(h.calls.length, 0);
  h.ctx.profile.role = "navigator";
  await assert.rejects(
    () =>
      h.services.handle("/api/video", { appointment_id: h.appointment }, h.ctx),
    (e) => e.status === 403,
  );
});
test("analysis sends image bytes without identifiers and stores research-only results", async () => {
  const h = harness();
  const result = await h.services.handle(
    "/api/analyze",
    { image_id: h.image },
    h.ctx,
  );
  assert.equal(result.clinical_use, false);
  assert.equal(result.model_version, "test-v1");
  assert.deepEqual(Object.keys(h.calls[0].body).sort(), [
    "image_base64",
    "mime_type",
    "model_version",
  ]);
  assert.ok(!JSON.stringify(h.calls[0].body).includes(h.person));
  assert.equal(
    h.writes.find((w) => w.table === "ai_analyses").value
      .requires_clinician_review,
    true,
  );
  h.rows.consents[1].granted = false;
  await assert.rejects(
    () => h.services.handle("/api/analyze", { image_id: h.image }, h.ctx),
    (e) => e.status === 403,
  );
});
