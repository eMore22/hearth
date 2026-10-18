"""Internal-only Nigerian Mono Sandbox institution discovery.

This is *not* a connected bank. It never accepts account credentials or
returns personal financial data. Real linking requires further consent review.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services.mono_sandbox import list_institutions, sandbox_ready, MonoSandboxError

router = APIRouter(tags=["NigeriaSandbox"])


def require_tester(user: dict) -> str:
    user_id = str(user.get("id") or "")
    if not user_id or not user.get("household_id"):
        raise HTTPException(status_code=403, detail="Verified household required")
    allowlist = {x.strip() for x in
                 os.getenv("MONO_SANDBOX_TESTER_USER_IDS", "").split(",") if x.strip()}
    if os.getenv("MONO_SANDBOX_DEMO_ENABLED", "").lower() != "true" or user_id not in allowlist:
        raise HTTPException(status_code=404, detail="Nigerian bank demo unavailable")
    return user_id


@router.get("/capabilities")
def capabilities(current_user: dict = Depends(get_current_user)):
    if not current_user.get("id") or not current_user.get("household_id"):
        raise HTTPException(status_code=403, detail="Verified household required")
    allowed = str(current_user["id"]) in {
        x.strip() for x in os.getenv("MONO_SANDBOX_TESTER_USER_IDS", "").split(",") if x.strip()
    }
    return {
        "country": "NG", "currency": "NGN", "sandbox": True,
        "discovery_available": allowed and sandbox_ready(),
        "bank_linking_enabled": False,
        "account_sync_enabled": False,
        "payment_execution_enabled": False,
    }


@router.get("/institutions")
async def institutions(current_user: dict = Depends(get_current_user)):
    require_tester(current_user)
    try:
        rows = await list_institutions()
    except MonoSandboxError:
        raise HTTPException(status_code=503, detail="Mono Sandbox discovery unavailable") from None
    return {"institutions": rows, "sandbox": True, "country": "NG",
            "bank_linking_enabled": False}
