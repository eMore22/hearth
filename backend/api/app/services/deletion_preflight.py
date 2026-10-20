"""Operator-only, read-only preflight for a pending deletion request.

Safely inventory the effects of removing one user before any destructive
operation. This module intentionally has NO purge, revoke, or auth-delete
methods; decisions about retained/shared family data remain human-reviewed.
"""
from uuid import UUID
from fastapi import HTTPException
from app.dependencies import get_supabase_admin


def _uuid(raw: str) -> str:
    try:
        return str(UUID(str(raw)))
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Invalid deletion request identifier") from None


def deletion_preflight(request_id: str, db=None) -> dict:
    request_id = _uuid(request_id)
    db = db or get_supabase_admin()
    try:
        record = (db.table("account_deletion_requests")
                  .select("id,user_id,household_id_at_request,status,requested_at")
                  .eq("id",request_id).maybe_single().execute().data)
    except Exception:
        raise HTTPException(status_code=503, detail="Deletion request lookup unavailable") from None
    if not record or record.get("status") not in ("requested","processing"):
        raise HTTPException(status_code=404, detail="No pending deletion request")

    user_id = str(record["user_id"])
    blockers = []
    evidence = {}
    household_id = str(record.get("household_id_at_request") or "")
    if not household_id:
        blockers.append("No verified household at request time. Verify identity and personal records manually.")
    try:
        membership = (db.table("household_members").select("role,household_id")
                      .eq("user_id",user_id).limit(101).execute().data or [])
    except Exception:
        membership = []
        blockers.append("Unable to read current household membership")
    evidence["membership_count"] = len(membership)
    if len(membership) >= 101:
        blockers.append("Membership inventory exceeds limit; investigate every household")
    if len(membership) > 1:
        blockers.append("User belongs to multiple households; every membership requires separate review")
    evidence["owns_household"] = any(row.get("role") == "owner" for row in membership)
    if evidence["owns_household"] and len(membership) > 1:
        blockers.append("Owner roles require verified transfer or closure for each household")
    household_id = str(membership[0]["household_id"]) if membership else household_id
    role = str(membership[0].get("role") or "") if membership else "unverified"
    evidence["role"] = role
    evidence["membership_roles"] = sorted({str(row.get("role") or "unknown") for row in membership})
    if record.get("household_id_at_request") and household_id != str(record["household_id_at_request"]):
        blockers.append("Household changed after request; verify identity and deletion scope")

    def personal_count(table: str, col: str, cap=101):
        try:
            rows = (db.table(table).select("id").eq(col,user_id)
                    .limit(cap).execute().data or [])
            if len(rows) >= cap:
                blockers.append(f"{table} personal record count exceeds limit")
            return len(rows)
        except Exception:
            blockers.append(f"{table} user-attributed inventory unavailable")
            return None

    evidence["personal_chat_messages"] = personal_count("chat_messages","user_id")
    evidence["personal_push_tokens"] = personal_count("push_tokens","user_id")
    evidence["personal_analytics"] = personal_count("analytics_events","user_id")
    evidence["personal_finance_connections"] = personal_count("finance_connections","owner_user_id")
    if evidence["personal_chat_messages"]:
        blockers.append("User-attributed chat must be reviewed for personal deletion versus shared conversation")
    if evidence["personal_push_tokens"]:
        blockers.append("Revoke and erase user notification tokens before deleting Auth")

    if household_id:
        try:
            members = (db.table("household_members").select("user_id,role")
                       .eq("household_id",household_id).limit(100).execute().data or [])
            evidence["household_member_count"] = len(members)
            if role == "owner" and len(members)>1:
                blockers.append("Household owner has other members; transfer ownership or arrange separately verified household closure")
            if len(members)>=100:
                blockers.append("Member count exceeds the bounded review")
        except Exception:
            blockers.append("Member enumeration failed; do not remove shared household data")
            evidence["household_member_count"] = None

        def count(table: str, col: str, val: str, cap=101):
            try:
                rows=(db.table(table).select("id").eq(col,val).limit(cap).execute().data or [])
                if len(rows)==cap:
                    blockers.append(f"{table} count reached review limit")
                return len(rows)
            except Exception:
                blockers.append(f"{table} couldn't be checked")
                return None

        evidence["personal_documents"] = count("documents","uploaded_by",user_id)
        evidence["linked_bank_connections"] = evidence["personal_finance_connections"]
        evidence["household_health_events"] = count("health_events","household_id",household_id)
        evidence["household_medications"] = count("medications","household_id",household_id)
        evidence["household_family_health_profiles"] = count("family_health_profiles","household_id",household_id)
        evidence["household_chat_messages"] = count("chat_messages","household_id",household_id)
        if evidence["linked_bank_connections"]:
            blockers.append("Revoke linked provider consents and verify financial token cleanup first")
        if role != "owner" and any(evidence.get(key) for key in (
            "household_health_events","household_medications",
            "household_family_health_profiles","household_chat_messages"
        )):
            blockers.append("Shared medical/chat records lack sufficient user attribution for automatic member-only removal")
        if evidence["personal_documents"]:
            blockers.append("Delete uploader-owned private documents and Storage objects, then verify the deletion before Auth removal")
    else:
        blockers.append("Household identity unavailable; privileged manual review required")

    # Remain blocked until both an operator and the individual external provider
    # consent/purchase workflows are independently verified. In particular,
    # this response never acts as an authorization to delete.
    blockers.append("Verify Google Play/RevenueCat cancellation and provider revocation records")
    blockers.append("Verify legally required retention, Auth deletion and personal data removal with the operator")

    return {
        "request_id":request_id,
        "user_id":user_id,
        "status":record["status"],
        "evidence_counts":evidence,
        "blockers":list(dict.fromkeys(blockers)),
        "destructive_actions_performed":False,
        "automated_purge_authorized":False,
    }
