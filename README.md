# Aarogya Drishti

AAROHAN 2026 screening-to-care workspace, built with React, TypeScript, Vite and
Supabase PostgreSQL. Clinical mode supports clinician-led records, consent, review,
referrals and follow-up. See [clinical activation](docs/CLINICAL_WORKSPACE.md).
Evaluation and local training retain test data and research-only AI.
For real-record AI assistance, see [clinical AI integration](docs/CLINICAL_AI.md)
and the [model selection and validation assessment](docs/CLINICAL_AI_VALIDATION.md).

Hosted pilot: https://aarogya-drishti-om9g.onrender.com/
For the 12 November presentation, follow the [live walkthrough](docs/LIVE_PRESENTATION.md).
Start with the [release handoff](docs/RELEASE_HANDOFF.md),
[handbook checklist](docs/HANDBOOK_CHECKLIST.md),
[test report](docs/TEST_REPORT.md), and [submission guide](docs/SUBMISSION.md).

## Run locally

Requires Node.js **24 or newer**.

```powershell
npm ci
npm run dev:all
```

Open **http://127.0.0.1:5174**. The API starts on port 8787. Configure `.env` for
Supabase sign-in; missing configuration does not open an unauthenticated workspace.
Set `VITE_APP_MODE=demo` explicitly for local training with 12 fictional patients.
Clinical mode requires `VITE_APP_MODE=supabase` and `VITE_WORKSPACE_MODE=clinical`.

For the production build and offline behavior:

```powershell
npm run build
npm run preview
```

Open **http://127.0.0.1:4173** once while online. The production service worker caches
application assets and bundled fonts for all nine languages. Development mode does not
install the production service worker.

## Implemented

For hosting, follow [Deploy to Render](docs/RENDER_DEPLOY.md). The production Node
server serves both the frontend and API; use `npm run build:render` and `npm start`.

- Responsive dashboard, patient search and screening queue in English, Telugu,
  Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, and Odia. See
  [language setup and Gemini reports](docs/LANGUAGES.md).
- Registration, consent and screening intake; clinical drafts stay in session memory.
- IndexedDB demo persistence, encrypted cloud screening/photo drafts and reconnect retries. See [Offline capture](docs/OFFLINE_CAPTURE.md).
- Oral-photo upload, decoded image validation, exposure/blur checks and retake guidance.
- A bundled MobileNetV3 oral-image classifier runs real CPU inference inside the
  Node service without an external model API. Its benign/malignant dataset-class
  predictions remain under validation and require independent clinician review.
- A separate mock provider remains available for workflow-only testing.
- Independent clinician review, signed history, referrals and appointment booking.
- Attendance, missed-visit tasks, clinician-entered diagnostic outcomes and follow-up.
- Investigation stages, PDF/JPEG reports, treatment plans and immutable progress history.
- Appointment rescheduling, cancellation, automatic in-app reminders and calendar downloads.
- Consent grant/withdrawal history, outreach event entry and follow-up completion metrics.
- Aggregate reports with CSV export and a separate district-admin view.
- Nine-step patient journey with direct actions, automatic care stages, signed optional-care
  decisions, closure checks and reopening with retained history.
- Supabase Auth integration, RLS-protected reads and atomic workflow RPCs with
  patient authorization, revision checks, audit attribution and idempotency.
- Configurable Node API for private validated files, LiveKit/Daily video, reminder delivery
  and a version-pinned research model endpoint. Credentials are server-only.

## Connect Supabase

Follow [Supabase setup](docs/SUPABASE_SETUP.md). Apply all **ten** migrations,
provision the appropriate staff accounts, and configure an ignored `.env`:

```dotenv
VITE_APP_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

For live files/video/model/reminders, also configure `.env.server` using
`.env.server.example` and [integration setup](docs/INTEGRATIONS.md).
Restart both servers after changing environment variables. Supabase mode uses actual login
and never silently falls back to demo on failure. The implemented RPCs do not need
a server secret in the browser. Hosted checks use the separately configured Supabase
project; they never install or rerun migrations automatically.

## Verify

```powershell
npm test
npm run build
npm run test:e2e
```

Database tests execute PostgreSQL in PGlite with stubbed Supabase Auth/Storage
schemas. Browser tests use installed Microsoft Edge in headless mode, start a
preview server, and require a current production build. On another OS, configure
an available Playwright browser in `playwright.config.ts`.

Tests cover the full guided journey through closure and reopening, registration persistence,
review/referral/booking/outcome, offline reload/retry, Telugu mobile layout, photo quality,
appointment conflicts, optional procedures, database permissions and admin restrictions.
For deployed checks, use `npm run test:deployed -- https://YOUR-SERVICE.onrender.com`.
With ignored `.env.server` configured, run `npm run test:hosted -- https://YOUR-SERVICE.onrender.com`
to verify the existing synthetic demo accounts and record permissions.
These do not replace real Android camera/installability checks or a two-device video call.

Use the [demo runbook](docs/DEMO_RUNBOOK.md) to walk through the nine-step flow.

## Remaining work

- **Real-device video acceptance remains.** LiveKit credentials and the actual
  two-browser generated-media path have been verified. Finish the phone-to-laptop
  camera/microphone check in [the submission guide](docs/SUBMISSION.md).
  External SMS is optional; in-app reminders and calendar downloads already work.
- **No trained lesion detector is supplied or required for the mock demonstration.**
  Hosted AI defaults to labelled `mock-v1` when no research endpoint is configured.
  `SCREENING_AI_MODE=research` requires a version-pinned provider and never falls back to mock.
  Image quality remains an uncalibrated prototype. Research results require clinician review.
- Cloud offline capture encrypts health worker drafts, queued photographs and a
  limited snapshot of their own screening records. It requires a current login;
  sync waits for server acknowledgement. Local demo storage is unencrypted.
  Background sync while the app is closed is not provided. See the
  [offline storage limits and recovery steps](docs/OFFLINE_CAPTURE.md).
- Staff assignment is administered through Supabase. A self-service administration UI
  and immediate revocation of already issued provider tokens remain pending.
  Privileged MFA is implemented and tested in the updated source; migration 006
  requires project-owner rollout. Encrypted isolated PostgreSQL recovery passed;
  a hosted-project restore still needs a separate destination and backup access.
  See [the security update](docs/SECURITY_UPDATE.md).

See [implementation notes](docs/IMPLEMENTATION.md). AI-assisted work must be
acknowledged for the hackathon; team members must understand and test the code.
