import { test, expect, type Page } from "@playwright/test";

async function captureDemo(page: Page, scene: string) {
  if (process.env.CAPTURE_DEMO === "1")
    await page.screenshot({
      path: `test-results/recording/${scene}.png`,
      animations: "disabled",
    });
}

async function register(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Register patient", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Age in years").fill("46");
  await dialog.getByLabel("Village / mandal").fill("G. Madugula");
  await dialog
    .getByLabel("Screening consent recorded in the selected language")
    .check();
  await dialog
    .getByLabel("Separate consent for intraoral clinical photographs")
    .check();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await captureDemo(page, "registration");
  await dialog
    .getByRole("button", { name: "Save screening", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
async function openPatient(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search by name, village or ID…" })
    .fill(name);
  await page
    .getByRole("button", { name: `Open record: ${name}`, exact: true })
    .click();
}

test("worker screening validates, restores its draft, and saves structured findings", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start screening", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByLabel("Full name")).toBeVisible();
  await dialog.getByLabel("Full name").fill("Synthetic Structured Intake");
  await dialog.getByLabel("Age in years").fill("46");
  await dialog.getByLabel("Village / mandal").fill("Paderu");
  await dialog
    .getByLabel("Screening consent recorded in the selected language")
    .check();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Chutta (reverse smoking)", { exact: true }).check();
  await dialog
    .getByLabel("Tobacco history", { exact: true })
    .selectOption("current");
  await dialog.getByLabel("Habit duration (years)", { exact: true }).fill("15");
  await dialog
    .getByLabel("Daily frequency (times/day)", { exact: true })
    .fill("8");
  await dialog
    .getByLabel("Burning sensation with spices", { exact: true })
    .check();
  await dialog.getByLabel("Mouth opening (mm)", { exact: true }).fill("101");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    dialog.getByLabel("Mouth opening (mm)", { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Mouth opening (mm)", { exact: true }).fill("32");
  await dialog
    .getByLabel("Cervical lymph nodes", { exact: true })
    .selectOption("not_assessed");
  await expect(dialog.getByRole("status")).toContainText(
    "Draft saved on this device",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Start screening", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Mouth opening (mm)", { exact: true }),
  ).toHaveValue("32");
  await expect(
    dialog.getByLabel("Chutta (reverse smoking)", { exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: "test-results/worker-screening-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/worker-screening-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog).toContainText("Synthetic Structured Intake");
  await expect(dialog).toContainText("Burning sensation with spices");
  await dialog
    .getByRole("button", { name: "Save screening", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await openPatient(page, "Synthetic Structured Intake");
  await expect(page.locator(".intake-summary")).toContainText(
    "Chutta (reverse smoking)",
  );
  await expect(page.locator(".intake-summary")).toContainText(
    "Burning sensation with spices",
  );
  await expect(page.locator(".intake-summary")).toContainText("32");
  await expect(page.locator(".intake-summary")).toContainText("Not assessed");
});

test("dashboard, registration, doctor referral, booking and simulated outcome", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer path to Oral care" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await register(page, "Synthetic Browser Patient");
  await expect(
    page.getByText("Synthetic Browser Patient", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Synthetic Browser Patient", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("medical_officer");
  await openPatient(page, "Synthetic Browser Patient");
  await page
    .getByLabel("Clinician findings")
    .fill("Synthetic independent findings. Specialist assessment requested.");
  await page.getByRole("button", { name: "Sign review", exact: true }).click();
  await expect(
    page
      .locator(".review-card")
      .getByText(
        "Synthetic independent findings. Specialist assessment requested.",
        { exact: true },
      ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await page.getByLabel("Date and time").fill("2099-01-03T10:00");
  await page
    .getByRole("button", { name: "Confirm appointment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel("Clinician-entered simulated outcome")
    .fill("Simulated pathology report reviewed by demo clinician.");
  await page
    .getByRole("button", { name: "Save simulated outcome", exact: true })
    .click();
  await expect(
    page
      .locator(".review-card")
      .getByText("Simulated pathology report reviewed by demo clinician.", {
        exact: true,
      }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/patient-workflow.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("guided nine-step journey completes care, persists closure and reaches district totals", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await register(page, "Synthetic Complete Journey");
  await openPatient(page, "Synthetic Complete Journey");
  const journey = page.getByRole("region", { name: "Patient care journey" });
  await expect(journey.locator("[data-step]")).toHaveCount(9);
  await journey.locator('[data-step="photos"] button').click();
  const pattern = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    for (let y = 0; y < 512; y += 8)
      for (let x = 0; x < 512; x += 8) {
        ctx.fillStyle = (x / 8 + y / 8) % 2 ? "#bbb" : "#555";
        ctx.fillRect(x, y, 8, 8);
      }
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Capture / upload demo photo", { exact: true })
    .setInputFiles({
      name: "synthetic-pattern.png",
      mimeType: "image/png",
      buffer: Buffer.from(pattern, "base64"),
    });
  await page
    .locator(".photo-card")
    .getByRole("button", { name: "Run mock AI" })
    .click();
  await expect(journey.locator('[data-step="quality"]')).toHaveAttribute(
    "data-state",
    "complete",
  );
  await expect(journey.locator('[data-step="analysis"]')).toHaveAttribute(
    "data-state",
    "recorded",
  );
  await captureDemo(page, "photos-quality-ai");
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("medical_officer");
  await openPatient(page, "Synthetic Complete Journey");
  await page
    .getByLabel("Clinician findings")
    .fill("Synthetic signed review requesting specialist assessment");
  await page.getByRole("button", { name: "Sign review", exact: true }).click();
  await expect(journey.locator('[data-step="review"]')).toHaveAttribute(
    "data-state",
    "complete",
  );
  await captureDemo(page, "officer-review");
  await journey.locator('[data-step="consultation"] button').click();
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await page.getByLabel("Date and time").fill("2099-01-03T10:00");
  await page
    .getByRole("button", { name: "Confirm appointment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Mark attended", exact: true })
    .click();
  await expect(journey.locator('[data-step="consultation"]')).toHaveAttribute(
    "data-state",
    "complete",
  );
  await page
    .getByRole("button", { name: "Complete follow-up", exact: true })
    .click();
  await journey.locator('[data-step="diagnostics"] button').click();
  await page
    .getByRole("combobox", { name: "Investigation stage", exact: true })
    .selectOption("reviewed");
  await page
    .getByLabel("Investigation notes / result", { exact: true })
    .fill("Synthetic histopathology reviewed");
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(journey.locator('[data-step="diagnostics"]')).toHaveAttribute(
    "data-state",
    "complete",
  );
  await captureDemo(page, "diagnostics");
  await page
    .getByLabel("Treatment plan", { exact: true })
    .fill("Synthetic care plan");
  await page
    .getByRole("combobox", { name: "Treatment status", exact: true })
    .selectOption("active");
  await page
    .getByLabel("Progress notes", { exact: true })
    .fill("Synthetic start");
  await page
    .getByRole("button", { name: "Save treatment progress", exact: true })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Treatment record", exact: true })
      .locator("option"),
  ).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Decision area", exact: true })
    .selectOption("case");
  await expect(
    page.getByRole("button", { name: "Close case", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Treatment record", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Treatment status", exact: true })
    .selectOption("completed");
  await page
    .getByLabel("Progress notes", { exact: true })
    .fill("Synthetic course completed");
  await page
    .getByRole("button", { name: "Save treatment progress", exact: true })
    .click();
  await expect(journey.locator('[data-step="treatment"]')).toHaveAttribute(
    "data-state",
    "complete",
  );
  await captureDemo(page, "treatment");
  await page
    .getByLabel("Clinical rationale", { exact: true })
    .fill("Synthetic case resolved after review and follow-up");
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await expect(journey).toContainText("Case closed");
  await page.reload();
  await openPatient(page, "Synthetic Complete Journey");
  await expect(journey).toContainText("Case closed");
  await page.screenshot({
    path: "test-results/complete-journey-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/complete-journey-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("Clinical rationale", { exact: true })
    .fill("Synthetic case reopened for renewed review");
  await page.getByRole("button", { name: "Reopen case", exact: true }).click();
  await expect(journey).not.toContainText("Case closed");
  await page
    .getByRole("combobox", { name: "Decision area", exact: true })
    .selectOption("case");
  await page
    .getByLabel("Clinical rationale", { exact: true })
    .fill("Synthetic review completed again");
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await expect(journey).toContainText("Case closed");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("district_admin");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "District reports", exact: true })
    .click();
  await expect(
    page.locator(".stage-row").filter({ hasText: "Closed" }).locator("strong"),
  ).toHaveText("1");
  await captureDemo(page, "district-reports");
  expect(errors).toEqual([]);
});

test("offline registration survives reload and reconnects exactly once", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer path to Oral care" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A clearer path to Oral care" }),
  ).toBeVisible();
  await context.setOffline(true);
  await register(page, "Synthetic Offline Patient");
  await expect(
    page.getByRole("button", { name: /1 · Offline registration queue/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /1 · Offline registration queue/ }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByText("Synthetic Offline Patient", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await context.setOffline(false);
  await openPatient(page, "Synthetic Offline Patient");
  await expect(
    page.getByRole("heading", {
      name: "Synthetic Offline Patient",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to patients" }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
});

test("Telugu mobile navigation, registration labels and no page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer path to Oral care" }),
  ).toBeVisible();
  await page.locator(".language-picker select").selectOption("te");
  await expect(
    page.getByRole("heading", { name: "మెరుగైన సంరక్షణకు స్పష్టమైన మార్గం." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-mobile-telugu.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        right: el.getBoundingClientRect().right,
      }))
      .filter((el) => el.right > window.innerWidth + 1),
  }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.width,
  );
  await page
    .getByRole("button", { name: "రోగిని నమోదు చేయండి", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("పూర్తి పేరు", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "రద్దు", exact: true }).click();
  await page.getByRole("button", { name: "మెనూ తెరవండి" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "అపాయింట్‌మెంట్‌లు", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "అపాయింట్‌మెంట్‌లు", exact: true }),
  ).toBeVisible();
});

test("district role has aggregates without patient rows and can export CSV", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("district_admin");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Patient registry" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "District reports" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export summary CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "aarogya-clinical-summary.csv",
  );
});

test("photo decoding, retake guidance and nonclinical mock analysis", async ({
  page,
}) => {
  await page.goto("/");
  await register(page, "Synthetic Photo Patient");
  await openPatient(page, "Synthetic Photo Patient");
  await page
    .getByRole("tab", { name: "Oral photographs", exact: true })
    .click();
  const upload = page.getByLabel("Capture / upload demo photo", {
    exact: true,
  });
  await upload.setInputFiles({
    name: "invalid.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("%PDF-not-an-image"),
  });
  await expect(page.getByRole("alert")).toContainText("cannot be decoded");
  const patterns = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 512, 512);
    const flat = canvas.toDataURL("image/png").split(",")[1];
    for (let y = 0; y < 512; y += 8)
      for (let x = 0; x < 512; x += 8) {
        ctx.fillStyle = (x / 8 + y / 8) % 2 ? "#bbb" : "#555";
        ctx.fillRect(x, y, 8, 8);
      }
    return { flat, sharp: canvas.toDataURL("image/png").split(",")[1] };
  });
  await upload.setInputFiles({
    name: "flat.png",
    mimeType: "image/png",
    buffer: Buffer.from(patterns.flat, "base64"),
  });
  await expect(
    page
      .locator(".photo-card")
      .getByText("Retake recommended", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".photo-card").getByRole("button", { name: "Run mock AI" }),
  ).toBeDisabled();
  await upload.setInputFiles({
    name: "synthetic-pattern.png",
    mimeType: "image/png",
    buffer: Buffer.from(patterns.sharp, "base64"),
  });
  const accepted = page
    .locator(".photo-card")
    .filter({ hasText: "Quality check passed" });
  await expect(accepted).toHaveCount(1);
  await accepted.getByRole("button", { name: "Run mock AI" }).click();
  await expect(accepted).toContainText("No medical prediction was made.");
  await expect(accepted.locator(".analysis-score strong")).toHaveText("—");
  await expect(accepted.locator("meter")).toHaveCount(0);
  await expect(accepted.locator(".ai-detected-condition-card")).toHaveCount(0);
  await expect(
    accepted.locator(".vision-active-badge, .image-quality-overlay-pills"),
  ).toHaveCount(0);
  await expect(accepted).not.toContainText("Confidence:");
  await expect(accepted).toContainText(
    "Independent clinician examination required",
  );
  await expect(accepted).toContainText("Not assessed");
  await page.locator(".toast .icon-button").click();
  await accepted.screenshot({ path: "test-results/oral-analyser-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await accepted.screenshot({ path: "test-results/oral-analyser-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await openPatient(page, "Synthetic Photo Patient");
  await page
    .getByRole("tab", { name: "Oral photographs", exact: true })
    .click();
  await expect(page.locator(".analysis-score strong")).toHaveText(["—", "—"]);
  // Persist an explicit server-report fixture to verify rendering, not inference.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open("aarogya-synthetic-workspace", 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction("kv", "readwrite");
        const store = tx.objectStore("kv");
        const request = store.get("demo-v1");
        request.onsuccess = () => {
          const data = request.result;
          const patient = data.patients.find(
            (p: { display_name: string }) =>
              p.display_name === "Synthetic Photo Patient",
          );
          const image = data.images.find(
            (i: { patient_id: string; quality_status: string }) =>
              i.patient_id === patient.id && i.quality_status === "acceptable",
          );
          data.ai_analyses.unshift({
            id: crypto.randomUUID(),
            image_id: image.id,
            provider: "research",
            model_version: "gemini-report-test-fixture",
            research_label: "not_an_oral_photo",
            score: null,
            clinical_use: false,
            requires_clinician_review: true,
            status: "completed",
            created_at: new Date(Date.now() + 1000).toISOString(),
            findings: {
              engine: "gemini",
              prompt_version: "oral-observation-v1",
              image_kind: "not_oral_photo",
              summary:
                "Synthetic Gemini report fixture: this test pattern is not an oral photograph.",
              visible_findings: [],
              possible_conditions: [],
              limitations: [
                "Upload a suitable educational oral photograph; no disease assessment was performed.",
              ],
            },
          });
          store.put(data, "demo-v1");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  });
  await page.reload();
  await openPatient(page, "Synthetic Photo Patient");
  await page
    .getByRole("tab", { name: "Oral photographs", exact: true })
    .click();
  const report = page
    .locator(".photo-card")
    .filter({ has: page.locator(".vision-report") });
  await expect(report).toContainText("Synthetic Gemini report fixture");
  await expect(report.locator(".analysis-score")).toHaveCount(0);
  await expect(report.locator("meter")).toHaveCount(0);
  await expect(report.locator(".ai-detected-condition-card")).toHaveCount(0);
  await expect(page.locator('[data-step="analysis"]')).toHaveAttribute(
    "data-state",
    "recorded",
  );
  await report.screenshot({ path: "test-results/gemini-report-fixture.png" });
});
