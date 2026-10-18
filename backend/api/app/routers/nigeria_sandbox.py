"""Internal-only Nigerian Mono Sandbox institution discovery.

This is *not* a connected bank. It never accepts account credentials or
returns personal financial data. Real linking requires further consent review.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.mono_connect_link import (
    initiate, list_owned, account_preview, account_transactions, revoke,
    MonoLinkError, config_ready,
)
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
        "bank_linking_enabled": allowed and config_ready(),
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


class StartLinkRequest(BaseModel):
    consent_acknowledged: bool


def _identity(user: dict) -> tuple[str, str]:
    require_tester(user)
    return str(user["id"]), str(user["household_id"])


@router.post("/link")
async def initiate_link(payload: StartLinkRequest, current_user: dict = Depends(get_current_user)):
    user_id, household_id = _identity(current_user)
    try:
        return await initiate(user_id=user_id, household_id=household_id,
                              email=str(current_user.get("email") or ""),
                              name=str(current_user.get("full_name") or "Hearth Tester"),
                              acknowledged=payload.consent_acknowledged)
    except MonoLinkError:
        raise HTTPException(status_code=503, detail="Mono Sandbox linking unavailable") from None


@router.get("/connections")
def connections(current_user: dict = Depends(get_current_user)):
    user_id, household_id = _identity(current_user)
    try:
        return {"connections": list_owned(user_id, household_id), "sandbox": True}
    except MonoLinkError:
        raise HTTPException(status_code=503, detail="Sandbox connections unavailable") from None


@router.get("/connections/{connection_id}/preview")
async def preview(connection_id: str, current_user: dict = Depends(get_current_user)):
    user_id, household_id = _identity(current_user)
    try:
        return await account_preview(user_id=user_id, household_id=household_id, connection_id=connection_id)
    except MonoLinkError:
        raise HTTPException(status_code=503, detail="Sandbox account preview unavailable") from None


@router.get("/connections/{connection_id}/transactions")
async def transactions(connection_id: str, current_user: dict = Depends(get_current_user)):
    user_id, household_id = _identity(current_user)
    try:
        return await account_transactions(user_id=user_id, household_id=household_id, connection_id=connection_id)
    except MonoLinkError:
        raise HTTPException(status_code=503, detail="Sandbox transactions unavailable") from None


@router.post("/connections/{connection_id}/disconnect")
async def disconnect(connection_id: str, current_user: dict = Depends(get_current_user)):
    user_id, household_id = _identity(current_user)
    try:
        return await revoke(user_id=user_id, household_id=household_id, connection_id=connection_id)
    except MonoLinkError:
        raise HTTPException(status_code=503, detail="Sandbox revocation requires retry") from None
