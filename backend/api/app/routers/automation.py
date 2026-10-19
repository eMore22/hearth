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
import asyncio
import secrets
import re
import traceback
import logging
import httpx
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from app.dependencies import get_current_user, get_supabase_admin
from app.services.ha_bridge import build_ha_bridge, HABridgeService
from app.services.ha_security import household_owner, webhook_token, check_webhook_token, validate_public_ha_url
from app.services.analytics import log_event

from app.services.subscriptions import require_tier

router = APIRouter(tags=["automation"])
logger = logging.getLogger(__name__)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ConnectHARequest(BaseModel):
    ha_instance_url: str
    ha_access_token: str


class ExecuteActionRequest(BaseModel):
    entity_id: str
    action: str
    payload: dict = {}
    confirm_sensitive: bool = False


def sensitive_device_action(domain: str, entity_id: str) -> bool:
    """Require a separate user acknowledgement for security/utility actuators."""
    if domain in ("lock", "cover"):
        return True
    if domain in ("switch", "input_boolean", "climate"):
        return any(word in entity_id.casefold() for word in
                   ("valve", "gas", "garage", "gate", "door", "heater", "security", "boiler"))
    return False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_markdown(text: str) -> str:
    """
    Remove markdown formatting so the message renders as clean plain text
    in React Native's <Text> component.
    """
    text = re.sub(r'\*{1,3}(.+?)\*{1,3}', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'^\s*[-*•]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
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
    x_hearth_webhook_token: Optional[str] = Header(None),
):
    # A global token must never authorize caller-selected households.
    # Each household has its own HMAC derived from the server-side root
    # secret and that connection's creation timestamp.
    from app.config import settings
    if not settings.HA_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook authentication is not configured")
    total = 0
    pieces = []
    async for chunk in request.stream():
        total += len(chunk)
        if total > 32 * 1024:
            raise HTTPException(status_code=413, detail="Webhook event too large")
        pieces.append(chunk)
    try:
        body = json.loads(b"".join(pieces))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid webhook event")
    body_id = str(body.get("household_id") or "")
    header_id = str(x_hearth_household_id or "")
    if header_id and body_id and header_id != body_id:
        raise HTTPException(status_code=400, detail="Webhook household mismatch")
    household_id = header_id or body_id
    if not household_id:
        raise HTTPException(status_code=400, detail="household_id required")
    # Invalid UUID fails before any DB query; no tenant enumeration.
    webhook_token(household_id, "validation")
    supabase = get_supabase_admin()
    try:
        connection = (supabase.table("ha_connections")
                      .select("ha_connected_at")
                      .eq("household_id", household_id).eq("is_active", True)
                      .maybe_single().execute().data)
    except Exception:
        raise HTTPException(status_code=503, detail="Webhook authorization unavailable") from None
    if (not connection or
        not check_webhook_token(
            household_id, str(connection.get("ha_connected_at") or ""),
            str(x_hearth_webhook_token or ""))):
        raise HTTPException(status_code=401, detail="Invalid webhook credentials")

    entity_id = str(body.get("entity_id") or "")[:120]
    if not re.fullmatch(r"[a-z_]+[.][a-z0-9_]+", entity_id):
        raise HTTPException(status_code=422, detail="Invalid entity ID")
    try:
        device = (supabase.table("ha_devices").select("entity_id")
                  .eq("household_id", household_id).eq("entity_id", entity_id)
                  .maybe_single().execute().data)
    except Exception:
        raise HTTPException(status_code=503, detail="Webhook device verification unavailable") from None
    if not device:
        raise HTTPException(status_code=404, detail="Unknown household device")

    event_type = str(body.get("event_type") or "state_changed")[:50]
    old_state = str(body.get("old_state") or "")[:80]
    new_state = str(body.get("new_state") or "")[:80]
    raw_attributes = body.get("attributes")
    if not isinstance(raw_attributes, dict):
        raw_attributes = {}
    attributes = {key: str(raw_attributes[key])[:100]
                  for key in ("device_class", "friendly_name")
                  if key in raw_attributes}

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

    # 3. Analytics — every event that hits the webhook, not just critical
    #    ones, so you can see overall HA traffic volume per household.
    log_event(
        supabase=supabase,
        user_id=None,  # webhook has no authenticated user — system event
        household_id=household_id,
        event_name="ha_event_received",
        module="automation",
        metadata={"entity_id": entity_id, "new_state": new_state, "device_class": attributes.get("device_class")},
    )

    # 4. Process with Chief of Staff (handles critical-event filtering,
    #    alert generation, and push notification internally)
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

@router.post("/connect", dependencies=[Depends(require_tier("home"))])
async def connect_ha(
    payload: ConnectHARequest,
    current_user: dict = Depends(get_current_user),
):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="Create a household first")

    household_owner(current_user)
    # Validate DNS as well as the hostname before any outbound call.
    await validate_public_ha_url(payload.ha_instance_url)

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

    log_event(
        supabase=supabase,
        user_id=current_user["id"],
        household_id=household_id,
        event_name="ha_connected",
        module="automation",
        metadata={"device_count": device_count},
    )

    return {
        "status":       "connected",
        "device_count": device_count,
        "message":      f"Hearth is now connected to {device_count} household devices.",
    }


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/webhook-setup")
async def household_webhook_setup(current_user: dict = Depends(get_current_user)):
    """One household's webhook credential; never expose the shared root key."""
    household_id = household_owner(current_user)
    try:
        db = get_supabase_admin()
        connection = (db.table("ha_connections").select("ha_connected_at")
                      .eq("household_id", household_id).eq("is_active", True)
                      .maybe_single().execute().data)
    except Exception:
        raise HTTPException(status_code=503, detail="Webhook configuration unavailable") from None
    if not connection:
        raise HTTPException(status_code=404, detail="Connect Home Assistant first")
    return {
        "webhook_url": "https://hearth-hq.onrender.com/api/automation/webhook",
        "header_household_id": household_id,
        "header_name": "X-Hearth-Webhook-Token",
        "webhook_token": webhook_token(household_id, str(connection.get("ha_connected_at") or "")),
        "note": "Keep this token private. It only works for this active household connection. Disconnect/reconnect to revoke it.",
    }


@router.get("/status")
async def get_ha_status(current_user: dict = Depends(get_current_user)):
    """Distinguish a configured HA connection from one verified online now.

    Keeping cached devices is useful when a test tunnel or real HA server is
    offline, but the UI must not call old states live or offer stale controls.
    A bounded ping prevents a dead remote endpoint blocking the dashboard.
    """
    household_id = current_user.get("household_id")
    if not household_id:
        return {"connected": False, "reachable": False}

    supabase = get_supabase_admin()
    try:
        conn = (supabase.table("ha_connections")
                .select("ha_instance_url,ha_access_token,ha_connected_at,last_sync_at")
                .eq("household_id", household_id).eq("is_active", True)
                .maybe_single().execute())
        if not conn or not conn.data:
            return {"connected": False, "reachable": False}

        device_count_res = (supabase.table("ha_devices")
                            .select("id", count="exact")
                            .eq("household_id", household_id).execute())

        reachable = False
        try:
            bridge = build_ha_bridge(conn.data["ha_instance_url"],
                                     conn.data["ha_access_token"])
            reachable = bool(await asyncio.wait_for(bridge.ping(), timeout=3.0))
        except Exception:
            # An unreachable/expired test tunnel must never be shown as live.
            reachable = False

        return {
            "connected": True,  # A connection is saved, not necessarily online.
            "reachable": reachable,
            "ha_instance_url": conn.data["ha_instance_url"],
            "ha_connected_at": conn.data["ha_connected_at"],
            "last_sync_at": conn.data.get("last_sync_at"),
            "device_count": device_count_res.count or 0,
        }
    except Exception:
        return {"connected": False, "reachable": False}


@router.delete("/disconnect")
async def disconnect_ha(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")

    household_owner(current_user)
    supabase = get_supabase_admin()
    try:
        supabase.table("ha_connections")\
            .update({"is_active": False})\
            .eq("household_id", household_id)\
            .execute()
        return {"status": "disconnected"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not disconnect Home Assistant: {e}")


# ── Devices ───────────────────────────────────────────────────────────────────

@router.get("/devices")
async def list_devices(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        return []

    supabase = get_supabase_admin()

    # Pull fresh state from Home Assistant before returning the cached rows.
    # If HA is temporarily unreachable, Hearth still falls back to the last
    # known states stored in Supabase instead of blanking the device list.
    try:
        conn = supabase.table("ha_connections")\
            .select("ha_instance_url, ha_access_token")\
            .eq("household_id", household_id)\
            .eq("is_active", True)\
            .maybe_single()\
            .execute()
        if conn and conn.data:
            bridge = build_ha_bridge(
                conn.data["ha_instance_url"],
                conn.data["ha_access_token"],
            )
            await _sync_devices(household_id, bridge, supabase)
    except Exception as e:
        print(f"⚠️ Live HA refresh failed; using cached states: {e}")

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

    # Until granular device roles and two-phase confirmation are audited,
    # only the verified household owner may actuate physical equipment.
    household_owner(current_user)

    supabase = get_supabase_admin()

    conn = supabase.table("ha_connections")\
        .select("ha_instance_url, ha_access_token")\
        .eq("household_id", household_id)\
        .eq("is_active", True)\
        .maybe_single()\
        .execute()

    if not conn or not conn.data:
        raise HTTPException(status_code=400, detail="Home Assistant not connected")

    # Do not dispatch arbitrary entity IDs supplied by a client.
    target = (supabase.table("ha_devices").select("domain, is_actionable")
              .eq("household_id", household_id).eq("entity_id", payload.entity_id)
              .maybe_single().execute())
    if not target.data or not target.data.get("is_actionable"):
        raise HTTPException(status_code=404, detail="Device not found in this household")
    domain = target.data.get("domain")
    allowed = {
        "switch": {"turn_on", "turn_off"}, "light": {"turn_on", "turn_off"},
        "fan": {"turn_on", "turn_off"}, "input_boolean": {"turn_on", "turn_off"},
        "climate": {"turn_on", "turn_off"}, "lock": {"lock", "unlock", "turn_on", "turn_off"},
        "cover": {"open", "close", "turn_on", "turn_off"},
    }
    if payload.action not in allowed.get(domain, set()):
        raise HTTPException(status_code=400, detail="Unsupported action for this device")
    if sensitive_device_action(str(domain or ""), payload.entity_id) and not payload.confirm_sensitive:
        raise HTTPException(status_code=428,
                            detail="Confirm this sensitive device action explicitly before sending it")

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
        domain = payload.entity_id.split(".", 1)[0]

        # The mobile UI intentionally uses generic on/off semantics. Resolve
        # those into the Home Assistant service expected by the entity domain.
        # This keeps every caller (Smart Home, Home alerts, Chief) consistent.
        resolved_action = payload.action
        if domain == "lock":
            if payload.action == "turn_on":
                resolved_action = "unlock"
            elif payload.action == "turn_off":
                resolved_action = "lock"
        elif domain == "cover":
            if payload.action == "turn_on":
                resolved_action = "open"
            elif payload.action == "turn_off":
                resolved_action = "close"

        action_map = {
            "turn_on":  bridge.turn_on,
            "turn_off": bridge.turn_off,
            "close":    bridge.close_cover,
            "open":     bridge.open_cover,
            "lock":     bridge.lock,
            "unlock":   bridge.unlock,
        }
        handler = action_map.get(resolved_action)
        if not handler:
            raise HTTPException(status_code=400, detail=f"Unknown action: {payload.action}")

        ha_response = await handler(payload.entity_id)

        # Read the entity back from HA and persist the real post-action state.
        # Some physical devices update a fraction of a second after the service
        # call, so poll briefly rather than immediately trusting cached DB state.
        expected_states = {
            "turn_on": "on",
            "turn_off": "off",
            "lock": "locked",
            "unlock": "unlocked",
            "open": "open",
            "close": "closed",
        }
        expected_state = expected_states.get(resolved_action)
        entity_state = None
        for attempt in range(4):
            if attempt:
                await asyncio.sleep(0.25 * attempt)
            try:
                entity_state = await bridge.get_entity_state(payload.entity_id)
            except Exception:
                entity_state = None
            if entity_state and (
                not expected_state or entity_state.get("state") == expected_state
            ):
                break

        # A service call being accepted does not prove that hardware switched.
        # Report the observed state separately so the app can avoid a false success.
        confirmed = bool(entity_state and entity_state.get("state") == expected_state)
        updated_device = None
        if entity_state:
            attrs = entity_state.get("attributes", {})
            state_value = entity_state.get("state")
            state_time = entity_state.get("last_changed") or datetime.utcnow().isoformat()
            supabase.table("ha_devices").update({
                "last_state": state_value,
                "last_state_at": state_time,
                "friendly_name": attrs.get("friendly_name", payload.entity_id),
                "device_class": attrs.get("device_class"),
            }).eq("household_id", household_id)\
              .eq("entity_id", payload.entity_id)\
              .execute()

            refreshed = supabase.table("ha_devices")\
                .select("*")\
                .eq("household_id", household_id)\
                .eq("entity_id", payload.entity_id)\
                .maybe_single()\
                .execute()
            updated_device = refreshed.data if refreshed else None

        if action_id:
            supabase.table("ha_actions").update({
                "status":      "sent",
                "ha_response": ha_response,
            }).eq("id", action_id).execute()

        log_event(
            supabase=supabase,
            user_id=current_user["id"],
            household_id=household_id,
            event_name="device_action_executed",
            module="automation",
            metadata={
                "entity_id": payload.entity_id,
                "action": resolved_action,
                "requested_action": payload.action,
                "initiated_by": "user",
            },
        )

        return {
            "status": "sent",
            "entity_id": payload.entity_id,
            "action": resolved_action,
            "requested_action": payload.action,
            "device": updated_device,
            "confirmed": confirmed,
            "observed_state": entity_state.get("state") if entity_state else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        # DNS and network errors must not leak raw hostnames, access tokens or
        # a misleading 500 to the user. Save a sanitized failure marker.
        if isinstance(e, httpx.TimeoutException):
            code, detail = 503, "Home Assistant timed out. Check that your Home Assistant address is reachable from the internet."
        elif isinstance(e, httpx.HTTPStatusError):
            code, detail = 502, "Home Assistant rejected the command. Check its connection and permissions."
        elif isinstance(e, httpx.RequestError):
            code, detail = 503, "Home Assistant is unreachable. Verify the public HTTPS address and DNS."
        else:
            code, detail = 500, "Could not complete the smart-home command."
        logger.warning("Home Assistant action failed (%s)", type(e).__name__)
        if action_id:
            try:
                supabase.table("ha_actions").update({
                    "status": "failed",
                    "ha_response": {"error": detail},
                }).eq("id", action_id).execute()
            except Exception:
                logger.warning("Could not persist failed Home Assistant action")
        raise HTTPException(status_code=code, detail=detail) from e


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

    try:
        member  = supabase.table("household_members")\
            .select("user_id")\
            .eq("household_id", household_id)\
            .limit(1)\
            .execute()
        user_id = member.data[0]["user_id"] if member.data else "system"
    except Exception:
        user_id = "system"

    try:
        docs_res = supabase.table("documents")\
            .select("title,document_type")\
            .eq("household_id", household_id)\
            .eq("visibility", "household")\
            .limit(30).execute()
        docs = docs_res.data or []
        insurance_docs = [
            d for d in docs
            if "insurance" in (d.get("document_type") or "").lower()
            or "insurance" in (d.get("title") or "").lower()
        ]
    except Exception:
        insurance_docs = []

    suggested_actions = _get_suggested_actions(entity_id, device_class, new_state)

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

    # ── Analytics — critical events specifically, the ones that actually
    # demonstrate the cross-domain "Chief connects HA to documents" story.
    log_event(
        supabase=supabase,
        user_id=None,
        household_id=household_id,
        event_name="ha_critical_alert_generated",
        module="automation",
        metadata={
            "entity_id": entity_id,
            "device_class": device_class,
            "cross_referenced_documents": len(insurance_docs) > 0,
            "suggested_action_count": len(suggested_actions),
        },
    )

    # ── Push notification — fire immediately, don't wait for the user to
    # open the app. This is the whole point of a smart-home alert: the
    # household needs to know about a leak or open door right now, not
    # whenever they next check the dashboard.
    try:
        from app.services.push_service import send_push_to_household
        await send_push_to_household(
            household_id=household_id,
            title=f"🏠 {friendly_name}",
            body=chief_message,
            data={"type": "ha_alert", "entity_id": entity_id, "screen": "dashboard"},
            supabase=supabase,
        )
    except Exception as e:
        print(f"⚠️ Push notification failed for HA event: {e}")