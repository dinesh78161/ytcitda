# Aarogya Drishti

AAROHAN 2026 screening-to-care **synthetic demonstration**, built with React,
TypeScript, Vite and Supabase PostgreSQL. Never enter real patient information.

## Run locally

Requires Node.js **24 or newer**.

```powershell
npm ci
npm run dev:all
```

Open **http://127.0.0.1:5174**. The API starts on port 8787. Without configuration, the app starts in local demo
mode with 12 synthetic patients. Changes stay in this browser. Use the role selector
at the top to explore the five workspaces; it is a demonstration, not authentication.

For the production build and offline behavior:

```powershell
npm run build
npm run preview
```

Open **http://127.0.0.1:4173** once while online. The production service worker caches
application assets and bundled English/Telugu fonts. Development mode does not
install the production service worker.

## Implemented

For hosting, follow [Deploy to Render](docs/RENDER_DEPLOY.md). The production Node
server serves both the frontend and API; use `npm run build:render` and `npm start`.

- Responsive English/Telugu dashboard, patient search and screening queue.
- Registration, consent and screening intake with device-local drafts.
- IndexedDB demo persistence, offline registration queue and reconnect retries.
- Demo educational-photo upload, decoded image validation, prototype exposure/blur
  checks, retake guidance and clearly labelled mock AI. No disease prediction.
- Independent clinician review, signed history, referrals and appointment booking.
- Attendance, missed-visit tasks, simulated diagnostic outcomes and follow-up.
- Investigation stages, PDF/JPEG reports, treatment plans and immutable progress history.
- Appointment rescheduling, cancellation, automatic in-app reminders and calendar downloads.
- Consent grant/withdrawal history, outreach event entry and follow-up completion metrics.
- Aggregate reports with CSV export and a separate district-admin view.
- Nine-step patient journey with direct actions, automatic care stages, signed optional-care
  decisions, closure checks and reopening with retained history.
- Supabase Auth integration, RLS-protected reads and atomic workflow RPCs with
  patient authorization, revision checks, audit attribution and idempotency.
- Configurable Node API for private validated files, Daily video rooms, reminder delivery
  and a version-pinned research model endpoint. Credentials are server-only.

## Connect Supabase

Follow [Supabase setup](docs/SUPABASE_SETUP.md). Apply all **five** migrations,
create the demo Auth accounts, and configure an ignored `.env`:

```dotenv
VITE_APP_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

For live files/video/model/reminders, also configure `.env.server` using
`.env.server.example` and [integration setup](docs/INTEGRATIONS.md).
Restart both servers after changing environment variables. Supabase mode uses actual login
and never silently falls back to demo on failure. The implemented RPCs do not need
a server secret in the browser. No hosted project has been created or modified.

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
These do not replace real Android or hosted Supabase validation.

Use the [demo runbook](docs/DEMO_RUNBOOK.md) to walk through the nine-step flow.

## Remaining work

- **Hosted Supabase is not configured or verified.** Supply your project settings,
  run the migrations, and test with separate user sessions.
- **Live integrations need configuration and verification.** Private file endpoints,
  Daily room/token creation and reminder delivery are implemented, but no hosted
  accounts or credentials are supplied. See [integration setup](docs/INTEGRATIONS.md).
- **No trained lesion detector is supplied.** Demo AI is a mock. Cloud analysis calls
  a configured model, validates its version/output, and never falls back to mock.
  Image quality remains an uncalibrated prototype. Research results require clinician review.
- Offline storage contains synthetic records only and is not encrypted by this app.
  Supabase offline registration requires an existing session and waits for server
  acknowledgement on reconnect. Background sync across all Android browsers is not
  guaranteed. Historical cloud records are not cached for offline reading.
- Staff assignment is administered through Supabase. A self-service administration UI,
  MFA deployment, backup/restore drills and immediate revocation of already issued
  provider tokens are outside this demonstration.

See [implementation notes](docs/IMPLEMENTATION.md). AI-assisted work must be
acknowledged for the hackathon; team members must understand and test the code.
