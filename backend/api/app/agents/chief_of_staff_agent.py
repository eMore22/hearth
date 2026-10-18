import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.agents.document_agent import DocumentAgent
from app.agents.bill_agent import BillAgent
from app.agents.grocery_agent import GroceryAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.health_agent import HealthAgent
from app.services.household_reasoning import make_chief_prompt, offline_household_brief


class ChiefOfStaffAgent(BaseHouseholdAgent):

    SYSTEM_PROMPT = """You are Hearth's Chief of Staff AI — a warm, intelligent, and proactive assistant.
You help households manage documents, bills, groceries, maintenance, health, and smart home devices.

IMPORTANT RULES:
- Always remember and reference what the user told you earlier in the conversation.
- If the user shared their name, partner's name, or any personal detail — remember it.
- Never contradict something you were told earlier.
- Be warm, concise, and genuinely helpful — no markdown, no bullet points, plain conversational text only.
- When smart home alerts are present, treat them as the highest priority items.
- Cross-reference smart home events with documents when relevant (e.g. leak → insurance policy).
- Reference household context when relevant.
- If you don't have enough information, ask clarifying questions politely."""

    def __init__(self, household_id: str, user_id: str):
        super().__init__(household_id, user_id)
        self.document_agent    = DocumentAgent(household_id, user_id)
        self.bill_agent        = BillAgent(household_id, user_id)
        self.grocery_agent     = GroceryAgent(household_id, user_id)
        self.maintenance_agent = MaintenanceAgent(household_id, user_id)
        self.health_agent      = HealthAgent(household_id, user_id)

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "get_dashboard_summary":
            return self.get_dashboard_summary(input_data.get("household_data", {}))
        raise ValueError(f"Unknown sync action: {action}")

    async def process_chat(
        self,
        message: str,
        context: Dict,
        conversation_history: Optional[List] = None
    ) -> Dict:
        if conversation_history is None:
            conversation_history = []

        category = await self._classify_intent(message)

        response = {
            "category": category,
            "message": "",
            "proactive_suggestions": [],
            "actions_taken": [],
        }

        device_command = (
            self._detect_device_command(message, context.get("ha_devices") or [])
            if category == "smart_home" else None
        )
        if device_command:
            response["device_command"] = device_command
            response["message"] = "Sending the device command. I will report whether it succeeds."
        else:
            deterministic = self._deterministic_reply(message, category, context)
            if deterministic is not None:
                response["message"] = deterministic
            else:
                try:
                    from fastapi.concurrency import run_in_threadpool
                    response["message"] = await run_in_threadpool(
                        self._ai_response_with_memory,
                        message, category, context, conversation_history,
                    )
                except Exception:
                    response["message"] = offline_household_brief(context)

        if category == "grocery":
            response["proactive_suggestions"].append("Generate weekly meal plan")
        elif category == "maintenance":
            response["proactive_suggestions"].append("Show upcoming maintenance tasks")
        elif category == "bills":
            response["proactive_suggestions"].append("Find unused subscriptions")
        elif category == "smart_home":
            response["proactive_suggestions"].append("Show all smart home alerts")

        self.log_action("chat", f"{category}: {message[:80]}")
        return response

    def _ai_response_with_memory(
        self, message: str, category: str, context: Dict, conversation_history: List,
    ) -> str:
        prompt = make_chief_prompt(message, context, conversation_history)
        answer = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=720)
        return offline_household_brief(context) if answer == self.AI_OFF_MESSAGE else answer

    def _deterministic_reply(self, message: str, category: str, context: Dict) -> Optional[str]:
        """Handle common read-only requests without a model."""
        msg = message.lower()
        if category == "bills" and any(w in msg for w in ("due", "upcoming", "what bills", "show bills")):
            if (context.get("source_status") or {}).get("bills") == "unavailable":
                return "I couldn't check the bill records just now. Try again shortly."
            bills = [b for b in (context.get("bills") or [])
                     if b.get("is_active") is not False]
            return ("Bills: " + "; ".join(
                str(b.get("provider") or b.get("name") or "Bill")
                + (f" due {b['next_due_date']}" if b.get("next_due_date") else " (due date not recorded)")
                + (f", {b['currency']} {b['amount']}" if b.get("currency") and b.get("amount") is not None else "")
                for b in bills[:12])) if bills else "I don't see any active bills in your household overview."
        if category == "grocery" and any(w in msg for w in ("inventory", "pantry", "what groceries", "shopping list")):
            sources = context.get("source_status") or {}
            if sources.get("inventory") == "unavailable" and sources.get("legacy_inventory") == "unavailable":
                return "I couldn't check your grocery records just now. Try again shortly."
            items = context.get("inventory") or []
            return ("Pantry: " + ", ".join(str(i.get("name") or i.get("item_name") or "Item")
                                            for i in items[:20])) if items else "Your pantry is currently empty in Hearth."
        if category == "documents" and any(w in msg for w in ("expiry", "expire", "expiring", "document list")):
            if (context.get("source_status") or {}).get("documents") == "unavailable":
                return "I couldn't check your document vault just now. Try again shortly."
            alerts = context.get("alerts") or []
            return ("Document alerts: " + "; ".join(str(x.get("message", "Review document")) for x in alerts[:5])
                    if alerts else f"You have {len(context.get('documents') or [])} saved documents and no current expiry alerts.")
        if category == "general" and any(w in msg for w in ("my tasks", "to do", "todo", "to-do")):
            tasks = context.get("household_tasks") or []
            return ("Household tasks: " + "; ".join(str(t.get("title", "Task")) for t in tasks[:12])
                    if tasks else "I don't see any household tasks in your current overview.")
        if any(w in msg for w in ("integrations", "integration status", "what is connected", "connected services")):
            integrations = context.get("integrations") or []
            return ("Integrations: " + "; ".join(
                f"{item.get('name')}: {'configured (not live-verified)' if item.get('connected') else 'not configured'}"
                + (f", last sync {item['last_sync_at']}" if item.get("last_sync_at") else "")
                for item in integrations)) if integrations else "Integration status is not available."
        if category == "smart_home" and any(w in msg for w in ("status", "devices", "what is on", "connected")):
            if (context.get("source_status") or {}).get("ha_devices") == "unavailable":
                return "I couldn't read Home Assistant device states just now. Try again shortly."
            devices = context.get("ha_devices") or []
            return ("Device status: " + "; ".join(
                f"{d.get('friendly_name', 'Device')}: last known {d.get('last_state', 'unknown')}"
                + (f" at {d['last_state_at']}" if d.get("last_state_at") else "")
                for d in devices[:12])
                    if devices else "No device states are loaded in your current overview.")
        return None

    async def _classify_intent(self, message: str) -> str:
        """Prefer free deterministic routing for known household requests."""
        msg = message.lower()
        if any(w in msg for w in ("integration", "connected services")):
            return "integrations"
        if any(w in msg for w in ("smart home", "sensor", "leak", "door", "lock", "device", "garage", "valve", "light", "switch", "temperature")):
            return "smart_home"
        if any(w in msg for w in ("document", "passport", "insurance", "expire", "warranty")):
            return "documents"
        if any(w in msg for w in ("bill", "subscription", "payment", "rent")):
            return "bills"
        if any(w in msg for w in ("meal", "food", "grocery", "cook", "shopping", "pantry", "inventory")):
            return "grocery"
        if any(w in msg for w in ("fix", "repair", "maintenance", "broken")):
            return "maintenance"
        if any(w in msg for w in ("sick", "health", "doctor", "medication")):
            return "health"
        return "general"

    def _detect_device_command(self, message: str, devices: List[Dict]) -> Optional[Dict]:
        """
        Match a natural-language command to a known device + HA action.
        Returns {"entity_id": ..., "action": ...} or None if no confident match.

        Deliberately conservative: only fires on clear action verbs paired
        with a device name substring match, so ambiguous messages ("is the
        garage door open?") fall through to a normal conversational reply
        instead of accidentally triggering a command.
        """
        if not devices:
            return None

        import re
        msg = " ".join(message.lower().split())
        # Only unambiguous imperative instructions can control equipment.
        match = re.match(
            r"^(?:please\s+|can you\s+|could you\s+|hey hearth[,]?\s+)*"
            r"(unlock|lock|open|close|shut|turn on|turn off|switch on|switch off)\b", msg
        )
        if not match:
            return None
        detected_action = {
            "unlock": "unlock", "lock": "lock", "open": "open",
            "close": "close", "shut": "close", "turn on": "turn_on",
            "switch on": "turn_on", "turn off": "turn_off", "switch off": "turn_off",
        }[match.group(1)]
        matches = [
            device for device in devices
            if device.get("is_actionable")
            and (device.get("friendly_name") or "").strip()
            and (device.get("friendly_name") or "").lower() in msg
        ]
        if len(matches) != 1:
            return None
        best_match = matches[0]

        domain = best_match.get("domain", "")
        VALID_ACTIONS_BY_DOMAIN = {
            "cover":  {"open", "close"},
            "lock":   {"lock", "unlock"},
            "switch": {"turn_on", "turn_off"},
            "light":  {"turn_on", "turn_off"},
            "fan":    {"turn_on", "turn_off"},
        }
        valid_actions = VALID_ACTIONS_BY_DOMAIN.get(domain, set())
        if detected_action not in valid_actions:
            return None

        return {
            "entity_id":     best_match["entity_id"],
            "action":        detected_action,
            "friendly_name": best_match.get("friendly_name"),
        }

    def get_dashboard_summary(self, household_data: Dict) -> Dict:
        """A token-free dashboard based on dates in persisted records."""
        from datetime import date

        def days_until(value) -> int:
            if not value:
                return 9999
            try:
                return (date.fromisoformat(str(value)[:10]) - date.today()).days
            except (ValueError, TypeError):
                return 9999

        documents = household_data.get("documents") or []
        expiring = sorted(
            (d for d in documents if days_until(d.get("expiry_date")) <= 30),
            key=lambda d: days_until(d.get("expiry_date")),
        )
        bills = [b for b in (household_data.get("bills") or []) if b.get("is_active", True)]
        monthly = 0.0
        household_currency = (household_data.get("household") or {}).get("currency")
        for bill in bills:
            if household_currency and bill.get("currency") not in (None, household_currency):
                continue  # Never add incompatible currencies.
            try:
                amount = float(bill.get("amount") or 0)
                cycle = str(bill.get("billing_cycle") or "").lower()
                monthly += amount * (52 / 12 if cycle == "weekly" else
                                     1 / 12 if cycle in ("annual", "yearly") else
                                     1 if cycle in ("monthly", "month") else 0)
            except (ValueError, TypeError):
                continue

        inventory = household_data.get("inventory") or []
        maintenance = household_data.get("tasks") or []
        medicines = household_data.get("medications") or []
        alerts = household_data.get("smart_home_alerts") or []
        summary = {
            "documents": {
                "total": len(documents), "expiring_soon": len(expiring),
                "next_expiry": expiring[0].get("title") if expiring else None,
            },
            "bills": {
                "total": len(bills), "monthly_spend": round(monthly, 2),
                "largest_bill": max(bills, key=lambda b: float(b.get("amount") or 0)).get("provider")
                if bills else None,
            },
            "grocery": {
                "items": len(inventory),
                "expiring_soon": len([i for i in inventory if days_until(i.get("expiry_date")) <= 3]),
            },
            "maintenance": {
                "total_tasks": len(maintenance),
                "due_this_week": len([t for t in maintenance if
                    t.get("is_active", True) and days_until(t.get("next_due_date")) <= 7]),
            },
            "health": {
                "recent_events": household_data.get("health_event_count", 0),
                "active_medications": len([m for m in medicines if m.get("is_active", True)]),
            },
            "chief_message": (
                f"{len(alerts)} recent smart-home alerts need review." if alerts else
                f"{len(expiring)} documents need expiry review." if expiring else
                "Your household overview is ready."
            ),
        }
        return summary
