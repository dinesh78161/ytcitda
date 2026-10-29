import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createStaticHandler } from "./static.mjs";
import { storePrivateUpload } from "./private-upload.mjs";
import { enforceVerifiedAssurance } from "./security.mjs";
import {
  analyzeWithGemini,
  GEMINI_DEFAULT_MODEL,
  MEDGEMMA_DEFAULT_MODEL,
} from "./gemini.mjs";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import {
  HttpError,
  requireValue,
  uuid,
  validateFile,
  validateModelResult,
  videoWindow,
} from "./validation.mjs";

const checked = (result) => {
  if (result.error)
    throw new HttpError(
      502,
      "The data service could not complete this request.",
    );
  return result.data;
};
export function createServices(
  env = process.env,
  fetcher = fetch,
  clientFactory = createClient,
) {
  const configured = Boolean(
    env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY,
  );
  const clinical = env.WORKSPACE_MODE === "clinical";
  requireValue(
    !env.WORKSPACE_MODE ||
      ["evaluation", "clinical"].includes(env.WORKSPACE_MODE),
    503,
    "WORKSPACE_MODE must be evaluation or clinical.",
  );
  const admin = configured
    ? clientFactory(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  const aiMode =
    env.SCREENING_AI_MODE || (env.SCREENING_MODEL_URL ? "research" : "mock");
  requireValue(
    ["mock", "research", "gemini", "medgemma", "disabled"].includes(aiMode),
    503,
    "SCREENING_AI_MODE must be mock, research, gemini, medgemma or disabled.",
  );
  const aiEnabled =
    !clinical &&
    configured &&
    (aiMode === "mock" ||
      ((aiMode === "gemini" || aiMode === "medgemma") &&
        Boolean(env.GEMINI_API_KEY?.trim())) ||
      (aiMode === "research" &&
        !!(
          env.SCREENING_MODEL_URL &&
          env.SCREENING_MODEL_KEY &&
          env.SCREENING_MODEL_VERSION
        )));
  const videoProvider =
    env.VIDEO_PROVIDER ||
    (env.LIVEKIT_URL ? "livekit" : env.DAILY_API_KEY ? "daily" : "disabled");
  requireValue(
    ["livekit", "daily", "disabled"].includes(videoProvider),
    503,
    "VIDEO_PROVIDER must be livekit, daily or disabled.",
  );
  const videoEnabled =
    configured &&
    (videoProvider === "livekit"
      ? !!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET)
      : videoProvider === "daily" && !!env.DAILY_API_KEY);
  const status = () => ({
    database: configured,
    files: configured,
    video: videoEnabled,
    video_provider: videoEnabled ? videoProvider : "disabled",
    ai: aiEnabled,
    ai_provider: aiEnabled ? aiMode : "disabled",
    workspace_mode: clinical ? "clinical" : "evaluation",
    reminders:
      configured &&
      env.REMINDER_DELIVERY_ENABLED === "true" &&
      !!(env.REMINDER_WEBHOOK_URL && env.REMINDER_WEBHOOK_KEY),
  });
  const remote = async (url, key, body, method = "POST") => {
    requireValue(
      new URL(url).protocol === "https:",
      503,
      "Provider endpoint must use HTTPS.",
    );
    let response;
    try {
      response = await fetcher(url, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });
    } catch {
      throw new HttpError(502, "The provider is unavailable. Please retry.");
    }
    if (response.status === 404 && method === "GET") return null;
    requireValue(
      response.ok,
      502,
      "The provider could not complete this request.",
    );
    return response.json();
  };
  async function authenticate(token) {
    requireValue(
      configured,
      503,
      "Configure Supabase on the API server first.",
    );
    requireValue(token, 401, "Sign in first.");
    const { data, error } = await admin.auth.getUser(token);
    requireValue(!error && data?.user, 401, "Session expired. Sign in again.");
    const user = clientFactory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const profile = checked(
      await user.from("profiles").select("*").eq("id", data.user.id).single(),
    );
    requireValue(profile?.active, 403, "An active staff profile is required.");
    enforceVerifiedAssurance(token, data.user.id, profile);
    if (clinical) {
      const policy = checked(await user.rpc("workspace_policy"));
      requireValue(
        policy?.version === 1 && policy.mode === "clinical",
        503,
        "The clinical workspace database update is not available. Contact your workspace administrator.",
      );
    }
    return { user, profile };
  }
  const role = (ctx, roles) =>
    requireValue(
      roles.includes(ctx.profile.role),
      403,
      "Your role cannot perform this action.",
    );
  async function patient(ctx, id) {
    requireValue(uuid(id), 400, "Invalid patient ID.");
    const { data, error } = await ctx.user
      .from("patients")
      .select("id,is_synthetic")
      .eq("id", id)
      .maybeSingle();
    requireValue(!error && data, 403, "This patient is not assigned to you.");
    return data;
  }
  async function consent(ctx, id, purpose) {
    const { data, error } = await ctx.user
      .from("consents")
      .select("granted")
      .eq("patient_id", id)
      .eq("purpose", purpose)
      .order("recorded_at", { ascending: false })
      .limit(1);
    requireValue(
      !error && data?.[0]?.granted,
      403,
      `Current ${purpose.replaceAll("_", " ")} consent is required.`,
    );
  }
  async function audit(ctx, action, type, id) {
    checked(
      await admin.from("audit_events").insert({
        actor_id: ctx.profile.id,
        action,
        resource_type: type,
        resource_id: id,
      }),
    );
  }
  async function handle(path, body, ctx) {
    if (path === "/api/upload") {
      const oral = body.kind === "oral";
      requireValue(oral || body.kind === "report", 400, "Invalid file kind.");
      role(
        ctx,
        oral
          ? ["health_worker", "medical_officer", "specialist"]
          : ["medical_officer", "specialist"],
      );
      await patient(ctx, body.patient_id);
      await consent(ctx, body.patient_id, oral ? "image_capture" : "screening");
      requireValue(
        body.request_id === undefined || uuid(body.request_id),
        400,
        "Invalid upload request ID.",
      );
      if (oral)
        requireValue(
          ["cheek", "tongue", "palate", "gums", "floor_of_mouth"].includes(
            body.oral_view || "cheek",
          ),
          400,
          "Invalid oral view.",
        );
      const file = await validateFile(body.data_url, body.kind),
        id = body.request_id || randomUUID();
      const key = `${body.patient_id}/${id}.${file.mime_type === "image/jpeg" ? "jpg" : "pdf"}`;
      const metadata = {
        id,
        patient_id: body.patient_id,
        object_key: key,
        sha256: file.sha256,
        mime_type: file.mime_type,
        size_bytes: file.bytes.length,
        name: String(body.name || "Report")
          .replace(/[\r\n\\/]/g, "_")
          .slice(0, 150),
        investigation_id: body.investigation_id || null,
        oral_view: body.oral_view || "cheek",
        quality_status: file.quality_status,
        quality_details: file.quality_details,
      };
      return storePrivateUpload(
        admin,
        body.kind,
        metadata,
        file.bytes,
        ctx.profile.id,
      );
    }
    if (path === "/api/download") {
      const oral = body.kind === "oral";
      requireValue(oral || body.kind === "report", 400, "Invalid file kind.");
      role(
        ctx,
        oral
          ? ["health_worker", "medical_officer", "specialist"]
          : ["medical_officer", "specialist"],
      );
      requireValue(uuid(body.id), 400, "Invalid file ID.");
      const table = oral ? "images" : "patient_documents";
      const { data, error } = await ctx.user
        .from(table)
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      requireValue(
        !error && data,
        403,
        "File is not available to your account.",
      );
      await patient(ctx, data.patient_id);
      await consent(ctx, data.patient_id, oral ? "image_capture" : "screening");
      await audit(ctx, "DOWNLOAD", table, data.id);
      const signed = checked(
        await admin.storage
          .from(oral ? "oral-images" : "pathology-reports")
          .createSignedUrl(data.object_key, 60, {
            download: oral ? "oral-photo.jpg" : data.name,
          }),
      );
      return { url: signed.signedUrl, expires_in: 60 };
    }
    if (path === "/api/video") {
      requireValue(status().video, 503, "Video provider is not configured.");
      role(ctx, ["health_worker", "medical_officer", "specialist"]);
      requireValue(uuid(body.appointment_id), 400, "Invalid appointment ID.");
      const { data: a, error } = await ctx.user
        .from("appointments")
        .select("*")
        .eq("id", body.appointment_id)
        .maybeSingle();
      requireValue(!error && a, 403, "Assigned appointment required.");
      await patient(ctx, a.patient_id);
      await consent(ctx, a.patient_id, "teleconsultation");
      const exp = videoWindow(a);
      const roomName =
        "ad-" +
        createHash("sha256")
          .update(a.id + a.starts_at)
          .digest("hex")
          .slice(0, 32);
      if (videoProvider === "livekit") {
        const server = new URL(env.LIVEKIT_URL);
        requireValue(
          server.protocol === "wss:" && !server.username && !server.password,
          503,
          "Configure a secure LiveKit wss:// project URL.",
        );
        const token = new AccessToken(
          env.LIVEKIT_API_KEY,
          env.LIVEKIT_API_SECRET,
          {
            identity: ctx.profile.id,
            name: `Synthetic ${ctx.profile.role.replaceAll("_", " ")}`,
            ttl: Math.max(1, exp - Math.floor(Date.now() / 1000)),
          },
        );
        token.addGrant({
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
          canSubscribe: true,
          canPublishData: false,
          canUpdateOwnMetadata: false,
          roomAdmin: false,
          roomRecord: false,
          roomList: false,
          roomCreate: false,
        });
        const jwt = await token.toJwt();
        await audit(ctx, "JOIN_VIDEO", "appointments", a.id);
        return {
          provider: "livekit",
          server_url: server.origin,
          token: jwt,
          room_name: roomName,
          expires_at: exp,
        };
      }
      let room = await remote(
        `https://api.daily.co/v1/rooms/${roomName}`,
        env.DAILY_API_KEY,
        null,
        "GET",
      );
      if (!room) {
        try {
          room = await remote(
            "https://api.daily.co/v1/rooms",
            env.DAILY_API_KEY,
            {
              name: roomName,
              privacy: "private",
              properties: {
                exp,
                eject_at_room_exp: true,
                max_participants: 3,
                enable_prejoin_ui: true,
                enable_knocking: false,
                enable_chat: false,
                enable_screenshare: false,
              },
            },
          );
        } catch (error) {
          room = await remote(
            `https://api.daily.co/v1/rooms/${roomName}`,
            env.DAILY_API_KEY,
            null,
            "GET",
          );
          if (!room) throw error;
        }
      }
      requireValue(
        room.privacy === "private" &&
          new URL(room.url).protocol === "https:" &&
          new URL(room.url).hostname.endsWith(".daily.co"),
        502,
        "Provider returned an invalid room.",
      );
      const token = await remote(
        "https://api.daily.co/v1/meeting-tokens",
        env.DAILY_API_KEY,
        {
          properties: {
            room_name: roomName,
            exp,
            eject_at_token_exp: true,
            is_owner: false,
            user_id: ctx.profile.id,
            user_name: ctx.profile.display_name,
            enable_recording_ui: false,
            start_cloud_recording: false,
            auto_start_transcription: false,
          },
        },
      );
      requireValue(
        typeof token.token === "string",
        502,
        "Provider did not issue a meeting token.",
      );
      await audit(ctx, "JOIN_VIDEO", "appointments", a.id);
      return {
        provider: "daily",
        url: `${room.url}?t=${encodeURIComponent(token.token)}`,
        expires_at: exp,
      };
    }
    if (path === "/api/analyze") {
      requireValue(
        status().ai,
        503,
        "Image analysis is disabled or its AI provider is not configured. Ask your workspace administrator to finish AI setup. Clinician review remains available.",
      );
      role(ctx, ["health_worker", "medical_officer", "specialist"]);
      requireValue(uuid(body.image_id), 400, "Invalid image ID.");
      const { data: image, error } = await ctx.user
        .from("images")
        .select("*")
        .eq("id", body.image_id)
        .maybeSingle();
      requireValue(!error && image, 403, "Assigned image required.");
      const record = await patient(ctx, image.patient_id);
      requireValue(
        record.is_synthetic === true,
        403,
        "Research AI is unavailable for clinical patient records. Clinician review remains available.",
      );
      await consent(ctx, image.patient_id, "image_capture");
      requireValue(
        image.quality_status === "acceptable",
        409,
        "Retake this image before analysis.",
      );
      let result;
      if (aiMode === "mock") {
        result = {
          provider: "mock",
          model_version: "mock-v1",
          research_label: "demo_review_required",
          score: null,
          status: "completed",
          clinical_use: false,
          requires_clinician_review: true,
          warning: "NOT FOR CLINICAL USE",
        };
      } else {
        if (aiMode === "gemini" || aiMode === "medgemma") {
          const capability = await ctx.user.rpc("image_findings_policy");
          requireValue(
            !capability.error && capability.data?.version === 1,
            503,
            "The image findings update is not available in this workspace yet. Ask your administrator to finish AI setup.",
          );
        }
        const blob = checked(
          await admin.storage.from("oral-images").download(image.object_key),
        );
        if (aiMode === "gemini" || aiMode === "medgemma") {
          result = await analyzeWithGemini({
            bytes: await blob.arrayBuffer(),
            key: env.GEMINI_API_KEY,
            model:
              env.GEMINI_MODEL ||
              env.MEDGEMMA_MODEL ||
              (aiMode === "medgemma"
                ? MEDGEMMA_DEFAULT_MODEL
                : GEMINI_DEFAULT_MODEL),
            language: body.language ?? "en",
            fetcher,
            engine: aiMode === "medgemma" ? "medgemma" : "gemini",
          });
        } else {
          const raw = await remote(
            env.SCREENING_MODEL_URL,
            env.SCREENING_MODEL_KEY,
            {
              image_base64: Buffer.from(await blob.arrayBuffer()).toString(
                "base64",
              ),
              mime_type: "image/jpeg",
              model_version: env.SCREENING_MODEL_VERSION,
            },
          );
          result = validateModelResult(raw, env.SCREENING_MODEL_VERSION);
        }
      }
      await patient(ctx, image.patient_id);
      await consent(ctx, image.patient_id, "image_capture");
      const saved = checked(
        await admin
          .from("ai_analyses")
          .insert({ ...result, image_id: image.id })
          .select("id")
          .single(),
      );
      await audit(
        ctx,
        aiMode === "mock" ? "MOCK_ANALYSIS" : "RESEARCH_ANALYSIS",
        "ai_analyses",
        saved.id,
      );
      return { id: saved.id, ...result };
    }
    throw new HttpError(404, "Endpoint not found.");
  }
  let dispatching = false;
  async function dispatchReminders() {
    if (!status().reminders || dispatching) return;
    dispatching = true;
    try {
      const jobs = checked(await admin.rpc("claim_reminders"));
      for (const job of jobs) {
        try {
          const a = checked(
            await admin
              .from("appointments")
              .select("*")
              .eq("id", job.appointment_id)
              .single(),
          );
          const current = checked(
            await admin
              .from("appointment_reminders")
              .select("status")
              .eq("id", job.id)
              .single(),
          );
          if (
            !["pending", "failed"].includes(current.status) ||
            !["confirmed", "rescheduled", "requested"].includes(a.status) ||
            Date.parse(a.starts_at) <= Date.now()
          )
            continue;
          const p = checked(
            await admin
              .from("patients")
              .select("contact_phone,preferred_language")
              .eq("id", job.patient_id)
              .single(),
          );
          requireValue(p.contact_phone, 400, "No contact number.");
          const delivery = await remote(
            env.REMINDER_WEBHOOK_URL,
            env.REMINDER_WEBHOOK_KEY,
            {
              idempotency_key: job.id,
              to: p.contact_phone,
              language: p.preferred_language,
              template: "appointment_reminder",
              starts_at: a.starts_at,
            },
          );
          requireValue(
            delivery.accepted === true,
            502,
            "Reminder provider did not acknowledge delivery.",
          );
          checked(
            await admin
              .from("appointment_reminders")
              .update({ status: "sent", lease_until: null })
              .eq("id", job.id)
              .in("status", ["pending", "failed"]),
          );
        } catch {
          checked(
            await admin
              .from("appointment_reminders")
              .update({
                status: "failed",
                lease_until: new Date(Date.now() + 15 * 60000).toISOString(),
              })
              .eq("id", job.id)
              .in("status", ["pending", "failed"]),
          );
        }
      }
    } finally {
      dispatching = false;
    }
  }
  return { status, authenticate, handle, dispatchReminders };
}

export function createApi(services, env = process.env, { staticDir } = {}) {
  const serveStatic = staticDir ? createStaticHandler(staticDir) : null;
  const origins = new Set(
    (
      env.APP_ORIGINS ||
      (env.NODE_ENV === "production"
        ? ""
        : "http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:4173")
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  if (env.RENDER_EXTERNAL_URL)
    origins.add(new URL(env.RENDER_EXTERNAL_URL).origin);
  const counts = new Map();
  return createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    try {
      const pathname = req.url.split("?")[0];
      if (serveStatic && pathname !== "/api" && !pathname.startsWith("/api/")) {
        await serveStatic(req, res);
        return;
      }
      requireValue(
        !req.headers.origin || origins.has(req.headers.origin),
        403,
        "Origin not permitted.",
      );
      if (["GET", "HEAD"].includes(req.method) && pathname === "/api/status") {
        res.end(
          req.method === "HEAD" ? undefined : JSON.stringify(services.status()),
        );
        return;
      }
      requireValue(req.method === "POST", 405, "Use POST.");
      requireValue(
        ["/api/upload", "/api/download", "/api/video", "/api/analyze"].includes(
          req.url,
        ),
        404,
        "Endpoint not found.",
      );
      requireValue(
        req.headers["content-type"]?.startsWith("application/json"),
        415,
        "Use application/json.",
      );
      const ctx = await services.authenticate(
        /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1],
      );
      // Render terminates TLS at a shared proxy. Rate-limit verified accounts
      // rather than combining every visitor under that proxy's socket address.
      const account = ctx.profile?.id || req.socket.remoteAddress;
      const now = Date.now();
      for (const [key, value] of counts)
        if (now - value.since > 60000) counts.delete(key);
      const rate = counts.get(account) || { since: now, count: 0 };
      rate.count++;
      counts.set(account, rate);
      requireValue(
        rate.count <= 60,
        429,
        "Too many requests. Retry in a minute.",
      );
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        requireValue(size <= 15 * 1024 * 1024, 413, "Request is too large.");
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new HttpError(400, "Invalid JSON.");
      }
      requireValue(
        body && typeof body === "object" && !Array.isArray(body),
        400,
        "Object body required.",
      );
      res.end(JSON.stringify(await services.handle(req.url, body, ctx)));
    } catch (error) {
      res.statusCode = error instanceof HttpError ? error.status : 500;
      res.end(
        JSON.stringify({
          error:
            error instanceof HttpError
              ? error.message
              : "Unable to complete this request.",
        }),
      );
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const services = createServices(),
    server = createApi(services);
  server.listen(
    Number(process.env.API_PORT || 8787),
    process.env.API_HOST || "127.0.0.1",
    () =>
      console.log(
        `Care API listening on http://${process.env.API_HOST || "127.0.0.1"}:${process.env.API_PORT || 8787}`,
      ),
  );
  const timer = setInterval(
    () =>
      services
        .dispatchReminders()
        .catch(() =>
          console.error("Reminder dispatch failed; delivery will retry."),
        ),
    60000,
  );
  timer.unref();
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      clearInterval(timer);
      server.close();
    });
}
