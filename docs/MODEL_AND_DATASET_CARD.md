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

The [Mendeley V2 dataset record](https://data.mendeley.com/datasets/mhjyrn35p4/2)
was checked on 29 October 2026. It lists CC BY 4.0 and original photographs of
165 benign and 158 malignant lesions, plus augmented copies. This project has not
downloaded or trained on it, verified patient grouping or label ground truth, or
established suitability for the target population. Keep a source/license record
and attribution for each educational image. The [training kit](../ml/README.md)
documents the unresolved grouping and evaluation requirements.

## Optional research model

The [Gemini integration](GEMINI_SETUP.md) uses an existing general-purpose vision
model for visible observations and possible conditions for clinician review. It
has not been clinically evaluated by this project. Its results are stored as
`provider=research` with `findings.engine=gemini`, exact returned model version,
prompt version, `score=null`, and mandatory independent clinician review. It
checks whether an input appears to be an oral photograph, but that check is not
a validated oral-image detector. No sensitivity or specificity is claimed.

The new `ml/` scripts prepare patient-disjoint splits, fine-tune a photograph
classifier, save held-out evaluation metrics, and expose a versioned inference
adapter. They are a training scaffold, not an evaluated oral model. Dataset audit
tests use synthetic fixtures. PyTorch training/inference have not been executed
in this workspace because no labelled oral dataset or PyTorch installation is
available. No accuracy, sensitivity, or specificity result is claimed.

Use `SCREENING_AI_MODE=research` only with an evaluated, pinned endpoint. Its contract
and validation are in [INTEGRATIONS.md](INTEGRATIONS.md). Document the dataset source,
license, counts, original/augmentation grouping, patient-level splits where possible,
transforms, model revision, held-out sample sizes, confusion matrix, sensitivity,
specificity, precision, F1 and known failures before presenting performance. A model
score must not be shown as an individual patient's cancer probability. Unavailable
or invalid research inference fails explicitly without changing a clinician decision.
