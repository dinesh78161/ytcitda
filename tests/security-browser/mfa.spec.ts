import { test, expect, type Page } from "@playwright/test";

const id = "00000000-0000-4000-8000-000000000002";
const factor = {
  id: "11111111-0000-4000-8000-000000000001",
  factor_type: "totp",
  status: "verified",
  friendly_name: "Test authenticator",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const jwt = (aal: string) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: id,
        aal,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url"),
    Buffer.from("synthetic-test-signature").toString("base64url"),
  ].join(".");

async function fixture(page: Page, enrolled: boolean) {
  const requests: string[] = [];
  let verified = false,
    enrollments = 0;
  const user = () => ({
    id,
    aud: "authenticated",
    email: "synthetic-mfa@example.invalid",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
    factors: enrolled || verified ? [factor] : [],
  });
  const session = (aal: string) => ({
    access_token: jwt(aal),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "synthetic-refresh-token",
    user: user(),
  });
  // Intercept the built public Supabase URL before its auth storage is initialized.
  // Seed once on navigation by discovering the URL from the public JS bundle.
  const html = await (await page.request.get("/")).text();
  const asset = /src="(\/assets\/[^" ]+\.js)"/.exec(html)?.[1];
  expect(asset).toBeTruthy();
  const bundle = await (await page.request.get(asset!)).text();
  const reference = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(bundle)?.[1];
  expect(reference).toBeTruthy();
  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${reference}-auth-token`, session: session("aal1") },
  );
  await page.route(`https://${reference}.supabase.co/**`, async (route) => {
    const url = new URL(route.request().url()),
      pathname = url.pathname;
    const respond = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    if (pathname === "/auth/v1/user") return respond(user());
    if (pathname.endsWith("/challenge"))
      return respond({
        id: "challenge",
        type: "totp",
        expires_at: Math.floor(Date.now() / 1000) + 120,
      });
    if (pathname.endsWith("/verify")) {
      const body = route.request().postDataJSON();
      if (body.code !== "123456")
        return respond(
          {
            code: "mfa_verification_failed",
            msg: "Invalid authenticator code",
          },
          422,
        );
      verified = true;
      return respond(session("aal2"));
    }
    if (
      pathname === "/auth/v1/factors" &&
      route.request().method() === "POST"
    ) {
      enrollments++;
      return respond({
        ...factor,
        status: "unverified",
        type: "totp",
        totp: {
          qr_code:
            '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#fff"/><text x="5" y="65">TEST QR ONLY</text></svg>',
          secret: "SYNTHETIC-SETUP-KEY",
          uri: "otpauth://totp/test",
        },
      });
    }
    if (pathname === "/auth/v1/logout") return respond({});
    if (pathname.endsWith("/workspace_policy"))
      return respond({ version: 1, mode: "evaluation" });
    if (pathname === "/rest/v1/profiles")
      return respond({
        id,
        display_name: "Synthetic MFA clinician",
        role: "medical_officer",
        facility_id: "10000000-0000-4000-8000-000000000001",
        active: true,
      });
    if (pathname.startsWith("/rest/v1/")) {
      requests.push(pathname);
      return respond([]);
    }
    return respond({ error: "Unmocked request" }, 500);
  });
  return { requests, enrollments: () => enrollments };
}

test("clinical records stay blocked until a valid authenticator challenge succeeds", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Verify your identity" }),
  ).toBeVisible();
  await expect(page.getByLabel("Six-digit authenticator code")).toBeVisible();
  expect(state.requests).toEqual([]);
  await page.getByLabel("Six-digit authenticator code").fill("000000");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid authenticator code",
  );
  expect(state.requests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mfa-mobile-challenge.png",
    fullPage: true,
  });
  await page.getByLabel("Six-digit authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(
    page.getByRole("navigation", { name: "CARE WORKSPACE", exact: true }),
  ).toBeAttached();
  await expect.poll(() => state.requests.length).toBeGreaterThan(0);
  await expect(
    page.getByRole("heading", { name: "Verify your identity" }),
  ).toHaveCount(0);
});

test("unenrolled clinician explicitly starts setup before entering an authenticator code", async ({
  page,
}) => {
  const state = await fixture(page, false);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toBeVisible();
  expect(state.enrollments()).toBe(0);
  expect(state.requests).toEqual([]);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(
    page.getByRole("img", { name: "Authenticator setup QR code" }),
  ).toBeVisible();
  expect(state.enrollments()).toBe(1);
  expect(state.requests).toEqual([]);
  await page.getByLabel("Six-digit authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(
    page.getByRole("navigation", { name: "CARE WORKSPACE", exact: true }),
  ).toBeAttached();
});
