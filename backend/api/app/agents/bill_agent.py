import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class BillAgent(BaseHouseholdAgent):
    """
    Bill & Subscription Agent
    Uses Claude for complex tasks and NVIDIA for light tasks.
    """

    SYSTEM_PROMPT = """You are Hearth's Bill Agent.
You help households manage bills, subscriptions, and spending.
Be precise, helpful, and concise. Always respond in valid JSON when asked to extract or analyze data."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "analyze_bill":
            return self.analyze_bill(input_data.get("bill_data", {}))
        elif action == "detect_unused_subscriptions":
            return self.detect_unused_subscriptions(input_data.get("bills", []))
        elif action == "generate_negotiation_script":
            return self.generate_negotiation_script(
                input_data.get("provider"),
                input_data.get("current_plan"),
                input_data.get("account_age_months", 12)
            )
        elif action == "monthly_report":
            return self.generate_monthly_report(
                input_data.get("bills", []),
                input_data.get("previous_month_bills", [])
            )
        else:
            raise ValueError(f"Unknown action: {action}")

    def analyze_bill(self, bill_data: Dict) -> Dict:
        """Analyze a single bill - uses Claude (heavy)"""
        prompt = f"""Analyze this bill and return structured data:

Bill data: {json.dumps(bill_data)}

Return ONLY valid JSON:
{{
  "category": "utilities|subscription|insurance|rent|loan|other",
  "is_recurring": true/false,
  "estimated_monthly_cost": number,
  "notes": "short note about this bill"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"category": "other", "is_recurring": False, "estimated_monthly_cost": 0, "notes": "Could not analyze"}

    def detect_unused_subscriptions(self, bills: List[Dict]) -> List[Dict]:
        """Detect potentially unused subscriptions - uses Claude (heavy)"""
        if not bills:
            return []

        prompt = f"""Analyze these bills and identify subscriptions that might be unused or forgotten:

Bills: {json.dumps(bills)}

Return ONLY a JSON array of objects with this structure:
[{{
  "provider": "name of service",
  "reason": "why it might be unused",
  "monthly_savings": estimated monthly amount
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return []

    def generate_negotiation_script(self, provider: str, current_plan: str, account_age_months: int = 12) -> Dict:
        """Generate negotiation script - uses Claude (heavy)"""
        prompt = f"""Create a polite negotiation script to get a better deal from {provider} for the plan "{current_plan}" after {account_age_months} months.

Return ONLY valid JSON:
{{
  "script": "the negotiation script text",
  "suggested_talking_points": ["point 1", "point 2"]
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"script": "Hi, I've been a customer for a while and would like to discuss my current plan.", "suggested_talking_points": []}

    def generate_monthly_report(self, bills: List[Dict], previous_month_bills: List[Dict] = None) -> Dict:
        """Generate monthly spending report - uses Claude (heavy)"""
        prompt = f"""Generate a monthly spending report based on these bills:

Current month bills: {json.dumps(bills)}
Previous month bills: {json.dumps(previous_month_bills or [])}

Return ONLY valid JSON:
{{
  "total_spent": number,
  "summary": "short summary of spending",
  "biggest_expense": "name of biggest bill",
  "suggestions": ["suggestion 1", "suggestion 2"]
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"total_spent": 0, "summary": "Could not generate report", "biggest_expense": "", "suggestions": []}