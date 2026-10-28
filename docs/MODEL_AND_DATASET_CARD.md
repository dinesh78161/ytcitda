# Mock model and dataset card

## Deployed demonstration adapter

`mock-v1` is deterministic application logic, not a trained classifier. It accepts
an authorized, consented image after the prototype quality gate. It stores:

```json
{
  "provider": "mock",
  "model_version": "mock-v1",
  "status": "completed",
  "research_label": "demo_review_required",
  "score": null,
  "clinical_use": false,
  "requires_clinician_review": true,
  "warning": "NOT FOR CLINICAL USE"
}
```

Every accepted image gets the same mock label. No sensitivity, specificity, accuracy,
localization or medical inference is claimed. The adapter demonstrates integration,
storage, failure states and the independent clinician-review workflow. It makes no
outbound model request. A mock result cannot confirm a diagnosis or create a referral.

The client and server quality checks use prototype Laplacian variance, brightness
and glare thresholds. These detect some deliberately flat/dark/bright fixtures;
they have not been calibrated for medical photographs or camera populations.

## Data provenance

No external clinical dataset has been downloaded, trained on or redistributed.
Automated tests generate checkerboard JPEGs and a PDF with explicit synthetic text.
Patients and staff examples are synthetic. These fixtures have no clinical labels,
subjects, demographic validity or disease information. There is no train/test split
because no learning takes place. The app's SVG icon is project artwork; no patient
photograph is bundled.

The handbook mentions Mendeley dataset `mhjyrn35p4/2`. This project has not verified
its license, label mapping, duplicate subjects, consent or permitted use and does not
claim permission to redistribute it. A team using educational photos must keep a
source/license record for every image used in the jury demonstration.

## Optional research model

Use `SCREENING_AI_MODE=research` only with an evaluated, pinned endpoint. Its contract
and validation are in [INTEGRATIONS.md](INTEGRATIONS.md). Document the dataset source,
license, counts, original/augmentation grouping, patient-level splits where possible,
transforms, model revision, held-out sample sizes, confusion matrix, sensitivity,
specificity, precision, F1 and known failures before presenting performance. A model
score must not be shown as an individual patient's cancer probability. Unavailable
or invalid research inference fails explicitly without changing a clinician decision.
