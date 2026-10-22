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
from app.services.document_security import storage_path
from app.services.subscriptions import _lookup_remote, BillingUnavailable

CLEANUP_TABLES = ("chat_messages", "push_tokens", "analytics_events")
BLOCK_IF_PRESENT = (
    "households", "tasks", "finance_connections",
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


def _list_storage_paths(db, household_id: str) -> set[str]:
    """Enumerate all nested Storage objects in one household, or fail closed.

    Supabase returns virtual folders (id=None) for paths like
    household-id/document-uuid/file.pdf. Every file must match a DB row.
    We cap depth, entries and total objects to avoid incomplete inventories.
    """
    bucket = db.storage.from_("documents")
    pending = [(household_id, 0)]
    found: set[str] = set()
    visited: set[str] = set()
    while pending:
        folder, depth = pending.pop()
        if folder in visited or depth > 5 or len(visited) > 400:
            _refuse("Document Storage inventory exceeded safety limits")
        visited.add(folder)
        entries = bucket.list(folder, {"limit": 1001, "offset": 0})
        if not isinstance(entries, list) or len(entries) >= 1001:
            _refuse("Document Storage listing incomplete")
        for entry in entries:
            if not isinstance(entry, dict):
                _refuse("Document Storage listing invalid")
            name = entry.get("name")
            if (not isinstance(name, str) or not name or
                    name in (".", "..") or "/" in name or "\\" in name):
                _refuse("Unrecognized document Storage path")
            path = folder + "/" + name
            if entry.get("id") or entry.get("metadata") is not None:
                found.add(path)
            else:
                pending.append((path, depth + 1))
            if len(found) + len(pending) > 4000:
                _refuse("Document Storage inventory exceeded limits")
    return found


def _reconcile_documents(db, user_id: str, household_id: str) -> set[str]:
    """Only private uploader-owned objects may be removed.

    Every document in household Storage must be accounted for by a
    metadata record, including those belonging to OTHER family members.
    An unknown orphan or duplicate path blocks all deletion.
    """
    rows = (db.table("documents")
            .select("id,household_id,uploaded_by,visibility,file_url")
            .eq("household_id", household_id).limit(1001).execute().data or [])
    if len(rows) >= 1001:
        _refuse("Too many household documents for safe reconciliation")
    paths = {}
    owned = set()
    for doc in rows:
        path = storage_path(doc.get("file_url"), household_id)
        if not path or path in paths:
            _refuse("Invalid or duplicate document Storage reference")
        paths[path] = doc
        if str(doc.get("uploaded_by")) == user_id:
            if doc.get("visibility") != "private":
                _refuse("Shared documents require family rights review")
            owned.add(path)
    current = _list_storage_paths(db, household_id)
    if current != set(paths):
        _refuse("Untracked or missing Storage objects require manual review")
    return owned


def _remove_and_verify_private_documents(db, user_id: str,
                                        household_id: str, owned: set[str]) -> None:
    if not owned:
        return
    db.storage.from_("documents").remove(sorted(owned))
    after = _list_storage_paths(db, household_id)
    if any(path in after for path in owned):
        raise HTTPException(status_code=503, detail="Document removal not fully verified")
    db.table("documents").delete().eq("uploaded_by", user_id).eq(
        "household_id", household_id).eq("visibility", "private").execute()
    _confirm_no_rows(db, "documents", "uploaded_by", user_id)


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
    if counts.get("documents") is None:
        _refuse("Document inventory unavailable")
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

    private_document_paths = _reconcile_documents(db, uid, household_id)
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
    _remove_and_verify_private_documents(db, uid, household_id, private_document_paths)
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
            "member_scope": "single_household_private_documents_reconciled_no_providers",
            "additional_audit_verification_required": True}
