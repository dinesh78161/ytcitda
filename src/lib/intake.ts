import { localize } from "./localize.ts";
import type { Language } from "./types";

export const habits = [
  ["reverse_smoking", "Chutta (reverse smoking)", "చుట్ట (రివర్స్ స్మోకింగ్)"],
  ["chewing_tobacco", "Khaini / chewing tobacco", "ఖైనీ / నమిలే పొగాకు"],
  ["gutkha", "Gutkha / pan masala", "గుట్కా / పాన్ మసాలా"],
  ["betel_quid", "Betel quid with slaked lime", "సున్నంతో తమలపాకు"],
  ["smoking", "Bidi / cigarette smoking", "బీడీ / సిగరెట్"],
  ["alcohol", "Regular alcohol intake", "క్రమం తప్పకుండా మద్యం సేవించడం"],
] as const;
export const symptoms = [
  [
    "persistent_ulcer",
    "Non-healing ulcer (> 2 weeks)",
    "మానని పుండు (2 వారాలకు పైగా)",
  ],
  ["white_patch", "White patch", "తెల్లని మచ్చ"],
  ["red_patch", "Red patch", "ఎర్రని మచ్చ"],
  ["burning", "Burning sensation with spices", "కారం తిన్నప్పుడు మంట"],
  ["restricted_opening", "Restricted mouth opening", "నోరు తెరవడంలో ఇబ్బంది"],
  ["lump", "Firm lesion / palpable lump", "గట్టి గాయం / తాకితే గడ్డ"],
] as const;
export const optionLabel = (
  option: readonly [string, string, string],
  lang: Language,
) => localize(lang, option[1], option[2]);
const selected = (
  value: unknown,
  allowed: readonly (readonly [string, string, string])[],
) => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((v) => !allowed.some(([id]) => id === v))
  )
    throw new Error("Invalid screening checklist selection.");
  return [...new Set(value as string[])];
};
const measurement = (value: unknown, max: number) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max || typeof value === "boolean")
    throw new Error(
      "Screening measurements must be within the displayed range.",
    );
  return n;
};
export function normalizeIntake(p: Record<string, unknown>) {
  const nodes = p.lymph_nodes ?? "not_assessed";
  if (!["not_assessed", "palpable", "not_palpable"].includes(String(nodes)))
    throw new Error("Invalid lymph node finding.");
  if (!["never", "former", "current"].includes(String(p.tobacco ?? "never")))
    throw new Error("Invalid tobacco use status.");
  return {
    symptoms: {
      discomfort: p.discomfort === true,
      reported: selected(p.reported_symptoms, symptoms),
      mouth_opening_mm: measurement(p.mouth_opening_mm, 100),
      lymph_nodes: String(nodes),
    },
    tobacco_history: {
      use: String(p.tobacco ?? "never"),
      habits: selected(p.habits, habits),
      duration_years: measurement(p.duration_years, 120),
      frequency_per_day: measurement(p.frequency_per_day, 200),
    },
  };
}
