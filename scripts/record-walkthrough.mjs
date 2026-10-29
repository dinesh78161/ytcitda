import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { scenes } from "./walkthrough-scenes.mjs";

const directory = path.resolve("test-results/recording");
await mkdir(directory, { recursive: true });
if (scenes.reduce((sum, scene) => sum + scene.seconds, 0) !== 300)
  throw new Error("The storyboard must be exactly five minutes.");
await writeFile(
  path.join(directory, "storyboard.json"),
  JSON.stringify(scenes, null, 2) + "\n",
);
if (process.argv.includes("--prepare")) {
  console.log(
    "Storyboard ready. Run scripts/narrate-walkthrough.ps1 with test-results/recording/storyboard.json, then run this command without --prepare.",
  );
} else {
  const token = randomUUID(),
    output = path.join(directory, "Aarogya-Drishti-5-minute-walkthrough.webm");
  try {
    await access(output);
    throw new Error(
      "Walkthrough output already exists; choose a fresh recording directory before repeating.",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const assets = new Map();
  for (let i = 0; i < scenes.length; i++) {
    assets.set(`/image/${i}`, {
      type: "image/png",
      bytes: await readFile(path.resolve("test-results", scenes[i].image)),
    });
    assets.set(`/audio/${i}`, {
      type: "audio/wav",
      bytes: await readFile(path.join(directory, `narration-${i}.wav`)),
    });
  }
  let saved = false;
  const server = createServer(async (req, res) => {
    try {
      const prefix = `/${token}`;
      if (!req.url?.startsWith(prefix)) {
        res.writeHead(404);
        res.end();
        return;
      }
      const route = req.url.slice(prefix.length);
      if (req.method === "POST" && route === "/recording" && !saved) {
        saved = true;
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 100 * 1024 * 1024)
            throw new Error("Recording is too large.");
          chunks.push(chunk);
        }
        await writeFile(output, Buffer.concat(chunks), { flag: "wx" });
        res.end("saved");
        return;
      }
      const asset = assets.get(route);
      if (asset) {
        res.setHeader("Content-Type", asset.type);
        res.end(asset.bytes);
        return;
      }
      if (route !== "/") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><title>Aarogya Drishti automated walkthrough</title><body style="margin:0;background:#123f39"><canvas width="1920" height="1080"></canvas></body></html>',
      );
    } catch {
      res.writeHead(500);
      res.end("Recording failed.");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    channel: process.platform === "win32" ? "msedge" : "chromium",
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/${token}/`);
    console.log(
      "Recording the five-minute walkthrough with generated narration. No camera or microphone is accessed.",
    );
    const result = await page.evaluate(
      async ({ scenes, token }) => {
        const canvas = document.querySelector("canvas"),
          ctx = canvas.getContext("2d");
        const audio = new AudioContext(),
          destination = audio.createMediaStreamDestination();
        const images = await Promise.all(
          scenes.map(
            (_, i) =>
              new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = `/${token}/image/${i}`;
              }),
          ),
        );
        const clips = await Promise.all(
          scenes.map(async (_, i) =>
            audio.decodeAudioData(
              await (await fetch(`/${token}/audio/${i}`)).arrayBuffer(),
            ),
          ),
        );
        const duration = 300,
          offsets = [];
        let total = 0;
        for (let i = 0; i < scenes.length; i++) {
          offsets.push(total);
          if (clips[i].duration > scenes[i].seconds - 0.5)
            throw new Error(
              `Narration ${i} exceeds its scene: ${clips[i].duration}s`,
            );
          total += scenes[i].seconds;
        }
        await audio.resume();
        const stream = canvas.captureStream(10);
        destination.stream
          .getAudioTracks()
          .forEach((track) => stream.addTrack(track));
        const mime = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((value) => MediaRecorder.isTypeSupported(value));
        if (!mime) throw new Error("WebM recording is unavailable.");
        const recorder = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: 800000,
            audioBitsPerSecond: 96000,
          }),
          chunks = [];
        const finished = new Promise((resolve) => {
          recorder.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data);
          };
          recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
        });
        const wrap = (text, x, y, width, lineHeight) => {
          const words = text.split(" ");
          let line = "";
          for (const word of words) {
            const next = line ? line + " " + word : word;
            if (ctx.measureText(next).width > width && line) {
              ctx.fillText(line, x, y);
              line = word;
              y += lineHeight;
            } else line = next;
          }
          ctx.fillText(line, x, y);
          return y + lineHeight;
        };
        const started = performance.now();
        const draw = () => {
          const elapsed = Math.min(
            duration,
            (performance.now() - started) / 1000,
          );
          let index = 0;
          for (let i = 0; i < offsets.length; i++)
            if (elapsed >= offsets[i]) index = i;
          const scene = scenes[index],
            image = images[index];
          ctx.fillStyle = "#f4f6f0";
          ctx.fillRect(0, 0, 1920, 1080);
          ctx.fillStyle = "#123f39";
          ctx.fillRect(0, 0, 1920, 180);
          ctx.fillStyle = "#ecb64c";
          ctx.font = "bold 22px Arial";
          ctx.fillText("AAROHAN 2026  /  AAROGYA DRISHTI", 55, 52);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 48px Arial";
          ctx.fillText(scene.title, 55, 125);
          ctx.fillStyle = "#fff";
          ctx.fillRect(55, 220, 1280, 740);
          const scale = Math.min(1260 / image.width, 720 / image.height),
            width = image.width * scale,
            height = image.height * scale;
          ctx.drawImage(
            image,
            65 + (1260 - width) / 2,
            230 + (720 - height) / 2,
            width,
            height,
          );
          ctx.fillStyle = "#123f39";
          ctx.font = "bold 25px Arial";
          ctx.fillText("WHAT THIS STEP SHOWS", 1390, 250);
          let y = 315;
          ctx.font = "30px Arial";
          for (const point of scene.points) {
            ctx.fillStyle = "#e6b34f";
            ctx.fillRect(1390, y - 20, 8, 8);
            ctx.fillStyle = "#28443e";
            y = wrap(point, 1415, y, 430, 43) + 37;
          }
          ctx.fillStyle = "#5c7069";
          ctx.font = "22px Arial";
          wrap(
            "Automated narration and test screenshots. Synthetic data throughout.",
            1390,
            815,
            440,
            32,
          );
          ctx.fillStyle = "#123f39";
          ctx.fillRect(0, 1010, 1920, 70);
          ctx.fillStyle = "#e6b34f";
          ctx.fillRect(0, 1002, (1920 * elapsed) / duration, 8);
          ctx.fillStyle = "#fff";
          ctx.font = "22px Arial";
          ctx.fillText(
            "Synthetic demonstration  ·  Labelled mock AI  ·  No clinical prediction",
            55,
            1054,
          );
          ctx.fillText(
            `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(Math.floor(elapsed % 60)).padStart(2, "0")} / 05:00`,
            1695,
            1054,
          );
        };
        draw();
        recorder.start(1000);
        const startAt = audio.currentTime + 0.15;
        clips.forEach((clip, i) => {
          const source = audio.createBufferSource();
          source.buffer = clip;
          source.connect(destination);
          source.start(startAt + offsets[i]);
        });
        const timer = setInterval(draw, 100);
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        clearInterval(timer);
        draw();
        recorder.stop();
        const blob = await finished;
        const response = await fetch(`/${token}/recording`, {
          method: "POST",
          body: blob,
        });
        if (!response.ok) throw new Error("Could not save recording.");
        stream.getTracks().forEach((track) => track.stop());
        await audio.close();
        return {
          duration_seconds: duration,
          wall_seconds: (performance.now() - started) / 1000,
          mime,
          bytes: blob.size,
          scenes: scenes.length,
          narration_seconds: clips.map((clip) => clip.duration),
        };
      },
      { scenes, token },
    );
    const bytes = await readFile(output);
    if (bytes.length !== result.bytes || bytes.length < 100000)
      throw new Error("Recording size verification failed.");
    const metadata = {
      ...result,
      created_at: new Date().toISOString(),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      disclosure:
        "Automated narrated walkthrough from synthetic application test screenshots. No physical-device or team-contribution verification is implied.",
    };
    await writeFile(
      path.join(directory, "walkthrough-metadata.json"),
      JSON.stringify(metadata, null, 2) + "\n",
    );
    console.log(
      `PASS: five-minute walkthrough saved (${result.bytes} bytes, ${result.scenes} scenes).`,
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
