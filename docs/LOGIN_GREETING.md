# Spoken login greeting

After an explicit successful password sign-in, the app plays a short welcome in
the display language selected on the login screen. Clinical/administrator users
hear it only after MFA and workspace loading finish. Restoring a session,
refreshing a page, renewing a token, navigating or changing languages does not
automatically repeat it. A failed login does not play it.

The login form's greeting checkbox defaults on and stores its preference in
`aarogya-login-greeting`. The speaker button beside the header language selector
replays the greeting in the current display language, including when automatic
greetings are off. It also supplies a user gesture when a browser blocks automatic
playback. Audio failures do not block login. Speaker volume/mute remains under
the device's control; phone/Safari playback needs physical-device acceptance.

All nine languages have fixed public clips in `public/audio/greetings/`. English
says “Hi. Welcome!” and Telugu says “స్వాగతం!”; the other supported languages use
their own welcome phrases. These are application assets, not test recordings or
patient data. The PWA precaches the clips. Production serves MP3/WAV with audio
content types. No runtime TTS service, API key, installed device voice or paid
inference is needed to play them. Only fixed greetings are spoken, without names
or record details.

## Asset provenance

The eight MP3 clips were synthesized from the project's fixed phrases with
Google Translate speech on 30 October 2026. Google Translate speech did not
support Odia, so `or.wav` was synthesized from “ନମସ୍କାର। ସ୍ୱାଗତମ୍!” with Gemini
`gemini-3.8-flash-lite-tts`, voice Kore, on the same date. The generation was a
one-time development action. No patient information was used or sent. See
`src/lib/greetings.ts` for the complete text. Native speakers should review
wording and pronunciation before clinic acceptance.

## Verification

The local browser checks in `tests/security-browser/greeting.spec.ts` intercept
Auth, database and service status requests. They decode and play the real bundled
clips in Edge, check each selected language's path and playback completion, and
cover MFA gating, unsuccessful login, opt-out persistence, reload/session silence
and blocked audio. No hosted records are created or changed. Run them against a
built Supabase frontend with:

```powershell
npm run build
npx playwright test --config playwright.security.config.ts
```

On 30 October 2026 the production build and six production-server checks passed.
All nine audio clips decoded and completed playback in the local browser checks.
These checks verify playback, not native-speaker pronunciation or physical-device
audio routing.
