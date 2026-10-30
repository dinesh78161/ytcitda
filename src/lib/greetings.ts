import type { Language } from "./languages";

export const greetings = {
  en: {
    text: "Hi. Welcome to Aarogya Drishti!",
    playLabel: "Play greeting",
  },
  te: {
    text: "ఆరోగ్య దృష్టికి స్వాగతం!",
    playLabel: "స్వాగత సందేశం వినండి",
  },
  hi: {
    text: "नमस्ते। आरोग्य दृष्टि में आपका स्वागत है!",
    playLabel: "स्वागत संदेश सुनें",
  },
  ta: {
    text: "வணக்கம். ஆரோக்ய திருஷ்டிக்கு நல்வரவு!",
    playLabel: "வரவேற்புச் செய்தியைக் கேளுங்கள்",
  },
  kn: {
    text: "ನಮಸ್ಕಾರ. ಆರೋಗ್ಯ ದೃಷ್ಟಿಗೆ ಸ್ವಾಗತ!",
    playLabel: "ಸ್ವಾಗತ ಸಂದೇಶವನ್ನು ಕೇಳಿ",
  },
  ml: {
    text: "നമസ്കാരം. ആരോഗ്യ ദൃഷ്ടിയിലേക്ക് സ്വാഗതം!",
    playLabel: "സ്വാഗത സന്ദേശം കേൾക്കുക",
  },
  mr: {
    text: "नमस्कार. आरोग्य दृष्टीमध्ये आपले स्वागत आहे!",
    playLabel: "स्वागत संदेश ऐका",
  },
  bn: {
    text: "নমস্কার। আরোগ্য দৃষ্টিতে আপনাকে স্বাগতম!",
    playLabel: "স্বাগত বার্তা শুনুন",
  },
  or: {
    text: "ନମସ୍କାର। ଆରୋଗ୍ୟ ଦୃଷ୍ଟିକୁ ସ୍ୱାଗତ!",
    playLabel: "ସ୍ୱାଗତ ବାର୍ତ୍ତା ଶୁଣନ୍ତୁ",
  },
} satisfies Record<Language, { text: string; playLabel: string }>;

export const greetingAudioPath = (language: Language) =>
  `/audio/greetings/${language}-welcome.${language === "or" ? "wav" : "mp3"}`;
