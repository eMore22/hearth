"""Privileged deletion review queue; not mounted as a public HTTP endpoint.

Provides operational visibility without modifying or disclosing the user's
private files, financial records, health history or credentials.
"""
from datetime import datetime, timezone
from fastapi import HTTPException
from app.dependencies import get_supabase_admin
from app.services.deletion_preflight import deletion_preflight


def pending_deletion_queue(db=None, *, limit: int = 25,
                           now: datetime | None = None,
                           aging_days: int = 7) -> dict:
    if not 1 <= limit <= 100 or not 1 <= aging_days <= 365:
        raise ValueError("Invalid deletion review limit or aging window")
    db = db or get_supabase_admin()
    now = now or datetime.now(timezone.utc)
    try:
        rows = (db.table("account_deletion_requests")
                .select("id,status,requested_at")
                .in_("status", ["requested", "processing"])
                .order("requested_at", desc=False)
                .limit(limit + 1).execute().data or [])
    except Exception:
        raise HTTPException(status_code=503, detail="Deletion queue unavailable") from None
    items = []
    overdue = 0
    for row in rows[:limit]:
        age_days = None
        try:
            at = datetime.fromisoformat(str(row["requested_at"]).replace("Z", "+00:00"))
            age_days = max(0, (now - at).days)
        except (ValueError, TypeError, KeyError):
            pass
        aged = age_days is None or age_days >= aging_days
        overdue += int(aged)
        items.append({"request_id": row["id"], "status": row.get("status"),
                      "age_days": age_days, "needs_operator_attention": aged})
    return {"items": items, "overdue_count": overdue,
            "truncated": len(rows) > limit,
            "destructive_actions_performed": False}


def review_deletion_request(request_id: str, db=None) -> dict:
    """Read-only fail-closed review; never authorizes a destructive action."""
    return deletion_preflight(request_id, db or get_supabase_admin())
