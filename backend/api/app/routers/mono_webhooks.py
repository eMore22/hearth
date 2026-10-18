"""Verified Mono Connect Sandbox events.

The POST endpoint must be called ONLY by Mono. Header authentication and
app/reference matching prevent account injection between Hearth households.
No financial details are taken from webhook bodies into user-facing responses.
"""
import hmac
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException, Request
from app.dependencies import get_supabase_admin
from app.services.mono_connect_link import config_ready, ACCOUNT_ID

router = APIRouter(tags=["MonoSandboxWebhook"])


@router.post("/mono")
async def mono_event(request: Request, mono_webhook_secret: str | None = Header(default=None)):
    secret = os.getenv("MONO_SANDBOX_WEBHOOK_SECRET", "")
    if not config_ready() or not secret or not mono_webhook_secret or not hmac.compare_digest(
        mono_webhook_secret, secret
    ):
        raise HTTPException(status_code=401, detail="Unauthorized event")

    if int(request.headers.get("content-length", "0") or "0") > 32768:
        raise HTTPException(status_code=413, detail="Event too large")
    raw = await request.body()
    if len(raw) > 32768:
        raise HTTPException(status_code=413, detail="Event too large")
    try:
        import json
        event = json.loads(raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Malformed event") from None
    if not isinstance(event, dict) or event.get("event") != "mono.events.account_connected":
        return {"received": True}

    data = event.get("data")
    if not isinstance(data, dict) or str(data.get("app") or "") != os.getenv("MONO_SANDBOX_APP_ID", ""):
        raise HTTPException(status_code=400, detail="Unrecognized Sandbox app")
    account_id = data.get("id")
    meta = data.get("meta") or {}
    ref = meta.get("ref") if isinstance(meta, dict) else None
    if not isinstance(account_id, str) or not ACCOUNT_ID.fullmatch(account_id):
        raise HTTPException(status_code=400, detail="Invalid Sandbox reference")
    try:
        UUID(str(ref))
        db = get_supabase_admin()
        pending = (db.table("finance_connections").select(
            "id,created_at,status,consent_expires_at,provider,country_code")
            .eq("id", str(ref)).eq("provider", "mono").eq("country_code", "NG")
            .maybe_single().execute().data)
        if not pending or pending.get("status") != "pending":
            # Idempotent retries are safe: do not re-link a revoked account.
            return {"received": True}
        created = datetime.fromisoformat(pending["created_at"].replace("Z", "+00:00"))
        expires = datetime.fromisoformat(pending["consent_expires_at"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if created + timedelta(hours=1) < now or expires <= now:
            return {"received": True}
        result = (db.table("finance_connections")
                  .update({"status": "linked", "provider_connection_ref": account_id,
                           "updated_at": now.isoformat()})
                  .eq("id", str(ref)).eq("status", "pending")
                  .eq("provider", "mono").eq("country_code", "NG")
                  .is_("consent_revoked_at", "null")
                  .execute())
        if not result.data:
            # A concurrently revoked or expired session must stay revoked.
            return {"received": True}
        db.table("finance_consent_events").insert({
            "connection_id": str(ref), "household_id": result.data[0]["household_id"],
            "owner_user_id": result.data[0]["owner_user_id"],
            "event_type": "granted", "scopes": ["accounts.read", "balances.read", "transactions.read"]
        }).execute()
    except HTTPException:
        raise
    except Exception:
        # A transient DB failure should be retried by Mono, not silently acked.
        raise HTTPException(status_code=503, detail="Sandbox event processing unavailable") from None
    return {"received": True}
