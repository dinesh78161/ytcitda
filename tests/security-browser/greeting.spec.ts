import { test, expect, type Page } from "@playwright/test";
import { greetings, greetingAudioPath } from "../../src/lib/greetings";
import { supportedLanguages, type Language } from "../../src/lib/languages";

const userId = "00000000-0000-4000-8000-000000000091";
const factor = {
  id: "11111111-0000-4000-8000-000000000091",
  factor_type: "totp",
  status: "verified",
  friendly_name: "Synthetic authenticator",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

async function fixture(
  page: Page,
  language: Language,
  options: { mfa?: boolean; restored?: boolean; suspended?: boolean } = {},
) {
  const html = await (await page.request.get("/")).text();
  const asset = /src="(\/assets\/[^" ]+\.js)"/.exec(html)?.[1];
  expect(asset).toBeTruthy();
  const bundle = await (await page.request.get(asset!)).text();
  const reference = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(bundle)?.[1];
  expect(reference).toBeTruthy();
  let verified = false;
  const user = () => ({
    id: userId,
    aud: "authenticated",
    email: "greeting-test@example.invalid",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
    factors: options.mfa ? [factor] : [],
  });
  const session = () => ({
    access_token: [
      { alg: "HS256", typ: "JWT" },
      {
        sub: userId,
        aal: verified ? "aal2" : "aal1",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        aud: "authenticated",
        role: "authenticated",
      },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
      .concat("synthetic-signature")
      .join("."),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "synthetic-refresh-token",
    user: user(),
  });
  await page.addInitScript(
    ({ language, key, restored, suspended }) => {
      localStorage.setItem("aarogya-language", language);
      if (restored && !localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(restored));
      const NativeAudioContext = window.AudioContext;
      const observed = {
        started: 0,
        ended: 0,
        durations: [] as number[],
        allowAudio: false,
        decoded: 0,
      };
      Object.assign(window, { greetingAudioObserved: observed });
      class ObservedAudioContext extends NativeAudioContext {
        override get state() {
          return suspended && !observed.allowAudio ? "suspended" : super.state;
        }
        override async decodeAudioData(data: ArrayBuffer) {
          const buffer = await super.decodeAudioData(data);
          observed.decoded++;
          return buffer;
        }
        override resume() {
          if (suspended && !observed.allowAudio)
            return Promise.reject(new Error("Audio blocked"));
          return super.resume();
        }
        override createBufferSource() {
          const source = super.createBufferSource();
          const start = source.start.bind(source);
          source.start = (...args: Parameters<typeof source.start>) => {
            observed.started++;
            observed.durations.push(source.buffer?.duration || 0);
            source.addEventListener("ended", () => observed.ended++);
            start(...args);
          };
          return source;
        }
      }
      window.AudioContext = ObservedAudioContext;
    },
    {
      language,
      key: `sb-${reference}-auth-token`,
      restored: options.restored ? session() : null,
      suspended: !!options.suspended,
    },
  );
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: { database: true, files: true, video: true, ai: false },
    }),
  );
  await page.route(`https://${reference}.supabase.co/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/token") {
      const body = route.request().postDataJSON();
      if (body.password === "wrong-password")
        return route.fulfill({
          status: 400,
          json: {
            code: "invalid_credentials",
            msg: "Invalid login credentials",
          },
        });
      return route.fulfill({ json: session() });
    }
    if (path === "/auth/v1/user") return route.fulfill({ json: user() });
    if (path.endsWith("/challenge"))
      return route.fulfill({ json: { id: "challenge", type: "totp" } });
    if (path.endsWith("/verify")) {
      verified = true;
      return route.fulfill({ json: session() });
    }
    if (path === "/rest/v1/profiles")
      return route.fulfill({
        json: {
          id: userId,
          display_name: "Synthetic greeting tester",
          role: options.mfa ? "medical_officer" : "health_worker",
          facility_id: "10000000-0000-4000-8000-000000000001",
          active: true,
        },
      });
    if (path.endsWith("/workspace_policy"))
      return route.fulfill({ json: { version: 1, mode: "evaluation" } });
    if (path.startsWith("/rest/v1/")) return route.fulfill({ json: [] });
    if (path === "/auth/v1/logout") return route.fulfill({ json: {} });
    return route.fulfill({ status: 500, json: { error: "Unmocked request" } });
  });
  await page.goto("/");
}

async function signIn(page: Page, password = "synthetic-password") {
  await page
    .locator('input[type="email"]')
    .fill("greeting-test@example.invalid");
  await page.locator('input[type="password"]').fill(password);
  await page.locator(".login-form form button").click();
}

const audioState = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as typeof window & {
          greetingAudioObserved: {
            started: number;
            ended: number;
            durations: number[];
            allowAudio: boolean;
            decoded: number;
          };
        }
      ).greetingAudioObserved,
  );

for (const language of supportedLanguages) {
  test(`${language.name}: successful login plays its real bundled audio once`, async ({
    page,
  }) => {
    const clips: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/audio/greetings/"))
        clips.push(new URL(request.url()).pathname);
    });
    await fixture(page, language.code);
    await signIn(page);
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect.poll(async () => (await audioState(page)).started).toBe(1);
    expect(clips).toEqual([greetingAudioPath(language.code)]);
    const duration = (await audioState(page)).durations[0];
    expect(duration).toBeGreaterThan(0.3);
    expect(duration).toBeLessThan(10);
    await expect
      .poll(async () => (await audioState(page)).ended, { timeout: 12000 })
      .toBe(1);
    await page
      .getByRole("button", {
        name: greetings[language.code].playLabel,
        exact: true,
      })
      .click();
    await expect.poll(async () => (await audioState(page)).started).toBe(2);
    if (language.code === "te") {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "test-results/greeting-telugu-mobile.png",
        fullPage: true,
      });
    }
  });
}

test("failed sign-in stays silent; successful retry greets only once and reload stays silent", async ({
  page,
}) => {
  await fixture(page, "en");
  await signIn(page, "wrong-password");
  await expect(page.getByRole("alert")).toContainText(
    "Invalid login credentials",
  );
  expect((await audioState(page)).started).toBe(0);
  await signIn(page);
  await expect.poll(async () => (await audioState(page)).started).toBe(1);
  await page.locator(".topbar select").selectOption("te");
  expect((await audioState(page)).started).toBe(1);
  await page.reload();
  await expect(page.getByRole("navigation")).toBeVisible();
  expect((await audioState(page)).started).toBe(0);
});

test("greeting is automatic without a checkbox, including when the old setting was off", async ({
  page,
}) => {
  await fixture(page, "en");
  await page.evaluate(() =>
    localStorage.setItem("aarogya-login-greeting", "off"),
  );
  await page.reload();
  await expect(page.locator('.login-form input[type="checkbox"]')).toHaveCount(
    0,
  );
  await signIn(page);
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect.poll(async () => (await audioState(page)).started).toBe(1);
  await page
    .getByRole("button", { name: greetings.en.playLabel, exact: true })
    .click();
  await expect.poll(async () => (await audioState(page)).started).toBe(2);
});

test("greeting waits for MFA before playing", async ({ page }) => {
  await fixture(page, "en", { mfa: true });
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Verify your identity" }),
  ).toBeVisible();
  expect((await audioState(page)).started).toBe(0);
  await page.getByLabel("Six-digit authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect.poll(async () => (await audioState(page)).started).toBe(1);
});

test("restored sessions and blocked audio do not interrupt the workspace", async ({
  page,
}) => {
  await fixture(page, "en", { restored: true, suspended: true });
  await expect(page.getByRole("navigation")).toBeVisible();
  expect((await audioState(page)).started).toBe(0);
  await page
    .getByRole("button", { name: greetings.en.playLabel, exact: true })
    .click();
  await expect(page.getByRole("navigation")).toBeVisible();
  expect((await audioState(page)).started).toBe(0);
});

test("speaker button retries a cached greeting when audio becomes allowed", async ({
  page,
}) => {
  await fixture(page, "en", { suspended: true });
  await signIn(page);
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect.poll(async () => (await audioState(page)).decoded).toBe(1);
  expect((await audioState(page)).started).toBe(0);
  await page.evaluate(() => {
    (
      window as typeof window & {
        greetingAudioObserved: { allowAudio: boolean };
      }
    ).greetingAudioObserved.allowAudio = true;
  });
  await page
    .getByRole("button", { name: greetings.en.playLabel, exact: true })
    .click();
  await expect.poll(async () => (await audioState(page)).started).toBe(1);
});
