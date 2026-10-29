# Executed test report

Date: 28 October 2026 (Asia/Kolkata). Windows, Node 24.13.0 and Microsoft Edge.
Render URL: https://aarogya-drishti-om9g.onrender.com/

## Latest production browser retest — 29 October 2026

**PASS after deploying `8c46521`:** the complete five-role browser journey passed
on production, including new treatment creation, active-treatment closure blocking,
completion, closure/reload, reopening/reclosure and district CSV/privacy. The
post-deployment two-browser LiveKit test and public smoke checks also passed.
The public bundle matches the approved isolated build. All 81 release-baseline
tests and the build passed; the development workspace's 88-test gate also passed.
The earlier empty-UUID treatment failure is resolved by the deployed targeted fix.
See [the current retest and recordings](PRODUCTION_RETEST_2026-10-29.md).

## Security and recovery follow-up

The subsequent source update adds privileged MFA and encrypted recovery tooling.
The baseline release evidence below remains historical. New executed results:

Rechecked on **29 October 2026 (Asia/Kolkata)**: all 87 unit/database/API
tests and both MFA browser checks passed, and the production build completed with
27 PWA cache entries. The unit run repeated the encrypted isolated restore.
Evidence: `test-results/continuation-unit-2026-10-29.log`,
`continuation-build-2026-10-29-retry.log`, and
`continuation-mfa-browser-2026-10-29.log`. The initial build was blocked by
sandbox child-process permissions; the successful retry used process access.
This rerun made no hosted database changes and did not redeploy the application.

| Check                                  | Observed result                                                                                                                                 | Evidence                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Full unit/database/API gate            | 87 passed, 0 failed                                                                                                                             | `test-results/remaining-build.log`             |
| PostgreSQL policy and recovery suite   | 47 passed, including AAL1 denial, AAL2 access, protected wrappers and encrypted snapshot restoration                                            | `test-results/mfa-database.log` / build log    |
| MFA browser checks                     | 2 passed; enrollment is explicit, wrong code stays blocked, no clinical reads before verification, valid code opens workspace                   | `test-results/mfa-browser.log`                 |
| Demo/offline browser regression        | 9 passed                                                                                                                                        | `test-results/remaining-e2e.log`               |
| Actual hosted Auth MFA                 | Passed using a temporary synthetic account; password sign-in, wrong-code rejection, TOTP enrollment and AAL2 promotion                          | `test-results/security/hosted-mfa.json`        |
| Updated API assurance guard            | Real AAL1 token denied, same account's AAL2 token accepted                                                                                      | Hosted MFA report                              |
| Encrypted isolated PostgreSQL recovery | All 20 application tables, nonempty retry ledger and policies restored; replay did not duplicate data; external synthetic blob checksum matched | `test-results/recovery/restore-rehearsal.json` |

The real Auth fixture was removed without changing existing staff passwords or
authenticators. Its report explicitly records that the hosted database MFA
migration was not yet installed at test time. The browser tests isolate the UI with
mocked provider responses; the separate hosted test exercises actual Supabase Auth.
The recovery run uses embedded PostgreSQL and stubbed Auth/Storage schemas; it is
not a hosted-project disaster-recovery acceptance result.

Normal sign-in for the five team-held passwords is awaiting those private values.
The supplied `test:passwords` check was run and stopped before any sign-in attempt
because `.env.acceptance` was absent. `db:security` stopped before making a request
because owner access was absent. See [SECURITY_UPDATE.md](SECURITY_UPDATE.md) for the
concrete rollout path and remaining physical-device/team tasks.

## Baseline release verification — 942f5b0

The release handoff reran the checks below against the public Render origin on
28 October 2026. `HOSTED_TEST_LOCAL_API` was cleared. Logs and hash evidence are in
`test-results/release-2026-10-28/` and the handoff archive's `evidence/` directory.

| Check                               | Final observed result                                                                                                                    | Evidence file                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Production prebuild gate            | 80 passed, 0 failed                                                                                                                      | `build-render.log`                                                           |
| Production build                    | TypeScript, Vite and 27-entry PWA cache passed                                                                                           | `build-render.log`                                                           |
| Public deployment identity          | Homepage and all 27 cached files match the local release bytes; service worker differs only in cache-entry order                         | `deployment-identity.json`                                                   |
| Public API schema/configuration     | Source-matching OpenAPI 3.1, five documented routes; files/database configured, LiveKit and mock AI enabled, external reminders disabled | `deployment-identity.json`                                                   |
| Hosted database                     | 20/20 application tables accessible                                                                                                      | `database.log`                                                               |
| Public smoke and hosted permissions | Five roles, private buckets and anonymous/admin restrictions passed                                                                      | `hosted-readonly.log`                                                        |
| Public desktop/mobile login         | 1 browser test passed, no page errors or horizontal overflow                                                                             | `production-browser.log`                                                     |
| Public five-role workspaces         | 1 browser test passed covering all five roles                                                                                            | `hosted-browser-before-fix.log` (the separate video test failed in this run) |
| Public two-user LiveKit call        | 1 browser test passed, both sides received video frames; mute, camera-off and leave passed                                               | `hosted-video.log`                                                           |
| Complete hosted write acceptance    | Passed through Render with actual hosted DB/Storage                                                                                      | `hosted-write.log`                                                           |

The video check initially failed because its connection assertion used the default
five-second timeout. The targeted assertion now waits up to 30 seconds, matching
the existing media checks. In the passing run, the worker connected in 4,834 ms
and the specialist in 5,557 ms. The test still requires real received video frames;
generated media only replaces physical camera/microphone capture. A fixture is now
marked completed only after the control and leave assertions also succeed.

Retained synthetic fixtures from this verification:

- Full workflow: `36970d07-d464-47e9-99ef-195f8dbff706`, closed with audit history.
- Passing video: `c684dbad-c29f-407e-9385-f00c83837eed`, closed with audit history.
- Initial video timeout: `ba04e0a1-19f0-4690-b1b0-df71bf4690bc`, appointment cancelled
  and fixture closed; not counted as a successful consultation.

The browser checks use temporary sessions for the documented synthetic accounts.
They do not verify the team-held passwords. Manual password sign-in and physical
Android/camera/audio acceptance are recorded separately in [SUBMISSION.md](SUBMISSION.md).
Only tests/documentation changed during this handoff; deployed application source
remains release `942f5b0`. Initial sandbox attempts blocked build/browser child
processes; the reported successful runs used the authorized process-capable environment.

## Earlier development checks

| Check                                    | Observed result                                                                      | Scope                                                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` / production prebuild gate    | 80 passed, 0 failed                                                                  | PostgreSQL/RLS/RPC, demo workflows, file validation/retry, provider/token contracts, production HTTP guards                                                                                                                                       |
| `npm run build:render`                   | Passed, including automatic `prebuild:render` test gate                              | TypeScript, production assets and PWA                                                                                                                                                                                                             |
| Demo build + `npm run test:e2e`          | 9 passed                                                                             | Registration through closure/reopening, offline retry, bilingual mobile layouts, images, reports, treatment and reminders                                                                                                                         |
| `npm run test:production`                | 1 passed                                                                             | Updated local production login/assets/API, anonymous upload rejection, environment-file protection and mobile layout                                                                                                                              |
| `DEPLOY_URL` + `npm run test:production` | 1 passed                                                                             | Baseline deployed Render login, assets, API and mobile layout                                                                                                                                                                                     |
| `npm run test:deployed -- <Render URL>`  | Passed                                                                               | Baseline live frontend/assets/status, private paths, unauthorized upload, manifest/service worker                                                                                                                                                 |
| `npm run db:check`                       | Server credentials verified; 20/20 tables accessible                                 | Actual hosted Supabase, no migrations or seeds rerun                                                                                                                                                                                              |
| Hosted role checks                       | Five roles authenticated; expected clinical/admin restrictions verified              | Actual Auth and RLS; private buckets confirmed                                                                                                                                                                                                    |
| Hosted browser role test                 | 1 passed covering all five staff roles                                               | Updated local app with actual hosted user sessions; no demo-role selector, no admin patient rows                                                                                                                                                  |
| Hosted `--write` acceptance              | Passed                                                                               | Updated local API with hosted DB/Storage: one fixture, retry-safe registration/photos/reports, mock AI, review/referral, assignment, reschedule, attendance, investigation, treatment, follow-up, consent withdrawal, close/reopen and aggregates |
| LiveKit project credentials              | Verified using provider room-list API                                                | Actual free project, secrets never printed                                                                                                                                                                                                        |
| Two-user LiveKit media test              | 1 passed; both participants received video frames; mute, camera-off and leave passed | Actual free LiveKit project, two independent browsers and generated synthetic camera/audio streams                                                                                                                                                |

The hosted acceptance fixture `8459c99b-017a-4c83-8a04-81d9a41716cc` is retained
closed with its audit trail. Video fixtures are also clearly labelled; failures are
cancelled and closed, not reported as completed consultations. Unit tests use an
isolated PGlite database and never reset hosted data. Authenticated checks generate
short-lived sessions for existing documented demo users; they send no email, do not
reset passwords and sign out only their own test sessions. No auth-state files or
video-test traces are saved.

The initial two-user tests exposed unreliable shared fake-device capture in Edge.
The final passing run used independent generated media sources while preserving the
real SDK, room authorization and provider transport. This verifies integration and
rendered video reception, not physical camera/microphone quality or a mobile network.

## Post-release Render verification

Release `942f5b0` was pushed to GitHub `main` and deployed by Render on 28 October 2026.
The live `/api/status` reports `video_provider=livekit` and `ai_provider=mock` with
database/files configured and external reminder delivery disabled. The published
OpenAPI 3.1 document responds with HTTP 200 and describes all five integration routes.

The production browser check passed against the deployed HTTPS URL. The full hosted
`--write` acceptance also passed directly through Render, including real Storage
upload/download and replay protection. Fixture `7a81d853-1467-4b72-9847-ffcb25d9d682`
was retained closed with audit history. No loopback API override was used for that run.
The table's baseline checks are historical; this release adds successful public-URL
verification of the updated API and mock pipeline.

## Repeatable commands

From the repository root:

```powershell
npm test
npm run build:render
npm run test:production
npm run db:check
npm run test:deployed -- https://aarogya-drishti-om9g.onrender.com
npm run test:hosted -- https://aarogya-drishti-om9g.onrender.com
```

For the complete hosted write acceptance, add `--write` to `test:hosted`. This
deliberately creates and retains one new synthetic record with its audit history.
Use only the synthetic demonstration project. Read-only is the default for records;
authentication checks still create/revoke their own temporary test sessions.

For actual deployed browser checks:

```powershell
$env:DEPLOY_URL='https://aarogya-drishti-om9g.onrender.com'
npm run test:production
npm run test:hosted:browser
# Explicit opt-in: creates a synthetic video fixture and uses provider minutes.
$env:RUN_HOSTED_VIDEO='1'
npm run test:hosted:browser -- --grep 'two assigned users'
```

To check a locally running production server against hosted Supabase, set
`HOSTED_TEST_LOCAL_API=http://127.0.0.1:4180`. This override only accepts an explicit
loopback port. It does not change the public deployed frontend's project-matching
check in `test:hosted`. Clear the override before claiming a Render acceptance run.

For offline demo browser tests, build with `VITE_APP_MODE=demo` and run `test:e2e`.
Rebuild with `build:render` before production testing. Screenshots are in ignored
`test-results/`; runner artifacts use separate demo/production/hosted directories.
Install a Playwright Chromium browser on non-Windows test machines.

## Evidence and remaining limits

Screenshots include journey/care-plan desktop/mobile views, Telugu mobile dashboard,
production login and five hosted staff workspaces. Video screenshots are retained
only when the frame assertions succeed. Build warnings report large minified chunks;
the video SDK is loaded in a separate chunk when the consultation opens.

Real Android camera/installability, a phone-to-laptop microphone/video check,
hosted rollout of privileged MFA, an actual hosted-project restore and provider-side
immediate in-call revocation remain separate acceptance items. Local MFA and
isolated PostgreSQL recovery passed as recorded above. External SMS and
trained-model accuracy are not tested or claimed. See [the handbook checklist](HANDBOOK_CHECKLIST.md).
