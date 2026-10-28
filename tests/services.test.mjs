import { test } from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import {
  validateFile,
  validateModelResult,
  videoWindow,
  HttpError,
} from "../server/validation.mjs";
import { createApi, createServices } from "../server/index.mjs";

test("unconfigured services stay disabled and reject authentication", async () => {
  const services = createServices({});
  assert.deepEqual(services.status(), {
    database: false,
    files: false,
    video: false,
    ai: false,
    reminders: false,
  });
  await assert.rejects(
    () => services.authenticate("fake"),
    (error) => error.status === 503,
  );
});
test("image uploads are decoded, re-encoded, hashed and independently quality checked", async () => {
  const pixels = Buffer.alloc(256 * 256 * 4, 255);
  const bytes = jpeg.encode({ data: pixels, width: 256, height: 256 }, 85).data;
  const file = await validateFile(
    `data:image/jpeg;base64,${bytes.toString("base64")}`,
    "oral",
  );
  assert.equal(file.quality_status, "recapture");
  assert.match(file.sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(
    () => validateFile("data:image/jpeg;base64,aGVsbG8=", "oral"),
    /decoded/,
  );
});
test("valid reports are accepted; scripts and fake PDFs are rejected", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const asUrl = async () =>
    `data:application/pdf;base64,${Buffer.from(await pdf.save()).toString("base64")}`;
  assert.equal(
    (await validateFile(await asUrl(), "report")).mime_type,
    "application/pdf",
  );
  await assert.rejects(
    () => validateFile("data:application/pdf;base64,aGVsbG8=", "report"),
    /Invalid PDF/,
  );
  const action = pdf.context.obj({
    S: PDFName.of("JavaScript"),
    JS: PDFString.of("app.alert('test')"),
  });
  pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.register(action));
  await assert.rejects(
    () => asUrl().then((url) => validateFile(url, "report")),
    /scripts/,
  );
});
test("model contract rejects missing or invalid scores and unpinned versions", () => {
  const valid = {
    model_version: "test-v1",
    label: "review_required",
    score: 0.8,
  };
  const result = validateModelResult(valid, "test-v1");
  assert.equal(result.clinical_use, false);
  assert.equal(result.requires_clinician_review, true);
  for (const bad of [
    { ...valid, score: 2 },
    { ...valid, score: NaN },
    { ...valid, model_version: "unexpected" },
    { ...valid, label: "" },
  ])
    assert.throws(() => validateModelResult(bad, "test-v1"), /invalid/);
});
test("video access is limited to active appointments within their join window", () => {
  const a = {
    mode: "video",
    status: "confirmed",
    starts_at: "2026-11-01T04:30:00Z",
    ends_at: "2026-11-01T05:00:00Z",
  };
  assert.equal(
    videoWindow(a, Date.parse(a.starts_at)),
    Date.parse("2026-11-01T05:15:00Z") / 1000,
  );
  assert.throws(
    () => videoWindow(a, Date.parse("2026-11-01T03:00:00Z")),
    /Join from/,
  );
  assert.throws(
    () => videoWindow({ ...a, status: "cancelled" }, Date.parse(a.starts_at)),
    /active/,
  );
});
test("HTTP rejects unauthenticated writes, foreign origins and malformed bodies", async () => {
  let handled = 0;
  const services = {
    status: () => ({ database: false }),
    authenticate: async (token) => {
      if (token !== "test-session") throw new HttpError(401, "Sign in first.");
      return {};
    },
    handle: async () => {
      handled++;
      return { ok: true };
    },
  };
  const server = createApi(services, {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(url + "/api/status")).status, 200);
    const post = (headers, body = "{}") =>
      fetch(url + "/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body,
      });
    assert.equal((await post({})).status, 401);
    assert.equal(
      (
        await post({
          Authorization: "Bearer test-session",
          Origin: "https://untrusted.invalid",
        })
      ).status,
      403,
    );
    assert.equal(
      (await post({ Authorization: "Bearer test-session" }, "broken")).status,
      400,
    );
    assert.equal(
      (await post({ Authorization: "Bearer test-session" })).status,
      200,
    );
    assert.equal(handled, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
