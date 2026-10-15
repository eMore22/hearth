# Hearth HQ Android production release gate
Updated: 2026-10-15. Branch: `fix/launch-hardening-2026-10-15`.

## Verified in this review branch
- [x] Python compilation and regression tests pass on GitHub Actions.
- [x] Mobile TypeScript type check passes in GitHub Actions.
- [x] Expo config check passes.
- [x] Current Expo SDK 54 targets API level 36 by default.
- [x] Smart-home command acknowledgement distinguished from confirmed device state.
- [x] RevenueCat SDK initialized before offerings/purchase/restore.
- [x] AI gateway has bounded calls, circuit breaker and offline fallback.
- [x] Household mutation security reviewed and scoped.
- [x] Schedules staggered to reduce simultaneous Celery memory load.

## Must verify before merging and public Play upload
- [x] Correct production Supabase project connected (`ewulkcyhjjbpmrvhdfly`); RLS enabled on public tables. Household membership and HA credential access have been locked down in live DB.
- [x] Supabase `documents` Storage bucket is **private**. Signed-link compatibility added for 23 older document records; physical document download still needs app smoke testing.
- [ ] Configure `HA_WEBHOOK_SECRET` in Render and the identical token in trusted Home Assistant webhook sender under the `X-Hearth-Webhook-Token` header. Until then, webhook events return HTTP 503 intentionally. Existing direct device control uses polling and is not dependent on this webhook.
- [ ] Verify the Home Assistant access token and URLs are safely secured at rest. This is not solved by a short-lived signed file link.
- [x] Expo EAS `production` environment contains the public Android RevenueCat SDK key (user-confirmed screenshot).
- [x] RevenueCat packages `home_monthly`, `family_monthly` and entitlements `home`, `family` match app code; Google Play has both products and active base plans. Pub/Sub notification delivery verified on 2026-10-15.
- [ ] Perform test purchase and restore through Google Play Internal Testing, with accurate region pricing and entitlement updates, using the exact proposed AAB.
- [ ] Confirm `support@hearthhq.online` accepts deletion requests, test live `/account-deletion` web page and verify Play Console's account-deletion URL and Data safety answers.
- [ ] Test physical Main Water Valve, lock, light, cover and leak alert; confirm correct post-action states without false positives.
- [ ] Check Render worker memory after staggered schedule; it was OOM-killed on Oct 10, 12, 13 at the old 512 MiB cap.
- [ ] Verify account/household access controls, data retention, health disclosures and privacy policy accuracy.
- [ ] Review final diff and merge PR #1 only after required checks; Render `main` auto-deploys to API, worker and beat.
- [x] Chief now reads authorized backend household context instead of accepting mobile snapshots, with grounded cross-module prompting, truthful integrations, offline overview and device state confirmation; CI regression checks added.
- [x] Revoked direct client access to Home Assistant credentials and unsafe membership write policies; hardened privileged function execution on live Supabase.
- [ ] Verify Celery worker memory use *after deployment*: before fixes, solo-pool usage increased from ~377 MB to ~430 MB in 4 hours on a 512 MB instance; service-role HTTP client reuse and job staggering are still untested in production.

## Build and submit
From the repository:
```sh
npm ci
npx tsc --noEmit --project apps/mobile/tsconfig.json
cd apps/mobile
npx expo config --type public
eas env:list --environment production
eas build --platform android --profile production
```
The `production` EAS profile auto-increments Android version code and builds a store-distribution Android App Bundle. EAS credentials/signing must match the Play Console app already in Internal Testing.

After the new AAB is ready, upload it in Play Console > Production > Create new release. Confirm required app content/declarations, stage the rollout, review and submit. Production-track access approval is separate from app review.

## Remaining product hardening
- IMPORTANT MONETIZATION BLOCKER: screens read RevenueCat entitlements but backend modules do not enforce paid tiers. A revenue policy and verified server-side entitlement checks are still needed before requiring payment or claiming Home/Family features are locked.
- Long-lived intelligence cache for repeated document uploads and advanced reasoning is not yet implemented; persisted document extraction is reused for reads.
- Not every conversational mutation (e.g. adding groceries by natural language) is implemented as a safe deterministic command yet. Normal module CRUD continues through deterministic endpoints.
- Production Home Assistant webhook requires setting an identical shared token at the sending Home Assistant instance and in Render. Until configured, webhook safely responds 503; live HA alerts will not flow via that endpoint. Verify after deployment.
- EAS AAB validation build was triggered from review branch at commit a86497d; subsequent commits require a fresh final AAB. See GitHub Actions run 38729621781.
