"""
Hearth Push Notification Service
Sends push notifications via Expo's push API.
Used by:
  - notifications.py router (token registration, manual sends)
  - automation.py webhook handler (instant push on critical HA events)
  - Celery workers (scheduled reminders — bills, expiries, maintenance)
"""
import httpx
from typing import Any, Dict, List, Optional


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    sound: str = "default",
    priority: str = "high",
) -> Dict:
    """
    Send a single push notification to one Expo push token.
    Returns the Expo API response, or an error dict on failure.
    """
    if not token or not token.startswith("ExponentPushToken"):
        return {"error": "Invalid or missing Expo push token", "token": token}

    message = {
        "to": token,
        "sound": sound,
        "title": title,
        "body": body,
        "data": data or {},
        "priority": priority,
        "channelId": "default",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            return resp.json()
    except Exception as e:
        print(f"⚠️ Push notification failed: {e}")
        return {"error": str(e)}


async def send_push_to_tokens(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> List[Dict]:
    """Send the same notification to multiple tokens (e.g. all members of a household)."""
    results = []
    for token in tokens:
        result = await send_push_notification(token, title, body, data)
        results.append(result)
    return results


async def send_push_to_household(
    household_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    supabase=None,
) -> List[Dict]:
    """
    Look up every push token registered to members of a household,
    then send the notification to all of them.
    """
    if supabase is None:
        from app.dependencies import get_supabase_admin
        supabase = get_supabase_admin()

    try:
        # Get all user_ids in this household
        members = supabase.table("household_members")\
            .select("user_id")\
            .eq("household_id", household_id)\
            .execute()
        user_ids = [m["user_id"] for m in (members.data or [])]

        if not user_ids:
            return []

        # Get all push tokens for those users
        tokens_res = supabase.table("push_tokens")\
            .select("token")\
            .in_("user_id", user_ids)\
            .execute()
        tokens = [t["token"] for t in (tokens_res.data or [])]

        if not tokens:
            print(f"⚠️ No push tokens found for household {household_id}")
            return []

        return await send_push_to_tokens(tokens, title, body, data)

    except Exception as e:
        print(f"⚠️ send_push_to_household failed: {e}")
        return [{"error": str(e)}]