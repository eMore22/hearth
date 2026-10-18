"""Owner-only private banking overview for the Hearth profile.

The shared household context, bills, utilities and Chief never call this service.
Balances are read from authorized, unexpired, owner-linked records only.
Mono balances are not automatically polled; that is a separate explicit action.
"""
from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException
from app.dependencies import get_supabase_admin


def require_household_owner(user: dict, db=None) -> tuple[str, str]:
    user_id = str(user.get("id") or "")
    household_id = str(user.get("household_id") or "")
    if not user_id or not household_id:
        raise HTTPException(status_code=403, detail="Household membership required")
    try:
        UUID(user_id)
        UUID(household_id)
        db = db or get_supabase_admin()
        role = (db.table("household_members").select("role")
                .eq("user_id", user_id).eq("household_id", household_id)
                .maybe_single().execute().data or {}).get("role")
    except (ValueError, TypeError):
        raise HTTPException(status_code=403, detail="Household membership required") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Household permissions unavailable") from None
    if role != "owner":
        raise HTTPException(status_code=403, detail="Bank balances are available only to the household owner")
    return user_id, household_id


def owner_bank_profile(user: dict) -> dict:
    db = get_supabase_admin()
    owner_id, household_id = require_household_owner(user, db)
    try:
        active = (db.table("finance_connections").select("id,provider,country_code,last_synced_at")
                  .eq("owner_user_id", owner_id).eq("household_id", household_id)
                  .eq("status", "linked").is_("consent_revoked_at", "null")
                  .gt("consent_expires_at", datetime.now(timezone.utc).isoformat())
                  .limit(25).execute().data or [])
        # Never expose a family member's account, even to the household owner.
        plaid_ids = [row["id"] for row in active if row.get("provider") == "plaid" and row.get("country_code") == "CA"]
        mono = [{"id": row["id"], "country": "NG", "provider": "mono",
                 "balance_requires_explicit_refresh": True}
                for row in active if row.get("provider") == "mono" and row.get("country_code") == "NG"]
        accounts = []
        if plaid_ids:
            records = (db.table("finance_accounts")
                       .select("id,display_name,masked_account,currency,balance_minor,balance_updated_at,connection_id")
                       .eq("household_id", household_id).eq("owner_user_id", owner_id)
                       .in_("connection_id", plaid_ids).limit(30).execute().data or [])
            accounts = [
                {"id": r["id"], "display_name": r.get("display_name"),
                 "masked_account": r.get("masked_account"),
                 "currency": r.get("currency"),
                 "balance_minor": r.get("balance_minor") if type(r.get("balance_minor")) is int else None,
                 "updated_at": r.get("balance_updated_at"), "provider": "plaid",
                 "sandbox": True}
                for r in records if r.get("currency") == "CAD"
            ]
        return {"private": True, "owner_only": True, "sandbox_only": True,
                "accounts": accounts, "mono_connections": mono,
                "payments_enabled": False}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Private banking preview unavailable") from None
