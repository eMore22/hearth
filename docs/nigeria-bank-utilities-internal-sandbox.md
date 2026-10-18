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
