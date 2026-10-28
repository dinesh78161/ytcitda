# Jury submission and real-device acceptance

Demo URL: https://aarogya-drishti-om9g.onrender.com/

Use [HANDBOOK_CHECKLIST.md](HANDBOOK_CHECKLIST.md) as the honest completion record.
The team must understand and explain the implementation, as required by the handbook.

## Accounts

| Existing synthetic test account | Role                   |
| ------------------------------- | ---------------------- |
| worker@aarohanytc.in            | Health worker          |
| doctor@aarohanytc.in            | Medical Officer        |
| specialist@aarohanytc.in        | Specialist             |
| navigator@aarohanytc.in         | Navigator              |
| admin@aarohanytc.in             | District administrator |

Passwords remain the values chosen in Supabase. Share jury credentials through a
private channel; never commit them. Each account requires an active profile and
appropriate patient assignments. The public app provides actual login, not a demo
role selector. Disable/rotate test access after the event.

## Five-minute recording

1. 0:00–0:30: show the deployed HTTPS URL, Telugu switch and synthetic-only purpose.
2. 0:30–1:20: worker registers a synthetic resident of G. Madugula, consent/checklist,
   then shows a rejected blurry/flat fixture and accepted synthetic photo.
3. 1:20–2:00: run labelled mock AI, then sign in as Medical Officer and independently
   review/refer. State that no medical prediction was made by the mock.
4. 2:00–2:40: join the same video appointment from the worker and specialist devices,
   showing both camera streams and microphone controls. Use synthetic participants only.
5. 2:40–3:40: show attendance, simulated pathology PDF, clinician diagnosis, treatment
   progress, follow-up completion and case closure/reopening.
6. 3:40–4:20: admin shows aggregates and CSV; explain the lack of identifiable rows.
7. 4:20–5:00: show offline registration recovery, test evidence, limitations and contributions.

For the ten-minute live version, follow [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md). Include
one unauthorized-access rejection, `SCREENING_AI_MODE=disabled` recovery, and a
reschedule/expired-token example. Do not claim a live provider call if only mocked
provider tests were run.

## Real Android checks (team must execute and record)

1. Open the Render HTTPS URL in current Android Chrome; sign in as worker.
2. Install/Add to Home screen and reopen the standalone app. Confirm the icon,
   Telugu fonts, 44px controls and mobile navigation are readable.
3. Grant camera access and capture a synthetic/appropriately licensed demo target.
   Check retake guidance and a second accepted image. Do not photograph a real patient.
4. Open once online, then enable airplane mode. Save one new synthetic registration,
   close/reopen, verify the draft remains, reconnect, and verify exactly one server record.
5. Reconnect twice; verify timestamps/UUID and that no duplicate screening appears.
6. Join a scheduled video call with a second authorized account on a laptop. Confirm
   both sides' audio/video, mute, camera off and leave. Revoke teleconsultation consent
   and confirm new joins fail; test expiry/rescheduling as described in integrations.
7. Complete the case and compare aggregate dashboard counts. Save dated evidence
   naming the phone/browser versions and any observed failure.

Desktop browser tests with fake cameras and a mobile viewport cannot certify real
Android installation, camera permissions, microphone quality or mobile-network behavior.

## Package checklist

- Repository with lockfile, migrations, seed and ignored-secret templates.
- [Architecture and ER diagram](ARCHITECTURE.md), [API/OpenAPI](API_CONTRACT.md),
  [model/data card](MODEL_AND_DATASET_CARD.md), [security/recovery](SECURITY_AND_RECOVERY.md).
- [Executed test report](TEST_REPORT.md), screenshots under ignored `test-results/`,
  deployment runbook, private test credentials and local fallback.
- Team-owned five-minute video and completed real-device/restore evidence.

## Contribution and assistance disclosure (team to complete)

Record each student's name, center, role, implementation/review/testing work and
the commits or files they can explain. Do not invent contributors or claim human
review that did not happen. Disclose AI-assisted code/documentation and the tools
actually used, including Codex/ChatGPT for this work. Record third-party packages
and any reused templates/assets with their licenses. Existing project dependencies
are locked in `package-lock.json`; LiveKit SDKs are Apache-2.0. Licensed photographs,
if added for the event, need their own provenance entries.
