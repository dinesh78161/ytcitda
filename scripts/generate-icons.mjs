import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Derive browser/install icons from the owner's supplied logo without changing
// its artwork, proportions or background. No external service is used.
const logo = await readFile(
  new URL("../public/aarogya-logo.png", import.meta.url),
);
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : "chromium",
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [size, filename] of [
    [32, "favicon-32.png"],
    [180, "apple-touch-icon.png"],
    [192, "app-icon-192.png"],
    [512, "app-icon-512.png"],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:white}img{display:block;width:100vw;height:100vh;object-fit:contain}</style><img src="data:image/png;base64,${logo.toString("base64")}" alt="Aarogya Drishti">`,
    );
    await page.locator("img").evaluate((image) => image.decode());
    await page.screenshot({
      path: fileURLToPath(new URL(`../public/${filename}`, import.meta.url)),
    });
  }
} finally {
  await browser.close();
}
