import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const role of ["medical_officer", "specialist"]) {
  test(`${role} can open clinical reports and export aggregate counts`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page
      .getByLabel("Training role selection", { exact: true })
      .selectOption(role);
    const nav = page.getByRole("navigation");
    await expect(
      nav.getByRole("button", { name: "District reports", exact: true }),
    ).toHaveCount(0);
    await nav
      .getByRole("button", { name: "Clinical reports", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Clinical reports", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".breadcrumb")).toContainText("Clinical reports");
    await expect(
      page.getByRole("heading", {
        name: "Patient workflow stages",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Referral coverage", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Outreach village", { exact: true }),
    ).toHaveCount(0);

    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export summary CSV", exact: true })
      .click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("aarogya-clinical-summary.csv");
    const csv = await readFile((await download.path())!, "utf8");
    const lines = csv.trim().split("\n");
    expect(lines.shift()).toBe("metric,count");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatch(/^[a-z_]+,\d+$/);
    expect(csv).toContain("screenings,");
    expect(csv).not.toMatch(/patient_id|display_name|contact_phone/);
    await page.screenshot({
      path: `test-results/${role}-reports-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await nav
      .getByRole("button", { name: "Clinical reports", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Clinical reports", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${role}-reports-mobile.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  });
}

test("report navigation keeps district reporting exclusive to admins", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");
  const roles = page.getByLabel("Training role selection", { exact: true });
  for (const role of ["health_worker", "navigator"]) {
    await roles.selectOption(role);
    await expect(nav.getByRole("button", { name: /reports/i })).toHaveCount(0);
  }
  await roles.selectOption("district_admin");
  await nav
    .getByRole("button", { name: "District reports", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "A view of community care.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    nav.getByRole("button", { name: "Clinical reports", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("button", { name: "Patient registry", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("clinical report labels follow the selected language", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Training role selection", { exact: true })
    .selectOption("medical_officer");
  await page.locator(".language-picker select").selectOption("te");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "వైద్య నివేదికలు", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "వైద్య నివేదికలు", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".breadcrumb")).toContainText("వైద్య నివేదికలు");
});
