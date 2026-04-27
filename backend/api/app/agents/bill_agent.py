import json
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class BillAgent(BaseHouseholdAgent):
    """
    Module 2: Bill & Subscription Intelligence Agent

    Handles:
    - Manual bill entry and analysis
    - Subscription pattern detection
    - Negotiation script generation
    - Savings tracking and monthly reports
    - Lightweight tasks now routed through NVIDIA Nano (fallback to Claude)
    """

    SYSTEM_PROMPT = """You are Hearth's Bill Agent.
You help households manage their recurring bills and subscriptions.
You identify unused subscriptions, suggest better plans, and generate negotiation scripts.
Be practical, money-saving, and friendly. Use concrete numbers when possible."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "analyze_bill":
            return self.analyze_bill(input_data["bill_data"])
        elif action == "detect_unused_subscriptions":
            return self.detect_unused_subscriptions(input_data["bills"])
        elif action == "generate_negotiation_script":
            return self.generate_negotiation_script(
                input_data["provider"],
                input_data["current_plan"],
                input_data.get("account_age_months", 12)
            )
        elif action == "monthly_report":
            return self.generate_monthly_report(input_data["bills"], input_data.get("previous_month_bills", []))
        else:
            raise ValueError(f"Unknown action: {action}")

    def analyze_bill(self, bill_data: Dict) -> Dict:
        """
        Analyze a single bill entry. Try NVIDIA Nano first for cost reasons.
        """
        prompt = f"""Analyze this bill/subscription entry:

Provider: {bill_data.get('provider')}
Description: {bill_data.get('description')}
Amount: {bill_data.get('amount')}
Billing Cycle: {bill_data.get('billing_cycle', 'monthly')}
Category: {bill_data.get('category', 'unknown')}

Return ONLY valid JSON with:
{{
  "normalized_provider": "canonical provider name",
  "category": "streaming|utilities|insurance|software|fitness|phone|internet|other",
  "is_likely_subscription": true/false,
  "avg_industry_cost": "estimated typical cost for this service",
  "savings_potential": "none|low|medium|high",
  "savings_tip": "one actionable tip to reduce cost",
  "confidence": 0.0-1.0
}}"""

        # Try NVIDIA Nano for simple analysis
        try:
            from app.services.nvidia_client import get_nvidia_client
            nvidia = get_nvidia_client()
            response = nvidia.complete(task="simple_chat", messages=[{"role": "user", "content": prompt}], max_tokens=300)
            analysis = json.loads(response)
            self.log_action("analyze_bill_nvidia", bill_data.get("provider"))
        except Exception:
            # Fallback to Claude
            response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
            try:
                analysis = json.loads(response)
            except:
                analysis = {"category": "other", "savings_potential": "low", "savings_tip": "Review manually"}
            self.log_action("analyze_bill_claude", bill_data.get("provider"))

        return analysis

    def detect_unused_subscriptions(self, bills: List[Dict]) -> List[Dict]:
        if not bills:
            return []

        bills_text = "\n".join([
            f"- {b.get('provider')}: ${b.get('amount')}/month, category {b.get('category')}, "
            f"last used: {b.get('last_used', 'unknown')}, notes: {b.get('notes', '')}"
            for b in bills if b.get('category') in ['streaming', 'software', 'fitness', 'other']
        ])

        prompt = f"""Based on these recurring subscriptions, identify which ones the user likely isn't using or could easily cancel:

{bills_text}

Return JSON list of objects with:
[
  {{
    "provider": "name",
    "reason": "why likely unused",
    "suggested_action": "cancel or pause or downgrade",
    "monthly_savings": amount_number
  }}
]

If none seem unused, return empty list."""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            unused = json.loads(response)
        except:
            unused = []

        self.log_action("detect_unused", f"{len(unused)} subscriptions flagged")
        return unused

    def generate_negotiation_script(self, provider: str, current_plan: str, account_age_months: int = 12) -> Dict:
        prompt = f"""Create a friendly negotiation script for someone calling {provider} to lower their bill.

Current plan: {current_plan}
Account age: {account_age_months} months

Return JSON with:
{{
  "script": "the full conversation script with placeholders for user info",
  "talking_points": ["key point 1", "key point 2"],
  "likely_discount": "estimated typical discount",
  "competitor_mention": "competitor to name-drop if applicable",
  "best_time_to_call": "e.g., weekday mornings"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            script_data = json.loads(response)
        except:
            script_data = {"script": "Could not generate script. Try again later."}

        self.log_action("generate_script", provider)
        return script_data

    def generate_monthly_report(self, current_bills: List[Dict], previous_bills: List[Dict] = None) -> Dict:
        total_current = sum(b.get('amount', 0) for b in current_bills)
        total_previous = sum(b.get('amount', 0) for b in (previous_bills or []))
        change = total_current - total_previous

        provider_map_curr = {b.get('provider'): b.get('amount', 0) for b in current_bills}
        provider_map_prev = {b.get('provider'): b.get('amount', 0) for b in (previous_bills or [])}
        biggest_increases = []
        for provider, amt in provider_map_curr.items():
            prev_amt = provider_map_prev.get(provider, 0)
            if amt > prev_amt:
                biggest_increases.append({"provider": provider, "increase": amt - prev_amt})

        prompt = f"""You are generating a monthly bill summary for a household.
Total spent this month: ${total_current:.2f}
Change from last month: ${change:+.2f}
Biggest increases: {biggest_increases[:3]}

Write a friendly, encouraging 2-3 sentence summary of their bill situation.
Mention if they should be proud or if there's an easy win this month.
Return JSON: {{"summary": "string", "mood": "good|neutral|alert"}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            narrative = json.loads(response)
        except:
            narrative = {"summary": "Here's your monthly bill summary.", "mood": "neutral"}

        report = {
            "month": date.today().strftime("%B %Y"),
            "total_spent": total_current,
            "change_from_last_month": change,
            "biggest_increases": biggest_increases[:3],
            "summary": narrative.get("summary"),
            "mood": narrative.get("mood"),
            "savings_tip": "Review unused subscriptions to save more."
        }

        self.log_action("monthly_report", f"Total: ${total_current:.2f}")
        return report