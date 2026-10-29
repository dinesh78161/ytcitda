import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
async function patient(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient registry", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Search by name/ })
    .fill("Demo Resident 01");
  await page
    .getByRole("button", { name: "Open record: Demo Resident 01", exact: true })
    .click();
  await page.getByRole("tab", { name: "Care plan", exact: true }).click();
}
test("investigations, report downloads and treatment history survive reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("medical_officer");
  await patient(page);
  await page
    .getByRole("combobox", { name: "Investigation stage", exact: true })
    .selectOption("collected");
  await page
    .getByLabel("Investigation notes / result", { exact: true })
    .fill("Synthetic sample collected");
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Investigation record", exact: true })
      .locator("option"),
  ).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Investigation record", exact: true })
    .selectOption({ index: 1 });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await page
    .getByLabel("Attach diagnostic report", { exact: true })
    .setInputFiles({
      name: "synthetic-report.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await expect(
    page.getByText("synthetic-report.pdf", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("synthetic-report.pdf");
  await page
    .getByLabel("Treatment plan", { exact: true })
    .fill("Synthetic specialist care plan");
  await page
    .getByRole("combobox", { name: "Treatment status", exact: true })
    .selectOption("active");
  await page
    .getByLabel("Progress notes", { exact: true })
    .fill("Synthetic course started after review");
  await page
    .getByRole("button", { name: "Save treatment progress", exact: true })
    .click();
  await expect(
    page
      .locator(".treatment-event")
      .getByText("Synthetic course started after review", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await patient(page);
  await expect(
    page.getByText("synthetic-report.pdf", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Treatment record", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Treatment status", exact: true })
    .selectOption("completed");
  await page
    .getByLabel("Progress notes", { exact: true })
    .fill("Synthetic treatment completed");
  await page
    .getByRole("button", { name: "Save treatment progress", exact: true })
    .click();
  await expect(page.locator(".treatment-event")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/care-plan-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/care-plan-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("outreach records update district totals without exposing patient records", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "District reports", exact: true })
    .click();
  await page
    .getByLabel("Outreach village", { exact: true })
    .fill("Synthetic outreach village");
  await page.getByLabel("People attending", { exact: true }).fill("20");
  await page.getByLabel("People screened", { exact: true }).fill("15");
  await page
    .getByRole("button", { name: "Save outreach event", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic outreach village", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("district_admin");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "District reports", exact: true })
    .click();
  await expect(
    page
      .locator(".care-metric")
      .filter({ hasText: "Screened at outreach" })
      .locator("strong"),
  ).toHaveText("15");
  await expect(
    page.getByText("Synthetic outreach village", { exact: true }),
  ).toHaveCount(0);
});
test("appointment rescheduling replaces reminders and calendar download works", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("navigator");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Appointments", exact: true })
    .click();
  const card = page.locator(".appointment-card").filter({
    has: page.getByRole("heading", { name: "Demo Resident 01", exact: true }),
  });
  await card.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page
    .getByLabel("New date and time", { exact: true })
    .fill("2099-01-02T10:30");
  await page
    .getByRole("button", { name: "Save new time", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card.getByText("Rescheduled", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await card
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("care-appointment.ics");
  await page
    .locator(".care-panel")
    .getByRole("button", { name: "Mark contacted", exact: true })
    .first()
    .click();
  await expect(
    page
      .locator(".care-panel")
      .getByRole("button", { name: "Mark contacted", exact: true }),
  ).toHaveCount(3);
});
