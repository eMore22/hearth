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
                input_data.get("previous_month_bills", []),
                input_data.get("currency"),
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

    def generate_monthly_report(self, bills: List[Dict],
                                previous_month_bills: List[Dict] = None,
                                currency: Optional[str] = None) -> Dict:
        """Project recurring household obligations without any AI calls.

        This is not bank-verified expenditure. Don't mix currency units or
        guess an amount for unknown cycles and one-time purchases.
        """
        from collections import defaultdict

        factors = {
            "daily": 365 / 12, "weekly": 52 / 12,
            "biweekly": 26 / 12, "fortnightly": 26 / 12,
            "monthly": 1, "month": 1, "quarterly": 1 / 3,
            "annual": 1 / 12, "annually": 1 / 12, "yearly": 1 / 12,
        }
        available = [b for b in bills if b.get("is_active", True)]
        normalized = (currency or next((str(b["currency"]) for b in available
                          if b.get("currency")), "")).upper()
        total, categories, per_bill = 0.0, defaultdict(float), []
        skipped_currencies, unrecognized_cycles = set(), 0
        for bill in available:
            bill_currency = str(bill.get("currency") or normalized).upper()
            if normalized and bill_currency and bill_currency != normalized:
                skipped_currencies.add(bill_currency)
                continue
            cycle = str(bill.get("billing_cycle") or "").lower().strip()
            if cycle not in factors:
                unrecognized_cycles += 1
                continue
            try:
                amount = float(bill.get("amount") or 0)
            except (ValueError, TypeError):
                continue
            if not 0 <= amount < 1e12:
                continue
            per_month = amount * factors[cycle]
            total += per_month
            provider = str(bill.get("provider") or bill.get("name") or "Bill")[:120]
            categories[str(bill.get("category") or "other")] += per_month
            per_bill.append({"provider": provider, "amount": round(per_month, 2)})
        per_bill.sort(key=lambda x: x["amount"], reverse=True)
        monthly = round(total, 2)
        suggestions = []
        if skipped_currencies:
            suggestions.append("Some bills use other currencies and were excluded: "
                               + ", ".join(sorted(skipped_currencies)) + ".")
        if unrecognized_cycles:
            suggestions.append(f"{unrecognized_cycles} bill(s) have unsupported billing cycles.")
        if not per_bill:
            suggestions.append("Add recurring bill amounts and payment cycles to estimate your monthly obligations.")
        else:
            suggestions.append("Review upcoming payment dates and subscription renewals before spending.")
        return {
            "month": __import__("datetime").date.today().strftime("%Y-%m"),
            "currency": normalized or None,
            "total_spent": monthly,
            "estimated_monthly_total": monthly,
            "is_estimate": True,
            "change_from_last_month": 0,
            "change_available": False,
            "biggest_expense": per_bill[0] if per_bill else {"provider": "", "amount": 0},
            "biggest_increases": [],
            "top_categories": sorted(categories, key=categories.get, reverse=True)[:5],
            "recommendations": suggestions,
            "summary": (f"Estimated monthly recurring obligations: {monthly:,.2f} "
                        f"{normalized or 'units'}. This is not confirmed spending."),
            "mood": "neutral",
            "savings_tip": "Check recurring subscriptions for services you no longer use.",
        }
