import { createLocalOralModel } from "../server/local-oral-model.mjs";
import { readFile } from "node:fs/promises";
import jpeg from "jpeg-js";
const model = createLocalOralModel();
try {
  await model.ready();
  const bytes = process.argv[2]
    ? await readFile(process.argv[2])
    : jpeg.encode(
        { data: Buffer.alloc(256 * 256 * 4, 127), width: 256, height: 256 },
        85,
      ).data;
  const started = performance.now();
  const result = await model.infer(bytes);
  console.log(
    JSON.stringify(
      {
        ready: true,
        ...result,
        milliseconds: Math.round(performance.now() - started),
        note: "Inference check only; no clinical accuracy is established by this check.",
      },
      null,
      2,
    ),
  );
} finally {
  await model.close();
}
