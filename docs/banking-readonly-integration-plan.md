# Hearth HQ bank integration plan — implementation specification

**Stage:** Integration architecture prepared. No real bank connections are enabled.

## Product and consent
- Phase 1: users can track bills and subscriptions manually, view spending estimates, and use local deterministic insights.
- Phase 2: user-initiated **read-only** connection through an approved Nigerian bank-data aggregator (Mono Connect is a candidate, subject to business approval and terms).
- Phase 3: transaction reconciliation, recurring-payment identification, duplicate-charge alerts, household spending intelligence, export, account unlink and data deletion.
- Do not implement bank transfers, bill payment, cancellation, lending or investment advice without an independently audited scope and regulatory review.
- Never capture bank username/password, PIN, OTP or online-banking credentials in Hearth forms. The provider must own consent/authentication.

## Mono-specific integration proposal
Reference: https://docs.mono.co/docs/financial-data/connect-link
1. Complete business registration/KYB, create a Mono Connect application and test credentials.
2. Backend-only `MONO_SECRET_KEY`, never in `EXPO_PUBLIC_` environment variables.
3. Authenticated `POST /api/bank/connect/initiate` creates a short-lived user/household-bound linking session and a provider Connect link. No unauthenticated account IDs.
4. Webhook must have cryptographically validated provider signature and delivery replay protection before any account is attached. Never trust a redirect alone to prove success.
5. Backend retrieves linked account metadata and transactions using least-privilege scopes and stores no raw bank credentials.
6. UI shows bank/provider name, *masked* account number, last successful sync, permissions, connection/reconnect status, and disconnect/delete controls.
7. Read-only sync runs asynchronously with retry/backoff; never block Chief, bills, groceries or smart-home operations while the provider is down.
8. Household access checks must require authorized user and household, not just a matching URL parameter. Personal bank data should remain user-private unless separately and explicitly shared.
9. Store transaction amount, currency, timestamp, provider transaction ID, merchant and category, with unique deduplication across reconnects. Exclude raw identities, BVN, passwords and sensitive banking response fields.
10. Chief may see aggregated spending and bills by default; individual transactions require deliberate finance requests. Exclude bank identifiers from prompts.

## Gate before real bank linking
- Approved Mono account, signed integration agreement, known prices and production keys.
- Provider signature documentation and successful sandbox webhook verification.
- Privacy policy/consent/data-deletion language, bank data retention policy and Nigerian data protection review.
- Environment: sandbox first, never silently change to live.
- Unit/integration tests for consent, webhook signature, replay, account isolation, unlink and provider outages.
- Go-live tests for stale balances, currency, duplicates, failed refresh, and scope revocation.

Until this gate is passed, the application must show **Bank connections not available yet** and offer manual Bills & Subscriptions instead of claiming an active bank connection.
