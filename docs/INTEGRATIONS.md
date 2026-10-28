# Live service configuration

The local demonstration works without credentials. Live integrations are implemented but disabled until configured. No Supabase project, video account, delivery provider or trained model is included or provisioned. Use synthetic data only.

## Run both servers

Requires Node 24+. Run `npm ci`, then `npm run dev:all` from the repository root.
The web app uses **http://127.0.0.1:5174** and the API listens on **http://127.0.0.1:8787**.
Alternatively run `npm run dev` and `npm run dev:api` in separate terminals.
`npm run preview` serves a production build on port 4173 and also proxies `/api` to 8787.
For hosting, deploy the static build and Node API behind the same HTTPS origin, forwarding `/api/*` to the Node process. Set `APP_ORIGINS` to that origin and keep the API behind the proxy. Vite's proxy is for local development/preview only.

## Supabase and private files

1. Follow [Supabase setup](SUPABASE_SETUP.md), including migrations **202610270004_care_workflows.sql** and **202610280005_patient_journey.sql**. Existing projects apply only unapplied migrations; never re-run the first schema migration.
2. Copy `.env.example` to `.env`, set `VITE_APP_MODE=supabase`, project URL and publishable key.
3. Copy `.env.server.example` to `.env.server`. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and a server-only `SUPABASE_SECRET_KEY` with service-role privileges. No secret may have a `VITE_` prefix.
4. Restart both servers, sign in as provisioned staff, then use Workspace settings → Check connections. “Configured” reports the presence of configuration; it does not prove credentials or the hosted services are healthy.

The API verifies the access token with Supabase Auth, checks active staff role and patient assignment, and requires the latest consent. Files remain in private buckets. Images are decoded, bounded to 4 megapixels, re-encoded without source metadata, hashed and quality-checked on the server. The browser normalizes larger supported images to JPEG before sending them. The quality check is a prototype; it is not a calibrated medical quality assessment.

Reports support JPEG and unencrypted PDFs up to 10 MB / 100 pages. PDFs are parsed and reject script/action/embedded-file structures. This is not a malware-scanning service. Reports download as attachments; images are not public. Upload metadata and the verified uploader's audit entry are committed atomically through a service-only RPC. Failed commits trigger object cleanup. A process crash between object upload and metadata commit can leave an orphan object; reconcile storage against metadata before operational deployment.

Downloads require current consent and assignment, write an access audit, then issue a 60-second download URL. Withdrawing consent blocks new access; an already issued URL may work until its expiry. Existing local demo data is kept in IndexedDB and is not encrypted. Do not enter real patient information.

## Video consultation (Daily)

Set `DAILY_API_KEY` on the API server. Configure the Daily domain to disable recording and transcription by default. The application does not request either, hides recording controls and issues non-owner tokens.

Book a video appointment, record separate teleconsultation consent in the patient's record, then use **Join consultation** from an assigned health-worker, Medical Officer or specialist account. The health worker can assist the patient from their device; the specialist signs in on a second device. Navigators can schedule but cannot join clinical calls.

The API creates a private room keyed to the appointment and scheduled time. Join access opens 15 minutes before the appointment and ends 15 minutes after its end. Tokens are scoped to that room and expire at that boundary; the room also expires. Rescheduling produces a different room. Cancellation/withdrawal blocks new tokens, but an already admitted participant is not forcibly removed immediately; the configured expiry still applies. Provider-side revocation is required for immediate in-call removal.

The meeting opens inside the app and requests browser camera/microphone permission. Closing the consultation removes the embedded call. Actual two-device calls require provider credentials and must be verified before use.

Provider contracts: [Daily private rooms](https://docs.daily.co/reference/rest-api/rooms/create-room), [meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token).

## Research oral-screening model

Set `SCREENING_MODEL_URL` to an HTTPS POST endpoint, `SCREENING_MODEL_KEY`, and `SCREENING_MODEL_VERSION` to the exact deployed version. Redirects are rejected and requests time out after 30 seconds.

The endpoint receives `Authorization: Bearer <server-only key>` and JSON:

```json
{
  "image_base64": "<JPEG bytes in base64>",
  "mime_type": "image/jpeg",
  "model_version": "your-evaluated-version"
}
```

It must return:

```json
{
  "model_version": "your-evaluated-version",
  "label": "review_required",
  "score": 0.82
}
```

The score must be a finite number in [0, 1], the label must contain 1–120 characters, and the version must match. Only stored images with acceptable quality and current photo consent are sent. No name, phone number or patient ID is included in the model request. Invalid responses fail without creating a result. Stored analyses are research-only and always require independent clinician review. There is no automatic referral, diagnosis or treatment decision.

**No trained lesion detector or evaluated dataset is supplied.** Demo mode remains explicitly mock; cloud mode never substitutes the mock when a service fails. Connecting an arbitrary classifier does not establish medical accuracy. Supply licensed data, held-out evaluation, calibration and model documentation before presenting lesion-detection performance.

## Reminders

Booking and rescheduling automatically create a reminder due 24 hours before the appointment (or immediately if closer). Rescheduling cancels previous pending reminders; attendance/cancellation stops pending delivery. In-app reminders and `.ics` calendar downloads work locally without a provider. “Mark contacted” records staff acknowledgement, not successful SMS delivery.

For automatic external delivery, configure an HTTPS `REMINDER_WEBHOOK_URL`, a server-only `REMINDER_WEBHOOK_KEY`, and explicitly set `REMINDER_DELIVERY_ENABLED=true`. The running Node API checks every minute. It claims up to 25 due jobs using database leases, retries failures after 15 minutes and stops after five attempts. Only future active appointments are eligible. A missing contact number causes a failed attempt.

The provider receives bearer authentication and this JSON contract:

```json
{
  "idempotency_key": "<reminder UUID>",
  "to": "<patient contact number>",
  "language": "te",
  "template": "appointment_reminder",
  "starts_at": "2026-11-01T04:30:00.000Z"
}
```

Return `{"accepted":true}` only after durably accepting the message. The provider **must deduplicate by idempotency_key**, since a network failure can occur after delivery acceptance. Names, diagnoses and photographs are excluded. “Sent” means provider acceptance; final delivery receipts are not implemented. The scheduler needs the Node process to remain running; it is not a browser background task. A reschedule racing an already dispatched request cannot recall that message.

## Verification and remaining live checks

`npm test` exercises the local database/RLS, workflow transitions, file decoding, model contract, video access window and HTTP guards. `npm run build` checks types and builds the PWA. `npm run test:e2e` starts local API/preview servers and tests Microsoft Edge, including offline retry, treatment/report persistence, rescheduling and outreach aggregates.

Hosted Auth, PostgREST/Storage permissions, provider video calls, reminder delivery and model inference still require real configured services. Test with at least two accounts on separate devices. Real Android installation/camera, MFA, backup/restore, assignment administration and clinical validation remain outside the local checks.

Implementation references: [Supabase token verification](https://supabase.com/docs/reference/javascript/auth-getuser), [private downloads](https://supabase.com/docs/guides/storage/serving/downloads), [JPEG decoding](https://github.com/jpeg-js/jpeg-js), [PDF parsing](https://pdf-lib.js.org/docs/api/classes/pdfdocument).
