from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.chief_of_staff_agent import ChiefOfStaffAgent
from app.services.ha_bridge import build_ha_bridge
from app.services.analytics import log_event

router = APIRouter(tags=["chief_of_staff"])


@router.post("/chat")
async def chat(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    household_id = current_user.get("household_id")

    agent = ChiefOfStaffAgent(
        household_id=household_id,
        user_id=str(current_user["id"])
    )

    # process_chat is async — must be awaited directly
    result = await agent.process_chat(
        message=body.get("message", ""),
        context=body.get("context", {}),
        conversation_history=body.get("conversation_history", [])
    )

    # ── Device command execution ──
    # If the agent detected a device command intent (e.g. "close the garage
    # door"), it returns a `device_command` field on the result instead of
    # just talking about it. Execute it here, where we have household_id
    # and HA bridge access, then fold the outcome into the reply.
    device_command = result.get("device_command")
    if device_command and household_id:
        result["action_result"] = await _execute_device_command(
            household_id=household_id,
            entity_id=device_command.get("entity_id"),
            action=device_command.get("action"),
            supabase=get_supabase_admin(),
        )

    # ── Logging for traction measurement ──
    # Two different tables, two different purposes:
    #   chat_messages    — full conversation text, queryable per-category
    #                       depth (e.g. "what do people actually ask about")
    #   analytics_events — lightweight, fits the same shape as every other
    #                       module's logging, used for cross-module
    #                       "what feature gets used most" comparisons
    # Both are non-fatal — a logging failure never breaks the chat reply.
    if household_id:
        supabase = get_supabase_admin()
        try:
            _log_chat_exchange(
                household_id=household_id,
                user_id=str(current_user["id"]),
                user_message=body.get("message", ""),
                assistant_message=result.get("message", ""),
                category=result.get("category"),
                device_command=device_command,
                supabase=supabase,
            )
        except Exception as e:
            print(f"⚠️ Chat logging failed (non-fatal): {e}")

        log_event(
            supabase=supabase,
            user_id=current_user["id"],
            household_id=household_id,
            event_name="chief_chat",
            module="chief_of_staff",
            metadata={
                "category": result.get("category"),
                "triggered_device_command": bool(device_command),
            },
        )

    return result


@router.get("/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    """
    Returns this household's shared Chief of Staff conversation, oldest
    first. One thread per household, not per user — every member sees
    and continues the same conversation.
    """
    household_id = current_user.get("household_id")
    if not household_id:
        return []

    supabase = get_supabase_admin()
    result = supabase.table("chat_messages")\
        .select("*")\
        .eq("household_id", household_id)\
        .order("created_at", desc=True)\
        .limit(200)\
        .execute()

    messages = result.data or []
    messages.reverse()  # oldest first for display
    return messages


@router.delete("/history")
async def clear_history(current_user: dict = Depends(get_current_user)):
    """
    Clears the shared household conversation. Deliberately destructive
    for everyone in the household, not just the caller's device — the
    frontend is expected to confirm before calling this.
    """
    household_id = current_user.get("household_id")
    if not household_id:
        return {"status": "no_household"}

    supabase = get_supabase_admin()
    supabase.table("chat_messages").delete().eq("household_id", household_id).execute()
    return {"status": "cleared"}


@router.post("/dashboard-summary")
async def dashboard_summary(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    household_id = current_user.get("household_id")

    agent = ChiefOfStaffAgent(
        household_id=household_id,
        user_id=str(current_user["id"])
    )
    # get_dashboard_summary is sync — call directly
    result = agent.get_dashboard_summary(body.get("household_data", {}))

    if household_id:
        log_event(
            supabase=get_supabase_admin(),
            user_id=current_user["id"],
            household_id=household_id,
            event_name="dashboard_viewed",
            module="dashboard",
        )

    return result


async def _execute_device_command(household_id: str, entity_id: str, action: str, supabase) -> dict:
    """
    Execute a device command the Chief of Staff decided to take during
    conversation. Mirrors the logic in automation.py's /action endpoint,
    but called internally from chat rather than a direct user tap.
    """
    if not entity_id or not action:
        return {"status": "failed", "error": "Missing entity_id or action"}

    conn = supabase.table("ha_connections")\
        .select("ha_instance_url, ha_access_token")\
        .eq("household_id", household_id)\
        .eq("is_active", True)\
        .maybe_single()\
        .execute()

    if not conn or not conn.data:
        return {"status": "failed", "error": "Home Assistant not connected"}

    bridge = build_ha_bridge(conn.data["ha_instance_url"], conn.data["ha_access_token"])

    action_row = supabase.table("ha_actions").insert({
        "household_id": household_id,
        "entity_id":    entity_id,
        "action":       action,
        "initiated_by": "chief_of_staff",
        "status":       "pending",
    }).execute()
    action_id = action_row.data[0]["id"] if action_row.data else None

    try:
        action_map = {
            "turn_on":  bridge.turn_on,
            "turn_off": bridge.turn_off,
            "close":    bridge.close_cover,
            "open":     bridge.open_cover,
            "lock":     bridge.lock,
            "unlock":   bridge.unlock,
        }
        handler = action_map.get(action)
        if not handler:
            raise ValueError(f"Unknown action: {action}")

        ha_response = await handler(entity_id)

        if action_id:
            supabase.table("ha_actions").update({
                "status": "sent", "ha_response": ha_response,
            }).eq("id", action_id).execute()

        return {"status": "sent", "entity_id": entity_id, "action": action}

    except Exception as e:
        if action_id:
            supabase.table("ha_actions").update({
                "status": "failed", "ha_response": {"error": str(e)},
            }).eq("id", action_id).execute()
        return {"status": "failed", "error": str(e)}


def _log_chat_exchange(
    household_id: str,
    user_id: str,
    user_message: str,
    assistant_message: str,
    category: str,
    device_command: dict,
    supabase,
):
    """
    Write both sides of a chat exchange to chat_messages.
    Two rows per exchange (user + assistant) so message-level analytics
    (category breakdown, messages/week, device commands via chat) are
    queryable directly in Supabase rather than estimated.
    """
    rows = [
        {
            "household_id": household_id,
            "user_id":      user_id,
            "role":         "user",
            "content":      user_message[:2000],  # guard against pathological input
            "category":     category,
            "device_command": device_command,
        },
        {
            "household_id": household_id,
            "user_id":      user_id,
            "role":         "assistant",
            "content":      assistant_message[:2000],
            "category":     category,
            "device_command": device_command,
        },
    ]
    supabase.table("chat_messages").insert(rows).execute()
