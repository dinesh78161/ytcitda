import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApi } from "../server/index.mjs";
import { HttpError } from "../server/validation.mjs";

let directory, server, base;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "aarogya-production-"));
  await mkdir(join(directory, "assets"));
  await writeFile(
    join(directory, "index.html"),
    "<!doctype html><html><body>Production app shell</body></html>",
  );
  await writeFile(
    join(directory, "assets", "app-12345678.js"),
    'console.log("public asset");',
  );
  await writeFile(join(directory, "sw.js"), "/* public service worker */");
  await writeFile(
    join(directory, ".env"),
    "PRIVATE_TEST_VALUE=must-not-be-served",
  );
  const services = {
    status: () => ({ database: true }),
    authenticate: async (token) => {
      if (token !== "test-user") throw new HttpError(401, "Sign in first.");
      return { profile: { id: "verified-test-user" } };
    },
    handle: async () => ({ ok: true }),
  };
  server = createApi(
    services,
    {
      NODE_ENV: "production",
      RENDER_EXTERNAL_URL: "https://example.onrender.com",
      APP_ORIGINS: " https://care.example.invalid ",
    },
    { staticDir: directory },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});
test("production serves the app shell and deep links without caching HTML indefinitely", async () => {
  for (const path of ["/", "/patients/demo"]) {
    const response = await fetch(base + path, {
      headers: { Accept: "text/html" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-cache");
    assert.match(await response.text(), /Production app shell/);
  }
});
test("production supports cached assets, HEAD, and revalidated service workers", async () => {
  const asset = await fetch(base + "/assets/app-12345678.js");
  assert.match(asset.headers.get("content-type"), /javascript/);
  assert.match(asset.headers.get("cache-control"), /immutable/);
  const head = await fetch(base + "/assets/app-12345678.js", {
    method: "HEAD",
  });
  assert.equal(head.status, 200);
  assert.ok(Number(head.headers.get("content-length")) > 0);
  assert.equal(await head.text(), "");
  const sw = await fetch(base + "/sw.js");
  assert.equal(sw.headers.get("cache-control"), "no-cache");
});
test("production refuses environment files, encoded traversal and missing assets", async () => {
  for (const path of [
    "/.env",
    "/.env.server",
    "/%2e%2e%2f.env",
    "/%2eenv",
    "/assets/missing.js",
    "/server/index.mjs",
    "/%5c..%5c.env",
  ]) {
    const response = await fetch(base + path, {
      headers: { Accept: "text/html" },
    });
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(
      await response.text(),
      /PRIVATE_TEST_VALUE|Production app shell/,
    );
  }
});
test("production health and unknown API routes remain JSON rather than app HTML", async () => {
  const status = await fetch(base + "/api/status?probe=1");
  assert.deepEqual(await status.json(), { database: true });
  assert.equal(status.headers.get("cache-control"), "no-store");
  const unknown = await fetch(base + "/api/missing", {
    headers: { Accept: "text/html" },
  });
  assert.ok(unknown.status >= 400);
  assert.match(unknown.headers.get("content-type"), /application\/json/);
  assert.equal(
    (await fetch(base + "/api/status", { method: "HEAD" })).status,
    200,
  );
});
test("production accepts its Render/custom origin and still enforces authentication", async () => {
  const post = (origin, token) =>
    fetch(base + "/api/upload", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: "{}",
    });
  assert.equal((await post("https://example.onrender.com")).status, 401);
  assert.equal(
    (await post("https://example.onrender.com", "test-user")).status,
    200,
  );
  assert.equal(
    (await post("https://care.example.invalid", "test-user")).status,
    200,
  );
  assert.equal(
    (await post("https://attacker.invalid", "test-user")).status,
    403,
  );
  assert.equal((await post("http://localhost:5174", "test-user")).status, 403);
});
test("accounts behind the same hosting proxy have independent request limits", async () => {
  const isolated = createApi(
    {
      status: () => ({}),
      authenticate: async (token) => ({ profile: { id: token } }),
      handle: async () => ({ ok: true }),
    },
    {},
  );
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${isolated.address().port}/api/upload`;
  const post = (token) =>
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  try {
    for (let i = 0; i < 60; i++)
      assert.equal((await post("account-a")).status, 200);
    assert.equal((await post("account-a")).status, 429);
    assert.equal((await post("account-b")).status, 200);
  } finally {
    isolated.closeAllConnections();
    await new Promise((resolve) => isolated.close(resolve));
  }
});
