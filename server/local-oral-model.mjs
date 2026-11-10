import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import jpeg from "jpeg-js";
import { HttpError, requireValue } from "./validation.mjs";
import { preprocessOralRGB } from "./oral-preprocess.mjs";

const defaultDirectory = new URL("./models/oral-mendeley-v1/", import.meta.url);

export function createLocalOralModel({ directory = defaultDirectory } = {}) {
  let session,
    ort,
    metadata,
    running = false,
    available = false;
  const initialized = (async () => {
    const [modelBytes, raw] = await Promise.all([
      readFile(new URL("model.onnx", directory)),
      readFile(new URL("model.json", directory), "utf8"),
    ]);
    metadata = JSON.parse(raw);
    if (
      metadata.clinical_use !== false ||
      metadata.model_version !== "oral-mendeley-v1" ||
      metadata.preprocessing !==
        "pil-bilinear-256-center-crop-224-imagenet-v1" ||
      JSON.stringify(metadata.classes) !==
        JSON.stringify(["benign_lesion", "malignant_lesion"]) ||
      !Number.isFinite(metadata.temperature) ||
      metadata.temperature < 0.05 ||
      metadata.temperature > 20 ||
      createHash("sha256").update(modelBytes).digest("hex") !== metadata.sha256
    )
      throw new Error(
        "Bundled oral model failed metadata or checksum verification.",
      );
    ort = await import("onnxruntime-node");
    session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ["cpu"],
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
    });
    await session.run({
      images: new ort.Tensor(
        "float32",
        new Float32Array(3 * 224 * 224),
        [1, 3, 224, 224],
      ),
    });
    available = true;
  })();
  // Observe startup failures immediately even when only status() is polled.
  initialized.catch(() => {});
  return {
    ready: () => initialized,
    status: () => ({
      ready: available,
      model_version: available ? metadata.model_version : null,
    }),
    async infer(bytes) {
      try {
        await initialized;
      } catch {
        throw new HttpError(
          503,
          "The bundled oral model could not load. No analysis was saved.",
        );
      }
      requireValue(
        !running,
        429,
        "The oral model is busy. Wait a moment before retrying.",
      );
      running = true;
      try {
        requireValue(
          bytes.byteLength > 0 && bytes.byteLength <= 10_000_000,
          400,
          "Invalid image size.",
        );
        let image;
        try {
          image = jpeg.decode(Buffer.from(bytes), {
            useTArray: true,
            formatAsRGBA: true,
            maxResolutionInMP: 4,
            maxMemoryUsageInMB: 64,
          });
        } catch {
          throw new HttpError(
            400,
            "The oral model requires a valid JPEG photograph.",
          );
        }
        let input;
        try {
          input = preprocessOralRGB(image.data, image.width, image.height);
        } catch {
          throw new HttpError(
            400,
            "Use a photograph at least 256 pixels per side and no larger than 4 megapixels.",
          );
        }
        const output = await session.run({
          images: new ort.Tensor("float32", input, [1, 3, 224, 224]),
        });
        const values = Array.from(
          output.logits.data,
          (x) => x / metadata.temperature,
        );
        requireValue(
          values.length === 2 && values.every(Number.isFinite),
          503,
          "The oral model returned invalid scores.",
        );
        const offset = Math.max(...values),
          exp = values.map((x) => Math.exp(x - offset)),
          total = exp.reduce((a, b) => a + b, 0);
        const scores = exp.map((x) => x / total),
          index = scores[1] > scores[0] ? 1 : 0;
        return {
          model_version: metadata.model_version,
          label: metadata.classes[index],
          score: scores[index],
          class_scores: Object.fromEntries(
            metadata.classes.map((c, i) => [c, scores[i]]),
          ),
          clinical_use: false,
          evaluation_unit: metadata.evaluation_unit,
          limitations: metadata.limitations,
        };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          503,
          "The oral model could not complete this image. No analysis was saved.",
        );
      } finally {
        running = false;
      }
    },
    async close() {
      await initialized.catch(() => {});
      available = false;
      await session?.release();
    },
  };
}
