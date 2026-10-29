import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const languages = [
  ["hi", "हिन्दी"],
  ["ta", "தமிழ்"],
  ["kn", "ಕನ್ನಡ"],
  ["ml", "മലയാളം"],
  ["mr", "मराठी"],
  ["bn", "বাংলা"],
  ["or", "ଓଡ଼ିଆ"],
];
for (const [code, nativeName] of languages) {
  test(`${code}: mobile language, screening, and saved patient preference`, async ({
    page,
    context,
  }) => {
    const messages = JSON.parse(
      readFileSync(
        new URL(`../../src/locales/${code}.json`, import.meta.url),
        "utf8",
      ),
    );
    const text = (english: string) => messages[english] || english;
    const patient = `Synthetic ${code} Resident`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator(".language-picker select").selectOption(code);
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(
      page.getByRole("heading", {
        name: text("A clearer path to care."),
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.reload();
    await expect(page.locator(".language-picker select")).toHaveValue(code);
    await page
      .getByRole("button", { name: text("Register patient"), exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(text("Full name"), { exact: true }).fill(patient);
    await dialog.getByLabel(text("Age in years"), { exact: true }).fill("46");
    await dialog
      .getByLabel(text("Village / mandal"), { exact: true })
      .fill("Synthetic Paderu");
    await expect(
      dialog.getByRole("combobox", {
        name: text("Preferred language"),
        exact: true,
      }),
    ).toHaveValue(code);
    await dialog
      .getByLabel(text("Screening consent recorded in the selected language"), {
        exact: true,
      })
      .check();
    await dialog
      .getByLabel(text("Separate consent for educational oral photographs"), {
        exact: true,
      })
      .check();
    await dialog
      .getByRole("button", { name: text("Continue"), exact: true })
      .click();
    await expect(
      dialog.getByLabel(text("Mouth opening (mm)"), { exact: true }),
    ).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await dialog.screenshot({
      path: `test-results/language-${code}-screening.png`,
    });
    await dialog
      .getByRole("button", { name: text("Continue"), exact: true })
      .click();
    await dialog
      .getByRole("button", { name: text("Save screening"), exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page
      .getByRole("button", {
        name: `${text("Open record")}: ${patient}`,
        exact: true,
      })
      .click();
    await expect(page.locator(".clinical-facts")).toContainText(nativeName);
    await expect(
      page.getByRole("heading", { name: patient, exact: true }),
    ).toBeVisible();
    if (code === "hi") {
      await page
        .getByRole("tab", { name: text("Oral photographs"), exact: true })
        .click();
      const pattern = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        const context = canvas.getContext("2d")!;
        for (let y = 0; y < 512; y += 8)
          for (let x = 0; x < 512; x += 8) {
            context.fillStyle = (x / 8 + y / 8) % 2 ? "#bbb" : "#555";
            context.fillRect(x, y, 8, 8);
          }
        return canvas.toDataURL("image/png").split(",")[1];
      });
      // A generated checkerboard verifies UI rendering; it is not a clinical image.
      await page
        .getByLabel(text("Capture / upload demo photo"), { exact: true })
        .setInputFiles({
          name: "synthetic-checkerboard.png",
          mimeType: "image/png",
          buffer: Buffer.from(pattern, "base64"),
        });
      const imageCard = page.locator(".photo-card");
      await expect(imageCard).toContainText(text("Image quality checks"));
      await expect(
        imageCard.getByRole("button", {
          name: text("Run mock AI"),
          exact: true,
        }),
      ).toBeEnabled();
      await imageCard.screenshot({
        path: "test-results/language-hi-image-analysis.png",
      });
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.reload();
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator(".language-picker select")).toHaveValue("hi");
      await expect(
        page.getByRole("heading", {
          name: text("A clearer path to care."),
          exact: true,
        }),
      ).toBeVisible();
      await context.setOffline(false);
    }
  });
}
