import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export function deploymentOrigin(value) {
  if (!value)
    throw new Error(
      "Supply the HTTPS deployment URL as the first argument or DEPLOY_URL.",
    );
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use the deployment's HTTPS origin, without credentials, a path, query or fragment.",
    );
  return url.origin;
}
export async function checkDeployment(base) {
  const request = (path, options = {}) =>
    fetch(new URL(path, base), {
      signal: AbortSignal.timeout(60000),
      redirect: "error",
      ...options,
    });
  const home = await request("/");
  assert.equal(home.status, 200, "Homepage must respond with 200");
  assert.match(home.headers.get("content-type") || "", /text\/html/);
  const html = await home.text();
  assert.match(html, /Aarogya Drishti/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(
    assets.some((path) => path.endsWith(".js")),
    "Built JavaScript must be referenced",
  );
  for (const path of assets)
    assert.equal(
      (await request(path)).status,
      200,
      "Every referenced asset must load",
    );
  const health = await request("/api/status");
  assert.equal(health.status, 200);
  const status = await health.json();
  assert.equal(status.database, true, "Database settings must be present");
  assert.equal(status.files, true, "Private-file settings must be present");
  for (const path of [
    "/.env",
    "/.env.server",
    "/.git/config",
    "/assets/missing.js",
  ])
    assert.equal(
      (await request(path)).status,
      404,
      `${path} must not be served`,
    );
  for (const path of ["/api/upload", "/api/analyze", "/api/video"]) {
    const unauthorized = await request(path, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(
      unauthorized.status,
      401,
      `${path} must accept the deployment origin and require sign-in`,
    );
  }
  const foreignOrigin = await request("/api/analyze", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(
    foreignOrigin.status,
    403,
    "Foreign origins must remain blocked",
  );
  const manifest = await request("/manifest.webmanifest");
  assert.equal(manifest.status, 200);
  assert.ok((await manifest.json()).icons?.length, "PWA must declare icons");
  const sw = await request("/sw.js");
  assert.equal(sw.status, 200);
  assert.match(
    sw.headers.get("cache-control") || "",
    /no-cache|no-store|max-age=0/,
  );
  console.log(
    "PASS: deployed frontend, assets, API, protected paths and PWA resources.",
  );
  console.log(
    `Services: files=${status.files}, AI=${status.ai_provider || (status.ai ? "research" : "disabled")}, video=${status.video}, external reminders=${status.reminders}.`,
  );
  return status;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await checkDeployment(
      deploymentOrigin(process.argv[2] || process.env.DEPLOY_URL),
    );
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
