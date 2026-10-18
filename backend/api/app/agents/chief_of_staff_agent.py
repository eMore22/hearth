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
        if category == "utilities":
            sources = context.get("source_status") or {}
            if sources.get("utilities") == "unavailable":
                return "I couldn't check saved utility bills right now."
            overview = context.get("utilities") or {}
            items = overview.get("utilities") or []
            if not items:
                return ("No utility bills are recorded yet. You can track electricity, "
                        "water, internet, gas and television through Hearth Bills.")
            filters = [word for word in ("electricity", "water", "internet", "gas", "television")
                       if word in msg]
            matching = [row for row in items if not filters or row.get("category") in filters]
            if not matching:
                return "I couldn't find a saved bill for that utility."
            lines = []
            for row in matching[:8]:
                money = (str(row.get("currency") or "currency unknown") + " " +
                         str(row["amount"])) if row.get("amount") is not None else "amount not recorded"
                due = str(row.get("next_due_date") or "due date not recorded")
                lines.append(f"{row.get('name') or 'Utility'}: {money}, {due}")
            household_currency = str(overview.get("household_currency") or "").upper()
            other_currencies = {str(row.get("currency") or "").upper()
                                for row in matching if row.get("currency")
                                and str(row.get("currency")).upper() != household_currency}
            mismatch_note = (" Some recorded utility amounts use " +
                             ", ".join(sorted(other_currencies)) +
                             " instead of household currency " + household_currency +
                             ". Check the saved bill settings; no conversion was made."
                             if household_currency and other_currencies else "")
            return ("These are manually recorded utility bills, not provider-verified balances "
                    "or confirmed payments: " + "; ".join(lines) + "." + mismatch_note)
        if category == "bills" and any(w in msg for w in ("due", "upcoming", "what bills", "show bills")):
            if (context.get("source_status") or {}).get("bills") == "unavailable":
                return "I couldn't check the bill records just now. Try again shortly."
            bills = [bill for bill in (context.get("bills") or [])
                     if bill.get("is_active") is not False]
            if not bills:
                return "I don't see any active bills in your household overview."

            from decimal import Decimal, InvalidOperation
            household_currency = str((context.get("household") or {}).get("currency") or "").upper()
            mismatched = set()
            def describe(bill: dict) -> str:
                title = str(bill.get("name") or bill.get("provider") or "Bill")
                saved_currency = str(bill.get("currency") or "").upper()
                if saved_currency and household_currency and saved_currency != household_currency:
                    mismatched.add(saved_currency)
                amount = bill.get("amount")
                if amount is None:
                    price = "amount not recorded"
                else:
                    try:
                        value = Decimal(str(amount))
                        price = (saved_currency + " " if saved_currency else "currency not recorded: ") + format(value, ",.2f")
                    except (InvalidOperation, ValueError):
                        price = "amount could not be read"
                when = str(bill.get("next_due_date") or "")
                return f"{title}: {price}, " + (f"due {when[:10]}" if when else "due date not recorded")

            dated = sorted((bill for bill in bills if bill.get("next_due_date")),
                           key=lambda bill: str(bill["next_due_date"]))
            undated = [bill for bill in bills if not bill.get("next_due_date")]
            lines = [describe(bill) for bill in (dated + undated)[:12]]
            intro = ("Here are your saved bills, with recorded due dates first. "
                     if dated else
                     "I can't tell which bills are due soon because none has a due date recorded. ")
            note = (f" Check your saved bill currencies: some are {', '.join(sorted(mismatched))}, "
                    f"but your household currency is {household_currency}. "
                    "I have not converted or changed these amounts."
                    if mismatched else "")
            return intro + "; ".join(lines) + "." + note
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
        if category != "smart_home" and any(w in msg for w in ("integrations", "integration status", "what is connected", "connected services")):
            integrations = context.get("integrations") or []
            return ("Integrations: " + "; ".join(
                f"{item.get('name')}: {'configured (not live-verified)' if item.get('connected') else 'not configured'}"
                + (f", last sync {item['last_sync_at']}" if item.get("last_sync_at") else "")
                for item in integrations)) if integrations else "Integration status is not available."
        if category == "smart_home" and any(
            w in msg for w in ("status", "devices", "what is on", "connected", "last known", "state of")
        ):
            sources = context.get("source_status") or {}
            if sources.get("ha_devices") == "unavailable":
                return "I couldn't check saved Home Assistant states just now. Try again shortly."
            devices = context.get("ha_devices") or []
            conn = next((item for item in (context.get("integrations") or [])
                         if item.get("name") == "Home Assistant"), None)
            if not conn or not conn.get("connected"):
                return "Home Assistant isn't configured for this household."
            from datetime import datetime
            def readable_date(value) -> str:
                if not value:
                    return "unknown date"
                try:
                    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d %b %Y")
                except (ValueError, TypeError):
                    return str(value)[:10]
            live = bool(context.get("ha_live_verified_at"))
            status = ("Home Assistant device states were checked live. " if live
                      else "Home Assistant is configured, but a live connection is not verified. ")
            if not live:
                status += ("Last successful sync: " + readable_date(conn.get("last_sync_at")) +
                           ". These are saved observations, not current physical-device states. ")
            if not devices:
                return status + "No device states are stored."
            named = [device for device in devices
                     if str(device.get("friendly_name") or "").strip()
                     and str(device.get("friendly_name")).casefold() in msg.casefold()]
            chosen = named if named else devices[:8]
            rows = [
                (str(device.get("friendly_name") or "Device") + ": "
                 + ("" if live else "last known ")
                 + str(device.get("last_state") or "unknown")
                 + (f" (observed {readable_date(device.get('last_state_at'))})"
                    if device.get("last_state_at") and not live else ""))
                for device in chosen
            ]
            return status + "; ".join(rows) + "."
        return None

    async def _classify_intent(self, message: str) -> str:
        """Prefer free deterministic routing for known household requests."""
        msg = message.lower()
        if any(w in msg for w in ("utility", "utilities", "electricity", "internet bill",
                                    "water bill", "meter bill", "meter number", "gas bill",
                                    "power bill", "broadband bill", "tv bill")):
            return "utilities"
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
