# Interface and report languages

The display-language menu on the sign-in and workspace screens supports English,
Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, and Odia. Options use
their native names. The selection persists on the current browser and sets the
document language for assistive technology. Dates use the selected Indian locale.
Bundled fonts and translation catalogs remain available with the offline app.

The screening form defaults the patient's preferred language to the current
display language. Staff can select a different preference. Registration records
that choice on the patient and the new consent records. Names, villages, notes,
signed reviews, and existing reports are retained as entered.

## Existing Supabase projects

Apply [migration 009](../supabase/migrations/202610290009_languages.sql) once in
the project's SQL Editor. It expands the patient and consent language constraints
and exposes an authenticated capability check. It does not rewrite old records.
Do not rerun the first-time `setup.sql` on an existing database.

Until this migration is available, registrations with a newly supported patient
language retain their draft and explain that the workspace needs an update.
Changing the interface language is still available.

## Gemini reports

New Gemini requests use the selected display language for report prose. JSON
field names and internal enums stay unchanged, and the saved report includes its
language code. An existing report keeps its original wording when the interface
language changes. Reports without a stored language are treated as English.

The seven additional catalogs were generated from fixed interface messages and
checked for completeness, placeholders, and rendering. They have not received
professional native-language clinical review; that review is needed before
patient-facing clinical use. Translation does not improve or validate the model's
medical accuracy.

## Checks

`npm test` checks catalog coverage, saved language preferences and consent records,
and report-language validation. Build with `VITE_APP_MODE=demo`, then run
`npm run test:e2e` to check mobile screening in each additional language,
persistence, and offline Hindi rendering.

Checked on 30 October 2026: all 107 `npm test` checks and the production build passed. All seven
language browser tests passed, including Hindi image-upload labels and offline
reload. The broader browser run passed 15 of 17 checks. Its two failures were
existing expectations for the CSV filename (`aarogya-synthetic-summary.csv`
versus the current `aarogya-clinical-summary.csv`) and the mock analysis message
(`No medical prediction was made.` versus the current clinical-triage wording).
These differences are not translation failures and have not been hidden by
removing assertions. No hosted database migration or deployment was performed
for this language update.

Clinical-workspace follow-up on the same date: all 17 browser regression checks
passed after updating the mock warning and CSV expectation. Clinical mode uses
the same nine display languages with clinician-led outcome and consent wording.
