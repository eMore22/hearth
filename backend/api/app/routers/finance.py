"""Read-only finance discovery routes. Never initiate transfers or solicit bank credentials."""
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, get_supabase_admin
from app.services.finance_guardrails import proposal_status

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
        result = (db.table("finance_accounts")
                  .select("id,display_name,masked_account,currency,balance_minor,balance_updated_at")
                  .eq("owner_user_id",user_id).eq("household_id",household_id)
                  .limit(30).execute())
    except Exception:
        # The review-only finance migration may not be applied yet.
        raise HTTPException(status_code=503,detail="Bank accounts are not available yet")
    return {"accounts": result.data or [], "live_sync_enabled": False}

@router.get("/payment-availability")
def payment_availability(current_user: dict = Depends(get_current_user)):
    _identity(current_user)
    return {"available": False, "reason": "Live payments are not enabled"}
