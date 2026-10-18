# Hearth HQ — Production integration and security gates
**Audit date:** 18 October 2026  
**Scope:** Android/Expo, FastAPI/Render/Celery, Supabase, Google Play/RevenueCat, Canadian and Nigerian provider adapters.  
**Release decision:** **Not yet approved for a public production rollout.** Internal QA is supported; public launch needs every blocking item signed off.

## Evidence confirmed during this audit

- Render API, worker, scheduler were live at merge 969477a8 (Documents privacy release); later merges must finish deploying before testing.
- Existing GitHub release workflow runs backend unit tests and mobile TypeScript checks. New PRs #24 and #25 passed both suites, with #25's initially failing fake Storage fixture corrected and retested.
- Supabase `documents` bucket is private. Document RLS migration `document_privacy_owner_household_20261018` applied and verified: uploader-only/private by default; household sharing is opt-in. All 23 legacy document records remain preserved and private. The app still requires a post-release physical upload/open/share/delete test.
- Firebase/Crashlytics, Sentry, and Google Play Console crash/pre-launch report configuration were **not verified** in this audit.
- No public AAB or payment integration was triggered during #24/#25. Android native changes have to be grouped into a later QA build.

## Provider / integration truth table

| Module | Tested / implemented | NOT production-ready / prerequisite |
| --- | --- | --- |
| Canadian banks (Plaid) | Read-only Canada Sandbox bank link, simulated account/transaction sync and revoke; owner-scoped backend. | Real bank credentials/account consent must not be used; production Plaid agreement and environment, scopes, security and operational review. |
| Nigerian banks (Mono) | Read-only Mono Test Mode link, webhook verified, simulated NGN balances/transactions and revoke; owner-only Private Profile. | Live Mono onboarding, production credentials, customer authorization, bank coverage, webhook protection and revocation/retention sign-off. |
| Nigeria electricity (VTpass) | Authorized Sandbox test meter verification. No real payment or live meter. | Real provider account, legally permitted meter lookup, verified customer consent, provider QA; no bill payment switch. |
| Canada electricity/natural gas | Ontario Green Button discovery/catalog; shared manual bills. | Register third-party app with each provider, customer Connect My Data authorization, OAuth-style consent, per-utility adapters, usage provenance, revocation, provider polling tests. Reference: https://www.oeb.ca/consumer-information-and-protection/green-button |
| Other utilities CA/NG | Household manual electricity, water, internet, gas, TV bills accessible to household. | Provider-specific integration/contract and consent; no automatically retrieved usage/balance yet. |
| Smart home (Home Assistant) | Reachability status, cached device readings, conditional controls, Chief stale-state guardrails. | Physical reachable HA instance and devices, token handling/rotation, DNS-rebinding/SSRF and webhook tenancy threat review, explicit confirmation for safety-sensitive actuations. Expired trycloudflare test instance is not production proof. |
| Documents | PDF/image upload, private Storage, signed on-demand URL, uploader opt-in sharing, saved metadata, expiry Q&A with offline fallback, original-object deletion. | Device upload/render/delete regression; private-vs-shared multi-account end-to-end test; automated orphan reconciliation and document retention policy. |
| Scanner/Intake | Private original scan + inferred destination suggestion after PR #25. | Review and confirm financial/medical drafts before creating structured records; extraction quality test on varied non-sensitive samples. No invented amounts or health event side effects. |
| Chief of Staff | Deterministic cross-household readouts of shared bills, utilities, groceries, tasks, smart-home cached states, and shared document expiry. | Owner-vs-member privacy E2E on shared conversation; redaction policy for medical/personal history; model-offline resilience, prompts injection tests, confirm-before-device-action. |
| RevenueCat / Google Play | Free/Home/Family code and simulated Android purchase experience previously tested internally; server-backed entitlement checks available. | Verify purchase/restore/cancel on final AAB, Play tester licenses, correct entitlements, family inheritance and `BILLING_ENFORCEMENT_ENABLED` server state (not verified here). Never enable paywall restrictions solely based on UI claims. |
| Account deletion / privacy | Privacy page includes in-app request path via email; backend hosts public deletion-request page. | Operational deletion process, response SLAs, linked data/caches/storage cleanup, Play Data safety disclosures and published privacy policy verification; see https://support.google.com/googleplay/android-developer/answer/13327111 |
| Automated payments | **Intentionally disabled.** | Requires regulated partner agreements, strong authorization/transaction policy and independent security review. Not a condition for a read-only household MVP. |

## Immediate P0 release blockers

1. **Physical multi-account privacy tests:** owner creates a private passport, member cannot list/view/ask Chief about it; owner opts in to share a benign warranty, member can access it; revoke sharing removes access on fresh requests. Confirm bank balances and transactions never appear to another member, in shared dashboard, Chief or shared chat history.
2. **Documents and scanner smoke tests:** camera JPG; gallery PNG; document PDF; offline AI; valid expiry; shared-vs-private; signed URL expiry; storage deletion and record deletion; rejection of mismatched content and oversized file.
3. **Safety: Home Assistant:** no unconfirmed lock, garage, gas/water-valve commands from Chief; verify real device remote URL/security before any public control. Review outbound SSRF and webhook authentication per household.
4. **RevenueCat enforcement and Play:** paid/free entitlement tests, restore after reinstall, Google Play cancellations, server verification failures, Family member gating, tester/license setup; document observed results.
5. **Data safety and account deletion:** ensure Play policy compliance, handle deletion of Auth, DB, Storage and provider tokens, and publish accurate disclosure of AI document processing and household sharing.
6. **Version and rollout control:** signed AAB from reviewed main AFTER grouped changes; Internal Testing smoke test; freeze code; gradual Production rollout only once the above passes.

## P1 backlog — separate from internal MVP launch

- OAuth-compatible Ontario Green Button Connect My Data implementation with real provider registration and user-granted revocation.
- Live CA/NG banking, Nigerian utility lookups and provider-linked bill reconciliation only after regulated partner onboarding/agreements and approved handling of customer data.
- In-household role granularity for medical records and personal Chief history; no private metadata in shared model prompts.
- Orphaned pre-hardening Storage reconciliation (31 objects versus 23 document records at audit time; some objects may be scan originals, so **do not bulk delete** without per-path analysis).
- Monitoring/alerting, backup-restore drill, incident response, secret rotation and cost tracking.
- Document extraction correction UI and verified source citations before relying on AI summaries for decisions.
- Performance and accessibility checks on a range of Android handsets, poor-network testing, battery/network consumption.

## Release discipline

- Merge small PRs only after backend + mobile CI pass. Do **not** trigger `.github/HEARTH_ANDROID_BUILD_READY` for each PR.
- Bundle coherent changes into one Android Internal Testing AAB after several PRs; use the exact GitHub SHA from the EAS build job and verify Play version code.
- Keep live bank connections, automated provider imports and payments disabled until their individual evidence gates are complete.
- A successful Sandbox response or green CI does not prove regulatory/provider approval or production readiness.
- No external tester is currently confirmed; preserve existing household tenant isolation and never invite testers into the founder's personal household.

## Useful official policies
- Google Play app account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play internal testing: https://support.google.com/googleplay/android-developer/answer/9845334
- Ontario Green Button: https://www.oeb.ca/consumer-information-and-protection/green-button
