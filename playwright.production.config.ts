import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/production-browser",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4180",
    channel: "msedge",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
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
