"""Read-only finance discovery routes. Never initiate transfers or solicit bank credentials."""
import os
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.dependencies import get_current_user, get_supabase_admin
from app.services.finance_guardrails import proposal_status
from app.services.plaid_sandbox import create_sandbox_link_token, PlaidSandboxUnavailable
from app.services.plaid_preview import preview_sandbox_accounts, PlaidPreviewUnavailable
from app.services.plaid_persistent_sandbox import (SandboxBankError, connect_sandbox_bank,
    disconnect_sandbox_bank, list_owned_sandbox_connections)
from app.services.plaid_sandbox_sync import (sync_sandbox_transactions,
    list_sandbox_transactions)

router = APIRouter(tags=["finance"])

def _identity(user: dict) -> tuple[str,str]:
    user_id = str(user.get("id") or "")
    household_id = str(user.get("household_id") or "")
    if not user_id or not household_id:
        raise HTTPException(status_code=403, detail="Verified household membership required")
    return user_id, household_id

@router.get("/capabilities")
def capabilities(current_user: dict = Depends(get_current_user)):
    _identity(current_user)
    return {**proposal_status(), "available_currencies": ["CAD", "NGN"],
            "bank_data_mode": "disabled", "payment_mode": "disabled"}

@router.get("/accounts")
def list_accounts(current_user: dict = Depends(get_current_user)):
    user_id, household_id = _identity(current_user)
    db = get_supabase_admin()
    try:
        # Revoked or expired connections must not leak even stale balances.
        active = (db.table("finance_connections").select("id")
                  .eq("owner_user_id", user_id).eq("household_id", household_id)
                  # Sandbox items are exclusively accessible through the explicit,
                  # feature-gated, tester-allowlisted /sandbox/plaid routes.
                  # Never surface them through the ordinary Finance account API.
                  .neq("provider", "plaid")
                  .eq("status", "linked").is_("consent_revoked_at", "null")
                  .gt("consent_expires_at", datetime.now(timezone.utc).isoformat())
                  .limit(30).execute().data or [])
        ids = [item["id"] for item in active]
        if not ids:
            return {"accounts": [], "live_sync_enabled": False}
        result = (db.table("finance_accounts")
                  .select("id,display_name,masked_account,currency,balance_minor,balance_updated_at")
                  .eq("owner_user_id",user_id).eq("household_id",household_id)
                  .in_("connection_id",ids).limit(30).execute())
    except Exception:
        # The review-only finance migration may not be applied yet.
        raise HTTPException(status_code=503,detail="Bank accounts are not available yet")
    return {"accounts": result.data or [], "live_sync_enabled": False}

@router.get("/payment-availability")
def payment_availability(current_user: dict = Depends(get_current_user)):
    _identity(current_user)
    return {"available": False, "reason": "Live payments are not enabled"}

def _sandbox_tester(user: dict) -> str:
    user_id, _ = _identity(user)
    allowed = {v.strip() for v in os.getenv("PLAID_SANDBOX_TESTER_USER_IDS", "").split(",") if v.strip()}
    if os.getenv("PLAID_SANDBOX_DEMO_ENABLED", "").lower() != "true" or user_id not in allowed:
        raise HTTPException(status_code=404, detail="Sandbox demo unavailable")
    return user_id

@router.post("/sandbox/plaid/link-token")
async def sandbox_link_token(current_user: dict = Depends(get_current_user)):
    user_id = _sandbox_tester(current_user)
    try:
        token = await create_sandbox_link_token(user_id=user_id)
    except PlaidSandboxUnavailable:
        raise HTTPException(status_code=503, detail="Plaid Sandbox is not configured or temporarily unavailable")
    return {"link_token": token, "environment": "sandbox", "country": "CA"}

class SandboxPreviewRequest(BaseModel):
    public_token: str = Field(min_length=1, max_length=512)

@router.post("/sandbox/plaid/preview")
async def sandbox_account_preview(payload: SandboxPreviewRequest, current_user: dict = Depends(get_current_user)):
    _sandbox_tester(current_user)
    try:
        accounts = await preview_sandbox_accounts(payload.public_token)
    except PlaidPreviewUnavailable:
        raise HTTPException(status_code=503, detail="Sandbox preview unavailable or test Item cleanup failed")
    return {"accounts": accounts, "environment": "sandbox", "persistent_connection": False,
            "item_revoked": True, "payments_enabled": False}

class SandboxConnectRequest(BaseModel):
    public_token: str = Field(min_length=1, max_length=512)
    consent_acknowledged: bool = False

@router.post("/sandbox/plaid/connections")
async def sandbox_connect(payload: SandboxConnectRequest, current_user: dict = Depends(get_current_user)):
    user_id = _sandbox_tester(current_user)
    _, household_id = _identity(current_user)
    try:
        return await connect_sandbox_bank(public_token=payload.public_token,
            owner_id=user_id, household_id=household_id,
            consent_acknowledged=payload.consent_acknowledged)
    except SandboxBankError:
        raise HTTPException(status_code=503, detail="Sandbox bank connection could not be saved safely")

@router.get("/sandbox/plaid/connections")
async def sandbox_connections(current_user: dict = Depends(get_current_user)):
    from fastapi.concurrency import run_in_threadpool
    user_id = _sandbox_tester(current_user)
    _, household_id = _identity(current_user)
    try:
        connections = await run_in_threadpool(list_owned_sandbox_connections,
            owner_id=user_id, household_id=household_id)
    except SandboxBankError:
        raise HTTPException(status_code=503, detail="Sandbox connections unavailable")
    return {"connections": connections, "environment": "sandbox"}

@router.post("/sandbox/plaid/connections/{connection_id}/sync")
async def sandbox_sync(connection_id: UUID, current_user: dict = Depends(get_current_user)):
    user_id = _sandbox_tester(current_user)
    _, household_id = _identity(current_user)
    try:
        return await sync_sandbox_transactions(connection_id=str(connection_id),
            owner_id=user_id, household_id=household_id)
    except SandboxBankError:
        raise HTTPException(status_code=503, detail="Sandbox sync unavailable; verify consent and provider status")

@router.get("/sandbox/plaid/connections/{connection_id}/transactions")
async def sandbox_transactions(connection_id: UUID, current_user: dict = Depends(get_current_user)):
    from fastapi.concurrency import run_in_threadpool
    user_id = _sandbox_tester(current_user)
    _, household_id = _identity(current_user)
    try:
        rows = await run_in_threadpool(list_sandbox_transactions,
            connection_id=str(connection_id), owner_id=user_id, household_id=household_id)
    except SandboxBankError:
        raise HTTPException(status_code=503, detail="Sandbox transaction data is unavailable")
    return {"transactions": rows, "environment": "sandbox"}

@router.delete("/sandbox/plaid/connections/{connection_id}")
async def sandbox_disconnect(connection_id: UUID, current_user: dict = Depends(get_current_user)):
    user_id = _sandbox_tester(current_user)
    _, household_id = _identity(current_user)
    try:
        return await disconnect_sandbox_bank(connection_id=str(connection_id),
            owner_id=user_id, household_id=household_id)
    except SandboxBankError:
        raise HTTPException(status_code=503, detail="Sandbox disconnect could not be confirmed; please retry")
