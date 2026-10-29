# Handbook implementation and acceptance checklist

Reference: AAROHAN Aarogya Drishti Detailed Open-Book Developer Handbook 2026,
13 pages. React/Node/Supabase is an allowed alternative stack (handbook page 3).

| Handbook requirement                                           | Implementation/evidence                                                                                                  | Status                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Consent, bilingual registration and clinical intake (pp. 2, 6) | Purpose-specific consent, tobacco/discomfort/notes, persistent drafts, duplicate warning limited to assigned records     | Implemented; browser and hosted RPC tests                                                                 |
| Guided oral views, decode/size checks and recapture (pp. 6–7)  | Five views; browser normalization; server decoding, checksum and quality gate                                            | Implemented; synthetic image tests                                                                        |
| Structured mock/research pipeline (pp. 6–8)                    | Server `mock-v1` with null score; optional pinned research adapter; explicit disabled mode                               | Implemented; provider tests and hosted mock fixture                                                       |
| Independent signed review/referral (pp. 2, 8)                  | Clinician-only RPC, immutable review, revision conflict, assignment updates                                              | Implemented; hosted journey                                                                               |
| Appointments and two-party video (pp. 8–9)                     | Booking/rescheduling/attendance, LiveKit or Daily access checks, time-limited tokens, embedded camera/microphone         | Token tests and actual LiveKit two-browser generated-media call passed; physical-device check pending     |
| Biopsy/pathology/diagnosis (pp. 5, 9)                          | Separate investigations, private reports, clinician notes                                                                | Implemented; hosted PDF upload/download                                                                   |
| Treatment, navigation and closure (pp. 5, 9)                   | Treatment history, pending/declined/lost-contact tasks, closure blockers, reopening                                      | Implemented; local and hosted journey                                                                     |
| District aggregates and patient privacy (pp. 8–10)             | Aggregate RPC and CSV; admin has no patient rows                                                                         | Verified for five hosted roles and in browser                                                             |
| Retry and offline recovery (pp. 8, 10)                         | Registration ledger, retained browser drafts, server acknowledgement, deterministic upload IDs                           | Local offline browser test; hosted registration/file retries                                              |
| Protected files/audit (pp. 9–10)                               | Private buckets, signed download URLs, actor-attributed upload/download/join/clinical audit                              | Hosted file checks; database negative tests                                                               |
| MFA for privileged staff (p. 9)                                | Authenticator UI, verified API assurance, migration 006 with 19 restrictive policies and guarded RPCs                    | Implemented; local/database/browser and real hosted Auth tests pass; hosted DB rollout needs owner access |
| Android installation/camera/offline (pp. 2, 8, 11)             | PWA, English/Telugu fonts, PNG install icons, responsive layouts                                                         | Desktop mobile-viewport tests pass; real Android acceptance pending                                       |
| Deployed test URL and health (p. 11)                           | Render frontend/API, public smoke and authenticated hosted commands                                                      | Release 942f5b0 verified: public assets/API, five roles, file round trip and LiveKit; see TEST_REPORT.md  |
| Backup/restore and fallback (p. 11)                            | Encrypted archive tools and executed isolated PostgreSQL restore with table hashes, retry ledger, RLS and synthetic blob | Local rehearsal passed; actual hosted-project restore needs isolated destination and backup access        |
| OpenAPI, cards, threats and submission (pp. 11?12)             | API contract, cards, security/recovery, test report, five-minute narrated product walkthrough                            | Included; team review, real contributions and physical-device evidence remain                             |

External SMS and a trained detector are not required for the handbook's mock
demonstration. A working secure two-user video demonstration is required. LiveKit
Build supplies a no-card provider option; it still needs a user-owned project.

No destructive migration or access-policy relaxation is needed for these changes.
Existing staff credentials and database schema are preserved. The hosted acceptance
script creates one explicitly labelled synthetic case only when `--write` is supplied;
it retains the completed record and its audit history.
