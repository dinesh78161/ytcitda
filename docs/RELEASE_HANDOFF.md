# Release handoff — 28 October 2026

**Follow-up:** the [security and recovery update](SECURITY_UPDATE.md) adds the
completed MFA implementation/tests, encrypted isolated restore rehearsal and
five-minute generated walkthrough. The original ZIP and baseline release evidence
below describe `942f5b0`; `Aarogya-Drishti-security-update-2026-10-29.zip`
contains the revised source, verification evidence and walkthrough.

The automated release verification is complete for the synthetic demonstration at
https://aarogya-drishti-om9g.onrender.com/. Application release: `942f5b0` in
https://github.com/dinesh78161/ytcitda. This handoff includes additional local test
and documentation changes, recorded in the archive's `handoff.patch`.

## Verified release

- Production build and all 80 database/workflow/API tests pass.
- The public homepage and all 27 cached assets match the rebuilt release. The
  service worker has equivalent content with a different cache-entry order.
- Public desktop/mobile login, all five authenticated workspaces and expected
  record/privacy restrictions pass. All 20 application tables are accessible.
- The full synthetic workflow passes through Render and hosted Supabase Storage,
  including upload/download retries, review/referral, appointments, investigations,
  treatment, follow-up, consent withdrawal, closure/reopening and district totals.
- A real LiveKit call between two independent browsers passes received-frame and
  microphone/camera/leave-control assertions using generated media. Connection
  readiness now has a bounded 30-second test wait; observed joins took 4.8/5.6 seconds.
- AI is explicitly `mock`; external reminder delivery is off. In-app reminders
  and calendar files remain available. The mock makes no disease prediction.

See [TEST_REPORT.md](TEST_REPORT.md) for exact scope, logs, retained fixture IDs and
historical checks. Earlier nine-test demo/offline results remain historical;
the handoff rerun focused on the published release.

## Start the presentation

1. Open the public URL before presenting and verify normal password sign-in using
   the privately held credentials for the five [submission accounts](SUBMISSION.md#accounts).
   Automated tests used temporary sessions and did not validate those passwords.
2. Follow the [five-minute recording outline](SUBMISSION.md#five-minute-recording)
   or [nine-step journey](DEMO_RUNBOOK.md). Use a new clearly labelled synthetic case.
3. For video, grant teleconsultation consent, book a video appointment near the
   current time and join the same appointment as assigned worker and specialist.
   See [integration instructions](INTEGRATIONS.md) for join-window and access rules.
4. Keep the [local demo fallback](SECURITY_AND_RECOVERY.md#fallback-if-hosting-is-unavailable)
   prepared on the presentation laptop. Use `VITE_APP_MODE=demo` explicitly when
   building it. A production Supabase build is not the local demo fallback.

## Remaining team work

| Work                                                             | Current status                                                                       | Completion record            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| Normal password sign-in                                          | Team verification needed                                                             | Submission acceptance record |
| Android install, real camera and offline retry                   | Physical device needed                                                               | Submission acceptance record |
| Phone-to-laptop camera/audio                                     | Physical devices needed; generated-media call passed                                 | Submission acceptance record |
| Five-minute recording, contributors and AI-assistance disclosure | Generated walkthrough ready; team review and real names/roles needed                 | Submission guide             |
| Backup/restore rehearsal                                         | Encrypted isolated PostgreSQL restore passed; hosted destination/access still needed | Security update              |
| Privileged MFA enforcement                                       | Implemented and tested; hosted database rollout needs owner access                   | Security update              |
| Immediate removal of already-admitted video clients              | Provider-side revocation remains pending                                             | Security/recovery runbook    |

Physical-device and team-password checks remain pending. MFA/recovery completion
has the precise local/hosted limits recorded in the security update.
This is a synthetic hackathon demonstration, not a clinical deployment.

## Archive contents

`Aarogya-Drishti-handoff-2026-10-28.zip` contains:

- `source/`: current source, lockfile, migrations, documentation and empty-secret
  environment templates. Run `npm ci` with Node 24+ after extracting.
- `evidence/`: dated build/API/browser logs, public asset hashes and screenshots
  from the release verification. The initial video-timeout log is retained beside
  the passing run so the test fix is traceable.
- `handoff.patch`: changes relative to application release `942f5b0`.
- `MANIFEST.sha256`: SHA-256 checksums for all packaged files except itself.
- `START_HERE.md`: entry point for the recipient.

Actual environment files, credentials, database dumps, dependency installs,
Git metadata and authenticated browser state are excluded. The archive is checked
against the locally configured server credential values before delivery.

The local raw evidence is under `test-results/release-2026-10-28/`; it is ignored by
Git. Keep the archive with the submission to preserve the evidence. The live app
does not require a redeployment for these test/documentation changes.
