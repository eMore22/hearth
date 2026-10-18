# Hearth HQ: Nigeria banking and utilities (internal Sandbox plan)

Status: provider evaluation and integration design, **not enabled in production**.

## Why this follows the Canadian Plaid test

The existing Finance schema already supports provider `mono`, country `NG`, and currency `NGN` in `finance_connections`, `finance_accounts` and `finance_transactions`. This is useful infrastructure, **not** a working Mono integration. The Plaid Sandbox RPCs deliberately require country `CA` and provider `plaid`, so do not reuse them unchanged for Mono.

## 1. Nigerian banking: Mono Connect, Sandbox first

Official documentation:
- https://docs.mono.co/docs/financial-data/partners-api-guide/sandbox-guide
- https://docs.mono.co/docs/financial-data/connect-link
- https://docs.mono.co/docs/quickstart

Prototype a read-only account-linking flow using simulated NGN accounts and transactions. Implement server-generated Connect session, customer consent, verified callback/webhook processing, account-data lookup, bounded pagination, owner-only visibility, encrypted provider-specific credentials or identifiers, revoke/disconnect, expiry and scheduled cleanup. Test revoked and expired consent, wrong household, duplicate syncs, race between sync/disconnect, provider outage, unexpected currencies, and callbacks arriving twice/out of order.

Requirements before first provider call:
1. Obtain authorized Mono developer access and Sandbox keys in Mono Dashboard; store secrets only server-side in Render, not in GitHub or Expo.
2. Verify Mono's current product onboarding, app setup, webhook signature verification, and approved Sandbox account-connection mechanism against current documentation.
3. Add disabled-by-default `MONO_SANDBOX_DEMO_ENABLED` and explicit internal tester allowlist. Do not make Sandbox accessible to public sign-ins.
4. Add server-owned consent and database transaction semantics comparable to the completed Plaid proof of concept. The existing Plaid encrypted-token table and RPCs are provider-specific.
5. Confirm privacy, data retention and Nigerian financial-data compliance before making any real bank connection.

Scope initially: **read-only financial insights**. No transfers, withdrawals, bill payments, payment initiation, or implied access to a spouse's private banking records. Never aggregate currencies without conversion rates and explicit labels. If a provider account is disconnected, the Chief of Staff must not retain a bank balance or transaction history in shared context.

## 2. Utilities: service tracking before execution

Official reference APIs to evaluate:
- https://sandbox.vtpass.com/
- https://vtpass.com/documentation/introduction/
- https://developer.flutterwave.com/docs/bill-payment

Build provider-independent read-only utility profiles for electricity, internet, water and other recurring services. First connect existing household `bills` records to utility categories, recurrence, meter/customer identifier (masked), due date and reminders. Do not assume every utility/provider exposes meter balances or usage history.

Create a simulated Sandbox adapter for supported Nigeria electricity billers and optional verification, but separate `lookup/verify` from `pay` operations. No bill-payment API calls with money movement. If VTpass Sandbox keys are required, they must be obtained from the official portal and stored server-side. Avoid assumptions about universal free production API access.

Future regulated payment capability requires a **separate security, licensing, consent and reconciliation review**, with an explicit payment approval workflow, audited execution, safe retry/idempotency, limits and provider-confirmed settlement. Keep payment execution disabled until that review.

## 3. Chief of Staff across modules

Provide a bounded, verified, household-scoped read-only context for utilities, bills, documents and devices; preserve bank-owner isolation. Chief may reason from authorized **summaries**, not raw private bank transactions from another member. Each fact needs freshness/source labels and no imaginary account balance, meter reading or verified payment. Deterministic summaries remain useful if Claude and NVIDIA credits run out.

## Release gates

- Backend unit/contract tests with simulated Mono and utilities provider responses.
- Consent, household isolation, revocation, encryption, no-secrets logs and concurrency tests.
- Existing Supabase + Render only unless explicitly approved; do not create paid branches or staging services.
- On-device Android Sandbox flow after CI and native build, as with Plaid.
- Do not merge or turn on any real-bank / real-payment environment flag without a separate review.

## Implemented internal test infrastructure (18 October 2026)

- `/api/utilities/overview` derives household utility summaries from manually stored bills. Currency totals are kept separate; this is not meter usage or confirmed payment data.
- `/api/utilities/sandbox/check-meter` is a clearly labeled local fixture, available only with `UTILITIES_SANDBOX_DEMO_ENABLED=true` and `UTILITIES_SANDBOX_TESTER_USER_IDS`. No external verification takes place.
- `/api/utilities/sandbox/vtpass/verify-meter` is an optional *actual VTpass Sandbox* meter verification, never a payment. Use only documented `enugu-electric` sample meter numbers. Leave disabled until official VTpass Sandbox credentials are configured. Requires `VTPASS_SANDBOX_ENABLED=true`, `VTPASS_SANDBOX_API_KEY`, `VTPASS_SANDBOX_SECRET_KEY` and an explicit `VTPASS_SANDBOX_TESTER_USER_IDS` list in the Render API service. Neither client nor API response exposes keys or full meter data. Only the fixed `sandbox.vtpass.com` host may be called.
- `/api/finance/sandbox/mono/capabilities` exposes the Nigerian readiness state. `/api/finance/sandbox/mono/institutions` is restricted to `MONO_SANDBOX_DEMO_ENABLED=true`, `MONO_SANDBOX_SECRET_KEY` and `MONO_SANDBOX_TESTER_USER_IDS` on Render. Linking and account synchronization remain OFF.
- An internal-test AAB with new read-only Nigeria and Utilities screens has been queued separately. Backend changes require no additional Supabase migration.

**Important:** VTpass Sandbox simulation, including a successful meter response, is not proof of ownership of a real utility account, bill payment, electricity supply or meter readings. Real bank connections and all payment APIs remain disabled.


## Mono Connect Link integration (Sandbox test path)

The new Android screen uses Mono's **hosted Connect Link** so Hearth never accepts banking passwords or OTPs. A per-user, per-household pending record is created only after 30-day read-only consent; Mono verifies the link through a webhook. Balances and at most the first 20 transactions are then fetched on-demand from Sandbox, not imported into Chief of Staff or shared with household members. User disconnection revokes local consent before calling Mono unlink. Payments remain disabled.

Before enabling the link button, configure on **Render API**:
- `MONO_SANDBOX_SECRET_KEY`: existing key starting `test_sk_`
- `MONO_SANDBOX_DEMO_ENABLED=true` and `MONO_SANDBOX_TESTER_USER_IDS`: internal tester only
- `MONO_SANDBOX_APP_ID`: the exact Mono Connect Test Mode app ID (not a credential)
- `MONO_SANDBOX_WEBHOOK_SECRET`: the secret generated by Mono when the webhook is configured; enter **directly in Render**, never in chat or GitHub
- Optional `MONO_SANDBOX_REDIRECT_URL`: secure redirect on the actual `hearthhq.online` domain. Default is its HTTPS home page.

In Mono Dashboard Test Mode -> Hearth HQ Nigeria Sandbox -> Webhooks, add this endpoint:
`https://hearth-hq.onrender.com/api/webhooks/mono`

Do not set a different webhook host, display the signature in chat, or enable Go Live. Mono delivers the `mono-webhook-secret` header; all missing/mismatching signatures and foreign app IDs are rejected. No account is displayed as linked until a signed event matches its single pending UUID, not older than one hour. Provider failure must never grant consent.

Tests: confirm provider URL has `https://link.mono.co`, link only via read-only consent, refresh after hosted flow, account read/private balance display, transaction list status, disconnect, expired consent rejection, foreign-household API denial, webhook retry/invalid signature rejection, and secret-free logs. The dedicated database schema was previously deployed; this integration does not migrate production.

**Limitations:** The linking, account previews and transactions are Sandbox-only and must be tested on Android before launch. This stage doesn't synchronize Mono transactions into the Finance database for Chief of Staff. Real-account production access, payments, and household-wide transaction sharing require separate reviews.
