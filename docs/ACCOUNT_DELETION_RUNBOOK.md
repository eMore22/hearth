# Hearth account deletion operations (release gate)

The signed-in app creates a **request**, not an irreversible deletion. Never report completion unless verified from Supabase Auth, private Storage, database records and linked providers.

## Intake
- POST `/api/auth/deletion-request` requires an authenticated user and exact confirmation text `DELETE MY ACCOUNT`. It creates a request row; no account is removed at this stage.
- GET shows the signed-in user's own last request; DELETE cancels a still-requested item. An index prevents duplicate active requests.
- Public access is available through `/account-deletion` (support email), for users who cannot sign in. The support inbox is **not** automatically connected to this queue; an operator must reconcile requests from both sources.
- Requests hold a user ID and household ID at request time, not email, password or scanned personal documents. Administrative database access only.

## Available operator-only readiness tools
- \`app.services.deletion_review_queue.pending_deletion_queue()\` returns bounded IDs, statuses and age flags for requests that need attention. It contains no personal email, documents or bank data, and is **not exposed to app users or unauthenticated HTTP clients**. Operations staff must explicitly invoke it from a restricted backend environment.
- \`app.services.deletion_review_queue.review_deletion_request(request_id)\` returns the conservative read-only preflight. It covers multiple memberships, owner roles, private documents, finance connections, notification tokens and user-attributed chat, in addition to household-shared health data.
- These tools only inventory work. They do not revoke consents, remove files, delete identities, send customer notifications or assert deletion completed. Every unresolved item remains a blocker; do not manually set the status to completed without audited verification.
- A seven-day default age flag is an operational triage threshold, **not a legal deadline**. Determine applicable statutory periods and response obligations by market.

## HA credential migration
- The API now encrypts existing active HA credentials on startup using its Render-held Fernet key; it logs **counts only**. Query the encrypted/plaintext counts without selecting secrets.
- After database encryption, rotate historical Home Assistant tokens through each user's authorized HA instance and re-link. Do not rotate or delete other household members' data.

## Required processing checklist (human operator)
1. Establish request ownership from active authenticated identity or independently verified support case. Confirm household owner vs invited family member, and inspect co-owned resources before deleting anything.
2. Cancel the user's Google Play subscription only via Google Play / user instructions; do not assert that deleting Hearth cancels billing. Check RevenueCat entitlements and reconcile subscriber IDs.
3. Identify linked Plaid and Mono consent records for this specific user. Revoke provider access and delete the user's cached Sandbox banking tokens and sensitive transaction records. Do not unlink another household member's account.
4. If the requester is a **member**, remove only that membership and personal documents, personal health details and other personally owned content; preserve shared household records and other members' documents.
5. If requester is **household owner**, resolve ownership transfer or explicit, verified full household deletion with other members first. Do not delete shared household data without a valid basis and clear notice.
6. Reconcile all `documents.file_url` paths with `storage.objects`, ensure the user's private Storage objects are removed, and audit remaining household-shared objects against permitted retention.
7. Export only legally necessary minimal request audit facts, erase Supabase Auth user (after linked references are handled), remove personal DB records in a transaction-safe order and invalidate auth sessions / subscription caches.
8. Confirm scoped records are gone with a fresh privileged check, update `account_deletion_requests.status` to `completed` with `completed_at` and `updated_at`. Set `processing` during verified execution. Keep the audit record only for a documented retention period, then purge it.
9. Notify the verified requester through an approved support channel once completion is verified. Record an incident if any provider/API revoke fails; do not mark a partial deletion as complete.

## Release blockers
- Implement, authorize and dry-run a reliable deletion worker/operator processor for both member and household-owner paths with reversible pre-deletion verification; do not run production destructive scripts against real users without explicit authorization.
- Verify public deletion request URL and actual operational support inbox handling.
- Document account/data retention periods, any legally required exceptions and a user-accessible privacy policy.
- Test from two household accounts on staging; a member's deletion must never delete the owner's accounts, household files or unrelated medical records.
- Implement operator alerts for pending/aging requests and reconcile public support requests into the queue.

**Current capability:** tracking and cancellation only. **Not yet confirmed:** end-to-end deletion processing or Google Play policy compliance.
