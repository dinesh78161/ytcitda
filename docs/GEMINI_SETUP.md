# Enable Gemini image analysis

The app can use Gemini's existing image-understanding capability without training
an oral classifier first. It requests visible findings, possible conditions for a
clinician to consider, and limitations. It does not establish a diagnosis, estimate
cancer probability, or choose treatment. This project's medical accuracy is not
measured. Continue using licensed educational photographs and synthetic records.

## 1. Add your private API key

Create a key in [Google AI Studio](https://aistudio.google.com/apikey). Follow
[Google's API key instructions](https://ai.google.dev/gemini-api/docs/api-key) and
check project access/quota. Do not paste the key into chat or commit it.

In the ignored `.env.server` file in the project root, set:

```dotenv
SCREENING_AI_MODE=gemini
GEMINI_API_KEY=YOUR_PRIVATE_GEMINI_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
```

The deployed default uses the model previously verified with this project.
You can configure another available Gemini model that supports image
input and structured JSON output. Model access and quota depend on your Google
project. There is no automatic substitution if a selected model fails. This sends
the photo to Google; review the applicable service terms for your use. Do not send
real patient data through this synthetic demonstration.

During the live connection check on 29 October 2026, `gemini-3.8-flash` returned
high-demand errors/timeouts. `gemini-3.5-flash-lite` passed the full generated-image
check and was selected in this workspace's local `.env.server`. This verifies
connectivity and report parsing, not medical accuracy. Model choice remains
explicit; the app does not silently switch models on errors.

The key stays on the Node server. Never use `VITE_GEMINI_API_KEY` or place a key in
browser code. Keep the existing Supabase server settings intact.

## 2. Apply the image-findings database migration

In the connected Supabase project's SQL Editor, run the complete contents of
[migration 008](../supabase/migrations/202610290008_image_findings.sql) once as
the project administrator. It adds an optional JSON findings column and a
capability check; it does not replace historical analyses or alter assignments.
Apply any earlier missing migrations in order; the new screening intake also
requires [migration 007](../supabase/migrations/202610290007_screening_intake.sql).
Follow [Supabase setup](SUPABASE_SETUP.md). Do not rerun the full first-time
`setup.sql` on an existing database.

The API checks migration 008 before contacting Gemini, so an old database cannot
silently discard the report or incur an inference request that cannot be stored.

## 3. Restart and check the connection

Restart `npm run dev:all` after environment changes. In a separate terminal:

```powershell
npm run ai:check
```

This makes one real API request using a generated checkerboard, verifies the
response schema and unsuitable-image handling, and prints no secrets. It consumes
API usage. A passing check proves connectivity, not disease-detection accuracy.

For hosted use, add the same three variables in the hosting service's server
environment and redeploy after applying missing migrations. A local key does not
configure the hosted site automatically.

## 4. Analyse a photograph

Sign in to the Supabase workspace as an assigned health worker or clinician.
Open a synthetic patient, record separate photo consent, and go to **Oral
photographs**. Upload a suitable educational image, inspect the quality result,
then select **Analyse with Gemini**. Existing mock results can be re-analysed with
Gemini once it is configured. Local demo mode continues using mock results.

Results show the summary, visible findings, possibilities with their visual basis,
limitations, model version, and a clinician-review notice. Gemini reports have no
numeric confidence score. Unsuitable images produce an explicit report and do not
complete the oral-analysis step in the guided patient journey. The model's oral
image check is also imperfect and is not a validated medical quality gate.

Only image bytes and fixed instructions are sent; the app does not add names,
contact information, case IDs, or clinician notes. Image content itself can still
contain identifying details. Authorization, current consent, and image quality
are checked before sending; assignment and consent are checked again before
saving. The app validates JSON on receipt and rejects malformed, blocked, or
incomplete responses. API errors never become mock findings. Model instructions
and structured output do not guarantee medical correctness or eliminate
hallucinations; qualified clinicians must review the result.

Official API references: [image input](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding),
[structured JSON](https://ai.google.dev/gemini-api/docs/generate-content/structured-output),
[models](https://ai.google.dev/gemini-api/docs/models).
