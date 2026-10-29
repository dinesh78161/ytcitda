// One real provider request using a generated, non-medical test image.
// Never prints the API key, request headers, or image bytes.
import jpeg from "jpeg-js";
import { analyzeWithGemini, GEMINI_DEFAULT_MODEL } from "../server/gemini.mjs";

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error(
    "Add GEMINI_API_KEY to .env.server, then run npm run ai:check again.",
  );
  process.exitCode = 1;
} else {
  const width = 256,
    height = 256;
  const data = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const grey = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? 70 : 180;
      const offset = (y * width + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = grey;
    }
  try {
    const result = await analyzeWithGemini({
      bytes: jpeg.encode({ data, width, height }, 85).data,
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    });
    if (result.findings.image_kind === "oral_photo")
      throw new Error(
        "Gemini incorrectly treated a synthetic test pattern as an oral photograph. Review the model/prompt before use.",
      );
    console.log(
      JSON.stringify(
        {
          connected: true,
          model_version: result.model_version,
          image_kind: result.findings.image_kind,
          score: result.score,
          note: "Connection and unsuitable-image check only; this does not measure medical accuracy.",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
