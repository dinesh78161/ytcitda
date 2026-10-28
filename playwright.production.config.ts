import { defineConfig } from "@playwright/test";
const deployed = process.env.DEPLOY_URL;
if (deployed && new URL(deployed).protocol !== "https:")
  throw new Error("DEPLOY_URL must use HTTPS.");

export default defineConfig({
  outputDir: "./test-results/production",
  testDir: "./tests/production-browser",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: deployed || "http://127.0.0.1:4180",
    channel: process.platform === "win32" ? "msedge" : "chromium",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: deployed
    ? undefined
    : {
        command: "npm start",
        url: "http://127.0.0.1:4180/api/status",
        env: {
          NODE_ENV: "production",
          PORT: "4180",
          APP_ORIGINS: "http://127.0.0.1:4180",
        },
        reuseExistingServer: false,
        timeout: 30000,
      },
});
