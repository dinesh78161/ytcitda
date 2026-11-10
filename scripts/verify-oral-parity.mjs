import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLocalOralModel } from "../server/local-oral-model.mjs";
const directory = process.argv[2];
if (!directory)
  throw new Error(
    "Supply a directory containing Python references.json and paired JPEG inputs.",
  );
const model = createLocalOralModel();
try {
  await model.ready();
  const references = JSON.parse(
    await readFile(path.join(directory, "references.json"), "utf8"),
  );
  let agreed = 0,
    maximum = 0,
    total = 0,
    duration = 0;
  for (const reference of references) {
    const bytes = await readFile(path.join(directory, reference.image)),
      started = performance.now();
    const result = await model.infer(bytes);
    duration += performance.now() - started;
    if (result.label === reference.label) agreed++;
    for (const label of Object.keys(reference.scores)) {
      const error = Math.abs(
        reference.scores[label] - result.class_scores[label],
      );
      maximum = Math.max(maximum, error);
      total += error;
    }
  }
  const report = {
    model_version: model.status().model_version,
    images: references.length,
    label_agreement: agreed,
    maximum_class_score_delta: maximum,
    mean_class_score_delta: total / (references.length * 2),
    mean_inference_milliseconds: duration / references.length,
    passed: agreed === references.length && maximum <= 0.05,
    scope:
      "Numerical export/preprocessing parity only. Not an independent clinical evaluation.",
  };
  await writeFile(
    path.join(directory, "node-parity.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  await model.close();
}
