# Hearth manual deletion execution (limited, verified invited members)

This supplements the request queue and existing read-only plan; **it is not a replacement for full multi-member/owner/provider/storage deletion handling**.

## Enabled processing pathway
From an authenticated, restricted server operator shell (not a public HTTP route), run:
1. Verify requester identity, household rights, active request and authorization.
2. Review \`app.services.deletion_plan.build_deletion_plan(request_id)\` and its SHA-256 scope digest.
3. Confirm billing is cancelled/expired in Google Play and RevenueCat: the operator executor **also** verifies Free tier on the provider; if unavailable it refuses.
4. Confirm no linked provider/banking data, private documents, household Storage entries, household-wide ambiguous health records, ownership or other non-transferable data. If any exists, this executor refuses, and the operator must follow a separate case-specific process.
5. Configure a strong, securely managed \`DELETION_OPERATOR_SECRET\` in the restricted backend environment; do not store it in GitHub or put the secret in shell args. Generate HMAC via \`operator_signature(...)\`, using an expiry no more than 10 minutes away and the current review digest. Do not print approval to shared logs.
6. Run \`python -m scripts.member_deletion_operator --request-id ... --review-digest ... --expires-at ... --approval ...\` from \`backend/api\` in the restricted shell. No user account in production may be used as a QA target. Verify the final completed receipt.
7. For partial failure, status remains \`processing\`. Manually reconcile every data store; do not mark complete or run a blind retry. Preserve a minimal lawful operator audit.
8. Notify the verified requester, follow local legal deadlines, and document completed external handling.

This supports only **an unambiguous invited member without owned documents, provider-linked data, unallocated household health records, or household Storage**. Other deletion requests remain a mandatory operator case; public launch still requires an implemented documented handling process for those cases. Deletion does not cancel subscriptions automatically.

The handler deletes its own chat, analytics and push tokens, removes one membership, invokes \`supabase.auth.admin.delete_user\` and verifies the profile CASCADE and recorded request completion. No unrelated household data is removed.

**Tests use simulated Auth and PostgREST interfaces only.** End-to-end staging with real Supabase Auth and Storage plus subscription receipts is required before production activation.


## Private documents in member deletions (October 2026)
Eligible invited-member deletions now reconcile ALL Storage paths and ALL document
metadata records within the member's household before beginning. Every object
must have a unique validated document record. Missing or orphaned objects, shared
uploads, uncertain ownership and any linked financial provider stop the deletion.
After operator approval, only the caller's private objects and DB metadata are
removed; the other members' objects and records remain untouched. This scope
still requires a real staged Auth + Storage test and a provider-aware solution
for connected-bank accounts before public launch.
