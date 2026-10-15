# Hearth household finance — controlled autonomy roadmap

Status: **Phase 1 partially implemented. Bank access and payment execution are not enabled.**

## Phase 1: Budgeting and insights (in progress)
- [x] Offline monthly recurring-obligation projection from tracked bills, with billing cycle and currency isolation.
- [x] Manual next-due date entry and real upcoming bill preview.
- [ ] Budget caps, transaction-level histories and payment confirmation; the projection is NOT verified spending.
- [ ] Additional due-date reminders and recurring date advancement when marked paid.
- Expense import and deduplication with household scoping and audit log.
- Chief recommends payment reminders and savings opportunities with explicit source references.
- User sees proposed actions; Hearth cannot transfer money or cancel services.
- Implement budget caps, approval workflow, merchant allowlist, action audit trail, policy version.

## Phase 2: Read-only reconciliation
- Integrate regulated and regional bank/fintech data aggregators only with revocable read-only consent.
- Match transactions to bills by exact reference, merchant, amount and date. Flag ambiguous matches.
- Never retain bank passwords or full PAN; segregate encrypted tokens with minimum scope.
- Add sync diagnostics, stale-data labeling, data export and revocation.
- WireMITE is a *candidate* payments-rails partner, not an active integration.

## Phase 3: Guardrailed execution (requires provider, compliance and consent validation)
- Payment proposals are built deterministically server-side, not directly authorized by model text.
- Every payment is bound to verified beneficiary, exact amount/currency, expiration, household,
  server-side spending rules, idempotency key and revocable permission.
- Default human approval per payment. Potential optional automation only with strong customer
  authentication, capped budgets, immutable ledger, emergency pause, notifications and dispute path.
- Stripe Shared Payment Tokens / agentic SDK capability are **conditional** on country support
  and merchant/provider eligibility; evaluate payment method acceptance for Nigeria separately.
- x402 targets HTTP-native agent/machine transactions; it is not a replacement for Nigerian
  utility, insurance and bank-transfer integrations.
- Subscription cancellation and insurance claims require merchant/insurer-specific supported
  APIs, verifiable identity, separate action-specific consent and reliable confirmation.
- Support dry-run simulation and manual review before any production funds movement.

## Non-negotiable controls
- A conversation or LLM response cannot grant payment authority.
- No card data, bank credentials, or agent payment tokens in AI prompts.
- No payments, transfers, claims or account closures executed from this roadmap alone.
- Consent scoped per purpose; revocation immediate; actions traceable to actor and policy.
- Family access does not imply spending authorization.
- Every connector must be tested for current geography, regulation and support before use.
