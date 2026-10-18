"""Bounded read-only shared household snapshot.

Household members can pull operational household data without separately
checking each module. Sensitive bank balances, bank transactions, medical
history and private documents are deliberately not included.
"""
from datetime import datetime, timezone
from fastapi import HTTPException
from app.dependencies import get_supabase_admin
from app.services.utility_intelligence import summarize_utilities


def shared_household_snapshot(user: dict, db=None) -> dict:
    household_id = str(user.get("household_id") or "")
    if not household_id or not user.get("id"):
        raise HTTPException(status_code=403, detail="Household membership required")
    db = db or get_supabase_admin()
    status = {}

    def rows(table: str, columns: str, max_rows: int = 50) -> list:
        try:
            result = (db.table(table).select(columns)
                      .eq("household_id", household_id).limit(max_rows).execute())
            status[table] = "available"
            return result.data or []
        except Exception:
            status[table] = "unavailable"
            return []

    try:
        home = (db.table("households").select("name,country,currency,timezone")
                .eq("id", household_id).maybe_single().execute().data or {})
    except Exception:
        raise HTTPException(status_code=503, detail="Household context unavailable") from None
    bills = [b for b in rows("bills",
        "name,provider,amount,currency,billing_cycle,next_due_date,is_active,category", 70)
        if b.get("is_active") is not False]
    groceries = rows("grocery_inventory", "name,quantity,unit,expiry_date", 60)
    tasks = rows("tasks", "title,due_at,is_completed", 50)
    # Devices are last observed; no remote Home Assistant or utility provider
    # network fetches are performed by this inexpensive read-only snapshot.
    devices = rows("ha_devices", "friendly_name,last_state,last_state_at", 35)
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "visibility": "household_members",
        "household": home,
        "source_status": status,
        "bills": bills,
        "utilities": summarize_utilities(bills, home.get("currency")),
        "groceries": groceries,
        "tasks": tasks,
        "devices_last_known": devices,
        "third_party_live_pull_enabled": False,
        "bank_balances_included": False,
        "bank_transactions_included": False,
        "medical_records_included": False,
        "document_contents_included": False,
    }
