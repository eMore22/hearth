import json
from typing import Any, Dict, List
from app.agents.base_agent import BaseHouseholdAgent
from app.agents.document_agent import DocumentAgent
from app.agents.bill_agent import BillAgent
from app.agents.grocery_agent import GroceryAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.health_agent import HealthAgent


class ChiefOfStaffAgent(BaseHouseholdAgent):
    """
    Meta-Agent that orchestrates all module agents.
    Handles natural language queries, routes to appropriate sub-agent,
    and provides unified household overview.
    Now with NVIDIA intent routing and RAG memory.
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
        action = input_data.get("action")
        if action == "chat":
            return self.process_chat(input_data["message"], input_data.get("context", {}))
        elif action == "get_dashboard_summary":
            return self.get_dashboard_summary(input_data.get("household_data", {}))
        else:
            raise ValueError(f"Unknown action: {action}")

    async def process_chat(self, message: str, context: Dict) -> Dict:
        """Process with NVIDIA intent routing and RAG memory."""
        from app.services.nvidia_client import get_nvidia_client
        from app.services.rag_service import RAGService

        nvidia = get_nvidia_client()
        rag = RAGService()

        # 1. Classify intent using NVIDIA Nano (free)
        try:
            category = nvidia.classify_intent(message)
        except:
            category = "general"

        # 2. Retrieve relevant household context
        household_context_text = rag.retrieve_context(message, top_k=3)

        # 3. Build enriched context for agents
        enriched_input = {
            "action": "chat",
            "message": message,
            "context": context,
            "household_context": household_context_text
        }

        # 4. Route to specialist or handle with Claude
        response = {"category": category, "message": "", "proactive_suggestions": []}

        if category == "documents":
            docs = context.get("documents", [])
            answer = self.document_agent.answer_question(message, docs)
            response["message"] = answer
        elif category == "bills":
            bills = context.get("bills", [])
            if "save" in message.lower() or "subscription" in message.lower():
                unused = self.bill_agent.detect_unused_subscriptions(bills)
                if unused:
                    response["message"] = f"I found {len(unused)} subscriptions you might not be using. The biggest potential saving is ${unused[0].get('monthly_savings', 0)}/month on {unused[0].get('provider')}."
                else:
                    response["message"] = "I don't see any obviously unused subscriptions right now. You're doing great!"
            else:
                total = sum(b.get('amount', 0) for b in bills)
                response["message"] = f"You have {len(bills)} recurring bills totaling ${total:.2f} per month."
        elif category == "grocery":
            response["message"] = "I can create a meal plan for this week based on your preferences. Want me to generate one now?"
            response["proactive_suggestions"].append("Generate weekly meal plan")
        elif category == "maintenance":
            response["message"] = "I can check your home maintenance calendar or help diagnose an issue. What's going on?"
            response["proactive_suggestions"].append("Show upcoming maintenance tasks")
        elif category == "health":
            response["message"] = "I'm here to help with health triage. Please describe the symptoms you're experiencing, and I'll provide guidance on next steps."
        else:
            response["message"] = self._general_chat_with_context(message, household_context_text)

        self.log_action("chat", f"{category}: {message[:50]}")
        return response

    def _general_chat_with_context(self, message: str, household_context: str) -> str:
        """Handle general questions with household memory."""
        prompt = f"""The user asked: "{message}"
Household context for this query:
{household_context if household_context else 'No specific context available.'}

Provide a helpful, warm response as the household chief of staff.
If you can draw from the household context, mention something relevant about their home (e.g., upcoming tasks, recent activity)."""

        return self.ask_claude(prompt, system=self.SYSTEM_PROMPT)

    def get_dashboard_summary(self, household_data: Dict) -> Dict:
        summary = {
            "documents": self._get_document_snapshot(household_data.get("documents", [])),
            "bills": self._get_bill_snapshot(household_data.get("bills", [])),
            "grocery": self._get_grocery_snapshot(household_data.get("inventory", [])),
            "maintenance": self._get_maintenance_snapshot(household_data.get("tasks", [])),
            "health": self._get_health_snapshot(household_data.get("health_events", [])),
            "chief_message": ""
        }

        prompt = f"""Write a one-sentence friendly greeting for a household dashboard.
Context: {len(household_data.get('documents', []))} documents, {len(household_data.get('bills', []))} bills.
Make it warm and helpful."""

        summary["chief_message"] = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=100)

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
        return {
            "total": len(bills),
            "monthly_spend": total,
            "largest_bill": max(bills, key=lambda x: x.get("amount", 0)).get("provider") if bills else None
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