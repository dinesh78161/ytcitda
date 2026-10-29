# Production retest and recordings ? 29 October 2026

**PASS after deploying treatment fix 8c46521.**
Production: https://aarogya-drishti-om9g.onrender.com/.
The complete five-role browser journey passed on the actual deployed site, with
hosted Supabase records and private Storage. No browser page errors occurred.

| Check                        | Result                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Release identity             | Public bundle matches the isolated approved build, SHA-256 verified.                                                          |
| Release gate                 | All 81 tests in the production-baseline checkout and the production build passed; 27 PWA entries.                             |
| Development gate             | All 88 tests passed, including separate pending security work; that security work was excluded from deployment.               |
| Registration and persistence | Consent, one patient/screening, reload and nine-step journey passed.                                                          |
| Private photos and AI        | Actual image upload, acceptable prototype quality and persisted labelled mock AI passed.                                      |
| Review and assignment        | Signed independent clinician referral and specialist access assignment passed.                                                |
| Consultation and follow-up   | Navigator booking, simulated attendance and follow-up completion passed.                                                      |
| Diagnostics and reports      | Requested/collected/reported/reviewed stages and private PDF upload/download with matching bytes passed.                      |
| Treatment                    | Creation returned HTTP 200; active treatment blocked closure; completion retained both progress events.                       |
| Closure and reopening        | Closure survived reload; reopening retained history; the case was closed again.                                               |
| District reporting           | Updated closed totals, CSV export and absence of identifiable patient access passed.                                          |
| Public smoke                 | Frontend, assets, API, protected paths and PWA resources passed after deployment.                                             |
| LiveKit after deployment     | Both browsers received video frames; mute, camera-off and leave passed. Worker connected in 5,736 ms; specialist in 5,337 ms. |

## Deployment

The user approved the targeted fix. GitHub device sign-in completed, and
commit 8c46521315a5042430626196714e440c6f0c1544 was pushed to main as a fast-forward from
942f5b0. Render deployed it. The public entry /assets/index-CXSDewZe.js
matched the isolated build at 2026-10-29T06:44:15.877Z.

The release changes only src/CarePanels.tsx and the PostgreSQL regression in
tests/database-care.mjs. New treatments now send a null optional UUID, while
updates retain their saved UUID. Pending MFA/security work remains outside this
release; no database migration was run.

## Recordings and evidence

The final package is in the workspace's .artifacts/production-end-to-end-2026-10-29/.
Watch production-patient-journey.webm first; livekit-worker.webm and
livekit-specialist.webm show the separate successful provider call. Recordings are
silent browser captures. Captions identify the patient-flow role and stage.
The package includes results, milestone screenshots, dated logs and SHA-256 hashes.

Raw evidence: test-results/production-rerun-2026-10-29/.

- journey-attempt-7/: passing production recording, stage times and HTTP 200 treatment response.
- livekit-attempt-4/: passing post-deployment call recordings.
- hotfix-deployment-identity.json and post-fix-deployment-smoke.log: deployed release verification.
- hotfix-isolated-unit.log and hotfix-isolated-build.log: exact release checks.

Retained closed browser case: Synthetic Recorded Journey 161b9133, patient ID 39ba8fb8-3efc-4045-b71d-de169a430322.
Passing post-deployment video fixture: 61e8e751-5696-4c89-9ddb-989610138979.
Earlier hosted API acceptance fixture: 5b0964cd-8137-4dae-a361-33e3ae449b60.

## Earlier failure and limits

Before the fix, the deployed treatment form submitted an empty UUID and received
PostgreSQL 22P02. The earlier API test omitted that field and missed the UI defect.
The failed recording remains in journey-attempt-6/ and the separate historical
production-retest-2026-10-29 package. Earlier setup/selector failures are also
retained. Aborted synthetic fixtures were finalized with explicit failed-test
rationales and retained audit history; they are not counted as successful tests.
The corrected candidate build passed first, then the deployed production run passed.

Only synthetic records were used. Attendance was simulated. Camera/audio input for
the actual LiveKit transport was generated, so physical devices and audible speech
were not verified. Authentication used temporary sessions for existing synthetic
accounts; normal team-held passwords were not tested and existing MFA was not
bypassed. AI was explicitly mock and external reminders were disabled. The pending
MFA rollout and physical-device acceptance remain separate work.
