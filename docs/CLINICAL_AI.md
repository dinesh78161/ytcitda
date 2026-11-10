# Image assistance on real patient records

Clinical mode originally disabled every AI provider in the UI, API and database.
That is separate from Gemini connectivity failures on a hosted evaluation app.
The new `clinical` provider path supports clinician-requested draft observations
from a separately configured clinical model service. It does not turn the local
Mendeley classifier into a clinically validated diagnostic device.

## Provider needed before activation

Select a model/service whose permitted clinical use, independent validation and
data-processing arrangements cover the intended oral-image workflow. This
repository currently contains **no clinically validated oral model**. The local
`oral-mendeley-v1` checkpoint has only exploratory image-split results and is not
accepted by this clinical report contract.

See [model selection and validation assessment](CLINICAL_AI_VALIDATION.md) for
the candidates reviewed, recommendation and clinical data still needed.

The [Gemini Developer API terms](https://ai.google.dev/gemini-api/terms) explicitly
exclude clinical practice. A paid API key or clinician-review label does not
change that restriction. The clinical path never calls that API, uses its key,
or falls back to Gemini, mock results or the research classifier.

## Deploy the application changes

1. Apply [migration 014](../supabase/migrations/202611100014_clinical_image_assistance.sql)
   to the existing clinical Supabase database after its earlier migrations. It
   adds consent and draft provenance fields, keeps research blocked, and does
   not delete or convert patient records. Do not rerun first-time `setup.sql` on
   an existing database.
2. Configure the Node hosting service with the clinical provider's private values:

   ```dotenv
   WORKSPACE_MODE=clinical
   SCREENING_AI_MODE=clinical
   CLINICAL_AI_URL=https://YOUR-CLINICAL-MODEL-HOST/infer
   CLINICAL_AI_KEY=YOUR-PRIVATE-SERVICE-KEY
   CLINICAL_AI_MODEL_VERSION=YOUR-VALIDATED-MODEL-VERSION
   ```

3. Rebuild and restart the app so its client and server workspace modes agree.
   Render's build script sets `VITE_WORKSPACE_MODE` from `WORKSPACE_MODE`. For other
   build environments set `VITE_WORKSPACE_MODE=clinical` explicitly. Keys and
   endpoint credentials belong only on the Node server.
4. In the hosting service's shell run `npm run ai:check:clinical`. It sends only a
   generated checkerboard and checks connectivity, version and response shape;
   it does not demonstrate clinical performance. `/api/status` reports configured
   services rather than continuously probing the provider.
5. Sign in as an assigned Medical Officer or specialist with MFA. Record the
   patient's separate **AI image assistance** decision in **Patient consent**,
   after explaining that the image goes to the configured clinical service.
   Photo consent alone does not grant this permission. Use an acceptable-quality
   photograph and select **Request AI assistance**.

The app displays an **AI DRAFT · CLINICIAN REVIEW REQUIRED** report, including
visible findings, supported possibilities and limitations. The clinician must
examine the patient and independently record/sign an assessment through the
existing clinical review workflow. AI drafts never create a signed review,
diagnosis, referral or treatment plan automatically. `clinical_use=false` remains
an invariant on AI rows: these rows are not independently signed clinical decisions.

Health workers can capture photos and record consent; only assigned clinicians
can request or read clinical AI drafts. The API verifies current assignment,
role, photo consent, separate AI consent, migration and image quality before
sending, then rechecks assignment/consent before saving. A database trigger also
checks clinician assignment and the current consent record while locking the
patient row. Draft rows retain the requesting clinician, consent ID, version and
creation timestamp and cannot be edited. The existing audit trail records the
draft action without image contents.

## Clinical service contract

The Node API makes an authenticated HTTPS POST with no redirects. The body is:

```json
{
  "model_version": "YOUR-VALIDATED-MODEL-VERSION",
  "intended_use": "clinician_assistance",
  "language": "en",
  "mime_type": "image/jpeg",
  "image_base64": "JPEG_BYTES_AS_BASE64"
}
```

The service receives only the image and version/language/purpose metadata; names,
case identifiers and clinical notes are not added. Image content can itself
contain identifying information. The configured service must support the
requested languages: `en`, `te`, `hi`, `ta`, `kn`, `ml`, `mr`, `bn`, `or`.

Return `Content-Type: application/json` and exactly this report structure:

```json
{
  "model_version": "YOUR-VALIDATED-MODEL-VERSION",
  "intended_use": "clinician_assistance",
  "findings": {
    "image_kind": "oral_photo",
    "summary": "Draft description for independent clinician review.",
    "visible_findings": ["Visible feature supported by the photograph."],
    "possible_conditions": [
      {
        "name": "Uncertain possibility",
        "visual_basis": "Visible feature supporting consideration."
      }
    ],
    "limitations": ["A photograph alone cannot confirm or exclude disease."]
  }
}
```

`image_kind` is `oral_photo`, `not_oral_photo` or `uncertain`; the latter two must
have empty findings/possibility arrays. Summary length is 1–1200 characters;
visible-findings and limitations lists have at most 8 strings, each 1–400
characters, with at least one limitation. There are at most 3 possibilities,
each with a 1–120-character name and 1–500-character visual basis. No extra keys,
class scores, disease probabilities or automatic treatment decisions are accepted.
The adapter rejects a version mismatch and reports failure rather than saving
fabricated findings.

Requests have a 45-second total deadline and responses are capped at 128 KB.
HTTP errors, malformed output and timeouts create no saved draft. The API limits
clinical inference to two active requests per process and one per image per
process; it does not retry provider requests automatically. For multiple API
replicas, the model service must also enforce its own capacity/queue controls.

## Verification

`node tests/clinical-ai.test.mjs` checks endpoint configuration, report contracts,
wrong versions, classifier rejection, oversized output, timeouts and errors.
`node tests/provider.test.mjs` checks consent, authorization, clinical/research
separation, loss of assignment and concurrency. `node tests/clinical-workspace.test.mjs`
checks the migration in embedded PostgreSQL, including read policies, immutable
drafts and database rejection after withdrawal. None establish medical accuracy.
`node tests/clinical-ai-ui.test.mjs` renders the actual clinical photo and consent
components with synthetic context to verify clinician-only draft visibility and
the separate-consent requirement.
