import { test } from "node:test";
import assert from "node:assert/strict";
import { labels, translator, roleLabel, statusLabel } from "../src/lib/i18n.ts";
import { clinicalLabels } from "../src/lib/i18n.ts";
import { languageCatalogs, localize } from "../src/lib/localize.ts";
import {
  supportedLanguages,
  initialLanguage,
  localeForLanguage,
} from "../src/lib/languages.ts";

test("all seven additional languages translate every shared message, role, and workflow status", () => {
  assert.equal(supportedLanguages.length, 9);
  const canonical = Object.keys(languageCatalogs.hi).sort();
  for (const { code } of supportedLanguages.filter(
    (item) => !["en", "te"].includes(item.code),
  )) {
    const catalog = languageCatalogs[code];
    assert.deepEqual(Object.keys(catalog).sort(), canonical);
    for (const [key, [english]] of Object.entries(labels)) {
      assert.ok(
        catalog[english.replace(/\s+/g, " ").trim()],
        `${code}: missing ${key}`,
      );
      assert.ok(translator(code)(key).trim());
    }
    assert.notEqual(roleLabel("health_worker", code), "Health worker");
    assert.notEqual(statusLabel("awaiting_clinician", code), "Awaiting review");
    assert.ok(
      localize(code, "Step {n}:").includes("{n}"),
      `${code}: interpolation lost`,
    );
    assert.ok(
      !Object.values(catalog).some((value) => /\?{3,}|\uFFFD/.test(value)),
      `${code}: corrupted characters`,
    );
  }
  assert.equal(roleLabel("health_worker", "te"), "ఆరోగ్య కార్యకర్త");
});

test("language persistence accepts supported choices and safely rejects unknown stored values", () => {
  for (const { code } of supportedLanguages) {
    assert.equal(initialLanguage(code), code);
    assert.ok(
      new Intl.DateTimeFormat(localeForLanguage(code)).format(new Date(0)),
    );
  }
  assert.equal(initialLanguage(null), "en");
  assert.equal(initialLanguage("unknown"), "en");
  assert.equal(
    localize("hi", "Uncatalogued patient-entered notes"),
    "Uncatalogued patient-entered notes",
  );
});

test("clinical workflow text remains translated and does not describe simulated results", () => {
  for (const { code } of supportedLanguages) {
    for (const [key, [english]] of Object.entries(clinicalLabels)) {
      if (!["en", "te"].includes(code))
        assert.ok(
          languageCatalogs[code][english],
          `${code}: missing clinical ${key}`,
        );
      assert.ok(translator(code, true)(key).trim());
    }
    assert.notEqual(
      translator(code, true)("saveOutcome"),
      translator(code)("saveOutcome"),
    );
  }
});
