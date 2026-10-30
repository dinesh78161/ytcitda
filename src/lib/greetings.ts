import type { Language } from "./languages";

export const greetings = {
  en: {
    text: "Hi. Welcome to Aarogya Drishti!",
    playLabel: "Play greeting",
    soundLabel: "Play a greeting after sign-in",
  },
  te: {
    text: "ఆరోగ్య దృష్టికి స్వాగతం!",
    playLabel: "స్వాగత సందేశం వినండి",
    soundLabel: "సైన్ ఇన్ తర్వాత స్వాగత సందేశం వినిపించండి",
  },
  hi: {
    text: "नमस्ते। आरोग्य दृष्टि में आपका स्वागत है!",
    playLabel: "स्वागत संदेश सुनें",
    soundLabel: "साइन इन के बाद स्वागत संदेश सुनाएँ",
  },
  ta: {
    text: "வணக்கம். ஆரோக்ய திருஷ்டிக்கு நல்வரவு!",
    playLabel: "வரவேற்புச் செய்தியைக் கேளுங்கள்",
    soundLabel: "உள்நுழைந்த பிறகு வரவேற்புச் செய்தியை ஒலிக்கவும்",
  },
  kn: {
    text: "ನಮಸ್ಕಾರ. ಆರೋಗ್ಯ ದೃಷ್ಟಿಗೆ ಸ್ವಾಗತ!",
    playLabel: "ಸ್ವಾಗತ ಸಂದೇಶವನ್ನು ಕೇಳಿ",
    soundLabel: "ಸೈನ್ ಇನ್ ನಂತರ ಸ್ವಾಗತ ಸಂದೇಶವನ್ನು ಕೇಳಿಸಿ",
  },
  ml: {
    text: "നമസ്കാരം. ആരോഗ്യ ദൃഷ്ടിയിലേക്ക് സ്വാഗതം!",
    playLabel: "സ്വാഗത സന്ദേശം കേൾക്കുക",
    soundLabel: "സൈൻ ഇൻ ചെയ്ത ശേഷം സ്വാഗത സന്ദേശം കേൾപ്പിക്കുക",
  },
  mr: {
    text: "नमस्कार. आरोग्य दृष्टीमध्ये आपले स्वागत आहे!",
    playLabel: "स्वागत संदेश ऐका",
    soundLabel: "साइन इन केल्यानंतर स्वागत संदेश ऐकवा",
  },
  bn: {
    text: "নমস্কার। আরোগ্য দৃষ্টিতে আপনাকে স্বাগতম!",
    playLabel: "স্বাগত বার্তা শুনুন",
    soundLabel: "সাইন ইন করার পরে স্বাগত বার্তা শোনান",
  },
  or: {
    text: "ନମସ୍କାର। ଆରୋଗ୍ୟ ଦୃଷ୍ଟିକୁ ସ୍ୱାଗତ!",
    playLabel: "ସ୍ୱାଗତ ବାର୍ତ୍ତା ଶୁଣନ୍ତୁ",
    soundLabel: "ସାଇନ୍ ଇନ୍ ପରେ ସ୍ୱାଗତ ବାର୍ତ୍ତା ଶୁଣାନ୍ତୁ",
  },
} satisfies Record<
  Language,
  { text: string; playLabel: string; soundLabel: string }
>;

export const greetingAudioPath = (language: Language) =>
  `/audio/greetings/${language}-welcome.${language === "or" ? "wav" : "mp3"}`;
