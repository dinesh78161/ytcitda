import jpeg from "jpeg-js";
import { PDFDocument, PDFDict, PDFName, PDFArray } from "pdf-lib";
import { createHash } from "node:crypto";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const requireValue = (condition, status, message) => {
  if (!condition) throw new HttpError(status, message);
};
export const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export function qualityOf({ data, width, height }) {
  const gray = new Float32Array(width * height);
  let sum = 0,
    glare = 0,
    lap = 0,
    squared = 0,
    n = 0;
  for (let i = 0; i < gray.length; i++) {
    gray[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    sum += gray[i];
    if (gray[i] > 248) glare++;
  }
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x,
        v =
          gray[i - 1] +
          gray[i + 1] +
          gray[i - width] +
          gray[i + width] -
          4 * gray[i];
      lap += v;
      squared += v * v;
      n++;
    }
  const brightness = sum / gray.length,
    sharpness = squared / n - (lap / n) ** 2;
  return {
    quality_status:
      sharpness < 55 ||
      brightness < 35 ||
      brightness > 225 ||
      glare / gray.length > 0.3
        ? "recapture"
        : "acceptable",
    quality_details: {
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness),
      glare_percent: Math.round((100 * glare) / gray.length),
      method: "prototype-laplacian-v1-server",
    },
  };
}
export async function validateFile(dataUrl, kind) {
  requireValue(
    typeof dataUrl === "string" && dataUrl.length < 15 * 1024 * 1024,
    400,
    "File exceeds the 10 MB limit.",
  );
  const match =
    /^data:(image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      dataUrl,
    );
  requireValue(match, 400, "Use a JPEG image or PDF report.");
  let bytes = Buffer.from(match[2], "base64");
  requireValue(
    bytes.length > 0 && bytes.length <= 10 * 1024 * 1024,
    400,
    "File exceeds the 10 MB limit.",
  );
  let quality = {};
  try {
    if (match[1] === "image/jpeg") {
      const decoded = jpeg.decode(bytes, {
        maxResolutionInMP: 4,
        maxMemoryUsageInMB: 96,
        tolerantDecoding: false,
      });
      requireValue(
        decoded.width >= 256 && decoded.height >= 256,
        400,
        "Image must be at least 256 by 256 pixels.",
      );
      quality = qualityOf(decoded);
      // Re-encode pixel data only; original EXIF and other metadata are discarded.
      bytes = jpeg.encode(
        { data: decoded.data, width: decoded.width, height: decoded.height },
        85,
      ).data;
    } else {
      requireValue(
        kind === "report",
        400,
        "Oral photographs must be JPEG images.",
      );
      requireValue(
        bytes.subarray(0, 5).toString() === "%PDF-",
        400,
        "Invalid PDF report.",
      );
      const pdf = await PDFDocument.load(bytes, {
        updateMetadata: false,
        throwOnInvalidObject: true,
      });
      requireValue(
        pdf.getPageCount() > 0 && pdf.getPageCount() <= 100,
        400,
        "Reports must contain 1–100 pages.",
      );
      const forbidden = new Set([
          "JS",
          "JavaScript",
          "OpenAction",
          "A",
          "AA",
          "Launch",
          "GoToR",
          "SubmitForm",
          "ImportData",
          "EmbeddedFiles",
          "RichMedia",
          "XFA",
        ]),
        visited = new Set();
      const inspect = (object) => {
        if (!object || visited.has(object)) return;
        visited.add(object);
        if (object instanceof PDFName)
          requireValue(
            !forbidden.has(object.decodeText()),
            400,
            "PDF scripts, actions and embedded files are not accepted.",
          );
        if (object instanceof PDFDict)
          for (const [key, value] of object.entries()) {
            inspect(key);
            inspect(value);
          }
        else if (object instanceof PDFArray)
          for (const value of object.asArray()) inspect(value);
        else if (object.dict instanceof PDFDict) inspect(object.dict);
      };
      for (const [, object] of pdf.context.enumerateIndirectObjects())
        inspect(object);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "The file could not be decoded. Use an unencrypted PDF or a valid JPEG.",
    );
  }
  return {
    bytes,
    mime_type: match[1],
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...quality,
  };
}
export function validateModelResult(result, expectedVersion) {
  requireValue(
    result &&
      result.model_version === expectedVersion &&
      typeof result.label === "string" &&
      result.label.trim().length > 0 &&
      result.label.length <= 120 &&
      typeof result.score === "number" &&
      Number.isFinite(result.score) &&
      result.score >= 0 &&
      result.score <= 1,
    502,
    "The screening service returned an invalid result or unexpected model version.",
  );
  return {
    provider: "research",
    model_version: result.model_version,
    research_label: result.label,
    score: result.score,
    status: "completed",
    clinical_use: false,
    requires_clinician_review: true,
    warning: "NOT FOR CLINICAL USE",
  };
}
export function videoWindow(appointment, now = Date.now()) {
  requireValue(
    appointment.mode === "video" &&
      ["confirmed", "rescheduled"].includes(appointment.status),
    409,
    "An active video appointment is required.",
  );
  const start = Date.parse(appointment.starts_at),
    end = Date.parse(appointment.ends_at);
  requireValue(
    now >= start - 15 * 60000 && now <= end + 15 * 60000,
    409,
    "Join from 15 minutes before the appointment until 15 minutes after it ends.",
  );
  return Math.floor((end + 15 * 60000) / 1000);
}
