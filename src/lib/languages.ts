export const supportedLanguages = [
  { code: "en", name: "English", nativeName: "English", locale: "en-IN" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", locale: "te-IN" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", locale: "hi-IN" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", locale: "ta-IN" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", locale: "kn-IN" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", locale: "ml-IN" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", locale: "mr-IN" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", locale: "bn-IN" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", locale: "or-IN" },
] as const;
export type Language = (typeof supportedLanguages)[number]["code"];
export function isLanguage(value: unknown): value is Language {
  return supportedLanguages.some((language) => language.code === value);
}
export const localeForLanguage = (language: Language) =>
  supportedLanguages.find((item) => item.code === language)!.locale;
export const languageName = (value: string) =>
  supportedLanguages.find((language) => language.code === value)?.nativeName ??
  value;
export function initialLanguage(value: string | null): Language {
  return isLanguage(value) ? value : "en";
}
