import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateFile } from "../server/validation.mjs";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const samplesDir = path.join(root, "public", "samples");

const EXPECTED_SUBSITES = [
  "left_buccal_mucosa",
  "right_buccal_mucosa",
  "lateral_tongue",
  "floor_of_mouth",
  "palate",
  "lower_labial_sulcus",
];

test("clinical sample images exist for all 6 anatomical sub-sites", () => {
  for (const subsite of EXPECTED_SUBSITES) {
    const filePath = path.join(samplesDir, `${subsite}.jpg`);
    assert.ok(fs.existsSync(filePath), `Sample image missing for ${subsite}`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 5000, `Sample image ${subsite} is too small (${stat.size} bytes)`);
  }
});

test("all 6 clinical sample images pass quality gate with acceptable status", async () => {
  for (const subsite of EXPECTED_SUBSITES) {
    const filePath = path.join(samplesDir, `${subsite}.jpg`);
    const bytes = fs.readFileSync(filePath);
    const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const result = await validateFile(dataUrl, "oral");

    assert.equal(result.quality_status, "acceptable", `${subsite} should be acceptable`);
    assert.ok(result.quality_details.sharpness >= 50, `${subsite} sharpness should be >= 50`);
    assert.ok(result.quality_details.brightness >= 40 && result.quality_details.brightness <= 220, `${subsite} brightness in range`);
    assert.ok(result.quality_details.glare_percent <= 15, `${subsite} glare <= 15%`);
  }
});

test("clinical-samples module exports complete metadata and base64 fallbacks for all 6 sites", async () => {
  const tsPath = path.join(root, "src", "lib", "clinical-samples.ts");
  assert.ok(fs.existsSync(tsPath), "src/lib/clinical-samples.ts must exist");
  const content = fs.readFileSync(tsPath, "utf8");

  for (const subsite of EXPECTED_SUBSITES) {
    assert.ok(content.includes(`id: "${subsite}"`), `Missing subsite id: ${subsite}`);
    assert.ok(content.includes(`/samples/${subsite}.jpg`), `Missing url for ${subsite}`);
    assert.ok(content.includes("data:image/jpeg;base64,"), "Missing embedded base64");
  }
});

