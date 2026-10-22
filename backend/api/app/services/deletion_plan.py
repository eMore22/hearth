"""Fail-closed, READ-ONLY deletion execution manifest for a verified request.

This module is never a public API route. It does not alter an account, send
provider requests, delete storage objects, or authorize an operator to do so.

The plan inventories user-attributed rows regardless of whether the user is
still a member of the original household. A fingerprint flags drift between
an operator review and a later re-review; it is NOT an authorization token.
"""
import hashlib
import json
from fastapi import HTTPException
from app.dependencies import get_supabase_admin
from app.services.deletion_preflight import deletion_preflight
from app.services.document_security import storage_path

MAX_ROWS = 100

# Attributes confirmed against the production schema. Do not infer an item's
# scope from household_id alone: many tables contain other members' records.
USER_OWNED = {
    "households": ("created_by", "id,created_by"),
    "household_members": ("user_id", "id,household_id,role"),
    "users": ("id", "id,household_id"),
    "documents": ("uploaded_by", "id,household_id,file_url,visibility"),
    "tasks": ("created_by", "id,household_id"),
    "chat_messages": ("user_id", "id,household_id"),
    "push_tokens": ("user_id", "id"),
    "analytics_events": ("user_id", "id"),
    "finance_connections": ("owner_user_id", "id,household_id,provider,status"),
    "finance_accounts": ("owner_user_id", "id,household_id"),
    "finance_transactions": ("owner_user_id", "id,household_id"),
    "finance_consent_events": ("owner_user_id", "id,household_id"),
    "finance_payment_proposals": ("payer_user_id", "id,household_id"),
}
# Privacy-sensitive records which are household keyed, without sufficiently
# reliable user attribution for individual-member automatic deletion.
SHARED_SENSITIVE = (
    "health_events", "medications", "family_health_profiles",
    "health_reminders", "household_preferences",
)


def _bounded_rows(db, table: str, col: str, value: str, select: str):
    rows = (db.table(table).select(select).eq(col, value)
            .limit(MAX_ROWS + 1).execute().data or [])
    if not isinstance(rows, list):
        raise ValueError("Unexpected inventory response")
    return rows, len(rows) > MAX_ROWS


def build_deletion_plan(request_id: str, db=None) -> dict:
    """Inventory all known personal relationships before any operator action.

    Fail closed for incomplete queries, unknown document locations, ownership
    ambiguities and missing third-party revocation or deletion receipts.
    No raw document URLs, connection refs or other people's details are returned.
    """
    db = db or get_supabase_admin()
    preflight = deletion_preflight(request_id, db)
    user_id = preflight["user_id"]
    blockers = list(preflight["blockers"])
    snapshot = {}
    counts = {}
    documents = []
    memberships = []

    for name, (owner_col, fields) in USER_OWNED.items():
        try:
            rows, truncated = _bounded_rows(db, name, owner_col, user_id, fields)
            # Individual scoped IDs are kept only for the digest, never in the
            # returned plan. Counts, not personal records, go to the operator.
            ids = sorted(str(x.get("id") or "") for x in rows)
            if any(not x for x in ids):
                blockers.append(f"{name}: missing row identifier")
            if truncated:
                blockers.append(f"{name}: inventory exceeds {MAX_ROWS} rows")
            # Include every selected field in the opaque digest so edits to
            # document references, sharing, household roles and provider
            # connection state invalidate a previously reviewed snapshot.
            snapshot[name] = sorted(
                [{field: row.get(field) for field in fields.split(",")}
                 for row in rows], key=lambda row: str(row.get("id") or ""))
            counts[name] = len(rows)
            if name == "documents":
                documents = rows
            if name == "household_members":
                memberships = rows
        except Exception:
            counts[name] = None
            blockers.append(f"{name}: inventory unavailable")
            snapshot[name] = None

    owner_rows = counts.get("households")
    if owner_rows:
        blockers.append("User founded one or more households: verify transfer or closure independently")
    if not memberships and preflight["evidence_counts"].get("membership_count"):
        blockers.append("Membership inventory inconsistent with original preflight")
    if len(memberships) > 1:
        blockers.append("Multiple household memberships: individual review required")

    household_ids = sorted({str(m.get("household_id") or "") for m in memberships
                            if m.get("household_id")})
    shared_counts = {}
    shared_snapshot = {}
    for hid in household_ids:
        for table in SHARED_SENSITIVE:
            try:
                rows, truncated = _bounded_rows(db, table, "household_id", hid, "id")
                shared_counts[f"{table}:{hid}"] = len(rows)
                shared_snapshot[f"{table}:{hid}"] = sorted(str(row.get("id") or "") for row in rows)
                if truncated:
                    blockers.append(f"{table}: shared data inventory exceeds {MAX_ROWS}")
                if rows:
                    blockers.append(f"{table}: household-wide data requires other members' rights review")
            except Exception:
                shared_counts[f"{table}:{hid}"] = None
                shared_snapshot[f"{table}:{hid}"] = None
                blockers.append(f"{table}: shared data inventory unavailable")

    document_checks = {"rows": len(documents), "invalid_paths": 0,
                       "shared_documents": 0, "storage_objects_verified": False}
    for doc in documents:
        household_id = str(doc.get("household_id") or "")
        reference = doc.get("file_url")
        if not household_id or not storage_path(reference, household_id):
            document_checks["invalid_paths"] += 1
        if doc.get("visibility") == "household":
            document_checks["shared_documents"] += 1
    if document_checks["invalid_paths"]:
        blockers.append("Some document references are invalid or outside their household storage path")
    if document_checks["shared_documents"]:
        blockers.append("User uploaded shared documents: other members' access and retention need review")
    if document_checks["rows"]:
        blockers.append("Verify and remove owned Storage objects before deleting Auth user")
    # Storage can hold orphan objects with no documents row: metadata alone
    # never proves the bucket contains no other objects owned by this Auth user.
    blockers.append("Verify all Storage objects owned by requester, including orphan objects")
    blockers.append("Verify active sessions/JWT expiry handling, provider consent revocation and subscriptions")
    blockers.append("Obtain operator authorization and review applicable data-retention obligations")

    # A database manifest cannot prove external revocation or actual deletion.
    for table in ("finance_connections", "finance_accounts", "finance_transactions",
                  "finance_consent_events", "finance_payment_proposals"):
        if counts.get(table):
            blockers.append(f"{table}: financial records and provider revocation require verified cleanup")
    if counts.get("tasks"):
        blockers.append("User-created household tasks require reassignment or removal decision")

    digest = hashlib.sha256(json.dumps(
        {"request": preflight["request_id"], "user": user_id, "status": preflight["status"],
         "snapshot": snapshot, "shared_snapshot": shared_snapshot,
         "doc": document_checks},
        sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    role = "multiple" if len(memberships) > 1 else (
        str(memberships[0].get("role") or "unknown") if memberships else "unattached")
    return {
        "request_id": preflight["request_id"],
        "user_id": user_id,
        "household_role": role,
        "requested_status": preflight["status"],
        "user_owned_counts": counts,
        "document_checks": document_checks,
        "shared_sensitive_row_counts": {
            name.split(":")[0]: sum(v for key, v in shared_counts.items()
                                   if key.split(":")[0] == name.split(":")[0] and v is not None)
            for name in shared_counts
        },
        "snapshot_sha256": digest,
        "required_sequence": [
            "Verify requester identity, processing authority and household/member rights",
            "Validate all provider consents and finish approved revocations",
            "Resolve shared records and reassign or close household ownership",
            "Inventory and remove approved private Storage objects and orphans",
            "Remove authorized user-scoped rows with audit evidence",
            "Invalidate sessions, delete Supabase Auth user and confirm token expiry window",
            "Independently verify Auth, Storage, database and provider cleanup",
            "Mark request completed only after verification; notify verified requester",
        ],
        "blockers": list(dict.fromkeys(blockers)),
        "destructive_actions_performed": False,
        "execution_authorized": False,
    }


def execute_deletion(*_args, **_kwargs):
    """Intentionally unavailable until execution contracts pass staging review.

    Never accept operator approval merely via a client-supplied boolean or a
    plan digest. This fail-closed boundary protects live customer records.
    """
    raise HTTPException(
        status_code=503,
        detail="Destructive deletion is not enabled until provider, Storage, Auth and audit verification are approved",
    )
