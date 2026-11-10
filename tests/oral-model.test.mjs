import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import jpeg from "jpeg-js";
import { createLocalOralModel } from "../server/local-oral-model.mjs";
import { preprocessOralRGB } from "../server/oral-preprocess.mjs";

let model;
before(async () => {
  model = createLocalOralModel();
  await model.ready();
});
after(async () => {
  await model?.close();
});

test("bundled model loads with checksum verification and runs real CPU inference", async () => {
  assert.deepEqual(model.status(), {
    ready: true,
    model_version: "oral-mendeley-v1",
  });
  const bytes = jpeg.encode(
    { width: 256, height: 256, data: Buffer.alloc(256 * 256 * 4, 128) },
    85,
  ).data;
  const result = await model.infer(bytes);
  assert.equal(result.model_version, "oral-mendeley-v1");
  assert.ok(["benign_lesion", "malignant_lesion"].includes(result.label));
  assert.ok(
    Number.isFinite(result.score) && result.score >= 0 && result.score <= 1,
  );
  assert.ok(
    Math.abs(
      Object.values(result.class_scores).reduce((a, b) => a + b, 0) - 1,
    ) < 1e-6,
  );
  assert.equal(result.clinical_use, false);
});

test("invalid JPEGs and unsupported dimensions are rejected without a result", async () => {
  await assert.rejects(
    () => model.infer(Buffer.from("not-a-jpeg")),
    (e) => e.status === 400,
  );
  const tiny = jpeg.encode(
    { width: 32, height: 32, data: Buffer.alloc(32 * 32 * 4, 128) },
    85,
  ).data;
  await assert.rejects(
    () => model.infer(tiny),
    (e) => e.status === 400,
  );
});

test("constant RGB values preserve crop, channels and ImageNet normalization", () => {
  const input = new Uint8Array(300 * 270 * 4).fill(255);
  const values = preprocessOralRGB(input, 300, 270);
  const expected = [
    (0.999999999 - 0.485) / 0.229,
    (1 - 0.456) / 0.224,
    (1 - 0.406) / 0.225,
  ];
  assert.equal(values.length, 3 * 224 * 224);
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 224 * 224; i++)
      assert.ok(Math.abs(values[c * 224 * 224 + i] - expected[c]) < 1e-5);
});

test("a corrupt model package never reports readiness", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aarogya-oral-model-"));
  try {
    const metadata = await readFile(
      new URL("../server/models/oral-mendeley-v1/model.json", import.meta.url),
    );
    await writeFile(join(directory, "model.json"), metadata);
    await writeFile(join(directory, "model.onnx"), "corrupt-model");
    const broken = createLocalOralModel({
      directory: pathToFileURL(directory + "/"),
    });
    await assert.rejects(() => broken.ready(), /checksum/);
    assert.equal(broken.status().ready, false);
    await broken.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
