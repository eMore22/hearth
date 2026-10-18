"""VTpass electricity Sandbox verification ONLY.

Never call /pay, transfer funds, or accept real meter numbers here.
The base URL is fixed to sandbox.vtpass.com and cannot be supplied by clients.
"""
import os
import httpx

SANDBOX_URL = "https://sandbox.vtpass.com"
SERVICE_ID = "enugu-electric"
TEST_NUMBERS = {"prepaid": "1111111111111", "postpaid": "1010101010101"}


class VtpassSandboxUnavailable(Exception):
    pass


def ready() -> bool:
    return (os.getenv("VTPASS_SANDBOX_ENABLED", "").lower() == "true"
            and bool(os.getenv("VTPASS_SANDBOX_API_KEY", "").strip())
            and bool(os.getenv("VTPASS_SANDBOX_SECRET_KEY", "").strip()))


async def verify_test_meter(meter_type: str, number: str) -> dict:
    if meter_type not in TEST_NUMBERS or number != TEST_NUMBERS[meter_type]:
        raise ValueError("Only officially documented Sandbox meter scenarios are permitted")
    if not ready():
        raise VtpassSandboxUnavailable("Sandbox provider verification disabled")
    try:
        async with httpx.AsyncClient(
            base_url=SANDBOX_URL,
            timeout=httpx.Timeout(10.0, connect=4.0),
            follow_redirects=False,
        ) as client:
            response = await client.post("/api/merchant-verify",
                headers={
                    "api-key": os.getenv("VTPASS_SANDBOX_API_KEY", "").strip(),
                    "secret-key": os.getenv("VTPASS_SANDBOX_SECRET_KEY", "").strip(),
                },
                json={"billersCode": number, "serviceID": SERVICE_ID, "type": meter_type})
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict):
            raise VtpassSandboxUnavailable("Unexpected Sandbox provider response")
        accepted = str(payload.get("code")) == "000"
        info = payload.get("content")
        if not isinstance(info, dict):
            info = {}
        # Never return provider's raw payload: addresses, meter identifiers,
        # arrears and names may be present even in Sandbox example responses.
        if info.get("WrongBillersCode") is True:
            accepted = False
        return {
            "source": "vtpass_sandbox",
            "sandbox": True,
            "service_id": SERVICE_ID,
            "meter_type": meter_type,
            "masked_meter": "****" + number[-4:],
            "valid": accepted,
            "provider_verified": accepted,
            "payments_enabled": False,
        }
    except (httpx.HTTPError, ValueError, TypeError):
        raise VtpassSandboxUnavailable("Sandbox provider verification unavailable") from None
