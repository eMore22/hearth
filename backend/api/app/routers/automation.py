"""
Hearth Automation Router
Handles:
  POST /api/automation/webhook          — receives HA state-change events
  POST /api/automation/connect          — saves HA credentials + syncs devices
  GET  /api/automation/status           — connection status + device count
  GET  /api/automation/devices          — list of known devices
  POST /api/automation/action           — execute a command on a device
  GET  /api/automation/events           — recent smart home events
"""
import traceback
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from app.dependencies import get_current_user, get_supabase_admin
from app.services.ha_bridge import build_ha_bridge

router = APIRouter(tags=["automation"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class ConnectHARequest(BaseModel):
    ha_instance_url: str    # e.g. http://192.168.1.10:8123
    ha_access_token: str    # long-lived HA token


class ExecuteActionRequest(BaseModel):
    entity_id: str
    action: str             # turn_on | turn_off | lock | unlock | close | open
    payload: dict = {}


# ── Webhook (called by Home Assistant, no user auth) ─────────────────────────

@router.post("/webhook")
async def receive_webhook(
    request: Request,
    x_hearth_household_id: Optional[str] = Header(None),
):
    """
    Home Assistant calls this endpoint when a device state changes.
    HA automation config example:
      trigger:
        platform: state
        entity_id: binary_sensor.kitchen_leak
      action:
        service: rest_command.hearth_webhook
        data:
          household_id: "{{ your_household_uuid }}"
          entity_id: "binary_sensor.kitchen_leak"
          event_type: "state_changed"
          old_state: "off"
          new_state: "on"
          attributes: {}
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Household ID comes either from header or body
    household_id = x_hearth_household_id or body.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="household_id required")

    entity_id  = body.get("entity_id", "unknown")
    event_type = body.get("event_type", "state_changed")
    old_state  = body.get("old_state")
    new_state  = body.get("new_state")
    attributes = body.get("attributes", {})

    supabase = get_supabase_admin()

    # 1. Log the raw event
    try:
        supabase.table("ha_events").insert({
            "household_id": household_id,
            "entity_id":    entity_id,
            "event_type":   event_type,
            "old_state":    old_state,
            "new_state":    new_state,
            "attributes":   attributes,
            "processed":    False,
            "alert_sent":   False,
        }).execute()
    except Exception as e:
        print(f"⚠️ Failed to log HA event: {e}")

    # 2. Update device last_state in registry
    try:
        supabase.table("ha_devices").update({
            "last_state":    new_state,
            "last_state_at": datetime.utcnow().isoformat(),
        }).eq("household_id", household_id)\
          .eq("entity_id", entity_id)\
          .execute()
    except Exception:
        pass

    # 3. Process with Chief of Staff agent asynchronously
    #    (fire and forget — webhook must return fast)
    try:
        await _process_event_with_chief(
            household_id=household_id,
            entity_id=entity_id,
            event_type=event_type,
            old_state=old_state,
            new_state=new_state,
            attributes=attributes,
            supabase=supabase,
        )
    except Exception as e:
        print(f"⚠️ Chief of Staff event processing error: {e}")

    return {"status": "received", "entity_id": entity_id}


# ── Connect HA instance ───────────────────────────────────────────────────────

@router.post("/connect")
async def connect_ha(
    payload: ConnectHARequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Save HA credentials for this household and do an initial device sync.
    Called from the Profile → Connect Smart Home flow.
    """
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="Create a household first")

    # 1. Test the connection before saving anything
    bridge = build_ha_bridge(payload.ha_instance_url, payload.ha_access_token)
    is_reachable = await bridge.ping()
    if not is_reachable:
        raise HTTPException(
            status_code=400,
            detail="Could not reach Home Assistant. Check the URL and token."
        )

    supabase = get_supabase_admin()

    # 2. Upsert connection record
    try:
        supabase.table("ha_connections").upsert({
            "household_id":    household_id,
            "ha_instance_url": payload.ha_instance_url,
            "ha_access_token": payload.ha_access_token,
            "ha_connected_at": datetime.utcnow().isoformat(),
            "is_active":       True,
        }, on_conflict="household_id").execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save connection: {e}")

    # 3. Sync device list from HA
    device_count = await _sync_devices(household_id, bridge, supabase)

    return {
        "status":       "connected",
        "device_count": device_count,
        "message":      f"Hearth is now connected to {device_count} household devices.",
    }


# ── Connection status ─────────────────────────────────────────────────────────

@router.get("/status")
async def get_ha_status(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        return {"connected": False}

    supabase = get_supabase_admin()
    try:
        conn = supabase.table("ha_connections")\
            .select("*")\
            .eq("household_id", household_id)\
            .eq("is_active", True)\
            .maybe_single()\
            .execute()

        if not conn or not conn.data:
            return {"connected": False}

        device_count_res = supabase.table("ha_devices")\
            .select("id", count="exact")\
            .eq("household_id", household_id)\
            .execute()

        return {
            "connected":       True,
            "ha_instance_url": conn.data["ha_instance_url"],
            "ha_connected_at": conn.data["ha_connected_at"],
            "last_sync_at":    conn.data.get("last_sync_at"),
            "device_count":    device_count_res.count or 0,
        }
    except Exception:
        return {"connected": False}


# ── Device list ───────────────────────────────────────────────────────────────

@router.get("/devices")
async def list_devices(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        return []

    supabase = get_supabase_admin()
    try:
        result = supabase.table("ha_devices")\
            .select("*")\
            .eq("household_id", household_id)\
            .order("friendly_name")\
            .execute()
        return result.data or []
    except Exception:
        return []


# ── Execute action ────────────────────────────────────────────────────────────

@router.post("/action")
async def execute_action(
    payload: ExecuteActionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    User (or Chief of Staff) taps an action button → this executes it on HA.
    Logs the action to ha_actions for the audit trail.
    """
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")

    supabase = get_supabase_admin()

    # Get HA credentials
    conn = supabase.table("ha_connections")\
        .select("ha_instance_url, ha_access_token")\
        .eq("household_id", household_id)\
        .eq("is_active", True)\
        .maybe_single()\
        .execute()

    if not conn or not conn.data:
        raise HTTPException(status_code=400, detail="Home Assistant not connected")

    bridge = build_ha_bridge(conn.data["ha_instance_url"], conn.data["ha_access_token"])

    # Log the action as pending
    action_row = supabase.table("ha_actions").insert({
        "household_id": household_id,
        "entity_id":    payload.entity_id,
        "action":       payload.action,
        "payload":      payload.payload,
        "initiated_by": "user",
        "status":       "pending",
    }).execute()

    action_id = action_row.data[0]["id"] if action_row.data else None

    # Execute on HA
    try:
        action_map = {
            "turn_on":  bridge.turn_on,
            "turn_off": bridge.turn_off,
            "close":    bridge.close_cover,
            "open":     bridge.open_cover,
            "lock":     bridge.lock,
            "unlock":   bridge.unlock,
        }
        handler = action_map.get(payload.action)
        if not handler:
            raise HTTPException(status_code=400, detail=f"Unknown action: {payload.action}")

        ha_response = await handler(payload.entity_id)

        # Update status to sent
        if action_id:
            supabase.table("ha_actions").update({
                "status":      "sent",
                "ha_response": ha_response,
            }).eq("id", action_id).execute()

        return {
            "status":    "sent",
            "entity_id": payload.entity_id,
            "action":    payload.action,
        }

    except HTTPException:
        raise
    except Exception as e:
        if action_id:
            supabase.table("ha_actions").update({
                "status":      "failed",
                "ha_response": {"error": str(e)},
            }).eq("id", action_id).execute()
        raise HTTPException(status_code=500, detail=f"HA command failed: {str(e)}")


# ── Recent events ─────────────────────────────────────────────────────────────

@router.get("/events")
async def get_recent_events(
    current_user: dict = Depends(get_current_user),
    limit: int = 20,
):
    household_id = current_user.get("household_id")
    if not household_id:
        return []

    supabase = get_supabase_admin()
    try:
        result = supabase.table("ha_events")\
            .select("*")\
            .eq("household_id", household_id)\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        return result.data or []
    except Exception:
        return []


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _sync_devices(household_id: str, bridge: HABridgeService, supabase) -> int:
    """Fetch all HA states and upsert into ha_devices."""
    try:
        states  = await bridge.get_all_states()
        devices = HABridgeService.parse_devices_from_states(states)

        for device in devices:
            supabase.table("ha_devices").upsert({
                "household_id": household_id,
                **device,
            }, on_conflict="household_id,entity_id").execute()

        # Update last_sync_at
        supabase.table("ha_connections").update({
            "last_sync_at": datetime.utcnow().isoformat(),
        }).eq("household_id", household_id).execute()

        return len(devices)
    except Exception as e:
        print(f"⚠️ Device sync failed: {e}")
        return 0


async def _process_event_with_chief(
    household_id: str,
    entity_id: str,
    event_type: str,
    old_state: Optional[str],
    new_state: Optional[str],
    attributes: dict,
    supabase,
):
    """
    Pass the HA event to the Chief of Staff agent for cross-domain analysis.
    The Chief can reference documents, bills, and household data to generate
    a rich, actionable alert — e.g. leak detected → find insurance policy.
    """
    from app.agents.chief_of_staff_agent import ChiefOfStaffAgent

    # Get a real user ID for the agent context
    try:
        member = supabase.table("household_members")\
            .select("user_id")\
            .eq("household_id", household_id)\
            .limit(1)\
            .execute()
        user_id = member.data[0]["user_id"] if member.data else "system"
    except Exception:
        user_id = "system"

    agent = ChiefOfStaffAgent(household_id=household_id, user_id=user_id)

    # Build a rich message for the Chief
    device_class = attributes.get("device_class", "")
    friendly_name = attributes.get("friendly_name", entity_id)

    event_message = (
        f"Smart home event: {friendly_name} ({entity_id}) "
        f"changed from '{old_state}' to '{new_state}'. "
        f"Device class: {device_class}. "
        f"Event type: {event_type}."
    )

    # Only process truly significant state changes
    CRITICAL_TRANSITIONS = [
        ("off", "on",     ["moisture", "smoke", "carbon_monoxide", "gas"]),
        ("closed", "open", ["door", "window", "garage"]),
        ("locked", "unlocked", ["lock"]),
    ]

    is_critical = any(
        old_state == old and new_state == new and device_class in classes
        for old, new, classes in CRITICAL_TRANSITIONS
    )

    if not is_critical:
        # Non-critical — mark processed and return
        supabase.table("ha_events").update({"processed": True})\
            .eq("household_id", household_id)\
            .eq("entity_id", entity_id)\
            .eq("processed", False)\
            .execute()
        return

    # Fetch household context for the Chief
    docs_res = supabase.table("documents")\
        .select("title, document_type, expiry_date, summary")\
        .eq("household_id", household_id)\
        .execute()
    docs = docs_res.data or []

    # Build suggested actions based on device class
    suggested_actions = _get_suggested_actions(entity_id, device_class, new_state)

    # Ask the Chief of Staff to generate an actionable alert message
    system_prompt = """You are Hearth's Chief of Staff. A smart home sensor just triggered.
Cross-reference the household documents and generate a concise, actionable alert.
Be specific — mention document names if relevant (e.g. found home insurance policy).
Keep it under 3 sentences. Be direct and helpful."""

    context_text = ""
    if docs:
        insurance = [d for d in docs if "insurance" in (d.get("document_type") or "").lower()
                     or "insurance" in (d.get("title") or "").lower()]
        if insurance:
            context_text = f"Relevant documents found: {', '.join(d['title'] for d in insurance[:2])}."

    prompt = f"""{event_message}

{context_text}

Generate a brief alert message for the user. Include what happened, what Hearth can do,
and reference any relevant documents. Suggested actions available: {suggested_actions}"""

    try:
        chief_message = agent.ask_claude(prompt, system=system_prompt, max_tokens=200)
    except Exception:
        chief_message = f"{friendly_name} alert: state changed to {new_state}."

    # Store as a processed alert in ha_events
    supabase.table("ha_events").update({
        "processed":    True,
        "alert_sent":   True,
        "attributes": {
            **attributes,
            "chief_message":    chief_message,
            "suggested_actions": suggested_actions,
            "friendly_name":    friendly_name,
        },
    }).eq("household_id", household_id)\
      .eq("entity_id", entity_id)\
      .eq("processed", False)\
      .execute()


def _get_suggested_actions(entity_id: str, device_class: str, new_state: str) -> list:
    """Return a list of action objects the frontend can render as buttons."""
    actions = []

    if device_class in ("moisture", "water"):
        actions.append({
            "label":     "Shut off water valve",
            "action":    "turn_off",
            "entity_id": "switch.main_water_valve",
            "icon":      "water-outline",
            "color":     "#4FC3F7",
        })
        actions.append({
            "label":  "Draft insurance claim",
            "action": "draft_claim",
            "icon":   "document-text-outline",
            "color":  "#C77DFF",
        })

    elif device_class in ("door", "garage"):
        if new_state == "open":
            actions.append({
                "label":     "Close garage door",
                "action":    "close",
                "entity_id": entity_id,
                "icon":      "home-outline",
                "color":     "#FFD166",
            })

    elif device_class == "smoke":
        actions.append({
            "label":  "Call emergency",
            "action": "call_emergency",
            "icon":   "call-outline",
            "color":  "#FF6B6B",
        })

    elif device_class == "lock" and new_state == "unlocked":
        actions.append({
            "label":     "Lock door",
            "action":    "lock",
            "entity_id": entity_id,
            "icon":      "lock-closed-outline",
            "color":     "#06D6A0",
        })

    return actions