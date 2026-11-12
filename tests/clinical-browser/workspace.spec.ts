import { test, expect, type Page } from "@playwright/test";
import { applyDemoCommand, createDemo, demoProfiles } from "../../src/lib/demo";
import jpeg from "jpeg-js";

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
    ({ jwt, user }) => {
      if (localStorage.getItem("sb-clinicalfixture-auth-token")) return;
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
      );
    },
    { jwt, user },
  );
  const writes: Record<string, unknown>[] = [];
  const uploads: Record<string, unknown>[] = [];
  const applied = new Set<string>();
  const control = {
    loseRegistrationResponse: false,
    rejectRegistration: false,
    rejectUpload: false,
  };
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
      const body = route.request().postDataJSON();
      writes.push(body);
      if (control.rejectRegistration)
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Registration conflict: staff review required",
          }),
        });
      if (!applied.has(body.request_id)) {
        Object.assign(
          data,
          applyDemoCommand(data, profile, {
            id: body.request_id,
            actor: profile.id,
            action: body.action,
            payload: body.payload,
            created_at: new Date().toISOString(),
          }),
        );
        for (const patient of data.patients) patient.is_synthetic = false;
        applied.add(body.request_id);
      }
      if (control.loseRegistrationResponse) {
        control.loseRegistrationResponse = false;
        return route.abort("failed");
      }
      return respond({ id: body.payload.patient_id });
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
  await page.route("**/api/upload", async (route) => {
    const body = route.request().postDataJSON();
    uploads.push(body);
    if (control.rejectUpload)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "File store temporarily unavailable" }),
      });
    if (!data.patients.some((p) => p.id === body.patient_id))
      throw new Error("Photo uploaded before registration acknowledgement");
    if (!data.images.some((image) => image.id === body.request_id))
      data.images.push({
        id: body.request_id,
        patient_id: body.patient_id,
        screening_id: data.screenings.find(
          (s) => s.patient_id === body.patient_id,
        )!.id,
        object_key: `fixture/${body.request_id}.jpg`,
        quality_status: "acceptable",
        oral_view: body.oral_view,
        created_at: new Date().toISOString(),
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: body.request_id,
        quality_status: "acceptable",
      }),
    });
  });
  await page.goto("/");
  return { data, writes, uploads, control, profile };
}

test("clinical pages use signed-in roles and show actual clinician-led workflows", async ({
  page,
}) => {
  await clinic(page);
  await expect(
    page.getByRole("heading", {
      name: "A clearer path to Oral care",
      exact: true,
    }),
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
    .getByRole("button", { name: "Settings", exact: true })
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

test("clinical drafts are encrypted, survive offline reload, and photos sync after an acknowledged registration", async ({
  page,
  context,
}) => {
  const fixture = await clinic(page, "health_worker");
  await expect(
    page.getByRole("heading", {
      name: "A clearer path to Oral care",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Register patient", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Full name", { exact: true })
    .fill("PRIVATE-TEST-DRAFT");
  await expect(dialog.getByRole("status")).toContainText(
    "Draft saved on this device",
  );
  await expect(
    dialog.getByLabel("Separate consent for intraoral clinical photographs", {
      exact: true,
    }),
  ).toBeVisible();
  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("aarogya-offline-v1", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const values = await Promise.all(
      ["records", "keys"].map(
        (store) =>
          new Promise((resolve, reject) => {
            const r = db.transaction(store).objectStore(store).getAll();
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          }),
      ),
    );
    const keys = values[1] as CryptoKey[];
    if (!keys.length || keys.some((key) => key.extractable))
      throw new Error("Offline encryption key must be non-exportable");
    const rows = values[0] as { iv: Uint8Array; ciphertext: ArrayBuffer }[];
    if (
      !rows.length ||
      rows.some(
        (row) => row.iv.length !== 12 || row.ciphertext.byteLength === 0,
      )
    )
      throw new Error("Expected encrypted offline records");
    db.close();
    return (
      rows.map((row) => new TextDecoder().decode(row.ciphertext)).join(" ") +
      JSON.stringify(localStorage)
    );
  });
  expect(persisted).not.toContain("PRIVATE-TEST-DRAFT");
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Register patient", exact: true })
    .first()
    .click();
  await expect(dialog.getByLabel("Full name", { exact: true })).toHaveValue(
    "PRIVATE-TEST-DRAFT",
  );
  await dialog.getByLabel("Age in years").fill("46");
  await dialog.getByLabel("Village / mandal").fill("Test village");
  await dialog
    .getByLabel("Screening consent recorded in the selected language")
    .check();
  await dialog
    .getByLabel("Separate consent for intraoral clinical photographs", {
      exact: true,
    })
    .check();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save screening", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /1 · Pending submissions/ }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Open record: PRIVATE-TEST-DRAFT",
      exact: true,
    })
    .click();
  await page
    .getByRole("tab", { name: "Oral photographs", exact: true })
    .click();
  const pixels = Buffer.alloc(256 * 256 * 4, 130);
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
  const photo = jpeg.encode({ data: pixels, width: 256, height: 256 }, 85).data;
  await page
    .getByLabel("Capture / upload oral photograph", { exact: true })
    .setInputFiles({
      name: "offline.jpg",
      mimeType: "image/jpeg",
      buffer: photo,
    });
  await expect(
    page.getByRole("button", { name: /2 · Pending submissions/ }),
  ).toBeVisible();
  await expect(page.locator(".oral-analysis-photo")).toBeVisible();
  expect(fixture.writes).toHaveLength(0);
  expect(fixture.uploads).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /2 · Pending submissions/ }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Open record: PRIVATE-TEST-DRAFT",
      exact: true,
    })
    .click();
  await page
    .getByRole("tab", { name: "Oral photographs", exact: true })
    .click();
  await expect(page.locator(".oral-analysis-photo")).toBeVisible();
  await page.screenshot({
    path: "test-results/offline-capture.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/offline-capture-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  fixture.control.loseRegistrationResponse = true;
  await context.setOffline(false);
  await page.getByRole("button", { name: /2 · Pending submissions/ }).click();
  await expect(
    page.locator(".draft-row").filter({ hasText: "failed" }),
  ).toBeVisible();
  // A lost response must keep both drafts and block the dependent photograph.
  expect(fixture.uploads).toHaveLength(0);
  expect(
    fixture.data.patients.filter(
      (p) => p.display_name === "PRIVATE-TEST-DRAFT",
    ),
  ).toHaveLength(1);
  fixture.control.rejectUpload = true;
  await page
    .getByRole("button", { name: "Sync pending records", exact: true })
    .click();
  await expect(
    page
      .locator(".draft-row")
      .filter({ hasText: "File store temporarily unavailable" }),
  ).toBeVisible();
  fixture.control.rejectUpload = false;
  await page
    .getByRole("button", { name: "Sync pending records", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /· Pending submissions/ }),
  ).toHaveCount(0);
  expect(fixture.writes).toHaveLength(2);
  expect(fixture.writes[0].request_id).toBe(fixture.writes[1].request_id);
  expect(fixture.uploads).toHaveLength(2);
  expect(fixture.uploads[0].request_id).toBe(fixture.uploads[1].request_id);
  expect(
    fixture.data.patients.filter(
      (p) => p.display_name === "PRIVATE-TEST-DRAFT",
    ),
  ).toHaveLength(1);
  await context.setOffline(true);
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "A clearer path to Oral care",
      exact: true,
    }),
  ).toBeVisible();
  expect(fixture.writes).toHaveLength(2);
  expect(fixture.uploads).toHaveLength(2);
});

test("offline capture does not open another account's cached records", async ({
  page,
  context,
}) => {
  await clinic(page, "health_worker");
  await expect(
    page.getByRole("heading", {
      name: "A clearer path to Oral care",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "A clearer path to Oral care",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    const session = JSON.parse(
      localStorage.getItem("sb-clinicalfixture-auth-token")!,
    );
    session.user.id = crypto.randomUUID();
    localStorage.setItem(
      "sb-clinicalfixture-auth-token",
      JSON.stringify(session),
    );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Reconnect and sign in before using offline capture",
  );
  await expect(page.getByRole("navigation")).toHaveCount(0);
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
