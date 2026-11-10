# Oral photo observations for camera and file upload

Camera captures and uploaded files use the same image processing, private upload,
quality check and configured observation provider. Their source never determines
the assessment. Camera capture does not mean healthy; file upload does not mean
diseased.

With `SCREENING_AI_MODE=gemini` (or the existing compatible `medgemma` adapter),
the main photo action now uses the configured vision provider even when the
bundled lesion classifier is loaded. Gemini requests a structured assessment:

- `no_visible_abnormality`: no abnormality visible in the photographed area;
  both abnormal-findings and possible-conditions arrays must be empty. This is
  not a certification of health or exclusion of disease.
- `visible_changes`: at least one visible abnormal feature is required, with
  optional uncertain possibilities for a clinician to consider.
- `not_assessable`: non-oral, obstructed or insufficient-detail photographs;
  findings and possible conditions must be empty and the summary explains retaking.

Missing or contradictory assessments fail without saving a result. The provider
processes actual image bytes. Failures do not produce mock, healthy or lesion
results. Photo consent and assigned-record access are checked before and after
inference. Existing clinical-mode restrictions and the separate clinical provider
contract remain in place. Gemini remains an evaluation integration, not a
clinically validated patient-diagnosis service.

## Two-class model

The bundled `oral-mendeley-v1` model remains available when configured as the
active provider. It has not acquired a healthy class. Its UI now requires the
operator to confirm a visible lesion; its API requires `lesion_confirmed: true`
before inference. An old saved two-class result can be re-analysed with the
configured observation provider. Training and independently validating a model
for healthy-mouth screening remains separate work.

## Image quality and retakes

Sharpness below 55, poor exposure or excessive glare still blocks analysis. This
threshold was not relaxed to make a demonstration pass. A sharpness-22 photo,
as in the reported screenshot, now has actionable focus guidance and a direct
**Retake oral photo** button. Quality measures describe the image, not disease.
Unrun analyses no longer display an empty model-score panel.

## Hosting

Keep the existing server-side Gemini credentials and `SCREENING_AI_MODE=gemini`
for observation-based evaluation. Confirm the provider connection with
`npm run ai:check`. Keep both exact custom domains in Render's `APP_ORIGINS`:

```text
https://aarogyadrishti.in,https://www.aarogyadrishti.in
```

The origin fix also adds these exact HTTPS domains to the production API's trust
list. Deploy the frontend and API together. No new database migration is required
for the new JSON findings field; the existing image-findings migration 008 is
required and checked before an external inference request.

## Validation on 10 November 2026

The real configured Gemini endpoint passed the generated non-oral-image check.
Existing public reference images exercised both `visible_changes` and
`no_visible_abnormality` without a disease probability. Results are retained in
`test-results/oral-observation/live-provider-check.json`. These are integration
checks, not a clinical accuracy study or physical-device validation.

Provider tests check persisted outcomes, source independence, missing/contradictory
assessments, consent, assignment, provider errors and local-model confirmation.
UI tests render the actual component for all outcomes, provider selection and the
sharpness-22 retake case. Clinical consent/role tests remain separate.

Run the normal `npm test` and `npm run build:render` gates from a clean release checkout before deploying.
