"""
Utility functions to send push notifications via Expo/Firebase.
Called by other workers.
"""
import requests
from typing import List, Optional, Dict, Any
from app.services.user_service import get_user_device_tokens
from app.config import settings


def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None
):
    """
    Send a single push notification to a device token.
    Uses Expo's push notification service.
    """
    if not token:
        return
    
    message = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
    }
    
    try:
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=message,
            headers={
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
        )
        return response.json()
    except Exception as e:
        print(f"Failed to send notification: {e}")
        return None


def send_notification_to_household(
    household_id: str,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    exclude_user_ids: List[str] = None
):
    """
    Send a notification to all members of a household.
    """
    tokens = get_user_device_tokens(household_id=household_id)
    for token_info in tokens:
        if exclude_user_ids and token_info["user_id"] in exclude_user_ids:
            continue
        send_push_notification(
            token=token_info["token"],
            title=title,
            body=body,
            data=data
        )


def send_notification_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict] = None
):
    """
    Send a notification to a specific user's devices.
    """
    tokens = get_user_device_tokens(user_id=user_id)
    for token_info in tokens:
        send_push_notification(
            token=token_info["token"],
            title=title,
            body=body,
            data=data
        )