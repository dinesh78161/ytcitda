import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Rasterize the existing project SVG for Android installability. No external art.
const svg = await readFile(
  new URL("../public/icon.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : "chromium",
});
try {
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:#123f39}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
    );
    await page.screenshot({ path: `public/icon-${size}.png` });
  }
} finally {
  await browser.close();
}
