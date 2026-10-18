"""Mono Connect Link Sandbox: read-only, owner-scoped and fail-closed.

Never accept bank credentials in Hearth. A successful Connect Link callback is
authenticated by Mono's webhook secret and bound to an unexpired pending record.
The Mono application key stays server-side. No payments or real keys permitted.
"""
import os
import re
from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
import httpx
from fastapi.concurrency import run_in_threadpool
from app.dependencies import get_supabase_admin
from app.services.mono_sandbox import sandbox_ready

HOST = "https://api.withmono.com"
SCOPES = ["accounts.read", "balances.read", "transactions.read"]
ACCOUNT_ID = re.compile(r"^[A-Za-z0-9_-]{12,90}$")
MAX_ITEMS = 20


class MonoLinkError(RuntimeError):
    pass


def config_ready() -> bool:
    return (sandbox_ready()
            and bool(os.getenv("MONO_SANDBOX_WEBHOOK_SECRET", "").strip())
            and bool(os.getenv("MONO_SANDBOX_APP_ID", "").strip()))


def _secret() -> str:
    if not config_ready():
        raise MonoLinkError("Mono Connect Sandbox is not configured")
    return os.environ["MONO_SANDBOX_SECRET_KEY"].strip()


async def _request(method: str, path: str, *, payload: dict | None = None,
                   params: dict | None = None) -> dict:
    if not path.startswith("/v2/accounts/") or "//" in path:
        raise MonoLinkError("Unsupported Mono Sandbox resource")
    try:
        async with httpx.AsyncClient(base_url=HOST, timeout=httpx.Timeout(12, connect=5),
                                     follow_redirects=False) as client:
            response = await client.request(
                method, path, json=payload, params=params,
                headers={"mono-sec-key": _secret(), "accept": "application/json"})
            response.raise_for_status()
            data = response.json()
        if not isinstance(data, dict) or data.get("status") != "successful":
            raise MonoLinkError("Mono Sandbox request was not successful")
        return data
    except (httpx.HTTPError, ValueError, TypeError):
        # Never forward provider responses; they can contain private bank data.
        raise MonoLinkError("Mono Sandbox provider unavailable") from None


def _db():
    return get_supabase_admin()


def _create_pending(db, *, user_id: str, household_id: str, acknowledged: bool) -> dict:
    if not acknowledged:
        raise MonoLinkError("Explicit read-only Sandbox consent is required")
    now = datetime.now(timezone.utc)
    record = {
        "id": str(uuid4()), "provider": "mono", "country_code": "NG",
        "owner_user_id": user_id, "household_id": household_id,
        "status": "pending", "consent_scopes": SCOPES,
        "consent_granted_at": now.isoformat(),
        "consent_expires_at": (now + timedelta(days=30)).isoformat(),
    }
    try:
        db.table("finance_connections").insert(record).execute()
        return record
    except Exception:
        raise MonoLinkError("Unable to prepare a secure test connection") from None


def _delete_pending(db, record: dict):
    try:
        (db.table("finance_connections").delete().eq("id", record["id"])
         .eq("owner_user_id", record["owner_user_id"])
         .eq("status", "pending").execute())
    except Exception:
        pass


async def initiate(*, user_id: str, household_id: str, email: str,
                   name: str, acknowledged: bool) -> dict:
    if not acknowledged:
        raise MonoLinkError("Explicit read-only Sandbox consent is required")
    _secret()
    if not email or "@" not in email or len(email) > 254:
        raise MonoLinkError("Verified account email required")
    db = _db()
    pending = await run_in_threadpool(
        _create_pending, db, user_id=user_id, household_id=household_id,
        acknowledged=acknowledged)
    # A HTTPS redirect page owned by Hearth; no secret/token in the URL.
    redirect = os.getenv("MONO_SANDBOX_REDIRECT_URL", "https://hearthhq.online")
    if not redirect.startswith("https://hearthhq.online"):
        await run_in_threadpool(_delete_pending, db, pending)
        raise MonoLinkError("Mono Sandbox callback URL is not approved")
    try:
        body = {
            "scope": "auth",
            "customer": {"name": (name or "Hearth Tester")[:120], "email": email},
            "meta": {"ref": pending["id"]},
            "redirect_url": redirect,
        }
        result = await _request("POST", "/v2/accounts/initiate", payload=body)
        url = ((result.get("data") or {}).get("mono_url"))
        from urllib.parse import urlsplit
        parsed = urlsplit(url) if isinstance(url, str) else None
        if not parsed or parsed.scheme != "https" or parsed.hostname != "link.mono.co":
            raise MonoLinkError("Unexpected bank linking URL")
        return {"connection_id": pending["id"], "url": url,
                "sandbox": True, "consent_expires_at": pending["consent_expires_at"]}
    except Exception:
        await run_in_threadpool(_delete_pending, db, pending)
        raise MonoLinkError("Could not start Mono Sandbox linking") from None


def _owned_connection(db, user_id: str, household_id: str, connection_id: str,
                      *, allow_error: bool = False) -> dict:
    try:
        UUID(connection_id)
        row = (db.table("finance_connections").select("*")
               .eq("id", connection_id).eq("owner_user_id", user_id)
               .eq("household_id", household_id).eq("provider", "mono")
               .eq("country_code", "NG").maybe_single().execute().data)
    except (ValueError, TypeError):
        raise MonoLinkError("Invalid Sandbox connection") from None
    except Exception:
        raise MonoLinkError("Could not read Sandbox connection") from None
    if not row or row.get("status") not in (("linked", "error") if allow_error else ("linked",)):
        raise MonoLinkError("No active, authorized Mono Sandbox connection")
    return row


def _valid_consent(record: dict) -> bool:
    if record.get("status") != "linked" or record.get("consent_revoked_at"):
        return False
    try:
        expiry = datetime.fromisoformat(record["consent_expires_at"].replace("Z", "+00:00"))
        return expiry > datetime.now(timezone.utc) and all(x in (record.get("consent_scopes") or [])
                                                            for x in SCOPES)
    except (TypeError, AttributeError, ValueError):
        return False


def list_owned(user_id: str, household_id: str) -> list[dict]:
    try:
        rows = ( _db().table("finance_connections")
            .select("id,status,provider_connection_ref,consent_expires_at,consent_revoked_at,consent_scopes,created_at")
            .eq("owner_user_id", user_id).eq("household_id", household_id)
            .eq("provider", "mono").eq("country_code", "NG")
            .order("created_at", desc=True).limit(20).execute().data or [])
    except Exception:
        raise MonoLinkError("Unable to list Mono Sandbox connections") from None
    return [{
        "id": r["id"], "status": r["status"],
        "consent_expires_at": r.get("consent_expires_at"),
        "read_only": True,
        "can_view_data": _valid_consent(r),
    } for r in rows]


def _safe_balance(data: dict) -> dict:
    account = (data.get("data") or {}).get("account") or {}
    meta = (data.get("data") or {}).get("meta") or {}
    # Per Mono, NGN monetary values are in KOBO. Do not transform to naira here.
    if account.get("currency") != "NGN":
        raise MonoLinkError("Unexpected currency in Nigeria Sandbox")
    value = account.get("balance")
    return {
        "institution": str((account.get("institution") or {}).get("name") or "Test bank")[:75],
        "display_name": str(account.get("name") or "Sandbox account")[:75],
        "masked_account": "••••"+str(account.get("account_number") or "")[-4:],
        "currency": "NGN", "balance_minor": value if type(value) is int else None,
        "data_status": str(meta.get("data_status") or "unknown").lower(),
        "retrieved_data": [x for x in (meta.get("retrieved_data") or [])
                           if x in ("balance", "transactions")],
        "sandbox": True, "read_only": True,
    }


async def account_preview(*, user_id: str, household_id: str,
                          connection_id: str) -> dict:
    row = await run_in_threadpool(_owned_connection, _db(), user_id, household_id, connection_id)
    if not _valid_consent(row):
        raise MonoLinkError("Bank consent expired or revoked")
    ref = row.get("provider_connection_ref") or ""
    if not ACCOUNT_ID.fullmatch(ref):
        raise MonoLinkError("Stored Mono Sandbox account reference invalid")
    response = await _request("GET", f"/v2/accounts/{ref}")
    return _safe_balance(response)


async def account_transactions(*, user_id: str, household_id: str,
                               connection_id: str) -> dict:
    row = await run_in_threadpool(_owned_connection, _db(), user_id, household_id, connection_id)
    if not _valid_consent(row):
        raise MonoLinkError("Bank consent expired or revoked")
    ref = row.get("provider_connection_ref") or ""
    if not ACCOUNT_ID.fullmatch(ref):
        raise MonoLinkError("Stored Mono Sandbox account reference invalid")
    detail = await _request("GET", f"/v2/accounts/{ref}")
    account = _safe_balance(detail)
    if account["data_status"] not in ("available", "partial") or (
        account["data_status"] == "partial" and "transactions" not in account["retrieved_data"]
    ):
        return {"transactions": [], "data_status": account["data_status"],
                "sandbox": True, "read_only": True}
    raw = await _request("GET", f"/v2/accounts/{ref}/transactions", params={"page":1, "limit":MAX_ITEMS})
    result = (raw.get("data") or [])
    if isinstance(result, dict):
        result = result.get("transactions") or result.get("data") or []
    if not isinstance(result, list):
        raise MonoLinkError("Unexpected Sandbox transaction response")
    cleaned=[]
    for t in result[:MAX_ITEMS]:
        if not isinstance(t, dict):
            continue
        amount=t.get("amount")
        if type(amount) is not int:
            continue
        cleaned.append({
            "date": str(t.get("date") or "")[:30],
            "narration": str(t.get("narration") or t.get("description") or "Transaction")[:125],
            "amount_minor": amount,
            "type": str(t.get("type") or "").lower() if str(t.get("type") or "").lower() in ("debit","credit") else "unknown",
            "currency": "NGN",
        })
    return {"transactions": cleaned, "sandbox": True, "read_only": True, "data_status": account["data_status"]}


async def revoke(*, user_id: str, household_id: str, connection_id: str) -> dict:
    db = _db()
    row = await run_in_threadpool(_owned_connection, db, user_id, household_id, connection_id, allow_error=True)
    if row["status"] == "linked":
        try:
            (db.table("finance_connections").update({
                "status": "error", "consent_revoked_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", connection_id).eq("owner_user_id", user_id)
               .eq("household_id", household_id).eq("status", "linked").execute())
        except Exception:
            raise MonoLinkError("Unable to revoke data access") from None
    ref = row.get("provider_connection_ref") or ""
    if not ACCOUNT_ID.fullmatch(ref):
        raise MonoLinkError("Stored Mono Sandbox account reference invalid")
    await _request("POST", f"/v2/accounts/{ref}/unlink")
    try:
        (db.table("finance_connections").update({"status":"revoked","provider_connection_ref":None})
        .eq("id", connection_id).eq("owner_user_id", user_id)
        .eq("household_id", household_id).eq("status", "error").execute())
    except Exception:
        raise MonoLinkError("Mono revoked, but local cleanup must be retried") from None
    return {"status": "revoked", "sandbox": True}
