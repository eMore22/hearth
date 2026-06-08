import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.agents.document_agent import DocumentAgent
from app.agents.bill_agent import BillAgent
from app.agents.grocery_agent import GroceryAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.health_agent import HealthAgent


class ChiefOfStaffAgent(BaseHouseholdAgent):
    SYSTEM_PROMPT = """You are Hearth's Chief of Staff AI — a warm, intelligent assistant
that helps households manage documents, bills, groceries, maintenance, and health.

IMPORTANT MEMORY RULES:
- You have access to the full conversation history below
- Always remember and reference what the user told you earlier in the conversation
- If the user told you their name, partner's name, or any personal detail — remember it
- Never contradict something you were told earlier in the conversation
- Build on previous messages naturally, like a real assistant would

Be warm, concise, and genuinely helpful. Reference household context when relevant."""

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

        category = await self._classify_intent(message)

        response = {
            "category": category,
            "message": "",
            "proactive_suggestions": [],
            "actions_taken": []
        }

        response["message"] = self._ai_response_with_memory(
            message=message,
            category=category,
            context=context,
            conversation_history=conversation_history
        )

        if category == "grocery":
            response["proactive_suggestions"].append("Generate weekly meal plan")
        elif category == "maintenance":
            response["proactive_suggestions"].append("Show maintenance calendar")

        self.log_action("chat", f"{category}: {message[:80]}")
        return response

    def _ai_response_with_memory(self, message: str, category: str, context: Dict, conversation_history: List) -> str:
        history_text = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-20:]:
                role = "User" if msg.get("role") == "user" else "Hearth"
                history_lines.append(f"{role}: {msg.get('content', '')}")
            history_text = "\n".join(history_lines)

        context_parts = []
        if context.get("documents"):
            context_parts.append(f"{len(context['documents'])} documents stored")
        if context.get("bills"):
            total = sum(b.get("amount", 0) for b in context["bills"])
            context_parts.append(f"{len(context['bills'])} bills (${total:.2f}/month)")
        if context.get("tasks"):
            context_parts.append(f"{len(context['tasks'])} maintenance tasks")
        if context.get("inventory"):
            context_parts.append(f"{len(context['inventory'])} grocery items")

        household_summary = ", ".join(context_parts) if context_parts else "No household data loaded yet"

        category_context = ""
        if category == "documents":
            docs = context.get("documents", [])
            if docs:
                doc_list = ", ".join([d.get("title", "Unknown") for d in docs[:5]])
                category_context = f"\nDocuments in vault: {doc_list}"
        elif category == "bills":
            bills = context.get("bills", [])
            if bills:
                bill_list = ", ".join([f"{b.get('provider','?')} ${b.get('amount',0)}" for b in bills[:5]])
                category_context = f"\nActive bills: {bill_list}"
        elif category == "maintenance":
            tasks = context.get("tasks", [])
            if tasks:
                task_list = ", ".join([t.get("name", t.get("title", "?")) for t in tasks[:5]])
                category_context = f"\nMaintenance tasks: {task_list}"

        prompt = f"""CONVERSATION HISTORY:
{history_text if history_text else "This is the start of the conversation."}

HOUSEHOLD OVERVIEW: {household_summary}{category_context}

CURRENT MESSAGE FROM USER: {message}

Respond as Hearth Chief of Staff. Use the conversation history above to:
1. Remember anything the user told you (names, preferences, situations)
2. Reference relevant household data when helpful
3. Give a warm, concise, genuinely useful response
4. Never repeat information unnecessarily
5. Build naturally on the conversation"""

        return self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=400)

    async def _classify_intent(self, message: str) -> str:
        try:
            nvidia = self.nvidia_client
            if nvidia:
                return nvidia.classify_intent(message)
        except Exception:
            pass

        msg = message.lower()
        if any(w in msg for w in ["document", "passport", "insurance", "expire", "warranty", "certificate", "id card"]):
            return "documents"
        if any(w in msg for w in ["bill", "subscription", "payment", "netflix", "spotify", "electricity", "save money", "spending"]):
            return "bills"
        if any(w in msg for w in ["meal", "food", "grocery", "cook", "recipe", "shopping", "eat", "dinner", "lunch", "breakfast"]):
            return "grocery"
        if any(w in msg for w in ["fix", "repair", "broken", "maintenance", "service", "plumber", "ac", "generator", "leak", "noise"]):
            return "maintenance"
        if any(w in msg for w in ["sick", "fever", "pain", "symptom", "medication", "health", "doctor", "hospital", "hurt", "ill"]):
            return "health"
        return "general"

    def get_dashboard_summary(self, household_data: Dict) -> Dict:
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
        prompt = (f"Write a one-sentence warm greeting for a household dashboard. "
                  f"Context: {doc_count} documents, {bill_count} bills, {task_count} tasks. Under 20 words. Upbeat and helpful.")
        summary["chief_message"] = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=60)
        self.log_action("dashboard_summary", "generated")
        return summary

    def _get_document_snapshot(self, documents: List) -> Dict:
        expiring_soon = [d for d in documents if d.get("days_until_expiry", 999) <= 30]
        return {"total": len(documents), "expiring_soon": len(expiring_soon), "next_expiry": expiring_soon[0].get("title") if expiring_soon else None}

    def _get_bill_snapshot(self, bills: List) -> Dict:
        total = sum(b.get("amount", 0) for b in bills)
        largest = max(bills, key=lambda x: x.get("amount", 0)) if bills else None
        return {"total": len(bills), "monthly_spend": round(total, 2), "largest_bill": largest.get("provider") if largest else None}

    def _get_grocery_snapshot(self, inventory: List) -> Dict:
        expiring = [i for i in inventory if i.get("days_left", 999) <= 3]
        return {"items": len(inventory), "expiring_soon": len(expiring)}

    def _get_maintenance_snapshot(self, tasks: List) -> Dict:
        upcoming = [t for t in tasks if t.get("days_until_due", 999) <= 7]
        return {"total_tasks": len(tasks), "due_this_week": len(upcoming)}

    def _get_health_snapshot(self, events: List) -> Dict:
        return {"recent_events": len(events), "active_medications": 0}