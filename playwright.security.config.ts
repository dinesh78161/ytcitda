import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/security-browser",
  outputDir: "./test-results/security-browser",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4181",
    channel: process.platform === "win32" ? "msedge" : "chromium",
    viewport: { width: 390, height: 844 },
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4181/api/status",
    env: {
      NODE_ENV: "production",
      PORT: "4181",
      APP_ORIGINS: "http://127.0.0.1:4181",
    },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
