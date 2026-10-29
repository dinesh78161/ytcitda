# Nine-step patient journey

For the local fallback, explicitly select demo mode so an existing Supabase `.env`
does not change the walkthrough:

```powershell
npm ci
$env:VITE_APP_MODE='demo'
npm run dev:all
```

Then open http://127.0.0.1:5174.
No accounts or external providers are required for the local synthetic demonstration.
Choose roles from the demo selector. Existing demo records persist across reloads.

| Step               | Action                                                                                                                                                | Expected result                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Register        | As Health worker, register a synthetic person and record screening and photo consent.                                                                 | One patient and screening, with the nine-step journey visible on the patient record.                                                        |
| 2. Oral photos     | Open Oral photographs; upload an educational/synthetic image.                                                                                         | Decoded image saved locally and linked to the screening.                                                                                    |
| 3. Quality         | Try a flat image, then a clear synthetic pattern.                                                                                                     | Retake guidance for the flat image; acceptable-quality state for the pattern. This tests software behavior, not clinical image suitability. |
| 4. Experimental AI | Run mock AI on the acceptable image.                                                                                                                  | Explicit mock result. The journey says “Mock result recorded”; it never claims a real prediction. AI may be skipped.                        |
| 5. Officer review  | Switch to Medical Officer, open the patient and sign independent findings with the referral decision.                                                 | Signed review, referral and navigator follow-up task.                                                                                       |
| 6. Consultation    | Open the journey's Consultation step, book a future in-person slot, then simulate attendance and complete the follow-up task.                         | Status progresses from appointment booked to assessed. Video requires the configured provider.                                              |
| 7. Diagnostics     | In Care plan, create a biopsy/histopathology investigation, progress through stages, attach a synthetic PDF/JPEG report and mark reviewed with notes. | Outstanding results stay visible as diagnostics pending; reviewed results remain in history.                                                |
| 8. Treatment       | Save a plan as active. Select the saved treatment and record completed with progress notes.                                                           | Append-only events record the course. Closing remains disabled while treatment is active.                                                   |
| 9. District view   | Select Case closure in Clinical decisions, enter the rationale and close. Switch to District admin and open District reports.                         | Closed-case count and stage distribution update; patient identifiers are unavailable to the admin. CSV includes stage totals.               |

Reload the patient to verify persistence. As a clinician, enter a rationale and
choose Reopen case to resume care without erasing history. If diagnostics or
treatment are unnecessary, record a signed “Not required” decision in the matching
decision area. Outstanding procedures cannot be bypassed with that choice.

For routine review without a specialist referral, choose Follow-up and a future
date. The patient's consultation tab shows the navigator task; it must be resolved
before closing. Missed appointments create a separate follow-up task. Rescheduling
replaces pending reminders, while cancellation stops pending delivery.

## Offline and mobile checks

Keep `VITE_APP_MODE=demo` set in the terminal, build with `npm run build`, then
`npm run preview` and visit http://127.0.0.1:4173
once online. Disconnect, register a synthetic patient, reload, reconnect, and verify
one patient record. The app shell and fonts are cached. Cloud registration needs an
existing session and server acknowledgement on reconnect; private cloud records
are not cached for offline reading. Test Android camera and installation on a real
device separately. The automated mobile checks use a 390 px browser viewport.

## Integration acceptance

Apply all six migrations from [Supabase setup](SUPABASE_SETUP.md). Follow
[integration setup](INTEGRATIONS.md) to configure private storage and LiveKit video.
The hosted mock adapter requires no external model; a version-pinned research endpoint
and external reminder delivery are optional. Keep service
keys in `.env.server`; browser configuration contains only the publishable key.
Unconfigured services display unavailable states and cannot report live success.
Verify separate assigned/unassigned accounts, two-device calls, private report access,
consent withdrawal and model failures against the actual providers before using them.

## Automated evidence

`npm test` executes PostgreSQL permission/RPC tests and local workflow/API contract
tests. `npm run build` checks TypeScript and builds the PWA. After building,
`npm run test:e2e` exercises Edge, including the complete journey, closure/reopening,
offline registration, photo quality, report downloads, treatments, reminders,
Telugu and mobile layouts. Screenshots and failure traces are under `test-results/`.

The demo uses synthetic records only. The application includes no trained lesion
model, and the quality heuristics are not clinically calibrated. See the
[test report](TEST_REPORT.md) for executed hosted checks and pending acceptance steps.

## Record the deployed patient journey

The opt-in hosted browser test records one continuous browser video across the
worker, Medical Officer, navigator, specialist and district administrator roles.
It creates a clearly labelled synthetic case, uploads a synthetic image/PDF,
verifies persistence and access restrictions, and closes the retained audit fixture
after testing reopening. It uses actual deployed pages, database and Storage.
Attendance is simulated; this test does not exercise physical devices or video calls.

Configure the existing ignored `.env.server` first, then run:

```powershell
npx playwright install ffmpeg
Remove-Item Env:HOSTED_TEST_LOCAL_API -ErrorAction SilentlyContinue
$env:DEPLOY_URL='https://aarogya-drishti-om9g.onrender.com'
$env:RUN_HOSTED_JOURNEY='1'
$env:JOURNEY_RECORDING_DIR='test-results/my-production-recording'
npm run test:hosted:browser -- --grep 'record the complete production patient journey'
```

Choose a fresh recording directory for each run. The output includes
`production-patient-journey.webm`, milestone screenshots and `journey-result.json`.
Recordings capture the screen without narration. Read the outcome field before
calling a recording successful; a failed run is still retained for diagnosis.

To record the separate existing two-browser LiveKit check, set
`RUN_HOSTED_VIDEO=1` and `RECORD_HOSTED_VIDEO_DIR` to a fresh directory, then filter
the hosted browser command with `--grep 'two assigned users exchange live video'`.
The directory receives `livekit-worker.webm` and `livekit-specialist.webm`.
The provider transport is real, with generated camera/audio sources. Run hosted
tests sequentially: concurrent generation of one-time sign-in tokens for the same
synthetic account can invalidate another test's pending token. No test resets
staff passwords or bypasses enrolled MFA; fresh codes belong in `.env.acceptance`.
