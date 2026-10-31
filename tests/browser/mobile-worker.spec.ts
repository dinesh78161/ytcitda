import { test, expect, type Page } from "@playwright/test";
import { labels } from "../../src/lib/i18n";
import { localize } from "../../src/lib/localize";
import type { Language } from "../../src/lib/types";

const telugu: Record<string, string> = Object.fromEntries(
  Object.values(labels),
);
Object.assign(telugu, {
  "Full name": "పూర్తి పేరు",
  "Separate consent for intraoral clinical photographs":
    "ఇంట్రాఓరల్ క్లినికల్ చిత్రాల కోసం ప్రత్యేక సమ్మతి",
  Continue: "కొనసాగించండి",
  "Mouth opening (mm)": "నోరు తెరిచిన కొలత (మి.మీ.)",
});

async function noPageOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);
}

test.use({
  hasTouch: true,
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test.describe("health worker mobile workflow", () => {
  for (const device of [
    { width: 360, height: 800, language: "en", camera: true },
    { width: 412, height: 915, language: "te", camera: false },
  ]) {
    test(`${device.width}px ${device.language}: registration, patient search and photo capture`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const text = (english: string) =>
        localize(device.language as Language, english, telugu[english]);
      const patient = `Synthetic Mobile ${device.width} Resident With A Long Name`;
      await page.setViewportSize(device);
      await page.emulateMedia({ reducedMotion: "reduce" });
      if (!device.camera) {
        // Exercise the file-upload fallback when a field worker denies camera access.
        await page.addInitScript(() => {
          Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
            value: async () => {
              throw new DOMException(
                "Simulated camera permission denial",
                "NotAllowedError",
              );
            },
          });
        });
      }
      await page.goto("/");
      await page
        .locator(".language-picker select")
        .selectOption(device.language);
      const quickNav = page.locator(".mobile-worker-nav");
      await expect(quickNav).toBeVisible();
      await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
      for (const button of await quickNav.getByRole("button").all()) {
        const bounds = (await button.boundingBox())!;
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      await noPageOverflow(page);
      await page.screenshot({
        path: `test-results/mobile-${device.width}-overview.png`,
        fullPage: true,
        animations: "disabled",
      });

      const menu = page.getByRole("button", {
        name: text("Open navigation"),
        exact: true,
      });
      await menu.click();
      const drawer = page.locator(".sidebar");
      await expect(drawer).toHaveAttribute("aria-modal", "true");
      await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveAttribute("inert", "");
      await expect(menu).toBeFocused();

      await quickNav.locator(".mobile-register").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const footer = dialog.locator(".intake-footer");
      await expect(
        footer.getByRole("button", { name: text("Continue"), exact: true }),
      ).toBeInViewport();
      expect((await dialog.boundingBox())!.width).toBe(device.width);
      await dialog.getByLabel(text("Full name"), { exact: true }).fill(patient);
      await dialog.getByLabel(text("Age in years"), { exact: true }).fill("46");
      await dialog
        .getByLabel(text("Village / mandal"), { exact: true })
        .fill("Synthetic village with a long habitation name");
      await dialog
        .getByLabel(
          text("Screening consent recorded in the selected language"),
          { exact: true },
        )
        .check();
      await dialog
        .getByLabel(
          text("Separate consent for intraoral clinical photographs"),
          { exact: true },
        )
        .check();
      await page.setViewportSize({ width: device.width, height: 440 });
      await expect(
        footer.getByRole("button", { name: text("Continue"), exact: true }),
      ).toBeInViewport();
      await page.setViewportSize(device);
      await page.screenshot({
        path: `test-results/mobile-${device.width}-intake.png`,
        animations: "disabled",
      });
      await footer
        .getByRole("button", { name: text("Continue"), exact: true })
        .click();
      await dialog
        .getByLabel(text("Mouth opening (mm)"), { exact: true })
        .fill("32");
      await footer
        .getByRole("button", { name: text("Continue"), exact: true })
        .click();
      await expect(dialog).toContainText(patient);
      await footer
        .getByRole("button", { name: text("Save screening"), exact: true })
        .click();
      await expect(dialog).not.toBeVisible();

      await quickNav
        .getByRole("button", { name: text("Patient registry"), exact: true })
        .click();
      await page
        .getByRole("textbox", {
          name: text("Search by name, village or ID…"),
          exact: true,
        })
        .fill(patient);
      await expect(page.locator(".patient-table tbody tr")).toHaveCount(1);
      const table = page.locator(".table-scroll");
      expect(
        await table.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await noPageOverflow(page);
      await page.screenshot({
        path: `test-results/mobile-${device.width}-registry.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page
        .getByRole("button", {
          name: `${text("Open record")}: ${patient}`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", { name: patient, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("tab", { name: text("Oral photographs"), exact: true })
        .scrollIntoViewIfNeeded();
      await page
        .getByRole("tab", { name: text("Oral photographs"), exact: true })
        .click();
      await page.locator(".live-camera-trigger").click();
      const camera = page.locator(".live-camera-modal");
      await expect(camera).toBeVisible();
      if (device.camera) {
        await expect(camera.locator(".shutter-button")).toBeEnabled();
      } else {
        await expect(camera.locator(".live-camera-error")).toBeVisible();
        await expect(camera.locator(".shutter-button")).toBeDisabled();
        await expect(
          camera.locator(".live-camera-error-actions .button.primary"),
        ).toBeInViewport();
      }
      await expect(camera.locator(".shutter-button")).toBeInViewport();
      await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
      await noPageOverflow(page);
      await page.screenshot({
        path: `test-results/mobile-${device.width}-camera.png`,
        animations: "disabled",
      });
      await camera.locator(".icon-button-close").click();
      await expect(camera).not.toBeVisible();
      await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
      await quickNav
        .getByRole("button", { name: text("Appointments"), exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: text("Appointments"), exact: true }),
      ).toBeVisible();
      await noPageOverflow(page);
      expect(errors).toEqual([]);
    });
  }
});

test("mobile drawer closes on navigation and desktop layout remains available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Screening queue", exact: false })
    .click();
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("heading", { name: "Screening queue", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 740, height: 360 });
  await noPageOverflow(page);
  await expect(page.locator(".mobile-worker-nav")).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".mobile-worker-nav")).not.toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveAttribute("inert", "");
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Patient registry", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".patient-table")).toHaveCSS("display", "table");
  await noPageOverflow(page);
});
