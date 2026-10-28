import { test } from "node:test";
import assert from "node:assert/strict";
import { createServices } from "../server/index.mjs";
function harness() {
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
  const client = {
    auth: {
      getUser: async (token) => ({
        data: { user: token === "valid" ? { id: actor } : null },
        error: token === "valid" ? null : new Error("Invalid"),
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
  };
  const remote = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, options, body });
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
  };
}
test("video handler verifies consent, creates a private room and scopes expiring tokens", async () => {
  const h = harness();
  await assert.rejects(
    () => h.services.authenticate("invalid"),
    (e) => e.status === 401,
  );
  const ctx = await h.services.authenticate("valid");
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
