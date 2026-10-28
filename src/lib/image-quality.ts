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
    return {
      preview: canvas.toDataURL("image/jpeg", 0.78),
      quality_status,
      quality_details: {
        sharpness: Math.round(sharpness),
        brightness: Math.round(brightness),
        glare_percent: Math.round((glare / gray.length) * 100),
        method: "prototype-laplacian-v1",
      },
    };
  } finally {
    bitmap.close();
  }
}
