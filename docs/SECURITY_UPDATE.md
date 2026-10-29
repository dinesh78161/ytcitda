# Security and recovery update — 28 October 2026

The remaining software changes are implemented and tested. The live database
upgrade needs project-owner access. The supplied server API key can manage
application records but cannot change PostgreSQL functions or policies.

## Completed software

- Authenticator enrollment and six-digit verification in English/Telugu. Clinicians
  and district administrators are stopped before application records load.
- API requests verify the same authenticated token's identity and `aal2` assurance.
- Migration 006 adds 19 restrictive table policies and guards both workflow and
  district-summary RPCs. The old implementations cannot be invoked to bypass MFA.
- The PostgreSQL tests cover denied AAL1 access, allowed AAL2 access, continued
  worker/navigator access, and protected function grants.
- Real hosted Auth verification passed using one temporary synthetic account:
  password sign-in, TOTP enrollment, wrong-code rejection, AAL2 promotion and the
  updated API's assurance guard. The temporary profile/account were removed.
- Encrypted backup tooling authenticates every entry and rejects corruption or a
  wrong passphrase. A separate PostgreSQL instance restored all application tables,
  an actual retry-ledger entry, permissions, signed history and synthetic file
  bytes. Retrying the original workflow after restore created no duplicate.
- All nine demo/offline browser checks and both MFA browser checks pass.

## Activate database enforcement

Preferred: connect the Supabase integration with the owner of the existing project.
The agent can then apply the tested migration and verify its result.

Alternatively, open the existing project's SQL Editor, run only
[migration 006](../supabase/migrations/202610280006_privileged_mfa.sql), and verify:

```sql
select public.security_policy();
-- version=1, privileged_mfa=true
select count(*) from pg_policies
where schemaname='public' and policyname='require_privileged_mfa';
-- 19
```

Do not rerun first-time `setup.sql` or demo seeds on the existing project.
The reviewed migration is additive, transactional and preserves staff/passwords,
records and existing access assignments. The updated frontend must be deployed so
staff can complete enrollment after the database guard is enabled.

For an owner who prefers local automation, put a user-owned Management API access
token in ignored `.env.recovery` using `.env.recovery.example`, then run:

```powershell
npm run db:security
```

It checks the existing application schema, applies only migration 006, verifies
the policy count, and skips the migration when the expected policy is installed.
No SQL response, credentials or authenticator keys are logged.

## Staff authenticator setup

After ordinary password sign-in, a clinician/administrator chooses **Set up
authenticator**, scans the QR code with their own authenticator app, and enters a
fresh code. Later sign-ins ask for a code from the existing authenticator. Setup
keys/codes must stay out of screenshots, recordings, logs and chat. MFA secrets for
real team accounts have not been created by the agent.

If a device is lost, a trusted project administrator must verify the owner's
identity and use Supabase's account recovery procedures. Removing a factor does
not bypass this application's requirement to enroll again for a privileged role.

To check the five existing first-factor passwords without resetting anything,
populate ignored `.env.acceptance` from `.env.acceptance.example`, then run
`npm run test:passwords`. No passwords are tried unless all five are supplied.
Hosted role/write tests now accept fresh `HOSTED_TOTP_CODE_<ROLE>` values from this
private file for already-enrolled privileged accounts; they cannot bypass MFA.

## Backup tools and the remaining hosted rehearsal

The executed restore uses isolated embedded PostgreSQL with test Auth/Storage
schemas and a synthetic external blob. Its evidence is
`test-results/recovery/restore-rehearsal.json`. It verifies recovery logic, table
hashes, access policies, immutable history and retry protection; it does not certify
a restore of the actual hosted project or physical Storage service.

For a real hosted rehearsal, use a new isolated Supabase project and the
[official backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
Export `roles.sql`, `schema.sql` and `data.sql`, including the private workflow
ledger, and copy private Storage bytes separately. Preserve/check object keys and
checksums. Follow the current provider instructions for managed Auth/Storage
schemas, project encryption keys, extensions and account restoration.

The tools wrap those exports without modifying any database:

```powershell
# Set BACKUP_PASSPHRASE in ignored .env.recovery; keep a separate recovery copy.
npm run backup:seal -- backups/raw backups/demo.adbackup
npm run backup:verify -- backups/demo.adbackup
# Extraction refuses an existing destination and verifies before writing.
npm run backup:extract -- backups/demo.adbackup backups/new-restore-input
```

Archives use AES-256-GCM with a random salt/nonce and scrypt-derived key. Raw files
are private plaintext and need protected storage. The backup tooling does not claim
that supplied exports are complete: the owner must verify actual database dumps,
Storage contents and the isolated hosted restore. No restore runs against the demo.

## Submission material

The follow-up archive is `Aarogya-Drishti-security-update-2026-10-29.zip` in
the workspace's `.artifacts` directory. It includes the complete revised source,
the dated verification evidence, the walkthrough and its storyboard/metadata.
`START_HERE.md` describes the package; `MANIFEST.sha256` covers its contents and
the separate `.zip.sha256` file covers the archive. Actual environment files,
credentials, database dumps, dependencies and authenticated browser state are
excluded. The original 28 October archive remains the baseline release package.

The generated five-minute walkthrough is under
`test-results/recording/Aarogya-Drishti-5-minute-walkthrough.webm`, with its storyboard
and metadata. It uses generated narration, actual synthetic test screenshots and
the successful generated-media LiveKit screenshot. It is a product walkthrough,
not evidence of physical Android testing or human review.

Reproduce the capture with `CAPTURE_DEMO=1` and `npm run test:e2e` on a demo build,
then `node scripts/record-walkthrough.mjs --prepare`, the supplied Windows narration
script, and `node scripts/record-walkthrough.mjs`. The recorder uses screenshots and
generated WAV audio, without accessing a camera or microphone.

The team must review the video and provide its real names/contributions. Complete
the physical phone/laptop acceptance record in [SUBMISSION.md](SUBMISSION.md).

References: [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp),
[MFA enforcement](https://supabase.com/docs/guides/auth/auth-mfa),
[PGlite snapshots](https://pglite.dev/docs/api).
