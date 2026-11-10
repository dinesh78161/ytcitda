// Connectivity/schema check only. Never sends a patient photograph or logs keys.
import jpeg from "jpeg-js";
import { analyzeWithClinicalModel } from "../server/clinical-ai.mjs";

const width = 256,
  height = 256;
const data = Buffer.alloc(width * height * 4, 255);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    const grey = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? 70 : 180;
    data[offset] = data[offset + 1] = data[offset + 2] = grey;
  }
try {
  const result = await analyzeWithClinicalModel({
    bytes: jpeg.encode({ data, width, height }, 85).data,
    env: process.env,
  });
  if (result.findings.image_kind === "oral_photo")
    throw new Error(
      "The clinical service treated a generated checkerboard as an oral photograph. Review its input validation before activation.",
    );
  console.log(
    JSON.stringify(
      {
        connected: true,
        model_version: result.model_version,
        image_kind: result.findings.image_kind,
        note: "Generated-image connectivity and contract check only; no medical performance has been measured.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
