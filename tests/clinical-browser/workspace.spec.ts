import { test, expect, type Page } from "@playwright/test";
import { createDemo, demoProfiles } from "../../src/lib/demo";

async function clinic(
  page: Page,
  role = "medical_officer",
  policyMode = "clinical",
) {
  const profile = {
    ...demoProfiles.find((p) => p.role === role)!,
    display_name: "Test staff",
  };
  const data = createDemo();
  for (const [i, p] of data.patients.entries()) {
    p.display_name = `Clinical Test Record ${i + 1}`;
    p.is_synthetic = false;
  }
  for (const f of data.facilities) f.name = "Test clinic";
  const photoPatient = data.patients[0];
  data.consents.push({
    id: crypto.randomUUID(),
    patient_id: photoPatient.id,
    purpose: "image_capture",
    granted: true,
    recorded_at: new Date().toISOString(),
  });
  data.images.push({
    id: crypto.randomUUID(),
    patient_id: photoPatient.id,
    screening_id: data.screenings.find((s) => s.patient_id === photoPatient.id)!
      .id,
    quality_status: "acceptable",
    quality_details: { sharpness: 80, brightness: 120, glare_percent: 1 },
    object_key: "fixture/not-a-real-image.jpg",
    oral_view: "cheek",
    created_at: new Date().toISOString(),
  });
  const jwt = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: profile.id,
      aal: "aal2",
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .concat(Buffer.from("test-only-signature").toString("base64url"))
    .join(".");
  const user = {
    id: profile.id,
    aud: "authenticated",
    email: "staff@clinic.invalid",
    app_metadata: { provider: "email" },
    user_metadata: {},
    factors: [],
    created_at: new Date().toISOString(),
  };
  await page.addInitScript(
    ({ jwt, user }) =>
      localStorage.setItem(
        "sb-clinicalfixture-auth-token",
        JSON.stringify({
          access_token: jwt,
          refresh_token: "test-refresh-token",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          user,
        }),
      ),
    { jwt, user },
  );
  const writes: Record<string, unknown>[] = [];
  await page.route("https://clinicalfixture.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const respond = (value: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    if (path === "/auth/v1/user") return respond(user);
    if (path.endsWith("/workspace_policy"))
      return respond({ version: 1, mode: policyMode, ai_clinical_use: false });
    if (path.endsWith("/screening_intake_policy"))
      return respond({ version: 1 });
    if (path.endsWith("/language_policy"))
      return respond({
        version: 1,
        languages: ["en", "te", "hi", "ta", "kn", "ml", "mr", "bn", "or"],
      });
    if (path.endsWith("/submit_workflow")) {
      writes.push(route.request().postDataJSON());
      return respond({ id: "test-submission" });
    }
    if (path.endsWith("/profiles")) return respond(profile);
    const table = path.split("/").pop() as keyof typeof data;
    if (path.startsWith("/rest/v1/") && table in data)
      return respond(data[table]);
    throw new Error("Unexpected test request: " + path);
  });
  await page.route("**/api/status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        database: true,
        files: true,
        video: false,
        ai: false,
        ai_provider: "disabled",
        workspace_mode: "clinical",
        reminders: false,
      }),
    }),
  );
  await page.route("**/api/download", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="gray"/></svg>',
      }),
    }),
  );
  await page.goto("/");
  return { data, writes };
}

test("clinical pages use signed-in roles and show actual clinician-led workflows", async ({
  page,
}) => {
  await clinic(page);
  await expect(
    page.getByRole("heading", { name: "A clearer path to care.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Clinical workspace", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: /role selection/i }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation");
  for (const name of [
    "Patient registry",
    "Screening queue",
    "Appointments",
    "Care navigation",
    "District reports",
  ]) {
    await nav.getByRole("button", { name: new RegExp("^" + name) }).click();
    await expect(page.locator("main h1")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /simulated|mock|synthetic|demo/i }),
    ).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Not enabled for clinical use", { exact: true }),
  ).toBeVisible();
  await nav
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search by name, village or ID…" })
    .fill("Clinical Test Record 1");
  await page
    .getByRole("button", {
      name: "Open record: Clinical Test Record 1",
      exact: true,
    })
    .click();
  await expect(page.locator('[data-step="analysis"]')).toHaveCount(0);
  await expect(
    page.getByText(
      "Record your examination findings and sign your decision. Signed reviews are retained.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Oral photographs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Clinician image review", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".analysis-score")).toHaveCount(0);
  await expect(page.locator(".analysis-run")).toHaveCount(0);
  await expect(
    page.getByText(
      "Automated disease analysis is not enabled in this clinical workspace.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Care plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /simulated|demo|mock/i }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/clinical-workspace-mobile.png",
    fullPage: true,
  });
});

test("clinical registration keeps identifiable draft fields out of browser storage", async ({
  page,
  context,
}) => {
  await clinic(page, "health_worker");
  await page
    .getByRole("button", { name: "Register patient", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Full name", { exact: true })
    .fill("PRIVATE-TEST-DRAFT");
  await expect(dialog.getByRole("status")).toContainText(
    "Changes held for this session",
  );
  await expect(
    dialog.getByText(
      "Explain the screening and record the patient's consent before continuing.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Consent for oral photographs recorded", { exact: true }),
  ).toBeVisible();
  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("aarogya-synthetic-workspace", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const values = await Promise.all(
      ["kv", "queue"].map(
        (store) =>
          new Promise((resolve, reject) => {
            const r = db.transaction(store).objectStore(store).getAll();
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          }),
      ),
    );
    db.close();
    return JSON.stringify(values) + JSON.stringify(localStorage);
  });
  expect(persisted).not.toContain("PRIVATE-TEST-DRAFT");
  await dialog.getByLabel("Age in years").fill("46");
  await dialog.getByLabel("Village / mandal").fill("Test village");
  await dialog
    .getByLabel("Screening consent recorded in the selected language")
    .check();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await context.setOffline(true);
  await dialog
    .getByRole("button", { name: "Save screening", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Reconnect before saving clinical records",
  );
  await context.setOffline(false);
  await page.reload();
  await page
    .getByRole("button", { name: "Register patient", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Full name", { exact: true }),
  ).toHaveValue("");
});

test("a clinical build refuses an evaluation database before fetching patient records", async ({
  page,
}) => {
  await clinic(page, "health_worker", "evaluation");
  await expect(page.getByRole("alert")).toContainText(
    "Workspace configuration does not match",
  );
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
