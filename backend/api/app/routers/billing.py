"""Read-only account subscription access and post-purchase refresh."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from app.dependencies import get_current_user
from app.services.subscriptions import access_for, invalidate_cache, BillingUnavailable

router = APIRouter()


def _error():
    return HTTPException(
        status_code=503,
        detail="Subscription verification temporarily unavailable. Please try again shortly.",
    )


@router.get("/access")
async def current_access(user: dict = Depends(get_current_user)):
    try:
        return await run_in_threadpool(access_for, user)
    except BillingUnavailable:
        raise _error()


@router.post("/refresh")
async def refresh_access(user: dict = Depends(get_current_user)):
    # A user can invalidate only their own cached verification; this does not
    # grant an entitlement or trust client-declared purchase status.
    invalidate_cache(str(user["id"]))
    try:
        return await run_in_threadpool(access_for, user)
    except BillingUnavailable:
        raise _error()
