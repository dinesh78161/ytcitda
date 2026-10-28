import { defineConfig } from "@playwright/test";
const baseURL = process.env.HOSTED_TEST_LOCAL_API || process.env.DEPLOY_URL;
if (
  !baseURL ||
  !(
    baseURL.startsWith("https://") ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)
  )
)
  throw new Error(
    "Set DEPLOY_URL to your HTTPS site, or HOSTED_TEST_LOCAL_API to the local production server.",
  );
export default defineConfig({
  outputDir: "./test-results/hosted",
  testDir: "./tests/hosted-browser",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL,
    channel: process.platform === "win32" ? "msedge" : "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions:
      process.env.RUN_HOSTED_VIDEO === "1"
        ? {
            args: [
              "--use-fake-device-for-media-stream",
              "--use-fake-ui-for-media-stream",
              "--autoplay-policy=no-user-gesture-required",
            ],
          }
        : {},
  },
});
