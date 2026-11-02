# Supabase setup

## Create and migrate

Create a new dedicated project in the [Supabase dashboard](https://supabase.com/dashboard).
Keep its database password securely. These files assume a new project without
existing application tables or Storage policies.

For a new project, open [setup.sql](../supabase/setup.sql), copy the entire file into
SQL Editor, and run it as `postgres`. It includes all thirteen migrations and the facility
seed in one transaction. Run it once; it refuses to overwrite an existing application
schema. Regenerate the file after migration changes with `npm run db:prepare`.

Alternatively, execute each complete file in SQL Editor, in order (do not also run
the combined setup file):

1. [Initial schema](../supabase/migrations/202610260001_initial_schema.sql)
2. [Private storage](../supabase/migrations/202610260002_private_storage.sql)
3. [Authenticated workflow API](../supabase/migrations/202610260003_workflow_api.sql)
4. [Care workflows and integration API](../supabase/migrations/202610270004_care_workflows.sql)
5. [Patient journey, decisions and closure](../supabase/migrations/202610280005_patient_journey.sql)
6. [Privileged MFA enforcement](../supabase/migrations/202610280006_privileged_mfa.sql)
7. [Structured worker screening intake](../supabase/migrations/202610290007_screening_intake.sql)
8. [Vision-model image findings](../supabase/migrations/202610290008_image_findings.sql)
9. [Additional patient and consent languages](../supabase/migrations/202610290009_languages.sql)
10. [Clinical workspace and record separation](../supabase/migrations/202610300010_clinical_workspace.sql)
11. [Patient ABDM identifiers](../supabase/migrations/202610300011_patient_abdm_identifiers.sql)
12. [Anatomical subsites](../supabase/migrations/202610300012_anatomical_subsites.sql)
13. [Patient report staff names](../supabase/migrations/202611020013_patient_report.sql)
14. [Synthetic facilities](../supabase/seed.sql)

Apply only migrations that are not already applied. Migrations
run once in transactions; seeds are repeatable. Keep `app_private` out of the Data
API exposed schemas. If adopting CLI migrations later, baseline their history to
match the files already applied manually.

For an existing project, apply any missing migrations in order. Migration 006
enforces authenticator verification for clinician and administrator accounts; see
[the security update](SECURITY_UPDATE.md). Migration 007 stores the new worker
habit checklists, symptoms, and measurements. Apply it before using the updated
screening form in Supabase mode. The form keeps its draft and refuses submission
when that database update is unavailable. Existing staff accounts and historical
screenings are retained; unrecorded historical findings display as not assessed
or not recorded.

Migration 013 enables ASHA / ANM names in doctor patient reports. It returns only
the registering health worker's name for patients assigned to the verified
clinician. Apply it before deploying the patient report update. The report shows
an error and disables its patient CSV export if staff names cannot be loaded;
the aggregate summary export remains available.

Migration 008 adds structured image findings for Gemini. Apply it before enabling
Gemini analysis; the API checks its presence before sending a photo to Google.

Migration 009 enables the seven additional patient and consent languages. Apply
it before registering patients with these preferences; see [languages](LANGUAGES.md).

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
-- 20 public tables, all with rowsecurity = true.

select id, public, file_size_limit from storage.buckets
where id in ('oral-images', 'pathology-reports');
-- Both private, each with a 10 MiB limit.
```

## Demo accounts

Under Authentication > Users, create and confirm these email/password accounts via
the dashboard. For the demo, confirm accounts directly; sending verification or
password-reset messages requires working mailboxes on this domain:

| Email                    | Role                   |
| ------------------------ | ---------------------- |
| worker@aarohanytc.in     | Health worker          |
| doctor@aarohanytc.in     | Medical Officer        |
| specialist@aarohanytc.in | Specialist             |
| navigator@aarohanytc.in  | Navigator              |
| admin@aarohanytc.in      | District administrator |

Choose passwords locally. None are embedded in the repository. Then run
[demo_seed.sql](../supabase/demo_seed.sql). It maps the Auth IDs to active profiles
and creates 12 synthetic patients, four referrals, appointments and follow-up tasks.
It does not create actual files, meetings or AI predictions.

Re-running the demo seed restores its assignments. It is not an operational account
management tool. Other staff profiles must be provisioned by a trusted admin tool
or SQL Editor. Profiles default inactive. Never derive roles from signup metadata.

## App configuration

Create `.env` using `.env.example` as a template:

```dotenv
VITE_APP_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Find the URL and publishable key in the project's Connect/API Keys interface.
Restart `npm run dev` and sign in as a provisioned user. The publishable key identifies
the app; the user session and database authorization determine patient access.
Never put a secret/service key in a `VITE_` variable or browser bundle. The current
workflow functions do not need a server secret. `.env` is ignored by Git.

The integration API loads `.env.server`; `.env.server.example` is only a template.
Keep real server credentials in `.env.server`, which is also ignored by Git.
After configuring it, run `npm run db:check` to verify the credentials, detect
missing application tables, and check whether Auth accounts exist. This command
does not create or modify records and never prints credentials or patient data.

## Permissions

| Role               | Reads                                      | Workflow actions                                                                                        |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Health worker      | Assigned intake, review and image metadata | Register, consent, outreach, configured image/model/video services                                      |
| Medical Officer    | Assigned clinical records                  | Review/referral, booking/rescheduling, investigations, treatment, reports, consent, follow-up, outreach |
| Specialist         | Explicitly assigned clinical records       | Review/referral, booking/rescheduling, investigations, treatment, reports, consent, follow-up           |
| Navigator          | Assigned demographics and logistics        | Booking/rescheduling, attendance, reminders, follow-up                                                  |
| District admin     | District aggregates; no patient rows       | None                                                                                                    |
| Anonymous/inactive | No patient records                         | None                                                                                                    |

Direct browser table writes are denied. The app calls
`submit_workflow(request_id, action, payload)` with the user's session. The function
checks active role and patient assignment, commits related changes atomically,
rejects stale review revisions, and makes identical retries idempotent. Reusing a
successful request ID with different content fails. Audit triggers capture the
verified `auth.uid()`; SQL Editor/service-only writes can have a null actor.

Registration uses the worker's facility and explicitly assigns its active Medical
Officers/navigators. Referrals choose a demo hospital in that district and assign
its active specialists. These deterministic defaults need configurable workflows
before broader use. Missed attendance creates a task for an active assigned
navigator; if none exists, the write fails atomically.

Signed reviews, treatment events, consent history and audit events cannot be overwritten. Corrections
create a new signed review. Not every handbook state/exception is implemented yet.

## Private files and video

Buckets have no browser read/write policies. The Node API verifies user sessions,
role, assignment and current consent, decodes files, and audits upload/download access.
Only service-role code can call `record_private_file`; browser users cannot supply
trusted file metadata directly. Oral images and reports use randomized object keys.
Downloads receive a 60-second signed URL after an access audit.

Configure `.env.server` for private files, Daily video, research model inference and
optional reminder delivery using [integration setup](INTEGRATIONS.md). Booking works
without the video provider; the app shows availability separately. The setup guide
documents token expiry, delivery retries and the limits of file validation.

## Hosted checks

Run local tests first, then verify using actual user sessions (not SQL Editor owner
privileges, which bypass RLS):

- A worker registers once even when an identical request is retried.
- An assigned clinician can review; unrelated clinicians cannot.
- Navigators cannot read clinical notes or write diagnoses.
- Admins receive aggregate counts but no identifiable records.
- Expired sessions fail, and direct profile/assignment writes are denied.
- Offline registrations remain queued until the server acknowledges them.

Hosted Auth, PostgREST, Storage, MFA and real Android behavior have not been tested.
Local PostgreSQL tests use simplified Supabase schema definitions in PGlite.

## References

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Auth user data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
