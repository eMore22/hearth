"""Plaid Sandbox Transactions Sync, read-only and replay-safe.

The cursor is advanced only after all pages are applied. Provider IDs are
unique per account, so retrying a partially saved batch is idempotent.
"""
from datetime import datetime
from app.dependencies import get_supabase_admin
from fastapi.concurrency import run_in_threadpool
from app.services.plaid_persistent_sandbox import (
    ENDPOINT, SandboxBankError, _auth_payload, _get_owned_connection, _get_cipher,
    decrypt_sandbox_token, _assert_live_consent, _minor,
)
import httpx

PAGE_SIZE = 500
MAX_PAGES = 15
MAX_RESTARTS = 2

async def fetch_transaction_changes(client: httpx.AsyncClient, token: str,
                                    cursor: str | None) -> dict:
    initial_cursor = cursor
    for attempt in range(MAX_RESTARTS + 1):
        current = initial_cursor
        added, modified, removed = [], [], []
        for page in range(MAX_PAGES):
            payload = {**_auth_payload(), "access_token": token, "count": PAGE_SIZE}
            if current:
                payload["cursor"] = current
            try:
                result = await client.post("/transactions/sync", json=payload)
                if result.status_code >= 400:
                    body = result.json()
                    if (body.get("error_code") == "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
                            and attempt < MAX_RESTARTS):
                        break
                    raise SandboxBankError("Plaid Sandbox transaction sync failed")
                data = result.json()
            except (httpx.HTTPError, ValueError, TypeError):
                raise SandboxBankError("Plaid Sandbox transaction sync unavailable") from None
            if not isinstance(data.get("next_cursor"), str):
                raise SandboxBankError("Plaid sync cursor unavailable")
            added.extend(data.get("added") or [])
            modified.extend(data.get("modified") or [])
            removed.extend(data.get("removed") or [])
            current = data["next_cursor"]
            if not data.get("has_more"):
                return {"added": added, "modified": modified, "removed": removed,
                        "next_cursor": current}
            if current == initial_cursor or not current:
                raise SandboxBankError("Plaid sync cursor did not advance")
        else:
            raise SandboxBankError("Plaid sync page limit exceeded")
    raise SandboxBankError("Plaid transaction data changed during pagination")

def _normalize_transaction(tx: dict, local_account: dict,
                           household_id: str, owner_id: str) -> dict | None:
    if tx.get("pending") or tx.get("iso_currency_code") != "CAD":
        return None
    transaction_id = tx.get("transaction_id")
    booked_at = tx.get("date")
    amount_minor = _minor(tx.get("amount"))
    if (not transaction_id or amount_minor is None or
            not isinstance(booked_at, str) or len(booked_at) != 10):
        return None
    try:
        datetime.fromisoformat(booked_at)
    except ValueError:
        return None
    return {
        "account_id": local_account["id"], "household_id": household_id,
        "owner_user_id": owner_id, "provider_transaction_ref": str(transaction_id),
        # Plaid amounts: positive debit/outflow; negative inflow/refund.
        # Hearth canonical signed amount: negative debit/outflow.
        "amount_minor": -amount_minor, "currency": "CAD",
        "booked_at": booked_at + "T00:00:00+00:00",
        "description": str(tx.get("name") or "")[:220],
        "merchant": str(tx.get("merchant_name") or "")[:120] or None,
        "category": str((tx.get("personal_finance_category") or {}).get("primary") or "")[:80] or None,
    }

def _apply_changes(db, *, connection_id: str, owner_id: str, household_id: str,
                   expected_cursor: str | None, changes: dict) -> dict:
    """Atomically apply transactions and cursor, serialized with revocation."""
    _assert_live_consent(_get_owned_connection(db, connection_id, owner_id, household_id))
    try:
        accounts = (db.table("finance_accounts").select("id,provider_account_ref")
            .eq("connection_id", connection_id).eq("owner_user_id", owner_id)
            .eq("household_id", household_id).limit(40).execute().data or [])
        by_provider_id = {item["provider_account_ref"]: item for item in accounts}
        upserts = {}
        for group in ("added", "modified"):
            for tx in changes[group]:
                local_account = by_provider_id.get(tx.get("account_id"))
                if not local_account:
                    continue
                normalized = _normalize_transaction(tx, local_account, household_id, owner_id)
                if normalized:
                    key = (normalized["account_id"], normalized["provider_transaction_ref"])
                    upserts[key] = {field: normalized[field] for field in (
                        "account_id", "provider_transaction_ref", "amount_minor",
                        "currency", "booked_at", "description", "merchant", "category")}
        removals = {}
        for removed in changes["removed"]:
            account = by_provider_id.get(removed.get("account_id"))
            transaction_id = removed.get("transaction_id")
            if account and transaction_id:
                key = (account["id"], str(transaction_id))
                removals[key] = {"account_id": key[0], "provider_transaction_ref": key[1]}
        for key in removals:
            upserts.pop(key, None)
        response = db.rpc("finance_apply_sandbox_changes", {
            "p_connection_id": connection_id,
            "p_owner_user_id": owner_id,
            "p_household_id": household_id,
            "p_expected_cursor": expected_cursor,
            "p_next_cursor": changes["next_cursor"],
            "p_upserts": list(upserts.values()),
            "p_removals": list(removals.values()),
        }).execute()
        result = response.data
        if not isinstance(result, dict):
            raise SandboxBankError("Invalid Sandbox sync confirmation")
        return {
            "connection_id": connection_id,
            "transaction_updates": int(result["transaction_updates"]),
            "removed_count": int(result["removed_count"]),
            "sandbox": True, "payments_enabled": False,
        }
    except Exception:
        # Any failure of the transactional RPC leaves the cursor unchanged.
        raise SandboxBankError("Sandbox transaction persistence failed") from None

async def sync_sandbox_transactions(*, connection_id: str, owner_id: str,
                                    household_id: str) -> dict:
    db = get_supabase_admin()
    record = await run_in_threadpool(_get_owned_connection,db,connection_id,owner_id,household_id)
    _assert_live_consent(record)
    ciphertext, cursor = await run_in_threadpool(_get_cipher,db,connection_id)
    access_token = decrypt_sandbox_token(ciphertext)
    async with httpx.AsyncClient(base_url=ENDPOINT,timeout=25.0) as client:
        changes = await fetch_transaction_changes(client,access_token,cursor)
    return await run_in_threadpool(_apply_changes,db,
        connection_id=connection_id,owner_id=owner_id,household_id=household_id,
        expected_cursor=cursor, changes=changes)

def list_sandbox_transactions(*, connection_id: str, owner_id: str,
                              household_id: str) -> list[dict]:
    db = get_supabase_admin()
    record = _get_owned_connection(db,connection_id,owner_id,household_id)
    _assert_live_consent(record)
    try:
        accounts = (db.table("finance_accounts").select("id").eq(
            "connection_id",connection_id).eq("owner_user_id",owner_id)
            .eq("household_id",household_id).limit(40).execute().data or [])
        ids = [a["id"] for a in accounts]
        if not ids:
            return []
        transactions = (db.table("finance_transactions")
            .select("id,account_id,booked_at,amount_minor,currency,description,merchant,category")
            .eq("owner_user_id",owner_id).eq("household_id",household_id)
            .in_("account_id",ids).order("booked_at",desc=True).limit(100).execute())
        return transactions.data or []
    except Exception:
        raise SandboxBankError("Sandbox transactions unavailable") from None
