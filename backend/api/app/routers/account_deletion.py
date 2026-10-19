"""Authenticated account-deletion requests, with no destructive side effects.

A request is not proof that deletion has happened. Operators must verify
household roles, cancel provider access and handle shared family data before
purging Supabase Auth and owned records.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_current_user, get_supabase_admin

router = APIRouter(tags=["Account deletion"])

ACTIVE = ("requested", "processing")
PUBLIC_COLUMNS = "id,status,requested_at,updated_at,completed_at"


class DeletionConfirmation(BaseModel):
    confirmation: str


def _user_id(user: dict) -> str:
    user_id = str(user.get("id") or "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


def _public(record: dict) -> dict:
    return {key: record.get(key) for key in
            ("id", "status", "requested_at", "updated_at", "completed_at")}


@router.get("/deletion-request")
async def deletion_request_status(user: dict = Depends(get_current_user)):
    user_id = _user_id(user)
    try:
        data = (get_supabase_admin().table("account_deletion_requests")
                .select(PUBLIC_COLUMNS).eq("user_id", user_id)
                .order("requested_at", desc=True).limit(1).execute().data or [])
        return {"request": _public(data[0]) if data else None}
    except Exception:
        raise HTTPException(status_code=503, detail="Deletion request status unavailable") from None


@router.post("/deletion-request", status_code=202)
async def request_account_deletion(payload: DeletionConfirmation,
                                   user: dict = Depends(get_current_user)):
    user_id = _user_id(user)
    if payload.confirmation != "DELETE MY ACCOUNT":
        raise HTTPException(status_code=422, detail="Type DELETE MY ACCOUNT to confirm")
    db = get_supabase_admin()
    try:
        existing = (db.table("account_deletion_requests")
                    .select(PUBLIC_COLUMNS).eq("user_id", user_id)
                    .in_("status", list(ACTIVE))
                    .order("requested_at", desc=True).limit(1).execute().data or [])
        if existing:
            return {"request": _public(existing[0]), "message": "Your deletion request is already pending."}
        new = (db.table("account_deletion_requests")
               .insert({"user_id": user_id,
                        "household_id_at_request": user.get("household_id"),
                        "status": "requested"}).execute().data or [])
        if not new:
            raise RuntimeError("No stored deletion request")
        return {"request": _public(new[0]),
                "message": "Deletion request received. Your account is still active while we verify and process it. Cancel any Google Play subscription separately."}
    except Exception:
        # A partial-index conflict during concurrent calls is safe; never
        # insert a second active request or claim success when unsure.
        raise HTTPException(status_code=503, detail="Could not save your deletion request. Please retry or contact support.") from None


@router.delete("/deletion-request")
async def cancel_deletion_request(user: dict = Depends(get_current_user)):
    user_id = _user_id(user)
    db = get_supabase_admin()
    try:
        changed = (db.table("account_deletion_requests")
                   .update({"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()})
                   .eq("user_id", user_id).eq("status", "requested")
                   .execute().data or [])
        if not changed:
            raise HTTPException(status_code=409,
                                detail="No cancellable request. Contact support if processing has started.")
        return {"status": "cancelled",
                "message": "Your deletion request has been cancelled; your account remains active."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Could not cancel deletion request") from None
