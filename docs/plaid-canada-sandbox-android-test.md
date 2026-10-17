# Plaid Canada Sandbox demo — Android internal testing

Status: development / internal-test only. No real bank link or fund movement.

## Credentials and access gates

The API reads PLAID_CLIENT_ID and PLAID_SANDBOX_SECRET only from Render environment variables; never embed either in Expo, GitHub, logs or analytics.

The two Sandbox endpoints are **off by default**, even when Plaid credentials exist.

Set on the API service, only for authorized internal testing:

- PLAID_SANDBOX_DEMO_ENABLED=true
- PLAID_SANDBOX_TESTER_USER_IDS=<comma-separated authenticated Supabase user UUIDs>

When not testing, set PLAID_SANDBOX_DEMO_ENABLED=false. Do not put the allowlist or access credentials in the app. Only service admins should change these values.

For an internal-test app bundle, the EAS `internalTest` profile sets `EXPO_PUBLIC_PLAID_SANDBOX_DEMO=true`. The production profile does **not** show the demo; that UI flag is NOT a backend security boundary. The backend allowlist is mandatory.

## Android requirements

- Expo 54 / RN 0.81.
- `react-native-plaid-link-sdk` pinned to v13.3.0; native custom build required, Expo Go unsupported.
- `expo-build-properties` minSdkVersion=26 and compileSdkVersion=36 for Plaid Android SDK.
- Registered Plaid Android package `com.emore22.hearth`.

## Manual test on signed internal app

1. Open Hearth > Profile > Integrations > Household Finance.
2. Confirm the purple **Canadian bank Sandbox** panel displays in the internal-test bundle only.
3. Tap **Try Canadian bank demo**. App requests a fresh Link token from the backend over an authenticated HTTPS session.
4. In Plaid Sandbox, select **Tartan-Dominion Bank of Canada** if available (ins_43), or an eligible Plaid test institution. Use the published Sandbox credentials from Plaid's test documentation, e.g. user_good/pass_good (never real bank credentials).
5. On success Plaid returns a one-use public token to Hearth. Hearth sends it to `/api/finance/sandbox/plaid/preview`, exchanges it on the server, gets **simulated** accounts and calls /item/remove.
6. Verify labels indicate **simulated** / **one-time preview** and that a new test clears old preview data.
7. Leave Link early; UI must return to a tappable button with no success claim.
8. With no credentials, unknown tester, or flag off, API must deny the flow. Logout and test another household user; one tester must not gain the other user's bank access.
9. Inspect logs: no Plaid secrets, public tokens, access tokens or masked account identifiers should be logged.

## Important limitations

- This is not a durable bank connection or transaction sync. Plaid Item is revoked immediately after preview.
- No persistent finance migration applied, no real bank account connected, no balance refreshed after page exit, and no payment execution.
- A native Android build and an actual device test remain required; passing TypeScript is not proof of successful native SDK compilation.
- Production bank linking requires approved Plaid terms, consent audit, server-only encrypted token vault, unlink/erasure endpoints, webhook verification, transaction cursor synchronization, user-private RLS and end-to-end QA.
