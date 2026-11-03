import { test, expect, type Page } from "@playwright/test";

async function openCall(page: Page, query = "") {
  await page.goto(`/tests/video-ui/index.html${query}`);
  await expect(page.locator(".consultation-conn-text")).toContainText(
    "Connected · Live call",
  );
}
async function expectRemoteLarger(page: Page) {
  const remote = await page.locator(".consultation-tile-remote").boundingBox();
  const local = await page.locator(".consultation-tile-local").boundingBox();
  expect(remote!.width).toBeGreaterThan(local!.width * 1.5);
  expect(remote!.width * remote!.height).toBeGreaterThan(
    local!.width * local!.height * 2,
  );
}

test("receives audible remote media separately from the self preview", async ({
  page,
}) => {
  await openCall(page);
  await expect(
    page.getByText("Participant microphone on", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".consultation-audio audio")
        .evaluate((el: HTMLAudioElement) => ({
          playing: !el.paused,
          muted: el.muted,
          volume: el.volume,
          audio: (el.srcObject as MediaStream).getAudioTracks()[0].readyState,
        })),
    )
    .toEqual({ playing: true, muted: false, volume: 1, audio: "live" });
  await expect(page.locator(".consultation-tile-local video")).toHaveJSProperty(
    "muted",
    true,
  );
  await expectRemoteLarger(page);
  await page.screenshot({
    path: "test-results/video-ui/desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Maximize test call" }).click();
  await expectRemoteLarger(page);
  await page.getByRole("button", { name: "Maximize test call" }).click();
  await page.getByRole("button", { name: "Full Screen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Exit Fullscreen", exact: true }),
  ).toBeVisible();
  await expectRemoteLarger(page);
  await page
    .getByRole("button", { name: "Exit Fullscreen", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectRemoteLarger(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/video-ui/mobile.png",
    fullPage: true,
  });
});

test("recovers blocked audio through the user control and permits another retry", async ({
  page,
}) => {
  await openCall(page, "?blocked");
  await expect(page.getByText(/Call sound is blocked/)).toBeVisible();
  await page
    .getByRole("button", { name: "Enable call audio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enable call audio", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as any).testRoom.blockAudio = false;
  });
  await page
    .getByRole("button", { name: "Enable call audio", exact: true })
    .click();
  await expect(page.getByText(/Call sound is blocked/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Check call audio", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".consultation-audio audio")).toHaveJSProperty(
    "paused",
    false,
  );
});

test("a denied camera does not prevent microphone publication", async ({
  page,
}) => {
  await openCall(page, "?no-camera");
  await expect(
    page.getByRole("button", { name: "Mute mic", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Turn camera on", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("a denied microphone leaves working video and an unmute retry", async ({
  page,
}) => {
  await openCall(page, "?no-microphone");
  await expect(
    page.getByRole("button", { name: "Unmute mic", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Turn camera off", exact: true }),
  ).toBeEnabled();
});

test("shows remote mute and camera changes and truthful reconnection state", async ({
  page,
}) => {
  await openCall(page);
  await page.evaluate(() => {
    const room = (window as any).testRoom;
    const remote = room.remoteParticipants.get("worker");
    remote.audioTrackPublications.get("microphone").isMuted = true;
    remote.videoTrackPublications.get("camera").isMuted = true;
    room.emit("TrackMuted");
  });
  await expect(page.getByText(/Participant microphone off/)).toBeVisible();
  await expect(
    page.getByText("Participant's camera is off", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => (window as any).testRoom.emit("Reconnecting"));
  await expect(page.locator(".status-pill")).toHaveText("Reconnecting…");
  await page.evaluate(() => (window as any).testRoom.emit("Reconnected"));
  await expect(page.locator(".status-pill")).toHaveText(
    "Connected · Live call",
  );
  await page.evaluate(() => (window as any).testRoom.disconnect());
  await expect(page.locator(".status-pill")).toHaveText("Disconnected");
  await expect(page.getByRole("button", { name: /call audio/ })).toBeDisabled();
});

test("leaving disconnects the room and removes remote audio", async ({
  page,
}) => {
  await openCall(page);
  await page.getByRole("button", { name: "Leave test call" }).click();
  await expect(page.locator(".live-consultation")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).testRoom.disconnected)).toBe(
    true,
  );
  await expect(page.locator("audio")).toHaveCount(0);
});
