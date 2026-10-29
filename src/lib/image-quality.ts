export interface MedGemmaQualityAssessment {
  status: "acceptable" | "recapture";
  lighting: "adequate" | "underexposed" | "overexposed" | "glare";
  focus: "sharp" | "blurred";
  recommendation: string;
  recommendation_te: string;
  score: number;
}

export function assessMedGemmaQuality(details: {
  sharpness: number;
  brightness: number;
  glare_percent: number;
}): MedGemmaQualityAssessment {
  const { sharpness, brightness, glare_percent } = details;
  const isBlurred = sharpness < 55;
  const isUnderexposed = brightness < 35;
  const isOverexposed = brightness > 225;
  const hasGlare = glare_percent > 30;

  let lighting: "adequate" | "underexposed" | "overexposed" | "glare" =
    "adequate";
  if (isUnderexposed) lighting = "underexposed";
  else if (isOverexposed) lighting = "overexposed";
  else if (hasGlare) lighting = "glare";

  const focus: "sharp" | "blurred" = isBlurred ? "blurred" : "sharp";
  const acceptable =
    !isBlurred && !isUnderexposed && !isOverexposed && !hasGlare;

  let score = 100;
  if (sharpness < 55) score -= Math.min(45, (55 - sharpness) * 1.5);
  if (brightness < 35) score -= Math.min(30, (35 - brightness) * 1.5);
  if (brightness > 225) score -= Math.min(30, (brightness - 225) * 1.5);
  if (glare_percent > 20) score -= Math.min(35, (glare_percent - 20) * 1.8);
  score = Math.max(10, Math.min(100, Math.round(score)));

  let recommendation =
    "Local image checks passed. A clinician must assess whether the photograph is suitable.";
  let recommendation_te =
    "స్థానిక చిత్ర తనిఖీలు పూర్తయ్యాయి. చిత్రం అనుకూలతను వైద్యుడు అంచనా వేయాలి.";

  if (isBlurred && (isUnderexposed || hasGlare)) {
    recommendation =
      "Image is blurred and has poor lighting. Hold camera steady and adjust lighting before retake.";
    recommendation_te =
      "చిత్రం అస్పష్టంగా ఉంది మరియు వెలుతురు సరిగా లేదు. కెమెరాను స్థిరంగా ఉంచి మళ్లీ తీయండి.";
  } else if (isBlurred) {
    recommendation =
      "Mucosal surface lacks sharp focus. Hold device steady and focus on the lesion or mucosa.";
    recommendation_te =
      "శ్లేష్మ పొరపై స్పష్టత తక్కువగా ఉంది. పరికరాన్ని కదలకుండా ఉంచి నోటి భాగంపై ఫోకస్ చేయండి.";
  } else if (hasGlare) {
    recommendation =
      "Specular saliva/flash glare detected. Angle camera 15° away from direct reflection.";
    recommendation_te =
      "లాలాజలం లేదా ఫ్లాష్ మెరుపు ఎక్కువగా ఉంది. కాంతి నేరుగా పడకుండా కొద్దిగా కోణం మార్చి తీయండి.";
  } else if (isUnderexposed) {
    recommendation =
      "Image is underexposed. Use a medical torch or additional light to illuminate the oral cavity.";
    recommendation_te =
      "చిత్రం చాలా చీకటిగా ఉంది. అదనపు కాంతి లేదా టార్చ్ ఉపయోగించి నోటి భాగాన్ని స్పష్టంగా చూపించండి.";
  } else if (isOverexposed) {
    recommendation =
      "Image is overexposed. Move light slightly back from mucosal surface to preserve tissue detail.";
    recommendation_te =
      "కాంతి చాలా ఎక్కువగా ఉంది. కణజాల వివరాలు స్పష్టంగా కనిపించేలా కాంతిని కొద్దిగా వెనక్కి జరపండి.";
  }

  return {
    status: acceptable ? "acceptable" : "recapture",
    lighting,
    focus,
    recommendation,
    recommendation_te,
    score,
  };
}

export async function inspectImage(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Use a JPEG, PNG or WebP image smaller than 10 MB.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("The file cannot be decoded as an image.");
  });
  try {
    if (
      bitmap.width < 256 ||
      bitmap.height < 256 ||
      bitmap.width * bitmap.height > 40000000
    )
      throw new Error(
        "Use an image at least 256 × 256 pixels and below 40 megapixels.",
      );
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Image processing is unavailable.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const gray = new Float32Array(canvas.width * canvas.height);
    let sum = 0,
      glare = 0;
    for (let n = 0; n < gray.length; n++) {
      gray[n] =
        0.299 * pixels[n * 4] +
        0.587 * pixels[n * 4 + 1] +
        0.114 * pixels[n * 4 + 2];
      sum += gray[n];
      if (gray[n] > 248) glare++;
    }
    let total = 0,
      squares = 0,
      count = 0;
    for (let y = 1; y < canvas.height - 1; y++)
      for (let x = 1; x < canvas.width - 1; x++) {
        const n = y * canvas.width + x;
        const lap =
          gray[n - 1] +
          gray[n + 1] +
          gray[n - canvas.width] +
          gray[n + canvas.width] -
          4 * gray[n];
        total += lap;
        squares += lap * lap;
        count++;
      }
    const sharpness = squares / count - (total / count) ** 2,
      brightness = sum / gray.length;
    const quality_status =
      sharpness < 55 ||
      brightness < 35 ||
      brightness > 225 ||
      glare / gray.length > 0.3
        ? "recapture"
        : "acceptable";
    const sharpnessRound = Math.round(sharpness);
    const brightnessRound = Math.round(brightness);
    const glarePercent = Math.round((glare / gray.length) * 100);
    const medgemma = assessMedGemmaQuality({
      sharpness: sharpnessRound,
      brightness: brightnessRound,
      glare_percent: glarePercent,
    });
    return {
      preview: canvas.toDataURL("image/jpeg", 0.78),
      quality_status,
      quality_details: {
        sharpness: sharpnessRound,
        brightness: brightnessRound,
        glare_percent: glarePercent,
        method: "prototype-laplacian-v1",
        medgemma,
      },
    };
  } finally {
    bitmap.close();
  }
}
