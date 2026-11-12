# Offline screening and photo capture

Health workers can save patient registration, consent, screening findings and
oral photographs without a connection. The queue survives browser reloads in
cloud evaluation and clinical workspaces. Registration reaches the server before
its photographs. A failed registration blocks its dependent uploads, while other
patients can continue syncing. Existing server authorization, consent and case
closure checks remain authoritative.

## Use on a phone

1. Open the deployed HTTPS app online, sign in as a health worker, and allow the
   app shell to finish caching. Use the same browser or installed PWA afterward.
2. Disconnect. Complete the patient intake, record screening and photograph
   consent, then select **Save screening**. The pending record can be opened from
   the patient registry immediately.
3. Open **Oral photographs**, use the camera or choose a file, and wait for
   **Saved to the offline queue**. Local image checks run without a network.
   Pending photographs display their preview and queue status.
4. Close/reopen or reload the app. The draft, pending patient and photographs
   remain available to the same signed-in worker.
5. Reconnect and keep the app open. Sync starts automatically and retries every
   30 seconds while connected. Settings also provides **Sync pending records**.
   Failed items show an error and remain available for retry. Entries leave the
   queue only after a server acknowledgement; retries reuse the original IDs.

Offline access requires an unexpired browser login and a worker profile verified
online within the last 24 hours. Reconnect and sign in again when either expires.
Only the worker's own registration/screening records and consent are cached for
offline capture. Other clinical workflows, report uploads and AI require a
connection. Doctor/navigator/admin accounts do not receive offline access.

## Device storage and recovery

Cloud drafts, queued payloads, photographs and the limited worker snapshot use
AES-256-GCM in a separate IndexedDB database. Every write has a random nonce and
authenticated scope/account/record identity. Keys are non-exportable Web Crypto
keys scoped to the Supabase project, workspace mode and staff ID. Pending and
failed payloads stay on the original device, including across sign-out, so the
same account can sign in online and retry. Sign-out removes the cached worker
snapshot and unfinished form and prevents offline re-entry until a fresh login.

This protects stored payload contents; it does not protect against malicious
same-origin scripts, an unlocked device, or browser-profile access. It is not an
independent clinical security assessment. Synthetic local demo storage retains
its existing unencrypted behavior.

Do not clear site data, uninstall the PWA or use a private browser session while
records are pending. Browser storage can be evicted, and a storage-full or
encryption failure is shown as a save error. There is no claim of background
sync while the application is closed. Cross-device clinical edits are never
replayed by this queue: only new registration and photo commands are queued;
server conflicts remain failed with their original payload available for review.

## Verification

`npm run test:offline` verifies access expiry and account boundaries, projection
of pending registrations/photos, consent withdrawal and snapshot minimization.
The clinical Playwright regression uses real browser IndexedDB and Web Crypto
with synthetic records and mocked providers. It covers offline reload, encrypted
payloads and non-exportable keys, a lost registration acknowledgement, upload
failure/retry with stable IDs, and another account being denied the cached data.

Build the clinical browser fixture with `VITE_APP_MODE=supabase`,
`VITE_WORKSPACE_MODE=clinical`, `VITE_SUPABASE_URL=https://clinicalfixture.supabase.co`
and `VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-public-key-only`, using
`vite build --outDir test-results/clinical-dist`. Then run
`playwright test --config playwright.clinical.config.ts --grep "clinical drafts|offline capture"`.
Physical Android camera/PWA acceptance remains a separate check.
