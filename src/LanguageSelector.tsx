import { Languages } from "lucide-react";
import { supportedLanguages, type Language } from "./lib/languages";
import { localize } from "./lib/localize";

export default function LanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="language-switch language-picker">
      <Languages size={16} aria-hidden="true" />
      <select
        aria-label={localize(language, "Display language", "ప్రదర్శన భాష")}
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
      >
        {supportedLanguages.map((item) => (
          <option key={item.code} value={item.code} lang={item.code}>
            {item.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
