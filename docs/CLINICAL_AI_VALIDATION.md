# Model selection and validation decision

Assessment date: 10 November 2026. Intended input: ordinary visible-light
intraoral photographs from the app's existing upload/camera workflow. Initial
clinical task: help a clinician assess oral mucosal lesions. This is distinct
from dental X-ray interpretation, multispectral imaging, and histopathology.

## Selection outcome

**No model is selected for real-patient activation yet.** The sources reviewed
do not establish an available drop-in API with independent clinical validation
for this app's exact photograph workflow and population. Absence of evidence
in this assessment is not proof that no suitable product exists.

| Candidate                               | Evidence and input                                                                                                                                                       | Decision for this app                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing MobileNetV3 `oral-mendeley-v1` | 285 eligible public images; 43-image exploratory test; no patient identifiers, external evaluation or out-of-distribution rejection                                      | Keep as a development baseline; the clinical adapter rejects its classifier response                                                                                                                     |
| MedGemma / MedSigLIP                    | Google's model documentation describes development foundations requiring adaptation and validation; it does not establish validation on this app's intraoral photographs | Candidate for a controlled comparison, not a clinical replacement selected on the strength of its name                                                                                                   |
| Sascan OralScan                         | Vendor describes a clinically validated, CE-marked device; government technology record describes multispectral fluorescence/reflectance capture                         | Potential device partnership if the clinic accepts dedicated hardware; not an interchangeable model for ordinary phone photographs. API availability and applicable local intended use need confirmation |
| Ivy AI oral screening API               | Vendor's evidence page describes internal validation and says detailed public validation evidence is unavailable                                                         | Do not select for this clinical use on current public evidence; request independent validation and intended-use documents before reconsidering                                                           |

Primary sources:

- [Google MedGemma model documentation](https://developers.google.com/health-ai-developer-foundations/medgemma/model-card)
- [Google MedGemma development guidance](https://research.google/blog/medgemma-our-most-capable-open-models-for-health-ai-development/)
- [Sascan OralScan specifications](https://sascan.in/oralcancer-screening-device/)
- [Government of India OralScan technology record](https://www.indiascienceandtechnology.gov.in/technologies/oralscan)
- [Ivy AI clinical evidence disclosure](https://www.ivyai.hk/clinical-evidence)
- [Gemini Developer API use restrictions](https://ai.google.dev/gemini-api/terms)

## Recommended next step

For the existing phone-photo workflow, work with an oral-medicine/dental hospital
partner to validate a task-specific model. Compare the current transfer-learning
baseline with a medical-image encoder under the same patient-separated protocol.
Do not promote the current classifier by changing its name, hosting environment,
number of epochs, or the `clinical_use` flag. If a clinic needs a clinical system
immediately, procurement of a purpose-built device/service with matching intended
use is a separate route from validating this prototype.

The work that can be done without patient data is implemented: provider isolation,
version checking, consent and clinician access, draft-only storage, audit history,
request deadlines/capacity, and rejection of unsupported reports. Model validation
requires actual labelled clinical data and qualified review; software tests do not
provide it.

## Validation protocol to agree with the clinical partner

1. Define the exact intended use and outputs. A benign/malignant lesion dataset
   cannot establish healthy-mouth screening, OPMD identification or diagnosis of
   every oral disease. Define unassessable/non-oral/low-quality inputs and when the
   model must abstain. The clinician remains responsible for examination and the
   final assessment.
2. Obtain appropriately permitted original images, stable pseudonymous patient
   IDs, acquisition site/device information and expert reference labels. Define
   the reference standard with oral specialists; link pathology when relevant.
   Record uncertain labels instead of silently treating them as negatives. The
   public dataset's augmented copies are not independent patients.
3. Freeze a protocol before development: patient-separated training/validation,
   an independent clinic/time-period test cohort, metrics, subgroup analyses and
   clinically acceptable error limits. Keep all images/visits for a patient in
   one partition, review exact/near-duplicates and source overlap, and lock the
   model, preprocessing and operating threshold before the final test.
4. Evaluate sensitivity, specificity, predictive values, failure/abstention rate,
   calibration where probabilities are used, and uncertainty at the patient
   level. Report denominators and confidence intervals. Set required sensitivity
   and its confidence bound with the clinical team; do not choose an arbitrary
   accuracy target or tune a threshold on the final test labels. Analyse missed
   serious lesions and performance across relevant sites, cameras and populations.
5. Conduct prospective silent evaluation, followed by an appropriately designed
   clinician-assisted evaluation, before changing patient-care decisions. Review
   permitted clinical use, patient data handling and applicable deployment
   requirements with the responsible institution. Do not infer suitability from
   a research paper's internal test accuracy or a vendor's marketing statement.
6. Release a versioned clinical model card and monitoring plan. Record the model
   hash/version, permitted input/task, operating threshold, uncertainty results,
   abstention behaviour, known failure modes and incident/rollback process. Test
   the hosted service with representative consented inputs before activation.

## Inputs still needed

- A clinical partner and agreed reference-standard labelling process.
- An independent, permitted clinical validation cohort with patient grouping.
- A selected model/service whose intended use and evidence match the workflow.
- A private hosted endpoint and credentials implementing [the report contract](CLINICAL_AI.md).

No real patient images have been sent to an external service during this work.
The provider tests use generated fixtures. The documented hosted app's public
status reported `workspace_mode=evaluation` and `ai_provider=gemini` during this
assessment; that status describes configuration, not clinical readiness or a
successful live inference.
