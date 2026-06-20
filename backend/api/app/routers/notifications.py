from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.dependencies import get_current_user, get_supabase_admin
from app.services.push_service import send_push_notification, send_push_to_household

router = APIRouter(tags=["notifications"])


class RegisterTokenRequest(BaseModel):
    token: str
    device_type: str = "android"


class SendNotificationRequest(BaseModel):
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None


@router.post("/register-token")
async def register_token(
    payload: RegisterTokenRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Save (or update) this user's Expo push token.
    Called on app launch / after login from the mobile client.
    """
    supabase = get_supabase_admin()
    try:
        # Upsert on token — same device re-registering just updates user_id/type
        supabase.table("push_tokens").upsert({
            "user_id":     current_user["id"],
            "token":       payload.token,
            "device_type": payload.device_type,
        }, on_conflict="token").execute()
        return {"status": "registered"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/unregister-token")
async def unregister_token(
    token: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a push token — call on sign out so the device stops receiving pushes."""
    supabase = get_supabase_admin()
    try:
        supabase.table("push_tokens").delete().eq("token", token).execute()
        return {"status": "unregistered"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/send")
async def send_notification(
    payload: SendNotificationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a push notification to every device in the current user's household.
    Useful for testing, or for manual "notify everyone" actions in-app.
    """
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")

    results = await send_push_to_household(
        household_id=household_id,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )
    return {"status": "sent", "results": results}


@router.post("/test")
async def send_test_notification(current_user: dict = Depends(get_current_user)):
    """Quick endpoint to confirm push is wired up correctly — sends to current user only."""
    supabase = get_supabase_admin()
    try:
        tokens_res = supabase.table("push_tokens")\
            .select("token")\
            .eq("user_id", current_user["id"])\
            .execute()
        tokens = [t["token"] for t in (tokens_res.data or [])]
        if not tokens:
            raise HTTPException(status_code=400, detail="No push token registered for this device yet")

        results = []
        for token in tokens:
            result = await send_push_notification(
                token=token,
                title="🏠 Hearth Test",
                body="Push notifications are working correctly.",
                data={"type": "test"},
            )
            results.append(result)
        return {"status": "sent", "results": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))