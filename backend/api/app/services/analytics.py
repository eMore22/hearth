"""
Hearth Analytics Logging Helper
Single shared function every router calls to log a usage event.
Feeds the analytics_events table — the source of truth for "what feature
actually gets used" once there's enough real usage to query.

Usage from any router:
    from app.services.analytics import log_event
    log_event(
        supabase=supabase,
        user_id=user["id"],
        household_id=household_id,
        event_name="document_scanned",
        module="documents",
        metadata={"document_type": "passport"},
    )
"""
from typing import Any, Dict, Optional


def log_event(
    supabase,
    user_id: Optional[str],
    household_id: Optional[str],
    event_name: str,
    module: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Write one row to analytics_events. Never raises — a logging failure
    must never break the actual feature the user is using. Call this
    right before returning from an endpoint, wrapped in nothing extra;
    this function handles its own try/except internally.
    """
    if not household_id:
        # No household yet (e.g. mid-onboarding) — nothing meaningful to log
        return
    try:
        supabase.table("analytics_events").insert({
            "user_id":      user_id,
            "household_id": household_id,
            "event_name":   event_name,
            "module":       module,
            "metadata":     metadata or {},
        }).execute()
    except Exception as e:
        print(f"⚠️ Analytics logging failed (non-fatal) for '{event_name}': {e}")