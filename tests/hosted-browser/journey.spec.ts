import { test, expect as playwrightExpect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import jpeg from "jpeg-js";
import { PDFDocument } from "pdf-lib";
import {
  checked,
  demoSession,
  hostedClients,
} from "../../scripts/hosted-session.mjs";

const expect = playwrightExpect.configure({ timeout: 30000 });

test("record the complete production patient journey across five staff roles", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    process.env.RUN_HOSTED_JOURNEY !== "1",
    "Explicit opt-in creates a synthetic production case and records browser video.",
  );
  test.setTimeout(600000);
  const candidate = process.env.HOSTED_RECORDING_CANDIDATE === "1";
  if (candidate) expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  else {
    expect(process.env.HOSTED_TEST_LOCAL_API).toBeFalsy();
    expect(baseURL).toMatch(/^https:\/\//);
  }
  const output = path.resolve(
    process.env.JOURNEY_RECORDING_DIR || "test-results/production-journey",
  );
  await mkdir(output, { recursive: true });
  const clients = hostedClients();
  const accounts: Record<string, Awaited<ReturnType<typeof demoSession>>> = {};
  const scenes: { step: string; at: string; elapsed_seconds: number }[] = [];
  const started = Date.now();
  const name = `Synthetic Recorded Journey ${randomUUID().slice(0, 8)}`;
  let patientId: string | undefined;
  let outcome = "failed";
  let failureReason: string | undefined;
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let video: ReturnType<import("@playwright/test").Page["video"]> = null;
  const errors: string[] = [];
  try {
    // Authenticate only existing synthetic users. No password resets, emails,
    // saved auth state, network traces or authenticator enrollment are used.
    for (const role of [
      "health_worker",
      "medical_officer",
      "navigator",
      "specialist",
      "district_admin",
    ]) {
      accounts[role] = await demoSession(clients, role);
    }
    const statusResponse = await fetch(`${baseURL}/api/status`, {
      signal: AbortSignal.timeout(60000),
    });
    expect(statusResponse.status).toBe(200);
    const status = await statusResponse.json();
    expect(status.database).toBe(true);
    expect(status.files).toBe(true);
    expect(status.ai_provider).toBe("mock");
    const before = checked(
      await accounts.district_admin.client.rpc("dashboard_summary"),
      "Initial aggregates",
    );
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Asia/Kolkata",
      recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("pageerror", (error) => errors.push(error.message));
    video = page.video();
    await page.goto(baseURL!);
    // Match configured project to the actual deployed bundle before writing.
    const asset = await page
      .locator('script[type="module"][src]')
      .getAttribute("src");
    expect(asset).toBeTruthy();
    const bundle = await (
      await page.request.get(new URL(asset!, baseURL).href)
    ).text();
    expect(bundle).toContain(clients.url);
    const authKey = `sb-${new URL(clients.url).hostname.split(".")[0]}-auth-token`;
    const journey = page.getByRole("region", { name: "Patient care journey" });
    const button = (label: string) =>
      page.getByRole("button", { name: label, exact: true });
    // Accessible role names exclude option text and textarea contents, unlike
    // wrapped label text. The fallback covers file and date/time inputs.
    const field = (label: string) =>
      page
        .getByRole("textbox", { name: label, exact: true })
        .or(page.getByRole("combobox", { name: label, exact: true }))
        .or(page.getByLabel(label, { exact: true }));
    async function scene(step: string) {
      scenes.push({
        step,
        at: new Date().toISOString(),
        elapsed_seconds: (Date.now() - started) / 1000,
      });
      console.log(`PASS: ${step}`);
      await page.evaluate(
        ({ text, candidate }) => {
          const banner =
            document.getElementById("production-test-caption") ||
            document.createElement("div");
          banner.id = "production-test-caption";
          banner.textContent = `${candidate ? "CANDIDATE BUILD" : "PRODUCTION TEST"} · SYNTHETIC DATA · ${text}`;
          Object.assign(banner.style, {
            position: "fixed",
            bottom: "12px",
            left: "12px",
            maxWidth: "95vw",
            padding: "10px 15px",
            color: "white",
            background: "#123f39ee",
            font: "14px sans-serif",
            borderRadius: "8px",
            zIndex: "99999",
            pointerEvents: "none",
          });
          document.body.appendChild(banner);
        },
        { text: step, candidate },
      );
      await page.screenshot({
        path: path.join(
          output,
          `${String(scenes.length).padStart(2, "0")}.png`,
        ),
        fullPage: false,
      });
      // Deliberate viewing time in the requested recording, not a readiness wait.
      await page.waitForTimeout(1600);
    }
    async function role(role: string) {
      await page.evaluate(
        ({ key, session }) => {
          localStorage.setItem(key, JSON.stringify(session));
          localStorage.setItem("aarogya-language", "en");
        },
        { key: authKey, session: accounts[role].session },
      );
      await page.reload();
      await expect(
        page.getByRole("navigation", { name: "CARE WORKSPACE", exact: true }),
      ).toBeVisible();
      await expect(field("Demo role")).toHaveCount(0);
    }
    async function openPatient() {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Patient registry", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Search by name, village or ID…" })
        .fill(name);
      await button(`Open record: ${name}`).click();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    }
    async function rows(role: string, table: string) {
      return checked(
        await accounts[role].client
          .from(table)
          .select("*")
          .eq(table === "patients" ? "id" : "patient_id", patientId),
        table,
      );
    }
    async function state() {
      return checked(
        await accounts.medical_officer.client
          .from("screenings")
          .select("revision,status")
          .eq("patient_id", patientId)
          .single(),
        "Patient state",
      );
    }

    await role("health_worker");
    await scene(
      `Health worker — ${candidate ? "candidate" : "production"} workspace`,
    );
    await button("Register patient").first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name (synthetic)").fill(name);
    await dialog.getByLabel("Age in years").fill("46");
    await dialog
      .getByLabel("Village / mandal")
      .fill("G. Madugula — synthetic recording");
    await dialog
      .getByLabel("Screening consent recorded in the selected language")
      .check();
    await dialog
      .getByLabel("Separate consent for educational oral photographs")
      .check();
    await scene("Health worker — synthetic registration and consent");
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save screening", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const patients = checked(
      await accounts.health_worker.client
        .from("patients")
        .select("id")
        .eq("display_name", name),
      "Registered patient",
    );
    expect(patients).toHaveLength(1);
    patientId = patients[0].id;
    console.log(
      `Synthetic recorded patient retained with audit history: ${patientId}`,
    );
    await page.reload();
    await openPatient();
    await expect(journey.locator("[data-step]")).toHaveCount(9);
    await scene("Health worker — patient persisted after reload");
    expect(await rows("specialist", "patients")).toHaveLength(0);

    await page
      .getByRole("tab", { name: "Oral photographs", exact: true })
      .click();
    const pixels = Buffer.alloc(512 * 512 * 4, 255);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        const value = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 185 : 70;
        pixels.fill(value, (y * 512 + x) * 4, (y * 512 + x) * 4 + 3);
      }
    await field("Capture / upload demo photo").setInputFiles({
      name: "synthetic-quality-pattern.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg.encode({ data: pixels, width: 512, height: 512 }, 85).data,
    });
    await expect(journey.locator('[data-step="quality"]')).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(await rows("health_worker", "images")).toHaveLength(1);
    await scene("Health worker — real private upload and acceptable quality");
    await button("Run mock AI").click();
    await expect(journey.locator('[data-step="analysis"]')).toHaveAttribute(
      "data-state",
      "recorded",
    );
    const uploadedImage = (await rows("health_worker", "images"))[0];
    const analyses = checked(
      await accounts.health_worker.client
        .from("ai_analyses")
        .select("*")
        .eq("image_id", uploadedImage.id),
      "Saved analysis",
    );
    expect(analyses).toHaveLength(1);
    expect(analyses[0].provider).toBe("mock");
    await scene(
      "Health worker — labelled mock result saved; no disease prediction",
    );

    await role("medical_officer");
    await openPatient();
    await field("Clinician findings").fill(
      "Synthetic independent review for recorded production acceptance. Specialist assessment requested. No clinical advice.",
    );
    await field("Clinical decision").selectOption("refer");
    await scene("Medical Officer — independent review and referral");
    await button("Sign review").click();
    await expect(journey.locator('[data-step="review"]')).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(await rows("specialist", "patients")).toHaveLength(1);
    await scene(
      "Medical Officer — signed review; assigned specialist now has access",
    );

    await role("navigator");
    await openPatient();
    await page.getByRole("tab", { name: "Appointments", exact: true }).click();
    await button("Book appointment").click();
    const start = new Date(
      Date.now() + 3 * 86400000 + Math.floor(Math.random() * 1400) * 60000,
    );
    const local = new Date(start.getTime() + 330 * 60000)
      .toISOString()
      .slice(0, 16);
    await field("Date and time").fill(local);
    await field("Consultation mode").selectOption("in_person");
    await scene("Navigator — book a synthetic in-person appointment");
    await button("Confirm appointment").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(button("Mark attended")).toBeVisible();
    await button("Mark attended").click();
    await expect(button("Mark attended")).toHaveCount(0);
    while (await button("Complete follow-up").count()) {
      const count = await button("Complete follow-up").count();
      await button("Complete follow-up").first().click();
      await expect(button("Complete follow-up")).toHaveCount(count - 1);
    }
    await expect(journey.locator('[data-step="consultation"]')).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(
      (await rows("navigator", "navigation_tasks")).filter(
        (t: { status: string }) => t.status === "pending",
      ),
    ).toHaveLength(0);
    await scene("Navigator — simulated attendance and follow-up completed");

    await role("specialist");
    await openPatient();
    await page.getByRole("tab", { name: "Care plan", exact: true }).click();
    await field("Investigation notes / result").fill(
      "Synthetic biopsy requested for production recording.",
    );
    await button("Save investigation").click();
    await expect(field("Investigation record").locator("option")).toHaveCount(
      2,
    );
    const investigation = (await rows("specialist", "investigations"))[0];
    for (const stage of ["collected", "reported", "reviewed"]) {
      await field("Investigation record").selectOption(investigation.id);
      await field("Investigation stage").selectOption(stage);
      await field("Investigation notes / result").fill(
        `Synthetic pathology stage: ${stage}. Test data only.`,
      );
      await button("Save investigation").click();
      await expect
        .poll(
          async () => (await rows("specialist", "investigations"))[0].status,
        )
        .toBe(stage);
      await expect(field("Investigation record")).toHaveValue("");
    }
    await expect(journey.locator('[data-step="diagnostics"]')).toHaveAttribute(
      "data-state",
      "complete",
    );
    await scene(
      "Specialist — requested, collected, reported and reviewed diagnostics",
    );
    await field("Investigation record").selectOption(investigation.id);
    const pdf = await PDFDocument.create();
    pdf
      .addPage()
      .drawText(
        "SYNTHETIC PRODUCTION TEST — NOT FOR CLINICAL USE".replace("—", "-"),
        { x: 30, y: 700, size: 12 },
      );
    const pdfBytes = Buffer.from(await pdf.save());
    await field("Attach diagnostic report").setInputFiles({
      name: "synthetic-recorded-report.pdf",
      mimeType: "application/pdf",
      buffer: pdfBytes,
    });
    const documentRow = page
      .locator(".document-row")
      .filter({ hasText: "synthetic-recorded-report.pdf" });
    await expect(documentRow).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await documentRow
      .getByRole("button", { name: "Download", exact: true })
      .click();
    const download = await downloaded;
    const reportPath = path.join(output, "synthetic-downloaded-report.pdf");
    await download.saveAs(reportPath);
    expect(
      createHash("sha256")
        .update(await readFile(reportPath))
        .digest("hex"),
    ).toBe(createHash("sha256").update(pdfBytes).digest("hex"));
    await scene(
      "Specialist — private PDF uploaded and downloaded with matching bytes",
    );

    await field("Treatment plan").fill(
      "Synthetic recorded treatment plan — software test only",
    );
    await field("Treatment status").selectOption("active");
    await field("Progress notes").fill("Synthetic plan started.");
    const treatmentSaved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/rest/v1/rpc/submit_workflow" &&
        response.request().postDataJSON()?.action === "treatment",
    );
    await button("Save treatment progress").click();
    const treatmentResponse = await treatmentSaved;
    const treatmentResult = await treatmentResponse.json();
    await writeFile(
      path.join(output, "treatment-response.json"),
      JSON.stringify(
        {
          http_status: treatmentResponse.status(),
          code: treatmentResult.code,
          message: treatmentResult.message,
          saved_id: treatmentResult.id,
        },
        null,
        2,
      ) + "\n",
    );
    if (treatmentResponse.status() !== 200) {
      await page.screenshot({
        path: path.join(output, "treatment-save-failure.png"),
        fullPage: true,
      });
      await page.waitForTimeout(2000);
    }
    expect(
      treatmentResponse.status(),
      `Treatment save failed: ${treatmentResult.code || "HTTP error"}`,
    ).toBe(200);
    await expect(field("Treatment record").locator("option")).toHaveCount(2);
    await field("Decision area").selectOption("case");
    await field("Clinical rationale").fill(
      "Attempt closure with active treatment; this must remain blocked.",
    );
    await expect(button("Close case")).toBeDisabled();
    await button("Close case").scrollIntoViewIfNeeded();
    await scene(
      "Specialist — closure correctly blocked while treatment is active",
    );
    const treatment = (await rows("specialist", "treatments"))[0];
    await field("Treatment record").selectOption(treatment.id);
    await field("Treatment status").selectOption("completed");
    await field("Progress notes").fill(
      "Synthetic treatment completed; no real care performed.",
    );
    await button("Save treatment progress").click();
    await expect(journey.locator('[data-step="treatment"]')).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(await rows("specialist", "treatment_events")).toHaveLength(2);
    await scene("Specialist — completed treatment with append-only history");

    await role("medical_officer");
    await openPatient();
    await field("Decision area").selectOption("case");
    await field("Clinical rationale").fill(
      "Synthetic production acceptance complete; reviewed diagnostics, completed treatment and resolved follow-up.",
    );
    await button("Close case").click();
    await expect(journey).toContainText("Case closed");
    await page.reload();
    await openPatient();
    await expect(journey).toContainText("Case closed");
    expect((await state()).status).toBe("closed");
    await scene("Medical Officer — case closed and persisted after reload");
    await field("Clinical rationale").fill(
      "Synthetic reopen acceptance; retain the complete earlier history.",
    );
    await button("Reopen case").click();
    await expect(journey).not.toContainText("Case closed");
    expect((await state()).status).not.toBe("closed");
    await scene("Medical Officer — reopened case retains signed history");
    await field("Decision area").selectOption("case");
    await field("Clinical rationale").fill(
      "Synthetic test finished; close the retained audit fixture again.",
    );
    await button("Close case").click();
    await expect(journey).toContainText("Case closed");

    await role("district_admin");
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: "Patient registry", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "District reports", exact: true })
      .click();
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(await rows("district_admin", "patients")).toHaveLength(0);
    const totals = checked(
      await accounts.district_admin.client.rpc("dashboard_summary"),
      "Final aggregates",
    );
    expect(totals.completed_cases).toBeGreaterThanOrEqual(
      before.completed_cases + 1,
    );
    const exported = page.waitForEvent("download");
    await button("Export summary CSV").click();
    await (await exported).saveAs(path.join(output, "district-summary.csv"));
    const csv = await readFile(
      path.join(output, "district-summary.csv"),
      "utf8",
    );
    expect(csv).toContain("stage_closed,");
    expect(csv).not.toContain(name);
    await scene(
      "District administrator — updated totals and CSV without patient identifiers",
    );
    expect(errors).toEqual([]);
    outcome = "passed";
  } catch (cause) {
    failureReason = cause instanceof Error ? cause.message : String(cause);
    throw cause;
  } finally {
    if (context) await context.close();
    if (video)
      await video.saveAs(
        path.join(
          output,
          `${candidate ? "candidate" : "production"}-patient-journey.webm`,
        ),
      );
    await writeFile(
      path.join(output, "journey-result.json"),
      JSON.stringify(
        {
          outcome,
          failure_reason: failureReason,
          checked_at: new Date().toISOString(),
          tested_url: baseURL,
          recording_target: candidate ? "candidate" : "production",
          patient_id: patientId,
          patient_name: name,
          retained_with_audit_history: Boolean(patientId),
          scope: candidate
            ? "Local candidate frontend/API using actual hosted database and private Storage; NOT a production deployment. Synthetic data; attendance simulated."
            : "Actual production browser workflow, hosted database and private Storage. Synthetic data. In-person attendance simulated.",
          authentication:
            "Temporary sessions for existing synthetic users; team passwords not verified. Existing MFA factors never bypassed.",
          video:
            "Continuous browser capture of this run; no generated narration or physical-device claim.",
          scenes,
          page_errors: errors,
        },
        null,
        2,
      ) + "\n",
    );
    for (const account of Object.values(accounts))
      await account.client.auth.signOut({ scope: "local" });
  }
});
