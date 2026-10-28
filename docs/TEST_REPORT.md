# Executed test report

Date: 28 October 2026 (Asia/Kolkata). Windows, Node 24.13.0 and Microsoft Edge.
Render URL: https://aarogya-drishti-om9g.onrender.com/

## Executed results

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

The public Render checks above describe the baseline release until the new source
is deployed. Updated private file/mock tests were run through the local updated Node
server against actual hosted Supabase. Repeat acceptance against Render after release.

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
privileged MFA enforcement, isolated backup/restore rehearsal and provider-side
immediate in-call revocation remain separate acceptance items. External SMS and
trained-model accuracy are not tested or claimed. See [the handbook checklist](HANDBOOK_CHECKLIST.md).
