# Home Assistant credential protection — rollout and rotation

## Current intent
Protect Home Assistant long-lived access tokens with Fernet encryption **in the application before they enter Supabase**. The key is held only on the backend Render service as `HA_TOKEN_ENCRYPTION_KEY` (URL-safe base64 Fernet key). Neither the mobile app nor Supabase client needs this key.

## Deployment order (required)
1. Generate a fresh `Fernet.generate_key().decode()` using a trusted secure runtime. Store it in a secure secrets manager, protected from source control and screenshots.
2. Put the identical key in the **API** Render service environment before merging encryption code. A secret change may deploy the existing build; verify the live API.
3. Merge the code only after CI succeeds. The legacy connection remains usable: the first authorized read conditionally encrypts its existing plaintext token. If encryption or database confirmation fails, device interaction fails closed; never log or return the token.
4. Confirm legacy migration **without selecting or printing tokens** by running a privileged SQL check: `select count(*) filter (where ha_access_token like 'hearth-ha-fernet:v1:%') as encrypted, count(*) filter (where is_active and ha_access_token <> '' and ha_access_token not like 'hearth-ha-fernet:v1:%') as legacy_active from public.ha_connections;`. Verify that every active credential is encrypted.
5. After migration, rotate any historical Home Assistant long-lived credentials in Home Assistant itself because old plaintext may exist in older database backups. Reconnect Hearth using new tokens. Clear retained inactive connections where policy permits.
6. On disconnect, the app clears the saved token but **does not remotely revoke Home Assistant's original token**. Inform customers how to revoke old tokens at their HA installation.
7. For key rotation, stage a versioned decrypt-old/encrypt-new transition first; **never replace the key in place** while active ciphertext relies on it. Keep protected backup access to the original key until migrations complete.

## Security caveats
- This protects application-stored database values. It does not replace encrypted database backups, provider credential revocation, TLS, authorization and outbound network restrictions.
- Public HTTPS DNS checks alone do **not** fully defeat DNS rebinding/SSRF: release still requires controlled egress or hardened IP-pinned TLS connections plus physical-device verification.
- If key configuration is absent or invalid, HA connections and commands return unavailable instead of falling back to plaintext writes.
