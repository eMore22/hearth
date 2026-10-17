"""Hourly maintenance of expiring Plaid SANDBOX Items.

Runs server-side only; never accesses live banking. Revokes locally before the
remote Item/remove call. Provider outages remain retryable via encrypted token.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from app.workers.celery_app import celery_app
from app.dependencies import get_supabase_admin
from app.services.plaid_persistent_sandbox import disconnect_sandbox_bank, SandboxBankError

log = logging.getLogger(__name__)

@celery_app.task(name="finance.expire_sandbox_connections")
def expire_sandbox_connections() -> dict:
    # Skip gracefully when staging schema/keys are not yet in place.
    if not all(os.getenv(k) for k in (
        "PLAID_CLIENT_ID", "PLAID_SANDBOX_SECRET", "FINANCE_TOKEN_ENCRYPTION_KEY"
    )):
        return {"status": "not_configured"}
    db = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    try:
        expired = (db.table("finance_connections").select(
            "id,owner_user_id,household_id").eq("provider","plaid")
            .eq("country_code","CA").eq("status","linked")
            .lt("consent_expires_at", now).limit(100).execute().data or [])
        retry = (db.table("finance_connections").select(
            "id,owner_user_id,household_id").eq("provider","plaid")
            .eq("country_code","CA").eq("status","error")
            .not_.is_("consent_revoked_at","null").limit(100).execute().data or [])
    except Exception:
        return {"status": "schema_unavailable"}
    completed, failed = 0, 0
    # Deduplicate in case of eventual query overlap.
    records = {item["id"]:item for item in expired + retry}
    for item in records.values():
        try:
            asyncio.run(disconnect_sandbox_bank(
                connection_id=item["id"],owner_id=item["owner_user_id"],
                household_id=item["household_id"]))
            completed += 1
        except (SandboxBankError, Exception) as exc:
            # Never log account IDs, usernames, tokens or provider responses.
            failed += 1
            log.warning("Sandbox revoke retry failed (%s)", type(exc).__name__)
    return {"completed":completed,"failed":failed}
