# Threat model and recovery runbook

This is a synthetic hackathon demonstration. Clinical use, a clinical accuracy claim,
or processing real patient information requires a separate approved system.

## Trust boundaries and controls

The [security update](SECURITY_UPDATE.md) adds the authenticator UI/API guard,
migration 006 and encrypted backup tools. Local tests and real hosted Auth checks
pass; hosted database enforcement awaits owner rollout. A local isolated PostgreSQL
restore has been executed; the hosted project restore remains untested.

| Threat                             | Current control                                                                              | Limit / remaining verification                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Wrong-record access or forged role | Supabase RLS and workflow RPCs check active identity/assignment; Node verifies user token    | Five hosted roles checked; staff administration remains trusted Supabase work                                  |
| Stolen device/token                | Expiring Auth tokens and protected cloud reads; queue scoped to actor                        | IndexedDB is not encrypted by this app; MFA source/tests complete; hosted policy rollout requires owner access |
| Leaked service credential          | Ignored environment files, server-only secrets, static path guards                           | Rotate any key previously disclosed; keep backups out of Git                                                   |
| Malicious files                    | Decode/re-encode JPEG; PDF page/structure checks; size/dimension limits                      | No antivirus engine; no guarantee of complete malware detection                                                |
| Lost upload response/double submit | Registration ledger and stable upload IDs; object/checksum reconciliation on retry           | Periodic orphan-object cleanup is an operational task                                                          |
| Shared/expired video link          | Appointment-specific user token, consent/role checks and join window                         | LiveKit already-admitted modified clients require provider-side removal for immediate revocation               |
| AI outage or false result          | Labelled mock; optional strict pinned research contract; independent signed clinician review | Quality thresholds are prototypes; no model accuracy is claimed                                                |
| Backup or log leak                 | Minimal audit metadata, no clinical content in server errors/logs                            | Database dumps and object exports still require encrypted storage/access controls                              |

The current UI exposes only aggregate CSV export and no identifiable bulk export.
Private file downloads are audited before signed access is issued. Signed clinical
records, consent history and audit history cannot be rewritten by browser roles.

## Verify after each deployment

1. Run `npm run test:deployed -- https://YOUR-SERVICE.onrender.com`.
2. Run `npm run db:check` against the same Supabase project.
3. Run the authenticated hosted checks in [TEST_REPORT.md](TEST_REPORT.md).
4. Check Render deploy logs and `/api/status`; do not paste secrets into tickets.
5. If the release fails, use Render's Manual Deploy menu to redeploy the last known
   good commit. Confirm whether auto-deploy was disabled by selecting a specific commit.
   Deployments do not run database migrations or seed resets automatically.

## Hosted backup and isolated restore rehearsal (pending owner access)

Do not test restore against the existing project. Before the event:

1. Use Supabase's supported backup/export method for your plan, or an authorized
   PostgreSQL/Supabase CLI dump with a direct database connection. A service API key
   alone is not a complete database backup, including schema, functions and policies.
2. Export private Storage objects separately; a database dump does not contain blob
   bytes. Keep a manifest of object keys and checksums in the protected backup.
3. Store exports encrypted with access restricted to the team owner. Keep a key
   recovery procedure separate from the encrypted files. Never commit a dump.
4. Provision a fresh isolated demo project. Restore the schema/data/functions/policies
   following the backup tool's procedure, restore private blobs, and recreate/map
   test Auth accounts as required by the restore format. Do not expose `app_private`.
5. Point a separate preview deployment at that project. Repeat database, five-role,
   file-round-trip and idempotency checks. Compare fixture counts/checksums; save the
   command output with secrets removed and record the restore time.
6. Only after this succeeds may the team claim a tested backup/restore route.

An encrypted isolated PGlite restore was executed with all 20 application tables,
retry ledger, access policies and a synthetic external blob. Its exact scope and
evidence are in [SECURITY_UPDATE.md](SECURITY_UPDATE.md). No hosted-project restore
was performed; direct DB backup access and an isolated destination were not supplied.
Supabase managed backup availability
depends on the actual plan and should be checked in its dashboard.

## Fallback if hosting is unavailable

Use Node 24+, `npm ci`, and a separate local-demo build:

```powershell
$env:VITE_APP_MODE='demo'
npm run build
npm run dev:api
# In a second terminal:
npm run preview
```

Open http://127.0.0.1:4173. The local synthetic demo has role selection and browser
persistence. In Workspace settings use Reset demo to restore its seed. This resets
only browser demo state, not hosted Supabase. Offline behavior works after one online
load. If `.env` selects Supabase for development, explicitly set demo mode in the
terminal used to build. Restore the production build with `npm run build:render`.
