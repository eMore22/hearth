"""Read-only, household-scoped context for Hearth Chief of Staff.

Never accept client-supplied household/device state as an authority. Keep all
queries bounded and explicitly select safe fields, excluding access tokens,
document URLs, payment identifiers and unrelated tenants.
"""
import logging
from datetime import datetime, timezone
from typing import Any

from app.dependencies import get_supabase_admin
from app.services.utility_intelligence import summarize_utilities

logger = logging.getLogger(__name__)


def _rows(db: Any, table: str, household_id: str, columns: str,
          *, limit: int = 50, date_column: str | None = None) -> list[dict] | None:
    """None means unavailable; [] means a successful empty query."""
    try:
        query = db.table(table).select(columns).eq("household_id", household_id)
        if date_column:
            query = query.order(date_column, desc=True)
        return query.limit(limit).execute().data or []
    except Exception as exc:
        logger.warning("Chief context query unavailable: %s (%s)", table, type(exc).__name__)
        return None


def load_household_context(household_id: str, db: Any = None) -> dict:
    """Collect a bounded, authoritative overview of all connected modules."""
    if not household_id:
        raise ValueError("A verified household is required")
    db = db or get_supabase_admin()
    overview = {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "source_status": {},
        "integrations": [],
    }

    def collect(key: str, table: str, columns: str, *, limit: int = 40,
                ordered: str | None = None) -> list[dict]:
        results = _rows(db, table, household_id, columns, limit=limit, date_column=ordered)
        overview["source_status"][key] = "available" if results is not None else "unavailable"
        return results or []

    # Unlike module tables, households uses id rather than household_id.
    try:
        household = (db.table("households").select("id,name,country,currency,timezone")
                     .eq("id", household_id).limit(1).execute().data or [])
        overview["source_status"]["household"] = "available"
    except Exception as exc:
        logger.warning("Household profile unavailable (%s)", type(exc).__name__)
        household = []
        overview["source_status"]["household"] = "unavailable"
    overview["household"] = household[0] if household else {}

    members = collect("members", "household_members", "role", limit=30)
    overview["household_member_count"] = len(members)
    overview["documents"] = collect("documents", "documents",
        "title,document_type,issuer,expiry_date,summary,created_at", limit=60)
    overview["alerts"] = collect("document_alerts", "document_alerts",
        "message,urgency,days_until_expiry,sent_at", limit=40, ordered="sent_at")
    overview["bills"] = collect("bills", "bills",
        "name,provider,amount,currency,billing_cycle,next_due_date,is_active,category", limit=60)
    # Only saved household obligations. Never assume provider-confirmed usage,
    # meter state, or payment. No private bank account data is loaded here.
    overview["utilities"] = summarize_utilities(
        overview["bills"], (overview["household"] or {}).get("currency"))
    overview["source_status"]["utilities"] = overview["source_status"]["bills"]
    overview["inventory"] = collect("groceries", "grocery_inventory",
        "name,quantity,unit,category,expiry_date", limit=80)
    legacy_inventory = collect("legacy_inventory", "inventory",
        "name,quantity,expiry_date", limit=40)
    if not overview["inventory"] and legacy_inventory:
        overview["inventory"] = legacy_inventory
    overview["shopping_lists"] = collect("shopping_lists", "shopping_lists",
        "items,week_start", limit=2, ordered="created_at")
    meal_plans = collect("meal_plans", "meal_plans", "plan_data,week_start",
        limit=1, ordered="created_at")
    overview["meal_plan"] = (meal_plans[0].get("plan_data") or {}) if meal_plans else {}
    preferences = collect("preferences", "household_preferences",
        "weekly_budget,currency,dietary_restrictions,cuisine_preferences,household_size", limit=1)
    overview["grocery_budget"] = preferences[0].get("weekly_budget") if preferences else None
    overview["preferences"] = preferences[0] if preferences else {}
    overview["tasks"] = collect("maintenance", "maintenance_tasks",
        "title,category,description,next_due_date,is_active,estimated_cost", limit=60)
    overview["household_tasks"] = collect("tasks", "tasks",
        "title,notes,due_at,is_completed", limit=60)
    overview["medications"] = collect("medications", "medications",
        "member_name,name,dosage,frequency,is_active", limit=30)
    overview["health_reminders"] = collect("health_reminders", "health_reminders",
        "member_name,title,due_at,is_sent", limit=30)
    # Keep medical symptoms out of general-purpose Chief prompts by default.
    overview["health_event_count"] = len(collect("health_events", "health_events",
        "id", limit=100))
    overview["home_profiles"] = collect("home_profiles", "home_profiles",
        "property_type,year_built,appliances,vehicles", limit=1)

    conn = collect("home_assistant", "ha_connections",
        "is_active,last_sync_at,ha_connected_at", limit=1)
    ha_active = bool(conn and conn[0].get("is_active"))
    overview["smart_home_connected"] = ha_active
    overview["ha_devices"] = collect("ha_devices", "ha_devices",
        "entity_id,friendly_name,domain,device_class,area,last_state,last_state_at,is_actionable",
        limit=100) if ha_active else []
    overview["smart_home_device_count"] = len(overview["ha_devices"])
    events = collect("ha_events", "ha_events",
        "entity_id,event_type,new_state,alert_sent,created_at", limit=30,
        ordered="created_at")
    # Only recent observations are considered current alerts. Never infer
    # that an older, already acknowledged alert is still active.
    def recent(event: dict) -> bool:
        try:
            stamp = datetime.fromisoformat(str(event.get("created_at")).replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - stamp).total_seconds() <= 48 * 3600
        except (TypeError, ValueError):
            return False

    overview["smart_home_alerts"] = [
        {"entity": event.get("entity_id"), "new_state": event.get("new_state"),
         "time": event.get("created_at")}
        for event in events if event.get("alert_sent") and recent(event)
    ][:8]
    overview["device_actions"] = collect("device_actions", "ha_actions",
        "entity_id,action,status,created_at", limit=15, ordered="created_at")
    overview["activity"] = collect("activity", "analytics_events",
        "event_name,module,created_at", limit=25, ordered="created_at")
    overview["savings"] = collect("savings", "savings_log",
        "amount_saved,description,achieved_at", limit=25, ordered="achieved_at")
    overview["integrations"] = [{
        "name": "Home Assistant",
        "connected": ha_active,
        "last_sync_at": conn[0].get("last_sync_at") if conn else None,
        "devices": overview["smart_home_device_count"],
    }]
    # Other integrations are not connected: never suggest that Chief can
    # access arbitrary calendars, banks, messaging providers, or third-party apps.
    return overview
