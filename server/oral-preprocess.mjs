// Match Pillow's separable, antialiased bilinear RGB resize with 22-bit weights.
// Uploaded JPEGs have already been re-encoded without EXIF by validateFile.
const PRECISION = 4194304;
function coefficients(input, output) {
  const scale = input / output,
    filterScale = Math.max(1, scale);
  return Array.from({ length: output }, (_, i) => {
    const center = (i + 0.5) * scale;
    const start = Math.max(0, Math.floor(center - filterScale + 0.5));
    const end = Math.min(input, Math.floor(center + filterScale + 0.5));
    const weights = Array.from({ length: end - start }, (_, j) =>
      Math.max(0, 1 - Math.abs((start + j - center + 0.5) / filterScale)),
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    return {
      start,
      weights: weights.map((w) => Math.floor((w / sum) * PRECISION + 0.5)),
    };
  });
}
export function preprocessOralRGB(data, width, height, channels = 4) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 256 ||
    height < 256 ||
    width * height > 4_000_000 ||
    ![3, 4].includes(channels) ||
    data.length !== width * height * channels
  )
    throw new Error("Invalid RGB photograph dimensions.");
  const xs = coefficients(width, 256),
    ys = coefficients(height, 256);
  const horizontal = new Uint8Array(256 * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < 256; x++)
      for (let c = 0; c < 3; c++) {
        const { start, weights } = xs[x];
        let sum = PRECISION / 2;
        for (let k = 0; k < weights.length; k++)
          sum += data[(y * width + start + k) * channels + c] * weights[k];
        horizontal[(y * 256 + x) * 3 + c] = Math.max(
          0,
          Math.min(255, Math.floor(sum / PRECISION)),
        );
      }
  const tensor = new Float32Array(3 * 224 * 224),
    mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];
  for (let y = 0; y < 224; y++)
    for (let x = 0; x < 224; x++)
      for (let c = 0; c < 3; c++) {
        const { start, weights } = ys[y + 16];
        let sum = PRECISION / 2;
        for (let k = 0; k < weights.length; k++)
          sum += horizontal[((start + k) * 256 + x + 16) * 3 + c] * weights[k];
        const pixel = Math.max(0, Math.min(255, Math.floor(sum / PRECISION)));
        tensor[c * 224 * 224 + y * 224 + x] =
          (Math.fround(pixel / 255) - mean[c]) / std[c];
      }
  return tensor;
}
