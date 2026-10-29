# Gemini on Render

This revision adds `SCREENING_AI_MODE=gemini` support to the Node server and a
structured image-findings display. An older revision reports "SCREENING_AI_MODE
must be mock, research or disabled" and exits at startup. Deploy the revision
containing `server/gemini.mjs` and the Gemini branch in `server/index.mjs`.

Set these in the Render service's **Environment** settings:

```dotenv
SCREENING_AI_MODE=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=YOUR_PRIVATE_KEY
```

Keep the key on the server. Local `.env.server` settings do not automatically
configure Render. Keep the existing Supabase credentials, build command
`npm ci --include=dev && npm run build:render`, and start command `npm start`.

In the connected Supabase project, apply the complete
[image-findings migration](../supabase/migrations/202610290008_image_findings.sql)
once if it is not already applied. It adds a findings JSON column and a capability
check; the API checks the capability before sending a photo to Google. Existing
projects apply only missing migrations, not the full first-time setup file.

Deploy the latest commit. If automatic deployment is off, choose **Manual Deploy
→ Deploy latest commit**. Verify `/api/status` returns HTTP 200 with
`ai_provider=gemini` and `ai=true`. This checks configuration presence, not provider
availability. A missing key disables analysis without crashing the web server.

To test locally after setting a private key in `.env.server`, run
`npm run ai:check`. This consumes one real API request using a generated checkerboard;
it verifies connectivity and unsuitable-image handling, not medical accuracy.

In the app, open an assigned synthetic patient → **Oral photographs**, record photo
consent, upload a licensed educational photo, and select **Analyse with Gemini**.
Results include visible findings, possible conditions for clinician review, model
details, and limitations. No numerical cancer probability is generated. Gemini is
not a clinically validated diagnostic model, and every result requires independent
clinician review. Non-oral/uncertain images do not complete the oral-analysis step.
Google errors do not become mock results or signed clinical decisions.

Google's official references: [image input](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding),
[structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output),
[API keys](https://ai.google.dev/gemini-api/docs/api-key).
