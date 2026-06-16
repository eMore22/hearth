import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.agents.document_agent import DocumentAgent
from app.agents.bill_agent import BillAgent
from app.agents.grocery_agent import GroceryAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.health_agent import HealthAgent


class ChiefOfStaffAgent(BaseHouseholdAgent):
    """
    The central AI brain of Hearth.
    Uses Claude for complex reasoning and conversation (heavy tasks).
    Uses NVIDIA for fast/light tasks (intent classification, simple summaries).
    """

    SYSTEM_PROMPT = """You are Hearth's Chief of Staff AI — a warm, intelligent, and proactive assistant.
You help households manage documents, bills, groceries, maintenance, and health.

IMPORTANT RULES:
- Always remember and reference what the user told you earlier in the conversation.
- If the user shared their name, partner's name, or any personal detail — remember it.
- Never contradict something you were told earlier.
- Be warm, concise, and genuinely helpful.
- Reference household context when relevant.
- If you don't have enough information, ask clarifying questions politely."""

    def __init__(self, household_id: str, user_id: str):
        super().__init__(household_id, user_id)
        self.document_agent = DocumentAgent(household_id, user_id)
        self.bill_agent = BillAgent(household_id, user_id)
        self.grocery_agent = GroceryAgent(household_id, user_id)
        self.maintenance_agent = MaintenanceAgent(household_id, user_id)
        self.health_agent = HealthAgent(household_id, user_id)

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "get_dashboard_summary":
            return self.get_dashboard_summary(input_data.get("household_data", {}))
        else:
            raise ValueError(f"Unknown sync action: {action}")

    async def process_chat(
        self,
        message: str,
        context: Dict,
        conversation_history: Optional[List] = None
    ) -> Dict:
        if conversation_history is None:
            conversation_history = []

        # LIGHT TASK: Use NVIDIA for fast intent classification
        category = await self._classify_intent(message)

        response = {
            "category": category,
            "message": "",
            "proactive_suggestions": [],
            "actions_taken": []
        }

        # HEAVY TASK: Use Claude for the actual conversation response
        try:
            response["message"] = self._ai_response_with_memory(
                message=message,
                category=category,
                context=context,
                conversation_history=conversation_history
            )
        except Exception as e:
            print(f"⚠️ Chief of Staff chat error: {e}")
            response["message"] = "I'm having trouble processing that right now. Could you try rephrasing?"

        # Add proactive suggestions based on category
        if category == "grocery":
            response["proactive_suggestions"].append("Generate weekly meal plan")
        elif category == "maintenance":
            response["proactive_suggestions"].append("Show upcoming maintenance tasks")
        elif category == "bills":
            response["proactive_suggestions"].append("Find unused subscriptions")

        self.log_action("chat", f"{category}: {message[:80]}")
        return response

    def _ai_response_with_memory(
        self,
        message: str,
        category: str,
        context: Dict,
        conversation_history: List
    ) -> str:
        """Builds rich prompt with memory and household context. Uses Claude."""
        history_text = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-15:]:  # Keep last 15 messages for context
                role = "User" if msg.get("role") == "user" else "Hearth"
                history_lines.append(f"{role}: {msg.get('content', '')}")
            history_text = "\n".join(history_lines)

        # Build household context
        context_parts = []

        if context.get("documents"):
            context_parts.append(f"{len(context['documents'])} documents in vault")

        # Surface urgent document alerts (expired/critical/urgent) by name so
        # the Chief can proactively flag things like "your passport expired"
        # instead of saying it has no household data.
        alerts = context.get("alerts") or []
        urgent_alerts = [a for a in alerts if a.get("urgency") in ("expired", "critical", "urgent")]
        if urgent_alerts:
            alert_lines = "; ".join(a.get("message", "") for a in urgent_alerts[:5] if a.get("message"))
            if alert_lines:
                context_parts.append(f"URGENT document alerts: {alert_lines}")

        if context.get("bills"):
            total = sum(b.get("amount", 0) for b in context["bills"])
            context_parts.append(f"{len(context['bills'])} active bills (₦{total:,.0f}/month)")

        tasks = context.get("tasks") or []
        if tasks:
            pending = [t for t in tasks if not t.get("completed")]
            context_parts.append(f"{len(pending)} pending maintenance tasks")

        if context.get("inventory"):
            context_parts.append(f"{len(context['inventory'])} grocery items")

        if context.get("medications"):
            context_parts.append(f"{len(context['medications'])} medications tracked")

        household_summary = ", ".join(context_parts) if context_parts else "No household data loaded yet"

        prompt = f"""CONVERSATION HISTORY:
{history_text if history_text else "This is the start of the conversation."}

HOUSEHOLD OVERVIEW: {household_summary}

CURRENT MESSAGE FROM USER: {message}

Respond as Hearth Chief of Staff. Follow these rules:
1. Remember anything the user told you earlier (names, preferences, situations).
2. If there are URGENT document alerts, proactively mention the most important one(s) — this is exactly what "what needs attention" questions are asking about.
3. Reference relevant household data when helpful.
4. Give a warm, concise, and genuinely useful response.
5. Never repeat information unnecessarily.
6. Build naturally on the conversation."""

        return self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=500)

    async def _classify_intent(self, message: str) -> str:
        """LIGHT TASK: Use NVIDIA for fast classification"""
        try:
            if self.nvidia_client:
                return self.nvidia_client.classify_intent(message)
        except Exception:
            pass

        # Fallback keyword classification
        msg = message.lower()
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

    def get_dashboard_summary(self, household_data: Dict) -> Dict:
        """Generate dashboard summary. Uses LIGHT model for the greeting."""
        summary = {
            "documents": self._get_document_snapshot(household_data.get("documents", [])),
            "bills": self._get_bill_snapshot(household_data.get("bills", [])),
            "grocery": self._get_grocery_snapshot(household_data.get("inventory", [])),
            "maintenance": self._get_maintenance_snapshot(household_data.get("tasks", [])),
            "health": self._get_health_snapshot(household_data.get("health_events", [])),
            "chief_message": ""
        }

        doc_count = len(household_data.get("documents", []))
        bill_count = len(household_data.get("bills", []))
        task_count = len(household_data.get("tasks", []))

        prompt = (
            f"Write a short, warm one-sentence greeting for a household dashboard. "
            f"Context: {doc_count} documents, {bill_count} bills, {task_count} tasks. "
            f"Keep it under 20 words and upbeat."
        )

        # LIGHT TASK: Use NVIDIA for simple greeting
        summary["chief_message"] = self.ask_light(prompt, max_tokens=60)
        self.log_action("dashboard_summary", "generated")

        return summary

    def _get_document_snapshot(self, documents: List) -> Dict:
        expiring_soon = [d for d in documents if d.get("days_until_expiry", 999) <= 30]
        return {
            "total": len(documents),
            "expiring_soon": len(expiring_soon),
            "next_expiry": expiring_soon[0].get("title") if expiring_soon else None
        }

    def _get_bill_snapshot(self, bills: List) -> Dict:
        total = sum(b.get("amount", 0) for b in bills)
        largest = max(bills, key=lambda x: x.get("amount", 0)) if bills else None
        return {
            "total": len(bills),
            "monthly_spend": round(total, 2),
            "largest_bill": largest.get("provider") if largest else None
        }

    def _get_grocery_snapshot(self, inventory: List) -> Dict:
        expiring = [i for i in inventory if i.get("days_left", 999) <= 3]
        return {"items": len(inventory), "expiring_soon": len(expiring)}

    def _get_maintenance_snapshot(self, tasks: List) -> Dict:
        upcoming = [t for t in tasks if t.get("days_until_due", 999) <= 7]
        return {"total_tasks": len(tasks), "due_this_week": len(upcoming)}

    def _get_health_snapshot(self, events: List) -> Dict:
        return {"recent_events": len(events), "active_medications": 0}