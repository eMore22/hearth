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
    The single brain of Hearth.
    Orchestrates all 5 specialist agents.
    All user interaction flows through here.
    """

    SYSTEM_PROMPT = """You are Hearth's Chief of Staff AI.
You help households manage everything: documents, bills, groceries, maintenance, and health.
You understand natural language requests and route them to the right specialist agent.
You also provide proactive suggestions based on household context.
Be warm, efficient, and always helpful."""

    def __init__(self, household_id: str, user_id: str):
        super().__init__(household_id, user_id)
        self.document_agent = DocumentAgent(household_id, user_id)
        self.bill_agent = BillAgent(household_id, user_id)
        self.grocery_agent = GroceryAgent(household_id, user_id)
        self.maintenance_agent = MaintenanceAgent(household_id, user_id)
        self.health_agent = HealthAgent(household_id, user_id)

    def run(self, input_data: Any) -> Any:
        """
        Sync entry point — only used for sync actions like dashboard_summary.
        For chat, call process_chat() directly with await from the router.
        """
        action = input_data.get("action")
        if action == "get_dashboard_summary":
            return self.get_dashboard_summary(input_data.get("household_data", {}))
        else:
            raise ValueError(f"Unknown sync action: {action}. Use process_chat() for chat.")

    async def process_chat(
        self,
        message: str,
        context: Dict,
        conversation_history: Optional[List] = None
    ) -> Dict:
        """
        Primary chat handler. Async because it may call async services.
        Routes to specialist agents based on intent classification.
        """
        if conversation_history is None:
            conversation_history = []

        # 1. Classify intent — use NVIDIA if available, else keyword fallback
        category = await self._classify_intent(message)

        # 2. Build response based on category
        response = {
            "category": category,
            "message": "",
            "proactive_suggestions": [],
            "actions_taken": []
        }

        if category == "documents":
            docs = context.get("documents", [])
            answer = self.document_agent.answer_question(message, docs)
            response["message"] = answer

        elif category == "bills":
            bills = context.get("bills", [])
            keywords = message.lower()
            if any(w in keywords for w in ["save", "subscription", "unused", "cancel"]):
                try:
                    unused = self.bill_agent.detect_unused_subscriptions(bills)
                    if unused:
                        top = unused[0]
                        response["message"] = (
                            f"I found {len(unused)} subscriptions you might not be using. "
                            f"The biggest saving is ${top.get('monthly_savings', 0):.2f}/month "
                            f"on {top.get('provider', 'an unknown provider')}."
                        )
                    else:
                        response["message"] = "Your subscriptions all look active. No obvious waste found."
                except Exception:
                    total = sum(b.get("amount", 0) for b in bills)
                    response["message"] = f"You have {len(bills)} bills totalling ${total:.2f}/month."
            else:
                total = sum(b.get("amount", 0) for b in bills)
                response["message"] = f"You have {len(bills)} recurring bills totalling ${total:.2f}/month."

        elif category == "grocery":
            response["message"] = (
                "I can create a meal plan for this week based on your preferences. "
                "Want me to generate one now?"
            )
            response["proactive_suggestions"].append("Generate weekly meal plan")

        elif category == "maintenance":
            tasks = context.get("tasks", [])
            due_soon = [t for t in tasks if t.get("days_until_due", 999) <= 7]
            if due_soon:
                response["message"] = (
                    f"You have {len(due_soon)} maintenance task(s) due this week. "
                    f"Most urgent: {due_soon[0].get('title', 'Unknown task')}."
                )
            else:
                response["message"] = (
                    "No urgent maintenance tasks this week. "
                    "I can help diagnose an issue or check your full calendar."
                )
            response["proactive_suggestions"].append("Show full maintenance calendar")

        elif category == "health":
            response["message"] = (
                "I'm here to help with health triage. "
                "Describe the symptoms and I'll guide you on next steps."
            )

        else:
            # General — use AI with household context
            response["message"] = self._general_response(message, context, conversation_history)

        self.log_action("chat", f"{category}: {message[:80]}")
        return response

    async def _classify_intent(self, message: str) -> str:
        """Classify intent using NVIDIA if available, otherwise keyword fallback."""
        # Try NVIDIA first (free)
        try:
            nvidia = self.nvidia_client
            if nvidia:
                return nvidia.classify_intent(message)
        except Exception:
            pass

        # Keyword fallback — always works
        msg = message.lower()
        if any(w in msg for w in ["document", "passport", "insurance", "expire", "warranty", "certificate"]):
            return "documents"
        if any(w in msg for w in ["bill", "subscription", "payment", "netflix", "spotify", "electricity", "save money"]):
            return "bills"
        if any(w in msg for w in ["meal", "food", "grocery", "cook", "recipe", "shopping", "eat"]):
            return "grocery"
        if any(w in msg for w in ["fix", "repair", "broken", "maintenance", "service", "plumber", "ac", "generator"]):
            return "maintenance"
        if any(w in msg for w in ["sick", "fever", "pain", "symptom", "medication", "health", "doctor", "hospital"]):
            return "health"
        return "general"

    def _general_response(
        self,
        message: str,
        context: Dict,
        conversation_history: List
    ) -> str:
        """Handle general questions using AI with household context."""
        context_summary = ""
        if context:
            parts = []
            if context.get("documents"):
                parts.append(f"{len(context['documents'])} documents stored")
            if context.get("bills"):
                total = sum(b.get("amount", 0) for b in context["bills"])
                parts.append(f"{len(context['bills'])} bills (${total:.2f}/month)")
            if context.get("tasks"):
                parts.append(f"{len(context['tasks'])} maintenance tasks")
            if parts:
                context_summary = "Household overview: " + ", ".join(parts)

        prompt = f"""The user said: "{message}"

{context_summary}

Respond as the household Chief of Staff — warm, helpful, and concise.
If the question relates to the household context above, reference it naturally."""

        return self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=300)

    def get_dashboard_summary(self, household_data: Dict) -> Dict:
        """Sync dashboard summary — called without await."""
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
            f"Write a one-sentence friendly morning greeting for a household dashboard. "
            f"Context: {doc_count} documents, {bill_count} bills, {task_count} maintenance tasks. "
            f"Be warm and helpful in under 20 words."
        )

        summary["chief_message"] = self.ask_claude(
            prompt, system=self.SYSTEM_PROMPT, max_tokens=60
        )

        self.log_action("dashboard_summary", "generated")
        return summary

    # ── Snapshot helpers ──────────────────────────────────────────────────────

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
        return {
            "items": len(inventory),
            "expiring_soon": len(expiring)
        }

    def _get_maintenance_snapshot(self, tasks: List) -> Dict:
        upcoming = [t for t in tasks if t.get("days_until_due", 999) <= 7]
        return {
            "total_tasks": len(tasks),
            "due_this_week": len(upcoming)
        }

    def _get_health_snapshot(self, events: List) -> Dict:
        return {
            "recent_events": len(events),
            "active_medications": 0
        }