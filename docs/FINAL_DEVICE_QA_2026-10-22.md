# Hearth release-candidate final device QA (22 Oct 2026)

## Confirmed in advance
- Google Play developer production access and initial Console requirements: founder confirmed complete. This is not the same as approving the final AAB.
- RevenueCat Google Play license-tester purchase and restore: founder confirmed successful. Render logs show multiple successful billing/access responses and two 200 billing/refresh responses on Oct 15. Logs alone do **not** prove entitlement levels.
- Last public API smoke: passed. Render backend workers active.
- Banking live integration: deliberately *excluded* from initial public release, but retained for tester-only Sandbox. Production EAS profile must be used for public release.
- **Do not trigger a new AAB for every documentation or QA change.** Only one production-profile AAB after the final fixes and checks.

## Final QA runbook — two clean test identities, never the founder's real household
Test both the internal-test build and the *production-profile* build. Record installed Android version code, bundle SHA, pass/fail, and evidence link (log/screenshot). Remove sensitive data from screenshots.

| Gate | Action and pass condition |
| --- | --- |
| Installation / identity | Install from Play testing; create adult test account A (owner), invite account B (member), login, logout and password reset. Reopen app; no crash or cross-account bleed. |
| Public banking excluded | On production-profile build, Finance shows manual bills, monthly estimates and due dates; there are **no** Plaid/Mono link/sync/preview CTAs or private Sandbox balance cards. In the internal-test build the Sandbox panels remain available to allowlisted tester identity only. |
| Private documents | A uploads non-sensitive PDF and JPG; A sees both. B cannot list/open/ask Chief about private files. A shares a benign file, B sees it; revoke sharing, B loses access on fresh request. Check owner can delete document and Storage path is gone. |
| Chief privacy | A and B discuss distinct dummy sensitive topics. History is private per user; clearing A's history does not erase B's. Neither receives the other's personal context. |
| Health and household | Verify med reminders, health events and household role access. Do not create real patient info in QA. A member should not read personal records contrary to your intended feature policy. |
| Bills/Utilities | Add/edit bill, expense estimate changes, due date appears, recurring frequency consistent. Utility provider lookups say test/unavailable where no live integration exists. Never advertise payment execution. |
| Home Assistant | Test signed HTTPS remote URL, correct device list, no accidental lock/unlock/garage actuation; offline and invalid/private DNS URL fail safely; disconnect and reconnect. Test with non-critical device first. |
| Billing | On newest final AAB, verify API access reports correct Home/Family tier and whether `serverEnforced` is true; verify free-tier protected API returns 402, Home tier access, Family owner inheritance, restore on reinstall, and tier drops after test expiration/cancellation. Purchase/restore basics already tested; don't repeat without reason. |
| Deletion | Use an isolated disposable account. Check in-app request and cancellation, public deletion URL, operator preflight, and a staged operator-approved deletion with private documents. Verify Supabase Auth, associated Storage, user data, notification tokens and audit receipt. Test household owner and bank-connected cases through case-specific operator procedure; no real user account in QA. |
| Connection interruptions | Test device offline, slow connection, failed AI provider, relaunch; no leaked traceback, no false payment/device-action success. |
| Release metadata | Production-profile Android App Bundle signed correctly; target API, package, version code, RevenueCat SDK public key, privacy/terms URLs and Play Data safety / Health declarations match shipping behavior. |
| Final rollout | Freeze tag and release notes, upload approved production-profile AAB to production, staged rollout with Play vitals/error monitoring and rollback procedure. |

## Hard stops, not reasons to restart development
- Authentication/household privilege escalation or private-health/document leakage.
- Accidental device commands, lost/private files, wrong subscription access or billing.
- Failure to fulfill deletion requests for eligible real accounts or misleading published policies.
- Production build containing Sandbox credentials or working Sandbox bank CTAs.
- Fatal startup/crash or broken paid/essential user journeys.

## Scope of v1
Hearth can launch as a household management app with manually managed bills, tasks, documents, home and family features, paid tiers as tested, and optional connected home features that pass hardware QA. No live banking or money movement. Internal allowlisted testers retain Sandbox bank tests. Play marketing and release screenshots must agree.
