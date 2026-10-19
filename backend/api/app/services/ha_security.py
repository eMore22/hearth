"""Home Assistant tenant-bound webhook secrets and public-host checks."""
import asyncio
import hashlib
import hmac
import ipaddress
import socket
from urllib.parse import urlsplit
from uuid import UUID
from fastapi import HTTPException
from app.dependencies import get_supabase_admin
from app.config import settings


def household_owner(user: dict, db=None) -> str:
    user_id = str(user.get("id") or "")
    household_id = str(user.get("household_id") or "")
    if not user_id or not household_id:
        raise HTTPException(status_code=403, detail="Household owner permission required")
    db = db or get_supabase_admin()
    try:
        role = (db.table("household_members").select("role")
                .eq("user_id", user_id).eq("household_id", household_id)
                .maybe_single().execute().data or {}).get("role")
    except Exception:
        raise HTTPException(status_code=503, detail="Household permissions unavailable") from None
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only the household owner can configure smart-home access")
    return household_id


def webhook_token(household_id: str, connected_at: str) -> str:
    """Derive a per-household token. Never give the root secret to devices."""
    root = settings.HA_WEBHOOK_SECRET
    if not root:
        raise HTTPException(status_code=503, detail="Home Assistant webhooks are not configured")
    try:
        UUID(str(household_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid household identifier") from None
    if not connected_at:
        raise HTTPException(status_code=503, detail="Home Assistant must be connected first")
    message = f"hearth-ha-event-v1:{household_id}:{connected_at}".encode()
    return hmac.new(root.encode(), message, hashlib.sha256).hexdigest()


def check_webhook_token(household_id: str, connected_at: str, received: str) -> bool:
    if not isinstance(received, str) or len(received) > 256 or not received:
        return False
    return hmac.compare_digest(webhook_token(household_id, connected_at), received)


def public_https_host(url: str) -> str:
    try:
        value = urlsplit(url)
        host = value.hostname
        port = value.port
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Home Assistant URL") from None
    if (value.scheme != "https" or not host or value.username or value.password
            or port not in (None, 443) or value.fragment or value.query
            or host.lower().rstrip(".").endswith((".local", ".internal", ".localhost", ".test"))
            or host.lower() == "localhost"):
        raise HTTPException(status_code=400, detail="Use a public HTTPS Home Assistant URL on port 443")
    if "%" in host or len(host) > 253:
        raise HTTPException(status_code=400, detail="Invalid Home Assistant host")
    try:
        ip = ipaddress.ip_address(host)
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="Private Home Assistant addresses are blocked")
    except ValueError:
        if "." not in host or any(not p for p in host.split(".")):
            raise HTTPException(status_code=400, detail="Public HTTPS hostname required")
    return host


async def validate_public_ha_url(url: str) -> None:
    """Reject hostnames whose DNS currently resolves to any private network.

    This is an SSRF defense in depth, not complete DNS rebinding protection.
    Outbound network egress controls remain required for public deployment.
    """
    host = public_https_host(url)
    try:
        replies = await asyncio.wait_for(
            asyncio.get_running_loop().getaddrinfo(
                host, 443, type=socket.SOCK_STREAM),
            timeout=3.0)
    except Exception:
        raise HTTPException(status_code=400, detail="Home Assistant hostname could not be verified") from None
    if not replies:
        raise HTTPException(status_code=400, detail="Home Assistant hostname unavailable")
    for row in replies:
        try:
            address = ipaddress.ip_address(row[4][0])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Home Assistant DNS response") from None
        if not address.is_global or (address.version == 6 and address.ipv4_mapped and not address.ipv4_mapped.is_global):
            raise HTTPException(status_code=400, detail="Home Assistant hostname resolves to a blocked network")
