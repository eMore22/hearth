import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.agents.document_agent import DocumentAgent
from app.agents.bill_agent import BillAgent
from app.agents.grocery_agent import GroceryAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.health_agent import HealthAgent


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

        try:
            response["message"] = self._ai_response_with_memory(
                message=message,
                category=category,
                context=context,
                conversation_history=conversation_history,
            )
        except Exception as e:
            print(f"⚠️ Chief of Staff chat error: {e}")
            response["message"] = "I'm having trouble processing that right now. Could you try rephrasing?"

        # ── Device command detection ──
        # Only attempt this for smart_home intent, and only if the frontend
        # sent the household's device list. Matches simple natural-language
        # commands ("close the garage door", "turn off kitchen light") to a
        # known entity_id + HA action. Deliberately rule-based rather than
        # another LLM call — keeps this fast and predictable.
        if category == "smart_home":
            device_command = self._detect_device_command(message, context.get("ha_devices") or [])
            if device_command:
                response["device_command"] = device_command

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
        self,
        message: str,
        category: str,
        context: Dict,
        conversation_history: List,
    ) -> str:
        # Build conversation history text
        history_text = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-15:]:
                role = "User" if msg.get("role") == "user" else "Hearth"
                history_lines.append(f"{role}: {msg.get('content', '')}")
            history_text = "\n".join(history_lines)

        # ── Build household context summary ──
        context_parts = []

        # Documents
        if context.get("documents"):
            context_parts.append(f"{len(context['documents'])} documents in vault")

        # Document expiry alerts
        alerts = context.get("alerts") or []
        urgent_alerts = [a for a in alerts if a.get("urgency") in ("expired", "critical", "urgent")]
        if urgent_alerts:
            alert_lines = "; ".join(
                a.get("message", "") for a in urgent_alerts[:5] if a.get("message")
            )
            if alert_lines:
                context_parts.append(f"URGENT document alerts: {alert_lines}")

        # Bills
        if context.get("bills"):
            total = sum(b.get("amount", 0) for b in context["bills"])
            context_parts.append(f"{len(context['bills'])} active bills (${total:,.0f}/month)")

        # Tasks
        tasks = context.get("tasks") or []
        if tasks:
            pending = [t for t in tasks if not t.get("completed")]
            context_parts.append(f"{len(pending)} pending maintenance tasks")

        # Inventory
        if context.get("inventory"):
            context_parts.append(f"{len(context['inventory'])} grocery items")

        # Medications
        if context.get("medications"):
            context_parts.append(f"{len(context['medications'])} medications tracked")

        # ── Smart home context — highest priority ──
        smart_home_alerts = context.get("smart_home_alerts") or []
        if smart_home_alerts:
            ha_lines = []
            for alert in smart_home_alerts[:5]:
                entity   = alert.get("entity", "device")
                msg_text = alert.get("message", "")
                state    = alert.get("new_state", "")
                ha_lines.append(f"{entity} is {state}: {msg_text}")
            context_parts.append(
                f"ACTIVE SMART HOME ALERTS ({len(smart_home_alerts)}): "
                + " | ".join(ha_lines)
            )
        elif context.get("smart_home_connected"):
            device_count = context.get("smart_home_device_count", 0)
            context_parts.append(f"Smart home connected ({device_count} devices, no active alerts)")

        household_summary = ", ".join(context_parts) if context_parts else "No household data loaded yet"

        prompt = f"""CONVERSATION HISTORY:
{history_text if history_text else "This is the start of the conversation."}

HOUSEHOLD OVERVIEW: {household_summary}

CURRENT MESSAGE FROM USER: {message}

Respond as Hearth Chief of Staff. Rules:
1. Remember anything the user told you earlier.
2. SMART HOME ALERTS are highest priority — mention them first if the user asks what needs attention.
3. Cross-reference smart home events with documents when relevant (e.g. leak detected → check insurance policy in vault).
4. Give a warm, concise, plain text response — no markdown, no asterisks, no bullet points.
5. Never repeat information unnecessarily.
6. Build naturally on the conversation."""

        return self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=500)

    async def _classify_intent(self, message: str) -> str:
        try:
            if self.nvidia_client:
                return self.nvidia_client.classify_intent(message)
        except Exception:
            pass

        msg = message.lower()
        if any(w in msg for w in ["smart home", "sensor", "leak", "door", "lock", "device", "garage", "valve"]):
            return "smart_home"
        if any(w in msg for w in ["document", "passport", "insurance", "expire", "warranty"]):
            return "documents"
        if any(w in msg for w in ["bill", "subscription", "payment", "rent"]):
            return "bills"
        if any(w in msg for w in ["meal", "food", "grocery", "cook", "shopping"]):
            return "grocery"
        if any(w in msg for w in ["fix", "repair", "maintenance", "broken"]):
            return "maintenance"
        if any(w in msg for w in ["sick", "health", "doctor", "medication"]):
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

        msg = message.lower()

        ACTION_VERBS = [
            (["close", "shut"],            "close"),
            (["open"],                     "open"),
            (["lock"],                     "lock"),
            (["unlock"],                   "unlock"),
            (["turn off", "switch off"],   "turn_off"),
            (["turn on", "switch on"],     "turn_on"),
        ]

        detected_action = None
        for phrases, action in ACTION_VERBS:
            if any(p in msg for p in phrases):
                detected_action = action
                break

        if not detected_action:
            return None

        best_match = None
        best_score = 0
        for device in devices:
            name = (device.get("friendly_name") or "").lower()
            if not name:
                continue
            name_words = set(name.split())
            msg_words = set(msg.split())
            overlap = len(name_words & msg_words)
            if overlap > best_score:
                best_score = overlap
                best_match = device

        if not best_match or best_score == 0:
            return None

        if not best_match.get("is_actionable"):
            return None

        domain = best_match.get("domain", "")
        VALID_ACTIONS_BY_DOMAIN = {
            "cover":  {"open", "close"},
            "lock":   {"lock", "unlock"},
            "switch": {"turn_on", "turn_off"},
            "light":  {"turn_on", "turn_off"},
            "fan":    {"turn_on", "turn_off"},
        }
        valid_actions = VALID_ACTIONS_BY_DOMAIN.get(domain, {"turn_on", "turn_off"})
        if detected_action not in valid_actions:
            return None

        return {
            "entity_id":     best_match["entity_id"],
            "action":        detected_action,
            "friendly_name": best_match.get("friendly_name"),
        }

    def get_dashboard_summary(self, household_data: Dict) -> Dict:
        summary = {
            "documents":   self._get_document_snapshot(household_data.get("documents", [])),
            "bills":       self._get_bill_snapshot(household_data.get("bills", [])),
            "grocery":     self._get_grocery_snapshot(household_data.get("inventory", [])),
            "maintenance": self._get_maintenance_snapshot(household_data.get("tasks", [])),
            "health":      self._get_health_snapshot(household_data.get("health_events", [])),
            "chief_message": "",
        }

        doc_count  = len(household_data.get("documents", []))
        bill_count = len(household_data.get("bills", []))
        task_count = len(household_data.get("tasks", []))
        ha_alerts  = len(household_data.get("smart_home_alerts", []))

        prompt = (
            f"Write a short warm one-sentence greeting for a household dashboard. "
            f"Context: {doc_count} documents, {bill_count} bills, {task_count} tasks"
            + (f", {ha_alerts} smart home alert(s) active" if ha_alerts else "")
            + ". Keep it under 20 words and upbeat. No markdown."
        )

        summary["chief_message"] = self.ask_light(prompt, max_tokens=60)
        self.log_action("dashboard_summary", "generated")
        return summary

    def _get_document_snapshot(self, documents: List) -> Dict:
        expiring_soon = [d for d in documents if d.get("days_until_expiry", 999) <= 30]
        return {
            "total": len(documents),
            "expiring_soon": len(expiring_soon),
            "next_expiry": expiring_soon[0].get("title") if expiring_soon else None,
        }

    def _get_bill_snapshot(self, bills: List) -> Dict:
        total   = sum(b.get("amount", 0) for b in bills)
        largest = max(bills, key=lambda x: x.get("amount", 0)) if bills else None
        return {
            "total": len(bills),
            "monthly_spend": round(total, 2),
            "largest_bill": largest.get("provider") if largest else None,
        }

    def _get_grocery_snapshot(self, inventory: List) -> Dict:
        expiring = [i for i in inventory if i.get("days_left", 999) <= 3]
        return {"items": len(inventory), "expiring_soon": len(expiring)}

    def _get_maintenance_snapshot(self, tasks: List) -> Dict:
        upcoming = [t for t in tasks if t.get("days_until_due", 999) <= 7]
        return {"total_tasks": len(tasks), "due_this_week": len(upcoming)}

    def _get_health_snapshot(self, events: List) -> Dict:
        return {"recent_events": len(events), "active_medications": 0}