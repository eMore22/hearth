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
- [ ] Confirm the actual production Supabase project is connected; current connected project differs from the live API's Supabase host. Audit RLS, storage buckets and public document URLs, including previously uploaded files.
- [ ] Confirm Supabase `documents` Storage bucket is **private**. New uploads store private paths; authorized listings generate short-lived URLs. Older public URLs require remediation.
- [ ] Configure `HA_WEBHOOK_SECRET` in Render and the identical token in trusted Home Assistant webhook sender under the `X-Hearth-Webhook-Token` header. Until then, webhook events return HTTP 503 intentionally. Existing direct device control uses polling and is not dependent on this webhook.
- [ ] Verify the Home Assistant access token and URLs are safely secured at rest. This is not solved by a short-lived signed file link.
- [ ] In Expo EAS **production environment**, set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` to the public Google Play RevenueCat SDK key (`goog_...`).
- [ ] RevenueCat current offering includes packages exactly named `home_monthly` and `family_monthly`, and entitlements `home` and `family`. Ensure matching active Google Play subscription products and base plans.
- [ ] Perform test purchase and restore through Google Play Internal Testing, with accurate region pricing and entitlement updates, using the exact proposed AAB.
- [ ] Confirm `support@hearthhq.online` accepts deletion requests, test live `/account-deletion` web page and verify Play Console's account-deletion URL and Data safety answers.
- [ ] Test physical Main Water Valve, lock, light, cover and leak alert; confirm correct post-action states without false positives.
- [ ] Check Render worker memory after staggered schedule; it was OOM-killed on Oct 10, 12, 13 at the old 512 MiB cap.
- [ ] Verify account/household access controls, data retention, health disclosures and privacy policy accuracy.
- [ ] Review final diff and merge PR #1 only after required checks; Render `main` auto-deploys to API, worker and beat.

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
- Premium/server-side entitlement enforcement requires verified RevenueCat server configuration and a tier-policy decision.
- Long-lived intelligence cache for repeated document uploads and advanced reasoning is not yet implemented; persisted document extraction is reused for reads.
- Not every conversational mutation (e.g. adding groceries by natural language) is implemented as a safe deterministic command yet. Normal module CRUD continues through deterministic endpoints.
- Production Home Assistant webhook and document access must be retested against the live Supabase configuration.
