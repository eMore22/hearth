# Deletion processor execution gates — Hearth HQ

**Status: implementation preparatory phase. Live destructive processing remains OFF.**

The new \`app.services.deletion_plan.build_deletion_plan(request_id)\` builds a read-only manifest of every user-attributed table checked against the actual production schema, household role and ownership, private document storage references, shared health modules, transaction references and pending consent responsibilities. Its digest is a drift detector, **not an approval token**.

**Never** pass an account-deletion request to \`execute_deletion\` in production: it explicitly fails closed until this release gate is satisfied. No feature flag in this PR can override this.

## Required before a destructive execution implementation can be enabled

1. Define legal controller, data retention schedule, notice/contact method and verified identity. Confirm the request is still active and has not been withdrawn.
2. Record independent, operator-authenticated approvals including verified scope, requested operation, short-lived nonce and request-specific audit evidence. Never authorize deletion using only a phone-supplied flag or digest.
3. Stage a transactional/idempotent database cleanup strategy for member versus owner, including tasks.creator foreign key, documents.uploaded_by, households.created_by, household_members.user_id and every other user-owned reference. Verify shared health, bills, groceries and documents of other family members survive.
4. Obtain per-connection read-only financial provider revocation receipts for Plaid/Mono and future US/Canada partners; never assert local disconnect is provider revocation if no provider confirmation occurred. Make failures retryable and visible.
5. Reconcile \`public.documents\` with \`storage.objects\`, including objects owned by a requester without a document metadata row. Supabase Auth deletion may fail if Storage still has objects owned by the user.
6. Handle RevenueCat entitlements and inform customers that deleting an account does not itself cancel Google Play subscriptions.
7. Deactivate sessions and plan for already-issued JWTs, which can remain valid until expiry unless a stronger server-side session check is implemented; restrict data access during deletion.
8. Independently verify Auth, database and Storage deletion (and any lawful retention exemptions). Mark the request completed and notify only after a durable audit record is written.
9. End-to-end stage with isolated test users (member, sole owner, multi-member owner, bank-connected user, storage objects, interrupted provider revocation, repeated requests, revoked approvals). No developer or customer production accounts are to be deleted as part of QA.
10. Conduct jurisdiction-specific legal review for Canadian, Nigerian and US privacy obligations. Do not claim Google Play deletion compliance while only request/preflight exists.

## Product-specific precautions

- Existing \`account_deletion_requests\` rows must not be purged until a retention rule is defined; preserve minimal audit trail.
- Health modules currently contain records keyed by household/member name without reliable user identity; never use name matching to delete one member's medical records.
- A multi-household user and household founder must not be treated as an ordinary member of whichever household row appears first.
- All returned plan counts are operator-only, not exposed to the public API. No raw document paths or banking credentials appear in the report.
