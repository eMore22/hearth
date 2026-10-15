"""Server-authoritative Hearth HQ subscription access.

The mobile SDK supplies purchases but never proof of paid authorization.
RevenueCat's REST API is queried with a server-only secret using the
authenticated Supabase user id (the configured RevenueCat appUserID).
Family is inherited from the household owner when Family is active.

Strict enforcement is an explicit release switch. Leave disabled until
the server key, test purchase, restore and paid-tier UX are verified.
"""
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import quote

import httpx
from fastapi import Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.config import settings
from app.dependencies import get_current_user, get_supabase_admin

logger = logging.getLogger(__name__)
Tier = Literal["free", "home", "family"]
_RANK = {"free": 0, "home": 1, "family": 2}
_CACHE_TTL = 90.0
_CACHE_STALE_TTL = 300.0
_lock = threading.Lock()
_cache: dict[str, tuple[float, Tier]] = {}


class BillingUnavailable(Exception):
    """Provider could not verify subscriptions right now."""


def _date_valid(date_string: str | None, now: datetime) -> bool:
    if date_string is None:
        return True  # RevenueCat lifetime entitlement.
    try:
        expiry = datetime.fromisoformat(str(date_string).replace("Z", "+00:00"))
        return expiry.astimezone(timezone.utc) > now
    except (TypeError, ValueError):
        return False


def tier_from_customer(data: dict, *, now: datetime | None = None) -> Tier:
    """Inspect active RevenueCat v1 entitlements, not declared client tier."""
    now = now or datetime.now(timezone.utc)
    entitlements = (data.get("subscriber") or {}).get("entitlements") or {}
    for name in ("family", "home"):
        entitlement = entitlements.get(name)
        if not isinstance(entitlement, dict) or not entitlement:
            continue
        expiry = entitlement.get("expires_date")
        grace = entitlement.get("grace_period_expires_date")
        if _date_valid(expiry, now) or (grace and _date_valid(grace, now)):
            return name
    return "free"


def _lookup_remote(user_id: str) -> Tier:
    key = settings.REVENUECAT_SECRET_API_KEY.strip()
    if not key:
        raise BillingUnavailable("Subscription verification is not configured")
    try:
        # URL is constant; only a URL-encoded Supabase user id is appended.
        response = httpx.get(
            f"https://api.revenuecat.com/v1/subscribers/{quote(str(user_id), safe='')}",
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
            timeout=httpx.Timeout(6.0, connect=3.0),
            follow_redirects=False,
        )
        response.raise_for_status()
        return tier_from_customer(response.json())
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        logger.warning("RevenueCat verification unavailable: %s", type(exc).__name__)
        raise BillingUnavailable("Subscription verification temporarily unavailable") from exc


def user_tier(user_id: str) -> Tier:
    """Cache short provider checks; allow brief stale positive access on outages."""
    now = time.monotonic()
    with _lock:
        cached = _cache.get(str(user_id))
        if cached and now - cached[0] < _CACHE_TTL:
            return cached[1]
    try:
        result = _lookup_remote(str(user_id))
    except BillingUnavailable:
        if cached and cached[1] != "free" and now - cached[0] < _CACHE_STALE_TTL:
            return cached[1]
        raise
    with _lock:
        _cache[str(user_id)] = (time.monotonic(), result)
        if len(_cache) > 10000:
            for key, data in list(_cache.items())[:2000]:
                if time.monotonic() - data[0] > _CACHE_STALE_TTL:
                    _cache.pop(key, None)
    return result


def access_for(user: dict) -> dict:
    """Never accept household or subscription IDs from request bodies."""
    if not user.get("id"):
        raise ValueError("Verified user ID required")
    enabled = settings.BILLING_ENFORCEMENT_ENABLED
    if not settings.REVENUECAT_SECRET_API_KEY.strip():
        if enabled:
            raise BillingUnavailable("Subscription verification is not configured")
        return {"tier": "free", "enforced": False, "verified": False,
                "household_family": False}

    own = user_tier(str(user["id"]))
    tier: Tier = own
    shared_family = False
    household_id = user.get("household_id")
    if household_id and own != "family":
        try:
            response = (get_supabase_admin().table("households").select("created_by")
                        .eq("id", household_id).maybe_single().execute())
            owner_id = (response.data or {}).get("created_by")
            if owner_id and str(owner_id) != str(user["id"]):
                if user_tier(str(owner_id)) == "family":
                    tier = "family"
                    shared_family = True
        except BillingUnavailable:
            raise
        except Exception as exc:
            logger.warning("Household subscription owner lookup failed: %s", type(exc).__name__)
            if enabled:
                raise BillingUnavailable("Household access temporarily unavailable") from exc
    return {"tier": tier, "enforced": enabled, "verified": True,
            "household_family": shared_family}


def require_tier(min_tier: Literal["home", "family"]):
    async def check(user: dict = Depends(get_current_user)) -> dict:
        try:
            access = await run_in_threadpool(access_for, user)
        except BillingUnavailable:
            if not settings.BILLING_ENFORCEMENT_ENABLED:
                return {"tier": "free", "enforced": False, "verified": False}
            raise HTTPException(status_code=503, detail="Unable to verify your subscription. Please try again shortly.")
        if access.get("enforced") and _RANK[access["tier"]] < _RANK[min_tier]:
            raise HTTPException(
                status_code=402,
                detail=("Hearth Family subscription required. Open Profile → Subscription."
                        if min_tier == "family" else
                        "Hearth Home or Family subscription required. Open Profile → Subscription."),
            )
        return access
    return check


def invalidate_cache(user_id: str) -> None:
    with _lock:
        _cache.pop(str(user_id), None)
