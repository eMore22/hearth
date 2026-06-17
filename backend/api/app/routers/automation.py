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
import re
import traceback
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from app.dependencies import get_current_user, get_supabase_admin
from app.services.ha_bridge import build_ha_bridge, HABridgeService

router = APIRouter(tags=["automation"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class ConnectHARequest(BaseModel):
    ha_instance_url: str
    ha_access_token: str


class ExecuteActionRequest(BaseModel):
    entity_id: str
    action: str
    payload: dict = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_markdown(text: str) -> str:
    """
    Remove markdown formatting so the message renders as clean plain text
    in React Native's <Text> component.
    """
    # Remove bold/italic markers
    text = re.sub(r'\*{1,3}(.+?)\*{1,3}', r'\1', text)
    # Remove inline links [label](url) → label
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove bare URLs
    text = re.sub(r'https?://\S+', '', text)
    # Remove markdown list markers (-, *, numbered)
    text = re.sub(r'^\s*[-*•]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    # Remove heading markers
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _get_suggested_actions(entity_id: str, device_class: str, new_state: str) -> list:
    """Return action button objects the frontend renders inline in the alert card."""
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


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def receive_webhook(
    request: Request,
    x_hearth_household_id: Optional[str] = Header(None),
):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    household_id = x_hearth_household_id or body.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="household_id required")

    entity_id  = body.get("entity_id", "unknown")
    event_type = body.get("event_type", "state_changed")
    old_state  = body.get("old_state")
    new_state  = body.get("new_state")
    attributes = body.get("attributes", {})

    supabase = get_supabase_admin()

    # 1. Log raw event
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

    # 2. Update device last_state
    try:
        supabase.table("ha_devices").update({
            "last_state":    new_state,
            "last_state_at": datetime.utcnow().isoformat(),
        }).eq("household_id", household_id)\
          .eq("entity_id", entity_id)\
          .execute()
    except Exception:
        pass

    # 3. Process with Chief of Staff
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
        print(f"⚠️ Chief processing error: {e}")
        traceback.print_exc()

    return {"status": "received", "entity_id": entity_id}


# ── Connect ───────────────────────────────────────────────────────────────────

@router.post("/connect")
async def connect_ha(
    payload: ConnectHARequest,
    current_user: dict = Depends(get_current_user),
):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="Create a household first")

    bridge = build_ha_bridge(payload.ha_instance_url, payload.ha_access_token)
    is_reachable = await bridge.ping()
    if not is_reachable:
        raise HTTPException(
            status_code=400,
            detail="Could not reach Home Assistant. Check the URL and token."
        )

    supabase = get_supabase_admin()

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

    device_count = await _sync_devices(household_id, bridge, supabase)

    return {
        "status":       "connected",
        "device_count": device_count,
        "message":      f"Hearth is now connected to {device_count} household devices.",
    }


# ── Status ────────────────────────────────────────────────────────────────────

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


# ── Devices ───────────────────────────────────────────────────────────────────

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
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")

    supabase = get_supabase_admin()

    conn = supabase.table("ha_connections")\
        .select("ha_instance_url, ha_access_token")\
        .eq("household_id", household_id)\
        .eq("is_active", True)\
        .maybe_single()\
        .execute()

    if not conn or not conn.data:
        raise HTTPException(status_code=400, detail="Home Assistant not connected")

    bridge = build_ha_bridge(conn.data["ha_instance_url"], conn.data["ha_access_token"])

    action_row = supabase.table("ha_actions").insert({
        "household_id": household_id,
        "entity_id":    payload.entity_id,
        "action":       payload.action,
        "payload":      payload.payload,
        "initiated_by": "user",
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
        handler = action_map.get(payload.action)
        if not handler:
            raise HTTPException(status_code=400, detail=f"Unknown action: {payload.action}")

        ha_response = await handler(payload.entity_id)

        if action_id:
            supabase.table("ha_actions").update({
                "status":      "sent",
                "ha_response": ha_response,
            }).eq("id", action_id).execute()

        return {"status": "sent", "entity_id": payload.entity_id, "action": payload.action}

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
    try:
        states  = await bridge.get_all_states()
        devices = HABridgeService.parse_devices_from_states(states)
        for device in devices:
            supabase.table("ha_devices").upsert({
                "household_id": household_id,
                **device,
            }, on_conflict="household_id,entity_id").execute()
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
    from app.agents.chief_of_staff_agent import ChiefOfStaffAgent

    # Only process critical state transitions
    CRITICAL_TRANSITIONS = [
        ("off",     "on",       ["moisture", "smoke", "carbon_monoxide", "gas"]),
        ("closed",  "open",     ["door", "window", "garage"]),
        ("locked",  "unlocked", ["lock"]),
    ]

    device_class  = attributes.get("device_class", "")
    friendly_name = attributes.get("friendly_name", entity_id)

    is_critical = any(
        old_state == old and new_state == new and device_class in classes
        for old, new, classes in CRITICAL_TRANSITIONS
    )

    if not is_critical:
        supabase.table("ha_events").update({"processed": True})\
            .eq("household_id", household_id)\
            .eq("entity_id", entity_id)\
            .eq("processed", False)\
            .execute()
        return

    # Get user_id for agent
    try:
        member  = supabase.table("household_members")\
            .select("user_id")\
            .eq("household_id", household_id)\
            .limit(1)\
            .execute()
        user_id = member.data[0]["user_id"] if member.data else "system"
    except Exception:
        user_id = "system"

    # Fetch insurance/home docs for cross-referencing
    try:
        docs_res = supabase.table("documents")\
            .select("title, document_type, summary")\
            .eq("household_id", household_id)\
            .execute()
        docs = docs_res.data or []
        insurance_docs = [
            d for d in docs
            if "insurance" in (d.get("document_type") or "").lower()
            or "insurance" in (d.get("title") or "").lower()
        ]
    except Exception:
        insurance_docs = []

    # Build suggested actions
    suggested_actions = _get_suggested_actions(entity_id, device_class, new_state)

    # ── Tight prompt — no markdown, 2 sentences, plain text only ──
    doc_context = ""
    if insurance_docs:
        names = ", ".join(d["title"] for d in insurance_docs[:2])
        doc_context = f" I found your {names} in the document vault."

    system_prompt = (
        "You are Hearth's Chief of Staff. Write ONE to TWO plain sentences — "
        "no markdown, no bullet points, no bold, no asterisks, no URLs, no lists. "
        "State what happened and what the user should do. Be direct and warm."
    )

    prompt = (
        f"{friendly_name} just changed from {old_state} to {new_state} "
        f"(device class: {device_class}).{doc_context} "
        f"Write a 1-2 sentence plain text alert for the user."
    )

    agent = ChiefOfStaffAgent(household_id=household_id, user_id=user_id)

    try:
        raw_message   = agent.ask_claude(prompt, system=system_prompt, max_tokens=120)
        chief_message = _strip_markdown(raw_message)
    except Exception:
        chief_message = f"{friendly_name} alert: changed to {new_state}."

    # Save processed alert
    supabase.table("ha_events").update({
        "processed":  True,
        "alert_sent": True,
        "attributes": {
            **attributes,
            "chief_message":     chief_message,
            "suggested_actions": suggested_actions,
            "friendly_name":     friendly_name,
        },
    }).eq("household_id", household_id)\
      .eq("entity_id", entity_id)\
      .eq("processed", False)\
      .execute()