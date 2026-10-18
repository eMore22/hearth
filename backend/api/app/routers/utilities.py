"""Authenticated read-only utilities, based on saved household bills.

Future utility-provider payments are deliberately not implemented.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, get_supabase_admin
from app.services.utility_intelligence import summarize_utilities

router = APIRouter(tags=["Utilities"])


@router.get("/overview")
def overview(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=403, detail="Household membership required")
    try:
        db = get_supabase_admin()
        rows = (db.table("bills")
                .select("name,provider,category,amount,currency,next_due_date,is_active")
                .eq("household_id", household_id).eq("is_active", True)
                .limit(150).execute().data or [])
        house = (db.table("households").select("currency").eq("id", household_id)
                 .maybe_single().execute().data or {})
    except Exception:
        raise HTTPException(status_code=503, detail="Utility records are temporarily unavailable") from None
    return summarize_utilities(rows, house.get("currency"))


@router.get("/capabilities")
def capabilities(current_user: dict = Depends(get_current_user)):
    if not current_user.get("household_id"):
        raise HTTPException(status_code=403, detail="Household membership required")
    return {
        "available_categories": ["electricity", "water", "internet", "gas", "television"],
        "manual_tracking_enabled": True,
        "real_provider_connections_enabled": False,
        "provider_meter_verification_enabled": False,
        "bill_payment_enabled": False,
    }
