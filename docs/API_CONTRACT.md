# API and data contract

The Node integration API is documented by [OpenAPI 3.1](../public/openapi.json),
available at `/openapi.json` after deployment. Use the same HTTPS origin as the app.
All POSTs require `Content-Type: application/json` and
`Authorization: Bearer <current Supabase user access token>`. Active staff, role,
patient assignment and current consent are checked independently on the server.

`GET /api/status` is public and reports configuration only. A true flag does not
prove that a provider, account, bucket or database is healthy. Hosted acceptance
checks verify actual authentication, reads, RPCs and file round trips separately.

## Auth and database workflows

Authentication uses Supabase Auth `signInWithPassword`, not a custom `/auth/login`.
The browser uses a publishable key and user token; the service secret never belongs
in the browser. Passwords are managed by Supabase, not this repository.

Records are read through Supabase's RLS-protected Data API, in pages of 500 with
stable ordering. The public schema contains 20 application tables; see
[Supabase setup](SUPABASE_SETUP.md) for roles, schema, storage and migrations.

Retryable clinical writes call `POST <SUPABASE_URL>/rest/v1/rpc/submit_workflow`:

```json
{
  "request_id": "f60ef2dc-6d98-4b4e-b4b3-a37b9e58909d",
  "action": "register",
  "payload": {
    "patient_id": "8a509619-3c14-43c0-9bce-fc3bdf81846d",
    "screening_id": "8dfe074a-98c8-4c25-85a6-5f956714814f",
    "display_name": "Synthetic Jury Resident",
    "age_years": 46,
    "village": "G. Madugula",
    "language": "te",
    "consent": true,
    "photo_consent": true,
    "tobacco": "never",
    "discomfort": false,
    "notes": "Synthetic demonstration"
  }
}
```

Also supply the Supabase publishable `apikey` header and current user's bearer token.
The request ledger returns the original result for an identical retry, and rejects
reusing an ID with changed content. Persist an ID until server acknowledgement.

| Action             | Essential payload                                                                          | Allowed actor                                            |
| ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `register`         | New patient/screening UUIDs, name/age/village/language, consent and history                | Health worker                                            |
| `consent`          | `patient_id`, `purpose`, `granted`, `language`                                             | Assigned worker/clinician                                |
| `review`           | `patient_id`, current `revision`, `findings`, `decision`; optional priority/follow-up date | Assigned clinician                                       |
| `appoint`          | `referral_id`, future `starts_at`, `mode`                                                  | Assigned clinician/navigator                             |
| `reschedule`       | `appointment_id`, `previous_starts_at`, future `starts_at`                                 | Assigned clinician/navigator                             |
| `attendance`       | `appointment_id`, allowed `status`                                                         | Assigned clinician/navigator                             |
| `investigation`    | `referral_id`, `kind`, `status`, notes; ID/previous status when updating                   | Assigned clinician                                       |
| `diagnosis`        | `referral_id`, simulated clinician diagnosis                                               | Assigned clinician                                       |
| `treatment`        | `referral_id`, `plan`, `status`, notes                                                     | Assigned clinician                                       |
| `treatment_update` | `treatment_id`, current `revision`, `status`, notes                                        | Assigned clinician                                       |
| `followup`         | `task_id`, `status` (`completed`, `declined`, `lost_contact`)                              | Assigned worker/clinician/navigator subject to DB checks |
| `care_decision`    | `patient_id`, current `revision`, category/decision, signed rationale                      | Assigned clinician                                       |
| `outreach`         | Synthetic event date/village, attendance/screening totals                                  | Staff permitted by workflow                              |

The SQL functions remain authoritative; unknown actions, forged actors, closed-case
edits and invalid transitions fail. `40001` indicates stale revisions; reload and
preserve the user's notes for deliberate resolution. `23505` can indicate request
ID reuse; do not silently generate a new ID for a failed retry. Permission errors
must not be worked around using the service secret in a client.

## Private files and video

Oral photos and reports use Node `/api/upload`, never direct browser bucket writes.
The browser supplies a stable file request ID. Replays check the original actor,
destination and normalized checksum. Downloads verify access, audit the request,
then return a signed URL valid for 60 seconds. Do not log or publish that URL.

`/api/video` issues a room-scoped token or provider URL after verifying a video
appointment. The app rechecks access during LiveKit calls. No public meeting link,
AI prediction or attendance event can authorize clinical diagnosis. See
[integration setup](INTEGRATIONS.md) for contracts and provider revocation limits.
