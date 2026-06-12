import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class BillAgent(BaseHouseholdAgent):
    """
    Bill & Subscription Management Agent
    Handles bill analysis, subscription detection, negotiation scripts, and monthly reports.
    """

    SYSTEM_PROMPT = """You are Hearth's Bill & Subscription Agent.
You help households manage recurring payments, detect wasteful subscriptions, 
and provide practical financial advice. Be precise, data-driven, and helpful.
Always return valid JSON when asked to analyze or generate reports."""

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
        """Analyze a single bill and categorize it."""
        prompt = f"""Analyze this bill and return structured insights:

Bill Data: {json.dumps(bill_data)}

Return ONLY valid JSON:
{{
  "category": "utilities|subscription|insurance|rent|loan|other",
  "is_recurring": true/false,
  "estimated_annual_cost": number,
  "potential_savings": number or null,
  "notes": "short analysis"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {
                "category": "other",
                "is_recurring": False,
                "estimated_annual_cost": 0,
                "potential_savings": None,
                "notes": "Could not analyze bill"
            }

    def detect_unused_subscriptions(self, bills: List[Dict]) -> List[Dict]:
        """Detect subscriptions that may be unused or forgotten."""
        if not bills:
            return []

        prompt = f"""Review these bills and identify subscriptions that might be unused:

Bills: {json.dumps(bills)}

Return ONLY a JSON array:
[{{
  "provider": "Service name",
  "reason": "Why it might be unused",
  "monthly_cost": number,
  "suggested_action": "cancel|downgrade|keep"
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return []

    def generate_negotiation_script(self, provider: str, current_plan: str, account_age_months: int = 12) -> Dict:
        """Generate a negotiation script to get better rates."""
        prompt = f"""Create a professional negotiation script for {provider} ({current_plan}) after {account_age_months} months as a customer.

Return ONLY valid JSON:
{{
  "opening_line": "First thing to say",
  "key_points": ["point 1", "point 2", "point 3"],
  "closing_line": "How to end the conversation",
  "expected_outcome": "What to realistically expect"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {
                "opening_line": f"Hi, I've been with {provider} for {account_age_months} months...",
                "key_points": ["Mention loyalty", "Ask for better rate"],
                "closing_line": "Thank you for your help.",
                "expected_outcome": "Possible discount or retention offer"
            }

    def generate_monthly_report(self, bills: List[Dict], previous_month_bills: List[Dict] = None) -> Dict:
        """Generate a monthly spending summary and insights."""
        prompt = f"""Create a monthly financial report.

Current Month Bills: {json.dumps(bills)}
Previous Month Bills: {json.dumps(previous_month_bills or [])}

Return ONLY valid JSON:
{{
  "total_spent": number,
  "change_from_last_month": number,
  "biggest_expense": {{"provider": "", "amount": 0}},
  "top_categories": ["category1", "category2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=800)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {
                "total_spent": 0,
                "change_from_last_month": 0,
                "biggest_expense": {"provider": "", "amount": 0},
                "top_categories": [],
                "recommendations": []
            }