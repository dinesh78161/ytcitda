# Live presentation — 12 November 2026

Use the deployed application at https://aarogya-drishti-om9g.onrender.com/.
This release adds genuine CPU inference from the trained `oral-mendeley-v1`
model to the same Node service that serves the app. It uses the existing
authenticated database and private photo storage. The oral-model action makes
no Gemini or other external model request.

## Position the project accurately

Suggested opening:

> Aarogya Drishti is a live screening-to-care platform. It connects patient
> registration, consent, oral photographs, AI-assisted image classification,
> clinician review, referrals, consultations and follow-up in one record.
> Our trained oral-image model now runs inside the application server. Its
> current validation is preliminary; the clinician makes the medical decision.

The software can be deployed and demonstrated live while its AI remains under
clinical evaluation. Use a clearly labelled presentation test case. Do not
describe the classifier as a certified cancer detector or use real patient
records to imply a completed clinical validation study.

## Before the session

- Verify password sign-in for the accounts you will use and complete required
  authenticator verification. Keep passwords/TOTP codes out of the slides.
- Open the public app and `/api/status` before the session. Confirm
  `oral_model_ready=true` and `oral_model_version=oral-mendeley-v1`.
- Use the **Analyse with oral model** action. A configured Gemini provider may
  still appear in general service status; this separate action explicitly selects
  the bundled model and never falls back to Gemini on failure.
- Prepare an educational oral photograph and a clearly labelled test case.
  Avoid selecting photographs used for training as a claim of independent testing.
- Rehearse upload, consent, model inference and reload of the saved result.
  Keep two signed-in devices ready if showing video consultation; confirm camera,
  microphone and appointment timing before the audience arrives.
- Keep the local production server available as a continuity option. If you
  switch to it, say that it is the same application running locally.

## Five-minute walkthrough

| Time      | Action                                                          | Explain                                                                  |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 0:00–1:00 | Register/open a presentation test case and record consent       | Assignment and consent govern access and photo use                       |
| 1:00–2:00 | Upload an educational oral photograph and run the oral model    | Real server-side inference returns a versioned dataset-class prediction  |
| 2:00–3:00 | Reload the record; open clinician review                        | Results are persisted; a clinician independently records the assessment  |
| 3:00–4:00 | Create/open a referral and appointment; show video if rehearsed | The platform carries the case into specialist care                       |
| 4:00–5:00 | Show investigation/treatment/follow-up history and aggregates   | The record continues through follow-up rather than stopping at screening |

Use the independent review workflow to sign the clinician's assessment. Do not
copy a model label into a diagnosis and present it as confirmed disease.

## Evidence you can explain

- MobileNetV3-Small, fine-tuned from ImageNet initialization.
- 285 eligible original photographs: 199 train, 43 validation, 43 test.
- Preliminary Python test: 39/43 matched dataset labels; 1 malignant-labelled
  image was missed and 3 benign-labelled images were flagged as malignant.
- Patient identifiers were unavailable in this public dataset, so these are
  exploratory image-level results. They do not establish clinical accuracy.
- Export parity: 43/43 class labels agreed between Python and Node on paired
  inputs. Mean class-score difference 0.00683, maximum 0.04363. This checks the
  implementation, not medical performance.
- Local Node CPU inference averaged about 53 ms/image in that conversion check.
  Hosted latency also includes authentication, storage download and persistence;
  do not describe 53 ms as the complete hosted response time or an SLA.

## Questions from judges

**Is the AI real or a fixed response?**
The oral-model action executes the trained ONNX model on the uploaded JPEG in
the backend and saves its versioned class/score. It is not the mock workflow.

**Does it diagnose cancer?**
It classifies images into the dataset's benign/malignant lesion categories. The
current model is under validation and cannot establish a patient's diagnosis.
The clinician's independent assessment and appropriate investigations remain
the clinical decision.

**Why not depend on Gemini?**
This action runs our model in the existing Node service, so it does not need
Gemini availability, quota or an external model key. Gemini's Developer API
also excludes clinical practice in its terms; it remains an evaluation integration.

**What makes the application ready for a live walkthrough?**
Authenticated accounts, assignment checks, private file storage, consent history,
saved workflows, independent review and versioned model execution are implemented
and tested. Physical-device, hosting and clinical-validation limits remain distinct.

**What is the next medical-validation step?**
Partner with an oral-medicine clinic for permitted, patient-grouped data and
independent reference labels; freeze a patient-separated/external evaluation
protocol before adapting and testing the next model version.

## Release and hosting

`npm start` warms the bundled model before listening in an evaluation workspace,
unless AI is disabled or `BUNDLED_ORAL_MODEL_ENABLED=false`. No extra model host
is required. `SCREENING_AI_MODE=local` also selects the model as the primary
evaluation provider. Clinical workspaces continue to require the separate
clinical model contract; the experimental classifier cannot be used on real records.

Run `npm run ai:check:local` for a generated-image inference check, `npm test`,
`npm run build:render`, then `npm run test:deployed -- https://YOUR-HOST`.
The generated-image check and software tests do not measure clinical accuracy.
