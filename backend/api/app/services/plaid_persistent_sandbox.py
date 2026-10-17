"""Plaid read-only Sandbox persistence. No live bank access and NO money movement.

Only callable by separately allowlisted testers, with an explicit persisted-demo
consent. Encryption is mandatory and tokens never enter responses or logs.
Database migration is review-only until manually approved.
"""
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi.concurrency import run_in_threadpool
from app.dependencies import get_supabase_admin

ENDPOINT = "https://sandbox.plaid.com"
SCOPES = ["accounts.read", "balances.read", "transactions.read"]
MAX_PAGES = 30

class SandboxBankError(RuntimeError):
    pass

def _fernet() -> Fernet:
    raw = os.getenv("FINANCE_TOKEN_ENCRYPTION_KEY", "")
    if not raw:
        raise SandboxBankError("Sandbox encryption key is not configured")
    try:
        return Fernet(raw.encode("ascii"))
    except (ValueError, TypeError):
        raise SandboxBankError("Invalid Sandbox encryption configuration") from None

def encrypt_sandbox_token(token: str) -> str:
    if not token.startswith("access-sandbox-"):
        raise SandboxBankError("Only Sandbox tokens may be persisted")
    return _fernet().encrypt(token.encode("utf-8")).decode("ascii")

def decrypt_sandbox_token(ciphertext: str) -> str:
    try:
        token = _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeError, ValueError):
        raise SandboxBankError("Sandbox token cannot be decrypted") from None
    if not token.startswith("access-sandbox-"):
        raise SandboxBankError("Stored token is not Sandbox scoped")
    return token

def _auth_payload() -> dict:
    client_id = os.getenv("PLAID_CLIENT_ID", "").strip()
    secret = os.getenv("PLAID_SANDBOX_SECRET", "").strip()
    if not client_id or not secret:
        raise SandboxBankError("Sandbox Plaid is not configured")
    return {"client_id": client_id, "secret": secret}

async def _plaid(client: httpx.AsyncClient, path: str, data: dict) -> dict:
    try:
        response = await client.post(path, json={**_auth_payload(), **data})
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        # Plaid errors and client request bodies can include sensitive fields.
        raise SandboxBankError("Plaid Sandbox request failed") from None

async def _remove_sandbox_item(client: httpx.AsyncClient, access_token: str) -> None:
    """Revoke a Sandbox Item, accepting an already-removed Item on retry."""
    try:
        response = await client.post("/item/remove", json={
            **_auth_payload(), "access_token": access_token})
        if response.status_code >= 400:
            # Only an explicit 'item absent' response can be treated as a
            # successful retry. Never log a provider response or token.
            try:
                already_removed = response.json().get("error_code") == "ITEM_NOT_FOUND"
            except (ValueError, TypeError, AttributeError):
                already_removed = False
            if not already_removed:
                raise SandboxBankError("Sandbox provider revocation unavailable")
            return
        response.raise_for_status()
    except (httpx.HTTPError, ValueError):
        raise SandboxBankError("Sandbox provider revocation unavailable") from None


def _minor(amount) -> int | None:
    if amount is None:
        return None
    try:
        value = Decimal(str(amount)) * 100
        if not value.is_finite() or value != value.to_integral_value():
            return None
        return int(value)
    except (ValueError, InvalidOperation):
        return None

def _account_rows(accounts: list, connection_id: str, household_id: str, owner_id: str) -> list[dict]:
    rows = []
    for account in accounts[:40]:
        currency = (account.get("balances") or {}).get("iso_currency_code")
        if currency != "CAD" or not account.get("account_id"):
            continue
        rows.append({
            "connection_id": connection_id, "household_id": household_id,
            "owner_user_id": owner_id, "provider_account_ref": account["account_id"],
            "display_name": str(account.get("name") or "Bank account")[:100],
            "masked_account": str(account.get("mask") or "")[-4:],
            "currency": "CAD",
            "balance_minor": _minor((account.get("balances") or {}).get("current")),
            "balance_updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows

def _save_connection(db, *, household_id, owner_id, item_id, ciphertext, accounts):
    now = datetime.now(timezone.utc)
    record_id = str(uuid4())
    connection = {
        "id": record_id, "household_id": household_id, "owner_user_id": owner_id,
        "provider": "plaid", "country_code": "CA", "status": "linked",
        "provider_connection_ref": item_id, "consent_scopes": SCOPES,
        "consent_granted_at": now.isoformat(),
        "consent_expires_at": (now + timedelta(days=30)).isoformat()
    }
    created = False
    try:
        db.table("finance_connections").insert(connection).execute()
        created = True
        db.table("finance_sandbox_tokens").insert(
            {"connection_id": record_id, "encrypted_access_token": ciphertext}).execute()
        rows = _account_rows(accounts, record_id, household_id, owner_id)
        if rows:
            db.table("finance_accounts").insert(rows).execute()
        db.table("finance_consent_events").insert({
            "connection_id": record_id, "household_id": household_id,
            "owner_user_id": owner_id, "event_type": "granted", "scopes": SCOPES
        }).execute()
        return {"id": record_id, "status": "linked", "country": "CA",
                "account_count": len(rows), "consent_expires_at": connection["consent_expires_at"],
                "environment": "sandbox"}
    except Exception:
        if created:
            try:
                db.table("finance_connections").delete().eq("id", record_id).eq(
                    "owner_user_id", owner_id).eq("household_id", household_id).execute()
            except Exception:
                pass
        raise SandboxBankError("Could not safely persist Sandbox connection") from None

async def connect_sandbox_bank(*, public_token: str, owner_id: str,
                               household_id: str, consent_acknowledged: bool) -> dict:
    if not consent_acknowledged:
        raise SandboxBankError("Explicit Sandbox data consent required")
    if not public_token.startswith("public-sandbox-") or len(public_token) > 512:
        raise SandboxBankError("Invalid Plaid Sandbox token")
    # Verify vault readiness before exchanging anything at Plaid.
    _fernet()
    access_token = None
    stored = False
    async with httpx.AsyncClient(base_url=ENDPOINT, timeout=20.0) as client:
        try:
            exchanged = await _plaid(client, "/item/public_token/exchange",
                                    {"public_token": public_token})
            access_token = exchanged.get("access_token")
            item_id = exchanged.get("item_id")
            if not isinstance(access_token, str) or not isinstance(item_id, str) or not item_id:
                raise SandboxBankError("Plaid did not return a valid Sandbox Item")
            ciphertext = encrypt_sandbox_token(access_token)
            found = await _plaid(client, "/accounts/get", {"access_token": access_token})
            saved = await run_in_threadpool(
                _save_connection, get_supabase_admin(), household_id=household_id,
                owner_id=owner_id, item_id=item_id, ciphertext=ciphertext,
                accounts=found.get("accounts") or [])
            stored = True
            return saved
        except Exception:
            if access_token and not stored:
                try:
                    await _plaid(client, "/item/remove", {"access_token": access_token})
                except SandboxBankError:
                    # We do not retain plaintext tokens; operator should investigate
                    # item cleanup via Plaid dashboard in this rare failure.
                    pass
            raise SandboxBankError("Sandbox connection could not be saved") from None

def _get_owned_connection(db, connection_id: str, owner_id: str, household_id: str) -> dict:
    try:
        result = (db.table("finance_connections").select(
            "id,owner_user_id,household_id,provider,country_code,status,consent_expires_at,consent_revoked_at,last_synced_at")
            .eq("id", connection_id).eq("owner_user_id", owner_id)
            .eq("household_id", household_id).eq("provider", "plaid").eq("country_code", "CA")
            .limit(1).execute())
        record = (result.data or [None])[0]
    except Exception:
        raise SandboxBankError("Sandbox connection is unavailable") from None
    if record is None:
        raise SandboxBankError("Sandbox connection not found")
    return record

def _get_cipher(db, connection_id: str) -> tuple[str, str | None]:
    try:
        result = db.table("finance_sandbox_tokens").select(
            "encrypted_access_token,transaction_cursor").eq(
            "connection_id", connection_id).limit(1).execute()
        data = (result.data or [None])[0]
    except Exception:
        data = None
    if not data:
        raise SandboxBankError("Connection has no stored Sandbox credentials")
    return data["encrypted_access_token"], data.get("transaction_cursor")

def _assert_live_consent(record: dict) -> None:
    try:
        expiry = datetime.fromisoformat(str(record.get("consent_expires_at") or "").replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            raise ValueError()
    except ValueError:
        raise SandboxBankError("Connection consent is invalid or expired") from None
    if (record.get("status") != "linked" or record.get("consent_revoked_at")
            or expiry <= datetime.now(timezone.utc)):
        raise SandboxBankError("Connection consent expired or revoked")

async def disconnect_sandbox_bank(*, connection_id: str, owner_id: str, household_id: str) -> dict:
    db = get_supabase_admin()
    record = await run_in_threadpool(_get_owned_connection,db,connection_id,owner_id,household_id)
    if record.get("status") == "revoked":
        return {"connection_id": connection_id, "status": "revoked"}

    def revoke_local_consent():
        # Revoke locally FIRST. Even a provider outage must prevent new reads.
        now = datetime.now(timezone.utc).isoformat()
        db.table("finance_connections").update({
            "status": "error", "consent_revoked_at": now
        }).eq("id",connection_id).eq("owner_user_id",owner_id).eq(
            "household_id",household_id).execute()
        if not record.get("consent_revoked_at"):
            db.table("finance_consent_events").insert({
                "connection_id": connection_id, "household_id": household_id,
                "owner_user_id": owner_id, "event_type": "revoked", "scopes": []
            }).execute()
    try:
        await run_in_threadpool(revoke_local_consent)
    except Exception:
        raise SandboxBankError("Could not revoke local access") from None

    ciphertext, _ = await run_in_threadpool(_get_cipher,db,connection_id)
    token = decrypt_sandbox_token(ciphertext)
    async with httpx.AsyncClient(base_url=ENDPOINT,timeout=20.0) as client:
        # If Plaid is unreachable, keep encrypted credentials so revocation
        # can be retried. Local consent remains revoked the entire time.
        await _remove_sandbox_item(client, token)

    def complete_cleanup():
        # A single PostgreSQL transaction removes accounts, transactions and
        # ciphertext, then finalizes revocation. Partial cleanup cannot commit.
        response = db.rpc("finance_finalize_sandbox_disconnect", {
            "p_connection_id": connection_id,
            "p_owner_user_id": owner_id,
            "p_household_id": household_id,
        }).execute()
        if response.data is not True:
            raise SandboxBankError("Sandbox cleanup was not confirmed")
    try:
        await run_in_threadpool(complete_cleanup)
    except Exception:
        raise SandboxBankError("Provider revoked; local cleanup needs operator review") from None
    return {"connection_id": connection_id, "status": "revoked"}

def list_owned_sandbox_connections(*, owner_id: str, household_id: str) -> list[dict]:
    db = get_supabase_admin()
    try:
        rows = db.table("finance_connections").select(
            "id,status,country_code,consent_expires_at,last_synced_at,created_at").eq(
            "owner_user_id",owner_id).eq("household_id",household_id).eq(
            "provider","plaid").eq("country_code","CA").order("created_at",desc=True).limit(20).execute()
        return rows.data or []
    except Exception:
        raise SandboxBankError("Sandbox connections unavailable") from None
