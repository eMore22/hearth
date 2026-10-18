from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
import asyncio
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.chief_of_staff_agent import ChiefOfStaffAgent
from app.services.ha_bridge import build_ha_bridge
from app.services.analytics import log_event
from app.services.household_context import load_household_context
from app.services.subscriptions import require_tier

router = APIRouter(tags=["chief_of_staff"])


@router.post("/chat", dependencies=[Depends(require_tier("home"))])
async def chat(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=403, detail="Create or join a household before using Chief")
    message = str(body.get("message") or "").strip()
    if not message or len(message) > 2000:
        raise HTTPException(status_code=422, detail="Message must contain 1 to 2000 characters")

    # IMPORTANT: never rely on a mobile-supplied state snapshot for either
    # reasoning or device commands. It may be stale or client-controlled.
    supabase = get_supabase_admin()
    context = await run_in_threadpool(load_household_context, household_id, supabase)
    # Refresh integration state only when needed. Offline HA must not block
    # bills/documents/grocery questions or trigger accidental actions.
    if context.get("smart_home_connected") and any(
        term in message.casefold() for term in
        ("device", "smart home", "water", "leak", "door", "lock", "valve",
         "garage", "light", "sensor", "what needs", "attention", "integration")
    ):
        try:
            connection = (supabase.table("ha_connections")
                          .select("ha_instance_url,ha_access_token")
                          .eq("household_id", household_id)
                          .eq("is_active", True).maybe_single().execute().data)
            if connection:
                bridge = build_ha_bridge(connection["ha_instance_url"],
                                         connection["ha_access_token"])
                live = await bridge.get_all_states()
                parsed = bridge.parse_devices_from_states(live)
                from datetime import datetime, timezone
                context["ha_devices"] = parsed
                context["smart_home_device_count"] = len(parsed)
                context["ha_live_verified_at"] = datetime.now(timezone.utc).isoformat()
                context["source_status"]["ha_devices"] = "live_verified"
        except Exception:
            # Existing bounded DB observations remain available, labeled
            # last-synced; never present a timeout as a successful action.
            context["source_status"]["ha_live_refresh"] = "unavailable"
    try:
        prior = (supabase.table("chat_messages").select("role,content")
                 .eq("household_id", household_id)
                 .order("created_at", desc=True).limit(20).execute().data or [])
        prior.reverse()
    except Exception:
        prior = []

    agent = ChiefOfStaffAgent(household_id=household_id, user_id=str(current_user["id"]))
    result = await agent.process_chat(
        message=message,
        context=context,
        conversation_history=prior,
    )

    # ── Device action confirmation boundary ──
    # Text chat is a *shared* household conversation. Never let a model
    # generated text response directly unlock a door, move a valve or
    # actuate equipment. A deliberate user tap in Devices, with current
    # authorization and live HA checks, is required for physical actions.
    device_command = result.pop("device_command", None)
    if device_command:
        result["message"] = (
            "I understood your device request, but I haven't changed the "
            "device state. Open Devices and confirm the action using the "
            "device's controls. Check Home Assistant's live state afterward."
        )
        result["device_confirmation_required"] = True
        result["actions_taken"] = []
        # No device control is attempted in this chat request.

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
                user_message=message,
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
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=403, detail="Household access required")
    data = await run_in_threadpool(load_household_context, household_id, get_supabase_admin())
    agent = ChiefOfStaffAgent(household_id=household_id, user_id=str(current_user["id"]))
    result = agent.get_dashboard_summary(data)

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

    # The model/client must not be able to command an arbitrary HA entity.
    device = (supabase.table("ha_devices").select("domain, is_actionable")
              .eq("household_id", household_id).eq("entity_id", entity_id)
              .maybe_single().execute())
    if not device.data or not device.data.get("is_actionable"):
        return {"status": "failed", "error": "Device unavailable in household"}
    domain = device.data.get("domain")
    allowed = {
        "switch": {"turn_on", "turn_off"}, "light": {"turn_on", "turn_off"},
        "fan": {"turn_on", "turn_off"}, "input_boolean": {"turn_on", "turn_off"},
        "lock": {"lock", "unlock"}, "cover": {"open", "close"},
    }
    if action not in allowed.get(domain, set()):
        return {"status": "failed", "error": "Unsupported action for this device"}

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

        expected = {
            "turn_on": "on", "turn_off": "off", "lock": "locked",
            "unlock": "unlocked", "open": "open", "close": "closed",
        }[action]
        confirmed = False
        observed = None
        # HA accepting a service call is not proof that a physical actuator
        # changed. Poll an authoritative observation before reporting success.
        for attempt in range(4):
            if attempt:
                await asyncio.sleep(0.8)
            try:
                current = await bridge.get_entity_state(entity_id)
                observed = current.get("state")
                if observed == expected:
                    confirmed = True
                    break
            except Exception:
                pass
        if observed is not None:
            supabase.table("ha_devices").update({
                "last_state": observed,
            }).eq("household_id", household_id).eq("entity_id", entity_id).execute()
        return {"status": "confirmed" if confirmed else "sent",
                "entity_id": entity_id, "action": action, "observed_state": observed}

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
