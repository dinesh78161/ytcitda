# Clinical workspace

Clinical mode supports clinician-led screening, consent, oral photographs, signed
review, referrals, appointments, investigation reports, treatment and follow-up.
It requires provisioned staff sign-in, assigned records, and MFA for clinicians
and administrators. Local role switching remains confined to the training build.

This is software for clinic evaluation. Workflow tests do not establish clinical
effectiveness, medical device clearance, model accuracy, or institutional release
acceptance. The clinic owns its consent wording, approval and operating procedures.

## Reuse the existing test project

At the project owner's explicit request, the existing Supabase project can be
cleared and activated. The prepared script is
`test-results/clinical-conversion/activate-existing-project.sql`; regenerate it
with `node scripts/prepare-clinical-conversion.mjs`. Do not run first-time setup
on the existing project.

The transaction refuses non-test records or an already active clinical workspace,
locks the affected tables, applies missing migrations 006–010, removes test
patient workflows/outreach/audits/retry payloads, and activates clinical mode. It
preserves staff profiles, Auth accounts, facilities, and private Storage buckets.
No tables are dropped and no immutability or integrity triggers are disabled.

Before the requested reset, an encrypted snapshot of the 39 test patients and
referenced files was saved in `test-results/clinical-conversion/`. This captures
public application records and referenced file bytes, not a complete PostgreSQL
or Auth backup. The recovery key is local and ignored by Git.

Run the full prepared SQL as owner in Supabase SQL Editor. After it shows clinical
mode and zero remaining patients, run:

```powershell
node --env-file-if-exists=.env.server scripts/finalize-clinical-conversion.mjs --cleanup-test-files --configure-local
```

This verifies the authenticated workspace policy, deletes only saved test-file
keys that are not referenced by active records, and updates the local mode. It
never clears files while the database is still in evaluation mode. Restart the
local app afterward. On Render set `WORKSPACE_MODE=clinical` and
`SCREENING_AI_MODE=disabled`, then rebuild/deploy the updated source. Review the
retained staff and facilities for the clinic before introducing patient data.
The recorded consent template version is `clinical-intake-v1`; the clinic must
review that form against its own approved consent process.

## Alternatively, provision a new clinical project

Do not relabel historical records. Mode changes require an empty patient table;
use either the explicitly authorized reset above or a new project below.

1. Run `npm run db:prepare`. Run `supabase/setup.sql` once in the new project's SQL
   Editor. It includes migrations 001–010 and facility examples, without patients
   or Auth accounts. Replace the facility examples with the clinic's facilities
   before assigning staff. Do **not** run `demo_seed.sql`.
2. As database owner, configure the clinic's actual approval reference and approved
   consent document version. Replace both example strings before running:

   ```sql
   update app_private.workspace_configuration
   set mode = 'clinical',
       approval_reference = 'REPLACE_WITH_CLINIC_APPROVAL_REFERENCE',
       consent_version = 'REPLACE_WITH_APPROVED_CONSENT_VERSION'
   where singleton;
   ```

   This configuration is private; application users and service API roles cannot
   change it. New patients are marked as clinical and investigation outcomes as
   non-simulated. New consent events use the configured document version.

3. Provision real staff Auth accounts and active profiles with their facility and
   role. Enroll privileged staff in MFA. Do not use the submission/demo accounts.
4. Configure the clinical project's server credentials privately, then set:

   ```dotenv
   WORKSPACE_MODE=clinical
   SCREENING_AI_MODE=disabled
   ```

   `build:render` sets the browser mode automatically. For a local/separate frontend,
   set `VITE_APP_MODE=supabase` and `VITE_WORKSPACE_MODE=clinical`, using the clinic's
   public URL and publishable key. Combining clinical mode with a local demo is
   rejected. Missing app configuration cannot silently open a local role switcher.

5. Complete clinic acceptance on actual devices: staff access, MFA, consent text,
   signatures, private photos/files, record assignments, camera/video, retention,
   and backup/recovery. Confirm the translated clinical text with native speakers.

Migration 010 alone retains evaluation mode on an existing test project. It does
not enable real-patient use. The clinical frontend refuses an evaluation database
before fetching patients; the clinical API also requires the matching database.

## Images and AI

Clinical pages show **Clinician image review**, without mock findings, model scores
or an automated AI step. Local focus, brightness and glare checks guide capture;
they do not run MedGemma, validate medical photographs or assess disease. The
camera's misleading MedGemma claims and aggregate heuristic score were removed.

The current Gemini Developer API terms prohibit clinical practice use; see
[Google's terms](https://ai.google.dev/gemini-api/terms), checked 30 October 2026.
Clinic approval does not change the provider's restrictions. Clinical API mode
disables every current AI adapter even if keys are present. The API checks patient
origin before sending image bytes, and the database rejects research analyses for
clinical records. Research reports retain their original provenance.

A future clinical inference provider requires permitted service terms, an
independently evaluated model, and the clinic's accepted validation and protocol.
An environment switch does not make the existing model clinically validated.

## Browser drafts

Health worker registration drafts and captured oral photographs are encrypted in
device storage and can be queued offline, including across reloads. Reconnect
with the same account to sync registrations before their dependent photographs.
Other clinical changes still require a connection. Sign-out removes the worker
snapshot and unfinished form; queued records remain available to the same account
after signing in online. See [Offline capture](OFFLINE_CAPTURE.md) for session
limits, storage boundaries, recovery and verification.

## Software verification

`npm test` includes an isolated PostgreSQL workflow for clinical registration,
signed review, diagnostic outcomes, consent version, origin immutability, mode
separation, MFA and audit checks. Provider tests assert that clinical photos never
reach research inference even when Gemini is configured.

The separate clinical browser build uses test URL
`https://clinicalfixture.supabase.co` and key `sb_publishable_clinical_fixture`.
Build with the clinical frontend settings into `test-results/clinical-dist`, then
run `npx playwright test --config playwright.clinical.config.ts`. All service
requests are intercepted. No real patient data or clinic credentials are used.
It checks page navigation, clinician wording, role controls, draft storage, offline
refusal and workspace mismatch. These checks are not a clinical validation study.
