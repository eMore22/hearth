"""Plaid Sandbox-only Link token issuance.

All credentials are read server-side from Render environment. No account tokens
are saved, exchanged or moved at this stage. Never make production Plaid calls
from this preview integration.
"""
import os
import httpx

PLAID_SANDBOX_ENDPOINT = "https://sandbox.plaid.com/link/token/create"
HEARTH_ANDROID_PACKAGE = "com.emore22.hearth"

class PlaidSandboxUnavailable(RuntimeError):
    pass

async def create_sandbox_link_token(*, user_id: str) -> str:
    client_id = os.getenv("PLAID_CLIENT_ID", "").strip()
    secret = os.getenv("PLAID_SANDBOX_SECRET", "").strip()
    if not client_id or not secret:
        raise PlaidSandboxUnavailable("Plaid Sandbox credentials are not configured")
    if not user_id:
        raise PlaidSandboxUnavailable("Authenticated user required")
    payload = {
        "client_id": client_id,
        "secret": secret,
        "client_name": "Hearth HQ",
        "user": {"client_user_id": user_id},
        "products": ["transactions"],
        "country_codes": ["CA"],
        "language": "en",
        "android_package_name": HEARTH_ANDROID_PACKAGE,
    }
    try:
        async with httpx.AsyncClient(timeout=14.0) as client:
            response = await client.post(PLAID_SANDBOX_ENDPOINT, json=payload)
            response.raise_for_status()
            result = response.json()
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        # Don't log Plaid API responses: some contain sensitive credentials.
        raise PlaidSandboxUnavailable(f"Plaid Sandbox session unavailable ({type(exc).__name__})") from None
    token = result.get("link_token")
    if not isinstance(token, str) or not token:
        raise PlaidSandboxUnavailable("Plaid Sandbox returned no Link token")
    return token
