import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/video-ui",
  outputDir: "./test-results/video-ui",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4180",
    channel: process.platform === "win32" ? "msedge" : "chromium",
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/video-ui/serve.mjs",
    url: "http://127.0.0.1:4180/tests/video-ui/index.html",
    timeout: 30000,
  },
});
