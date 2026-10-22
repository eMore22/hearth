"""Restricted *operator-only* account deletion for unambiguous invited members.

There is NO HTTP route or background worker for this function. Production
invocation requires a strong server-side operator key, a recent scoped HMAC
approval tied to a fresh inventory digest, and a verified cancellation status
from RevenueCat. It deliberately refuses owners, provider-linked accounts,
uploads, household-shared medical records or other ambiguous records.

A failed partial execution leaves the request in 'processing' for direct
operator reconciliation; it never falsely marks a request as completed.
"""
import hashlib
import hmac
import time
from datetime import datetime, timezone
from fastapi import HTTPException
from app.config import settings
from app.dependencies import get_supabase_admin
from app.services.deletion_plan import build_deletion_plan
from app.services.subscriptions import _lookup_remote, BillingUnavailable

CLEANUP_TABLES = ("chat_messages", "push_tokens", "analytics_events")
BLOCK_IF_PRESENT = (
    "households", "tasks", "documents", "finance_connections",
    "finance_accounts", "finance_transactions", "finance_consent_events",
    "finance_payment_proposals",
)


def operator_signature(*, request_id: str, user_id: str, digest: str,
                       expires_at: int, secret: str) -> str:
    if len(secret) < 32:
        raise ValueError("Operator key must be at least 32 characters")
    data = f"hearth-deletion-v1:{request_id}:{user_id}:{digest}:{expires_at}".encode()
    return hmac.new(secret.encode(), data, hashlib.sha256).hexdigest()


def _refuse(detail="Account deletion requires a verified operator review"):
    raise HTTPException(status_code=409, detail=detail)


def _confirm_no_rows(db, table: str, col: str, user_id: str) -> None:
    rows = (db.table(table).select("id").eq(col, user_id)
            .limit(1).execute().data or [])
    if rows:
        _refuse(f"{table} deletion could not be verified")


def _assert_no_storage_for_household(db, household_id: str) -> None:
    """Conservative: reject if any household Storage entry may remain.

    The existing Storage objects lack owner attribution. Until an explicit
    reconciliation process exists, removing a member from a household with
    Storage objects could leave personal orphan files behind. Never assume
    the absence of 'documents' rows proves Storage is empty.
    """
    items = db.storage.from_("documents").list(household_id, {"limit": 1000})
    if not isinstance(items, list) or items:
        _refuse("Household document Storage requires an independently verified cleanup")


def execute_member_deletion(*, request_id: str, expected_digest: str,
                            expires_at: int, approval: str, db=None,
                            operator_key: str | None = None,
                            now: int | None = None,
                            subscription_verifier=None) -> dict:
    """Execute one explicitly operator-approved, unambiguous member deletion.

    Call from a restricted operator shell only, never from a user/API route.
    Args are passed as CLI flags, secret remains in backend environment.
    """
    db = db or get_supabase_admin()
    now = int(now if now is not None else time.time())
    secret = operator_key if operator_key is not None else settings.DELETION_OPERATOR_SECRET
    if not isinstance(secret, str) or len(secret) < 32:
        raise HTTPException(status_code=503, detail="Deletion operator approval not configured")
    if not isinstance(expires_at, int) or not now < expires_at <= now + 600:
        _refuse("Expired or invalid deletion approval")

    plan = build_deletion_plan(request_id, db)
    if plan["requested_status"] != "requested":
        _refuse("Deletion request not in requested state")
    if plan["snapshot_sha256"] != expected_digest:
        _refuse("Deletion records changed since operator review")
    if plan["household_role"] != "member":
        _refuse("Owners and ambiguous household memberships need a separate reviewed process")

    uid = plan["user_id"]
    counts = plan["user_owned_counts"]
    if counts.get("household_members") != 1 or counts.get("users") not in (0, 1):
        _refuse("Cannot establish single-member ownership")
    if any(counts.get(t) is None or counts.get(t) for t in BLOCK_IF_PRESENT):
        _refuse("Shared or provider-owned data requires individual resolution")
    shared = plan["shared_sensitive_row_counts"]
    if any(value for value in shared.values()):
        _refuse("Household medical or preference records need an individual rights review")
    if any(counts.get(t) is None for t in CLEANUP_TABLES):
        _refuse("Personal records could not be inventoried")

    signature = operator_signature(request_id=plan["request_id"], user_id=uid,
                                   digest=expected_digest, expires_at=expires_at,
                                   secret=secret)
    if not isinstance(approval, str) or not hmac.compare_digest(approval, signature):
        raise HTTPException(status_code=403, detail="Invalid deletion operator approval")

    membership = (db.table("household_members").select("household_id,role")
                  .eq("user_id", uid).limit(2).execute().data or [])
    if len(membership) != 1 or membership[0].get("role") != "member":
        _refuse("Membership changed before deletion")
    household_id = str(membership[0]["household_id"])
    # Explicitly check that we are not the owner/founder.
    owner = (db.table("households").select("created_by")
             .eq("id", household_id).maybe_single().execute().data or {})
    if not owner.get("created_by") or str(owner["created_by"]) == uid:
        _refuse("Household owner identity requires manual resolution")

    _assert_no_storage_for_household(db, household_id)
    # A RevenueCat outage is a hard stop: deleting Hearth does not cancel a
    # Google Play subscription. Require verified non-paying access first.
    verify = subscription_verifier or _lookup_remote
    try:
        if verify(uid) != "free":
            _refuse("Active subscription must be cancelled or expired first")
    except BillingUnavailable:
        raise HTTPException(status_code=503, detail="Cannot verify subscription cancellation") from None

    request = (db.table("account_deletion_requests")
               .update({"status": "processing",
                        "updated_at": datetime.now(timezone.utc).isoformat()})
               .eq("id", request_id).eq("user_id", uid)
               .eq("status", "requested").execute().data or [])
    if len(request) != 1:
        _refuse("Deletion request changed before processing")

    # All writes are scoped by user ID; abort if a step did not verify.
    # A mid-run error intentionally leaves 'processing' for manual recovery.
    for table in CLEANUP_TABLES:
        db.table(table).delete().eq("user_id", uid).execute()
        _confirm_no_rows(db, table, "user_id", uid)
    db.table("household_members").delete().eq("user_id", uid).eq("household_id", household_id).execute()
    _confirm_no_rows(db, "household_members", "user_id", uid)

    db.auth.admin.delete_user(uid)
    # Supabase delete_user raises for a failed Auth request. After it returns,
    # confirm the public user profile CASCADE has taken effect.
    _confirm_no_rows(db, "users", "id", uid)
    db.table("account_deletion_requests").update({
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", request_id).eq("user_id", uid).eq("status", "processing").execute()
    completed = (db.table("account_deletion_requests")
                 .select("status,completed_at").eq("id", request_id)
                 .maybe_single().execute().data or {})
    if completed.get("status") != "completed" or not completed.get("completed_at"):
        raise HTTPException(status_code=503, detail="Deletion completion receipt could not be verified")
    return {"request_id": request_id, "status": "completed",
            "member_scope": "single_household_no_shared_storage_or_providers",
            "additional_audit_verification_required": True}
