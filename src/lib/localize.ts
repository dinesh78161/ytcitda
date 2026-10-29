import hi from "../locales/hi.json" with { type: "json" };
import ta from "../locales/ta.json" with { type: "json" };
import kn from "../locales/kn.json" with { type: "json" };
import ml from "../locales/ml.json" with { type: "json" };
import mr from "../locales/mr.json" with { type: "json" };
import bn from "../locales/bn.json" with { type: "json" };
import or from "../locales/or.json" with { type: "json" };
import te from "../locales/te.json" with { type: "json" };
import type { Language } from "./languages";

export const languageCatalogs: Partial<
  Record<Language, Record<string, string>>
> = { hi, ta, kn, ml, mr, bn, or, te };
export const messageKey = (value: string) => value.replace(/\s+/g, " ").trim();
export function localize(language: Language, english: string, telugu?: string) {
  if (language === "te")
    return languageCatalogs.te?.[messageKey(english)] ?? telugu ?? english;
  if (language === "en") return english;
  return languageCatalogs[language]?.[messageKey(english)] ?? english;
}
