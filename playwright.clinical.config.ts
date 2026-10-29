import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/clinical-browser",
  outputDir: "./test-results/clinical-browser",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4175",
    channel: process.platform === "win32" ? "msedge" : "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run preview -- --outDir test-results/clinical-dist --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
