# Oral-image research training kit

This kit prepares a MobileNetV3-Small photograph classifier and an inference adapter
for the existing `/api/analyze` endpoint. **No oral model has been trained yet.**
ImageNet initialization is general image pretraining, not oral-disease knowledge.
This kit does not activate a trained model in the app. Gemini evaluation is a
separate integration; use `SCREENING_AI_MODE=research` for this versioned model
endpoint when it is ready. Training longer does not establish greater accuracy.

## 1. Obtain and label suitable data

Start with original intraoral photographs, not X-rays, microscopic histology,
screenshots, or pre-augmented copies. Define the target classes with an oral
medicine specialist. A benign/malignant classifier does not also detect caries,
periodontal disease, every OPMD, or non-oral inputs.

Dataset sources checked on 29 October 2026:

- [Oral Images Dataset, Mendeley V2](https://data.mendeley.com/datasets/mhjyrn35p4/2)
  lists 165 benign and 158 malignant original images, plus augmented copies, under
  CC BY 4.0. It is a possible small research baseline. Its public description does
  not establish patient identifiers, subject independence, or local clinical
  performance. Obtain patient grouping from the authors before using this kit;
  do not fabricate one patient ID per image. Preserve attribution. Do not count
  augmented copies as new patients or put them into evaluation sets.
- [Annotated Oral Cavity Images, Zenodo](https://zenodo.org/records/10664056)
  provides a description of 3,000 photographs and patient/image metadata. Files
  are restricted. The record requires an institutional request and lists
  non-commercial and no-derivatives terms. Obtain explicit permission compatible
  with your intended training and deployment before using it.

No dataset is downloaded or redistributed by this repository. Do not use app
uploads for training automatically: consent to a screening/photo is not a grant
of permission for model training. Keep research data in an approved environment,
outside the synthetic demonstration database.

Create a CSV using `manifest.example.csv` as a header/template (its sample image
does not exist). Each row needs an original image path, a stable pseudonymous
patient ID, a clinician-verified class, the basis for the label (such as clinical
review or linked pathology when available), source, and verified license. Names
and contact details do not belong in this manifest. Resolve uncertain labels with
qualified reviewers instead of treating model predictions as ground truth.

## 2. Install and freeze the patient split

Use Python 3.12 in a dedicated environment. Install the matching CPU/GPU PyTorch
and torchvision packages from the [official installer](https://pytorch.org/get-started/locally/),
then the remaining dependencies. Review installed versions and retain a lock file
with each experiment. Network access is needed for ImageNet weights on first use.

```powershell
python -m venv .venv-oral
.\.venv-oral\Scripts\python -m pip install -r ml/requirements.txt
.\.venv-oral\Scripts\python ml/prepare.py ml/data/manifest.csv --output ml/data/splits-v1.csv
```

The auditor checks image decoding, dimensions, required provenance fields, and
exact decoded-pixel duplicates. It creates approximately 70/15/15 patient splits
and requires each class in each split. It refuses to overwrite an existing split.
The minimum patient checks only prevent impossible splits; they do not mean a
dataset is large enough. Perform a manual near-duplicate/source-overlap review;
the script does not detect every crop, re-encoding, or altered duplicate.

## 3. Train and evaluate

```powershell
.\.venv-oral\Scripts\python ml/train.py ml/data/splits-v1.csv --output ml/artifacts/oral-v1 --version oral-v1 --epochs 15
```

The script rechecks original file hashes, fine-tunes ImageNet MobileNetV3-Small
using class-weighted loss, selects the checkpoint using validation loss, and fits
a temperature using validation data only. Augmentation is applied only to training
images. The held-out test set is evaluated after model selection.

Outputs are `model.pt` and `evaluation.json` with patient/image counts, class
support, confusion matrix, sensitivity, specificity, precision, recall, F1, balanced
accuracy, log loss, and AUC. For binary AUC the second alphabetically sorted class
is positive. Report sample sizes and uncertainty, not just accuracy. Temperature
fitting does not guarantee calibrated probabilities on other clinics or cameras.

To improve a subsequent version, review false negatives and false positives,
collect better labels and diverse original training photos, and use validation
data to choose hyperparameters. Freeze a genuinely unseen external test cohort
before making improvement claims. Reusing the same test set to select versions
makes it development data; keep a separate final evaluation. This kit does not
provide localization, an oral/non-oral detector, uncertainty/OOD rejection, or
external/prospective clinical validation.

## 4. Connect a reviewed research checkpoint

Set a private random `SCREENING_MODEL_KEY` in the inference process environment.
Use a trusted checkpoint you produced; never load arbitrary downloaded checkpoints.

```powershell
.\.venv-oral\Scripts\python ml/serve.py ml/artifacts/oral-v1/model.pt
```

The adapter binds to loopback port 8090, accepts bearer-authenticated JPEG requests
at `/infer`, verifies the requested model version, and returns the exact version,
predicted class, and class score. It does not persist uploaded images. Expose it
through an authenticated HTTPS reverse proxy with body-size, concurrency, and
timeout limits. The development adapter is not a production inference service.

Configure the care API's server-only environment:

```dotenv
SCREENING_AI_MODE=research
SCREENING_MODEL_URL=https://YOUR-MODEL-HOST/infer
SCREENING_MODEL_KEY=YOUR-PRIVATE-RANDOM-KEY
SCREENING_MODEL_VERSION=oral-v1
```

Restart the API and use the photo's **Run research analysis** action. Supabase mode
continues to enforce assignment, current photo consent, and image-quality checks.
Research errors never fall back to mock. Class scores are not individual cancer
probabilities. The app retains its independent clinician review workflow; no model
output signs a diagnosis or changes treatment automatically.

## Verification available without PyTorch

```powershell
python -m unittest discover -s ml -p "test_*.py"
```

These checks use generated non-medical fixtures to test dataset integrity; they
provide no clinical performance evidence. Training and inference require the
dependencies above and suitable data. No numeric performance claim is included.

Technical references: [PyTorch transfer learning](https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial),
[MobileNetV3-Small](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.mobilenet_v3_small.html),
[saving/loading weights](https://docs.pytorch.org/tutorials/beginner/saving_loading_models),
[grouped evaluation](https://scikit-learn.org/stable/modules/cross_validation.html).
