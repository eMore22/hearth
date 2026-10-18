"""Mono Nigeria Sandbox discovery, disabled unless explicitly allowlisted.

Only lists institutions; no bank credentials, account sessions, transfers,
balance sharing, or payment initiation in this module.
"""
import os
import httpx

API_HOST = "https://api.withmono.com"


class MonoSandboxError(Exception):
    pass


def sandbox_ready() -> bool:
    return bool(os.getenv("MONO_SANDBOX_SECRET_KEY", "").strip()) and (
        os.getenv("MONO_SANDBOX_DEMO_ENABLED", "").lower() == "true"
    )


async def list_institutions() -> list[dict]:
    key = os.getenv("MONO_SANDBOX_SECRET_KEY", "").strip()
    if not sandbox_ready() or not key:
        raise MonoSandboxError("Mono Sandbox credentials not configured")
    try:
        async with httpx.AsyncClient(base_url=API_HOST, timeout=httpx.Timeout(8, connect=4),
                                     follow_redirects=False) as client:
            result = await client.get("/v3/institutions",
                                      params={"scope": "financial_data"},
                                      headers={"mono-sec-key": key, "Accept": "application/json"})
            result.raise_for_status()
            data = result.json()
        if not isinstance(data, dict) or data.get("status") != "successful":
            raise MonoSandboxError("Sandbox institution discovery unavailable")
        raw = data.get("data") or []
        if not isinstance(raw, list):
            raise MonoSandboxError("Unexpected institution response")
        # Whitelist only public display fields; never return provider login forms.
        return [{"id": str(x.get("_id") or "")[:80],
                 "name": str(x.get("name") or "")[:100],
                 "country": "NG"}
                for x in raw[:60] if isinstance(x, dict)
                and str(x.get("country") or "").lower() == "ng"
                and x.get("_id") and x.get("name")]
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise MonoSandboxError("Sandbox institution discovery unavailable") from None
