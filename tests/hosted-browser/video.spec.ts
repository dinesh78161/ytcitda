import { test, expect, chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  checked,
  demoSession,
  hostedClients,
} from "../../scripts/hosted-session.mjs";

test("two assigned users exchange live video through the configured LiveKit project", async ({
  baseURL,
}) => {
  test.skip(
    process.env.RUN_HOSTED_VIDEO !== "1",
    "Set RUN_HOSTED_VIDEO=1 to create a synthetic video case and use provider minutes.",
  );
  test.setTimeout(180000);
  const clients = hostedClients(),
    sessions = [],
    contexts = [],
    browsers = [];
  const accounts: Record<string, Awaited<ReturnType<typeof demoSession>>> = {};
  const patient = randomUUID(),
    screening = randomUUID(),
    name = `Synthetic Video ${patient.slice(0, 8)}`;
  let appointmentId: string | undefined,
    registered = false,
    consultationVerified = false;
  const rpc = async (
    role: string,
    action: string,
    payload: Record<string, unknown>,
  ) =>
    checked(
      await accounts[role].client.rpc("submit_workflow", {
        request_id: randomUUID(),
        action,
        payload,
      }),
      action,
    );
  try {
    const status = await (await fetch(`${baseURL}/api/status`)).json();
    expect(status.video_provider).toBe("livekit");
    expect(status.video).toBe(true);
    for (const role of [
      "health_worker",
      "medical_officer",
      "specialist",
      "navigator",
    ]) {
      const account = await demoSession(clients, role);
      sessions.push(account);
      accounts[role] = account;
    }
    await rpc("health_worker", "register", {
      patient_id: patient,
      screening_id: screening,
      display_name: name,
      age_years: 46,
      village: "Synthetic video test",
      language: "en",
      consent: true,
      photo_consent: false,
      tobacco: "never",
      discomfort: false,
      notes: "Synthetic video connectivity fixture; no medical data.",
    });
    registered = true;
    await rpc("health_worker", "consent", {
      patient_id: patient,
      purpose: "teleconsultation",
      granted: true,
      language: "en",
    });
    const state = () =>
      accounts.medical_officer.client
        .from("screenings")
        .select("revision,status")
        .eq("id", screening)
        .single()
        .then((r) => checked(r, "Fixture state"));
    const referral = await rpc("medical_officer", "review", {
      patient_id: patient,
      revision: (await state()).revision,
      findings: "Synthetic video test referral only.",
      decision: "refer",
      priority: "routine",
    });
    const appointment = await rpc("navigator", "appoint", {
      referral_id: referral.referral_id,
      starts_at: new Date(Date.now() + 60000).toISOString(),
      mode: "video",
    });
    appointmentId = appointment.id;
    const pages = [];
    for (const role of ["health_worker", "specialist"]) {
      const account = accounts[role];
      const instance = await chromium.launch({
        channel: process.platform === "win32" ? "msedge" : "chromium",
        args: [
          "--use-fake-device-for-media-stream",
          "--use-fake-ui-for-media-stream",
          "--autoplay-policy=no-user-gesture-required",
        ],
      });
      browsers.push(instance);
      const context = await instance.newContext({
        permissions: ["camera", "microphone"],
        ...(process.env.RECORD_HOSTED_VIDEO_DIR
          ? {
              recordVideo: {
                dir: process.env.RECORD_HOSTED_VIDEO_DIR,
                size: { width: 1280, height: 720 },
              },
            }
          : {}),
      });
      contexts.push(context);
      await context.addInitScript(() => {
        // Independent generated sources model separate devices without sharing
        // Edge's single fake capture device. The WebRTC/provider path is real.
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          const stream = new MediaStream();
          if (constraints?.video) {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext("2d")!;
            let frame = 0;
            const draw = () => {
              ctx.fillStyle = frame++ % 2 ? "#123f39" : "#236357";
              ctx.fillRect(0, 0, 640, 360);
              ctx.fillStyle = "#f5b657";
              ctx.fillRect((frame * 8) % 560, 100, 80, 80);
            };
            draw();
            setInterval(draw, 100);
            stream.addTrack(canvas.captureStream(10).getVideoTracks()[0]);
          }
          if (constraints?.audio) {
            const audio = new AudioContext(),
              oscillator = audio.createOscillator(),
              destination = audio.createMediaStreamDestination();
            oscillator.frequency.value = 440;
            oscillator.connect(destination);
            oscillator.start();
            await audio.resume();
            stream.addTrack(destination.stream.getAudioTracks()[0]);
          }
          return stream;
        };
      });
      await context.addInitScript(
        ({ key, session }) =>
          localStorage.setItem(key, JSON.stringify(session)),
        {
          key: `sb-${new URL(clients.url).hostname.split(".")[0]}-auth-token`,
          session: account.session,
        },
      );
      const page = await context.newPage();
      pages.push(page);
      await page.goto(baseURL!);
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Appointments", exact: true })
        .click();
      const card = page
        .locator(".appointment-card")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(card).toHaveCount(1);
      const joiningAt = Date.now();
      await card
        .getByRole("button", { name: "Join consultation", exact: true })
        .click();
      // Public WebRTC negotiation can exceed Playwright's default five seconds.
      await expect(
        page.locator(".live-consultation").getByRole("status"),
      ).toContainText(/^Connected/, { timeout: 30000 });
      console.log(`LiveKit ${role} connected in ${Date.now() - joiningAt} ms.`);
      await expect(
        page.getByRole("button", { name: "Turn camera off", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await expect(
        page.getByRole("button", { name: "Mute mic", exact: true }),
      ).toBeVisible({ timeout: 30000 });
    }
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      await expect(page.locator(".consultation-tile video")).toHaveCount(2, {
        timeout: 30000,
      });
      await expect
        .poll(
          async () =>
            page.locator(".consultation-tile video").evaluateAll((elements) =>
              elements.map((element) => {
                const video = element as HTMLVideoElement;
                return {
                  playing:
                    video.readyState >= 2 &&
                    video.videoWidth > 0 &&
                    video.getVideoPlaybackQuality().totalVideoFrames > 0,
                  ready: video.readyState,
                  width: video.videoWidth,
                  frames: video.getVideoPlaybackQuality().totalVideoFrames,
                  paused: video.paused,
                  muted: video.muted,
                  tracks: (video.srcObject as MediaStream | null)
                    ?.getTracks()
                    .map((t) => ({
                      kind: t.kind,
                      state: t.readyState,
                      muted: t.muted,
                    })),
                };
              }),
            ),
          { timeout: 30000 },
        )
        .toEqual([
          expect.objectContaining({ playing: true }),
          expect.objectContaining({ playing: true }),
        ]);
      await expect(page.locator(".consultation-audio audio")).toHaveCount(1);
      const enableAudio = page.getByRole("button", {
        name: "Enable call audio",
        exact: true,
      });
      if (await enableAudio.isVisible()) await enableAudio.click();
      await expect
        .poll(
          () =>
            page
              .locator(".consultation-audio audio")
              .evaluate((element: HTMLAudioElement) => ({
                playing: !element.paused && element.readyState >= 2,
                muted: element.muted,
                volume: element.volume,
                track: (
                  element.srcObject as MediaStream | null
                )?.getAudioTracks()[0]?.readyState,
              })),
          { timeout: 30000 },
        )
        .toEqual({ playing: true, muted: false, volume: 1, track: "live" });
      const remoteSize = await page
        .locator(".consultation-tile-remote")
        .boundingBox();
      const localSize = await page
        .locator(".consultation-tile-local")
        .boundingBox();
      expect(remoteSize!.width).toBeGreaterThan(localSize!.width);
      // Give viewers time to see the received streams in requested recordings.
      if (process.env.RECORD_HOSTED_VIDEO_DIR) await page.waitForTimeout(3000);
      await page.getByRole("dialog").screenshot({
        path: `test-results/livekit-two-party-${i + 1}.png`,
      });
    }
    await pages[0]
      .getByRole("button", { name: "Mute mic", exact: true })
      .click();
    await expect(
      pages[0].getByRole("button", { name: "Unmute mic", exact: true }),
    ).toBeVisible();
    if (process.env.RECORD_HOSTED_VIDEO_DIR)
      await pages[0].waitForTimeout(1200);
    await pages[0]
      .getByRole("button", { name: "Turn camera off", exact: true })
      .click();
    await expect(
      pages[0].getByRole("button", { name: "Turn camera on", exact: true }),
    ).toBeVisible();
    if (process.env.RECORD_HOSTED_VIDEO_DIR)
      await pages[0].waitForTimeout(1200);
    for (const page of pages) {
      await page
        .getByRole("button", { name: "Leave consultation", exact: true })
        .click();
      await expect(page.locator(".live-consultation")).toHaveCount(0);
    }
    consultationVerified = true;
  } finally {
    for (const [index, context] of contexts.entries()) {
      const recorded = context.pages()[0]?.video();
      await context.close();
      if (recorded && process.env.RECORD_HOSTED_VIDEO_DIR)
        await recorded.saveAs(
          `${process.env.RECORD_HOSTED_VIDEO_DIR}/livekit-${index === 0 ? "worker" : "specialist"}.webm`,
        );
    }
    for (const instance of browsers) await instance.close();
    if (appointmentId) {
      await rpc("navigator", "attendance", {
        appointment_id: appointmentId,
        status: consultationVerified ? "completed" : "cancelled",
      });
      const tasks = checked(
        await accounts.navigator.client
          .from("navigation_tasks")
          .select("id")
          .eq("patient_id", patient)
          .eq("status", "pending"),
        "Fixture tasks",
      );
      for (const task of tasks)
        await rpc("navigator", "followup", {
          task_id: task.id,
          status: "completed",
        });
      for (const [category, decision] of [
        ["diagnostics", "not_required"],
        ["treatment", "not_required"],
        ["case", "close"],
      ]) {
        const current = checked(
          await accounts.medical_officer.client
            .from("screenings")
            .select("revision")
            .eq("id", screening)
            .single(),
          "Fixture closure",
        );
        await rpc("medical_officer", "care_decision", {
          patient_id: patient,
          revision: current.revision,
          category,
          decision,
          notes: "Synthetic video test fixture closed; no clinical care.",
        });
      }
    }
    if (registered)
      console.log(
        `Synthetic video fixture retained with audit history: ${patient}`,
      );
    for (const account of sessions)
      await account.client.auth.signOut({ scope: "local" });
  }
});
