import { test } from "node:test";
import assert from "node:assert/strict";
import { assessMedGemmaQuality } from "../src/lib/image-quality.ts";
import { qualityOf } from "../server/validation.mjs";

test("Local capture guidance accepts optimal mucosal image", () => {
  const result = assessMedGemmaQuality({
    sharpness: 95,
    brightness: 120,
    glare_percent: 5,
  });
  assert.equal(result.status, "acceptable");
  assert.equal(result.focus, "sharp");
  assert.equal(result.lighting, "adequate");
  assert.ok(result.score >= 90);
  assert.match(result.recommendation, /Local image checks/i);
  assert.ok(!result.recommendation.includes("MedGemma"));
});

test("Local capture guidance detects blur and recommends steady capture", () => {
  const result = assessMedGemmaQuality({
    sharpness: 32,
    brightness: 110,
    glare_percent: 4,
  });
  assert.equal(result.status, "recapture");
  assert.equal(result.focus, "blurred");
  assert.ok(result.score < 80);
  assert.match(result.recommendation, /focus/i);
  assert.ok(result.recommendation_te.length > 0);
});

test("Local capture guidance flags saliva and flash glare", () => {
  const result = assessMedGemmaQuality({
    sharpness: 80,
    brightness: 130,
    glare_percent: 38,
  });
  assert.equal(result.status, "recapture");
  assert.equal(result.lighting, "glare");
  assert.match(result.recommendation, /glare/i);
  assert.ok(
    result.recommendation_te.includes("మెరుపు") ||
      result.recommendation_te.includes("కోణం"),
  );
});

test("Local capture guidance flags underexposed / dark oral image", () => {
  const result = assessMedGemmaQuality({
    sharpness: 75,
    brightness: 22,
    glare_percent: 2,
  });
  assert.equal(result.status, "recapture");
  assert.equal(result.lighting, "underexposed");
  assert.match(result.recommendation, /torch|illuminate/i);
});

test("server qualityOf includes local capture guidance", () => {
  // 256 x 256 grey image
  const width = 256,
    height = 256;
  const data = Buffer.alloc(width * height * 4, 128);
  const checked = qualityOf({ data, width, height });
  assert.ok(checked.quality_details.medgemma);
  assert.equal(typeof checked.quality_details.medgemma.status, "string");
  assert.equal(typeof checked.quality_details.medgemma.focus, "string");
  assert.equal(typeof checked.quality_details.medgemma.lighting, "string");
});
