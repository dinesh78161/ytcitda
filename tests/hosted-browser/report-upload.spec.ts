import { test, expect as baseExpect, type Page } from "@playwright/test";
import { createDemo, demoProfiles, applyDemoCommand } from "../../src/lib/demo";
import { PDFDocument } from "pdf-lib";
import { validateFile } from "../../server/validation.mjs";

const expect = baseExpect.configure({ timeout: 12000 });
test.use({ serviceWorkers: "block" });
test.beforeEach(() =>
  test.skip(
    process.env.RUN_REPORT_UPLOAD_UI !== "1",
    "Opt in to isolated mocked-provider report upload regression checks.",
  ),
);

async function fixture(
  page: Page,
  baseURL: string,
  options: {
    closed?: boolean;
    consent?: boolean;
    automatic?: boolean;
    configured?: boolean;
  } = {},
) {
  let data = createDemo();
  const patient = data.patients[0];
  let profile = demoProfiles[1];
  if (options.closed) data.screenings[0].status = "closed";
  if (options.consent === false) data.consents[0].granted = false;
  const html = await (await page.request.get(baseURL)).text();
  const asset = /src="(\/assets\/[^" ]+\.js)"/.exec(html)?.[1];
  expect(asset).toBeTruthy();
  const bundle = await (
    await page.request.get(new URL(asset!, baseURL).href)
  ).text();
  const reference = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(bundle)?.[1];
  expect(reference).toBeTruthy();
  const user = {
    id: profile.id,
    email: "synthetic-report-check@example.invalid",
    aud: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
    factors: [],
  };
  const token = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: profile.id,
      aal: "aal2",
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    "synthetic-signature",
  ]
    .map((value) =>
      Buffer.from(
        typeof value === "string" ? value : JSON.stringify(value),
      ).toString("base64url"),
    )
    .join(".");
  await page.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem("aarogya-language", "en");
    },
    {
      key: `sb-${reference}-auth-token`,
      session: {
        access_token: token,
        refresh_token: "synthetic-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      },
    },
  );
  let profileReads = 0;
  await page.route(`https://${reference}.supabase.co/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (pathname === "/auth/v1/user")
      return respond({ ...user, id: profile.id });
    if (pathname === "/auth/v1/logout") return respond({});
    if (pathname === "/rest/v1/profiles") {
      profileReads++;
      return respond(profile);
    }
    if (pathname === "/rest/v1/rpc/submit_workflow") {
      const body = route.request().postDataJSON();
      data = applyDemoCommand(data, profile, {
        id: body.request_id,
        actor: profile.id,
        action: body.action,
        payload: body.payload,
        created_at: new Date().toISOString(),
      });
      return respond({ id: data.investigations[0]?.id });
    }
    const table = pathname.replace("/rest/v1/", "");
    if (table in data) return respond(data[table as keyof typeof data]);
    return respond({ error: "Unexpected provider request" }, 500);
  });
  let available = false,
    checks = 0;
  await page.route(`${baseURL}/api/status`, async (route) => {
    checks++;
    if (options.automatic && checks > 1) available = true;
    await route.fulfill({
      status: available ? 200 : 503,
      contentType: "application/json",
      body: JSON.stringify(
        available
          ? {
              database: true,
              files: options.configured !== false,
              video: false,
              ai: true,
              ai_provider: "mock",
              reminders: false,
            }
          : { error: "Synthetic temporary connection failure" },
      ),
    });
  });
  let finishUpload: () => void = () => {};
  const uploadGate = new Promise<void>((resolve) => {
    finishUpload = resolve;
  });
  await page.route(`${baseURL}/api/upload`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.kind).toBe("report");
    const file = await validateFile(body.data_url, "report");
    await uploadGate;
    data.patient_documents.unshift({
      id: body.request_id,
      patient_id: patient.id,
      investigation_id: body.investigation_id,
      name: body.name,
      mime_type: file.mime_type,
      size_bytes: file.bytes.length,
      object_key: `synthetic/${body.request_id}.pdf`,
      created_at: new Date().toISOString(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: body.request_id }),
    });
  });
  await page.goto(baseURL);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search by name, village or ID…" })
    .fill(patient.display_name);
  await page
    .getByRole("button", {
      name: `Open record: ${patient.display_name}`,
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Care plan", exact: true }).click();
  return {
    enable: () => {
      available = true;
    },
    finishUpload,
    checks: () => checks,
    profileReads: () => profileReads,
    otherTabAuth: async (
      event: "SIGNED_IN" | "SIGNED_OUT",
      account = profile,
    ) => {
      profile = account;
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString(),
      );
      payload.sub = account.id;
      const updatedToken = [
        token.split(".")[0],
        Buffer.from(JSON.stringify(payload)).toString("base64url"),
        token.split(".")[2],
      ].join(".");
      await page.evaluate(
        ({ key, event, session }) => {
          if (event === "SIGNED_OUT") localStorage.removeItem(key);
          else localStorage.setItem(key, JSON.stringify(session));
          const channel = new BroadcastChannel(key);
          channel.postMessage({
            event,
            session: event === "SIGNED_OUT" ? null : session,
          });
          channel.close();
        },
        {
          key: `sb-${reference}-auth-token`,
          event,
          session: {
            access_token: updatedToken,
            refresh_token: "synthetic-refresh",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { ...user, id: account.id },
          },
        },
      );
    },
  };
}

test("report chooser explains initial connection failure and recovers without leaving the patient", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator("aside.sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  const chooser = page.getByLabel("Attach diagnostic report", { exact: true });
  await expect(chooser).toBeDisabled();
  await expect(
    page.getByText(
      "The file connection could not be checked. Retry to enable report uploads.",
      { exact: true },
    ),
  ).toBeVisible();
  await chooser.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("connection-disabled.png"),
  });
  state.enable();
  await page
    .getByRole("button", { name: "Retry file connection", exact: true })
    .click();
  await expect(chooser).toBeEnabled();
  await page.screenshot({
    path: test.info().outputPath("connection-recovered.png"),
  });
  await page
    .getByRole("textbox", { name: "Investigation notes / result", exact: true })
    .fill("Synthetic saved result remains after the form resets.");
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  const record = page.getByRole("combobox", {
    name: "Investigation record",
    exact: true,
  });
  await expect(record.locator("option")).toHaveCount(2);
  const id = await record.locator("option").nth(1).getAttribute("value");
  await record.selectOption(id!);
  await expect(
    page.getByRole("textbox", {
      name: "Investigation notes / result",
      exact: true,
    }),
  ).toHaveValue("Synthetic saved result remains after the form resets.");
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("SYNTHETIC REPORT CONNECTION RECOVERY TEST");
  await chooser.setInputFiles({
    name: "report-recovery.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(
    page.getByText("Uploading report. Please keep this page open.", {
      exact: true,
    }),
  ).toBeVisible();
  state.finishUpload();
  const row = page
    .locator(".document-row")
    .filter({ hasText: "report-recovery.pdf" });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Download", exact: true }),
  ).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("report-uploaded.png"),
  });
});

test("report chooser automatically recovers when the initial service check fails", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!, { automatic: true });
  await expect(
    page.getByLabel("Attach diagnostic report", { exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  expect(state.checks()).toBeGreaterThanOrEqual(2);
});

test("a recovered connection does not enable reports after consent withdrawal", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!, { consent: false });
  state.enable();
  await page.getByLabel("Workspace settings", { exact: true }).click();
  await page
    .getByRole("button", { name: "Check connections", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open record: Demo Resident 01", exact: true })
    .click();
  await page.getByRole("tab", { name: "Care plan", exact: true }).click();
  await expect(
    page.getByLabel("Attach diagnostic report", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Current screening consent is required to access reports.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("closed cases explain why report uploads are disabled", async ({
  page,
  baseURL,
}) => {
  await fixture(page, baseURL!, { closed: true });
  await expect(
    page.getByLabel("Attach diagnostic report", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Reopen this case before attaching a report.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("returning to a browser tab preserves the patient care form and unsaved notes", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!, { automatic: true });
  const notes = page.getByRole("textbox", {
    name: "Investigation notes / result",
    exact: true,
  });
  const plan = page.getByRole("textbox", {
    name: "Treatment plan",
    exact: true,
  });
  await notes.fill(
    "Synthetic unsaved investigation notes retained when returning to the browser.",
  );
  await plan.fill("Synthetic unsaved treatment plan retained on tab return.");
  await page
    .getByRole("combobox", { name: "Investigation stage", exact: true })
    .selectOption("collected");
  await notes.scrollIntoViewIfNeeded();
  const originalReads = state.profileReads();
  await notes.evaluate((el) =>
    el.setAttribute("data-tab-stability", "original-form"),
  );
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.evaluate(async () => {
      // Drive the browser visibility events used by the real Supabase SDK.
      // Headless browsers keep pages visible even when another page is focused.
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      window.dispatchEvent(new Event("visibilitychange"));
      await new Promise((resolve) => setTimeout(resolve, 100));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      window.dispatchEvent(new Event("visibilitychange"));
    });
    // Wait for the SDK's storage lock and deferred auth callback to settle.
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("tab", { name: "Care plan", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(notes).toHaveValue(
      "Synthetic unsaved investigation notes retained when returning to the browser.",
    );
    await expect(plan).toHaveValue(
      "Synthetic unsaved treatment plan retained on tab return.",
    );
    await expect(notes).toHaveAttribute("data-tab-stability", "original-form");
    await expect(
      page.getByRole("combobox", { name: "Investigation stage", exact: true }),
    ).toHaveValue("collected");
    expect(state.profileReads()).toBe(originalReads);
  }
  await page.screenshot({
    path: test.info().outputPath("care-form-after-tab-returns.png"),
  });
});

test("a genuine account change still resets the patient workspace", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!, { automatic: true });
  await page
    .getByRole("textbox", { name: "Investigation notes / result", exact: true })
    .fill("Synthetic unsaved notes for previous account only.");
  await state.otherTabAuth("SIGNED_IN", demoProfiles[2]);
  await expect(page.locator(".user-copy strong")).toHaveText("Specialist");
  await expect(
    page.getByRole("tab", { name: "Care plan", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Search by name, village or ID/ })
    .fill("Demo Resident 01");
  await page
    .getByRole("button", { name: "Open record: Demo Resident 01", exact: true })
    .click();
  await page.getByRole("tab", { name: "Care plan", exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Investigation notes / result",
      exact: true,
    }),
  ).toHaveValue("");
});

test("signing out in another tab still clears the patient workspace", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!, { automatic: true });
  await page
    .getByRole("textbox", { name: "Investigation notes / result", exact: true })
    .fill("Synthetic notes must disappear on sign out.");
  await state.otherTabAuth("SIGNED_OUT");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", {
      name: "Investigation notes / result",
      exact: true,
    }),
  ).toHaveCount(0);
  await state.otherTabAuth("SIGNED_IN");
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Care plan", exact: true }),
  ).toHaveCount(0);
});
