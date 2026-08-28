import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.dependencies import get_supabase_admin


class GroceryAgent(BaseHouseholdAgent):
    """
    Grocery, Meal Planning & Food Waste Agent
    """

    SYSTEM_PROMPT = """You are Hearth's Grocery & Meal Planning Agent.
You help households reduce food waste, plan meals efficiently, and save money on groceries.
Be practical and realistic with your suggestions."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "generate_meal_plan":
            return self.generate_meal_plan(input_data.get("preferences", {}))
        elif action == "create_shopping_list":
            return self.create_shopping_list(input_data.get("meal_plan", {}))
        elif action == "check_waste":
            return self.check_waste_alerts(input_data.get("inventory", []))
        elif action == "save_custom_meal_plan":
            return self.save_custom_meal_plan(
                input_data.get("meal_plan", {}),
                input_data.get("household_id")
            )
        elif action == "generate_budget_shopping_list":
            return self.generate_budget_shopping_list(
                input_data.get("meal_plan", {}),
                input_data.get("weekly_budget", 0)
            )
        elif action == "get_budget":
            return self.get_budget(input_data.get("household_id"))
        elif action == "set_budget":
            return self.set_budget(
                input_data.get("household_id"),
                input_data.get("weekly_budget", 0),
                input_data.get("currency")
            )
        else:
            raise ValueError(f"Unknown action: {action}")

    # _get_household_country() and _get_household_currency() live on
    # BaseHouseholdAgent — inherited automatically here.

    def generate_meal_plan(self, preferences: Dict) -> Dict:
        country = self._get_household_country()

        if country:
            locale_instruction = (
                f"This household is located in {country}. Build the meal plan around "
                f"dishes, ingredients, and cooking styles that are commonly eaten in "
                f"{country} and the surrounding region — make that the default, not an "
                f"occasional inclusion. If the preferences below list specific "
                f"cuisine_preferences, treat those as additional variety to mix in "
                f"alongside local dishes, not a replacement for them."
            )
        else:
            locale_instruction = (
                "No location is set for this household. Keep meals broadly familiar "
                "and avoid assuming any single country's cuisine as the default."
            )

        prompt = f"""Create a realistic 7-day meal plan based on these preferences:

{json.dumps(preferences)}

{locale_instruction}

Return ONLY valid JSON with this structure:
{{
  "week_of": "YYYY-MM-DD",
  "days": [
    {{
      "day": "Monday",
      "breakfast": {{"name": "", "ingredients": []}},
      "lunch": {{"name": "", "ingredients": []}},
      "dinner": {{"name": "", "ingredients": []}}
    }}
  ],
  "estimated_weekly_cost": number
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=1500)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"week_of": "", "days": [], "estimated_weekly_cost": 0}

    def create_shopping_list(self, meal_plan: Dict) -> Dict:
        prompt = f"""Create a smart shopping list from this meal plan:

{json.dumps(meal_plan)}

Return ONLY valid JSON:
{{
  "categories": {{
    "Produce": [],
    "Dairy & Eggs": [],
    "Meat & Fish": [],
    "Pantry": [],
    "Other": []
  }},
  "total_estimated_items": number,
  "estimated_cost": number
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"categories": {}, "total_estimated_items": 0, "estimated_cost": 0}

    def check_waste_alerts(self, inventory: List[Dict]) -> List[Dict]:
        if not inventory:
            return []

        prompt = f"""Analyze this grocery inventory and flag items at risk of going to waste:

Inventory: {json.dumps(inventory)}

Return ONLY a JSON array:
[{{
  "item": "",
  "days_left": number,
  "priority": "high|medium|low",
  "suggested_action": "cook today|freeze|use in recipe"
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return []

    def save_custom_meal_plan(self, meal_plan: Dict, household_id: str) -> Dict:
        supabase = get_supabase_admin()
        try:
            # Real meal_plans columns are week_start/plan_data (confirmed
            # against schema.sql) — week_of/days/estimated_cost were never
            # real columns, so every call here was failing every time. No
            # unique constraint exists on household_id for this table (each
            # generation is its own history row), so this is a plain insert,
            # not an upsert. The full meal_plan dict is preserved as-is in
            # plan_data (JSONB) — nothing about its shape is lost.
            week_of = meal_plan.get("week_of") or None
            result = supabase.table("meal_plans").insert({
                "household_id": household_id,
                "week_start": week_of,
                "plan_data": meal_plan,
            }).execute()
            return {"status": "saved", "data": result.data[0] if result.data else {}}
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    def generate_budget_shopping_list(self, meal_plan: Dict, weekly_budget: float) -> Dict:
        all_items = []
        for day in meal_plan.get("days", []):
            for meal_key in ("breakfast", "lunch", "dinner"):
                meal = day.get(meal_key, {})
                for ing in meal.get("ingredients", []):
                    all_items.append(ing.get("name", ing) if isinstance(ing, dict) else ing)

        unique_items = list(set(all_items))

        currency = self._get_household_currency()
        if currency:
            budget_instruction = (
                f"estimate costs in {currency}, and compare to the user's weekly "
                f"budget of {weekly_budget:,.2f} {currency}."
            )
        else:
            budget_instruction = (
                f"estimate costs using generic numeric values (do not assume any "
                f"specific currency), and compare to the user's weekly budget of "
                f"{weekly_budget:,.2f}."
            )

        prompt = f"""Create a shopping list from these meal plan ingredients, {budget_instruction}

Ingredients: {json.dumps(unique_items)}

Return ONLY valid JSON:
{{
  "categories": {{
    "Produce": [],
    "Dairy & Eggs": [],
    "Meat & Fish": [],
    "Pantry": [],
    "Other": []
  }},
  "total_items": number,
  "estimated_total": number,
  "over_budget": true/false,
  "budget_gap": number,
  "suggestions": ["tip 1", "tip 2"]
}}"""

        response = self.ask_light(prompt, max_tokens=800)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {
                "categories": {"Other": unique_items},
                "total_items": len(unique_items),
                "estimated_total": 0,
                "over_budget": False,
                "budget_gap": weekly_budget,
                "suggestions": []
            }

    def get_budget(self, household_id: str) -> Dict:
        supabase = get_supabase_admin()
        fallback_currency = self._get_household_currency()
        try:
            result = supabase.table("household_preferences")\
                .select("weekly_budget, currency")\
                .eq("household_id", household_id)\
                .maybe_single()\
                .execute()
            if result.data:
                return {
                    "weekly_budget": result.data.get("weekly_budget", 0),
                    "currency": result.data.get("currency") or fallback_currency
                }
            return {"weekly_budget": 0, "currency": fallback_currency}
        except:
            return {"weekly_budget": 0, "currency": fallback_currency}

    def set_budget(self, household_id: str, weekly_budget: float, currency: Optional[str] = None) -> Dict:
        supabase = get_supabase_admin()
        resolved_currency = currency or self._get_household_currency() or "USD"
        try:
            supabase.table("household_preferences").upsert({
                "household_id": household_id,
                "weekly_budget": weekly_budget,
                "currency": resolved_currency,
            }, on_conflict="household_id").execute()
            return {"weekly_budget": weekly_budget, "currency": resolved_currency, "status": "saved"}
        except Exception as e:
            return {"weekly_budget": weekly_budget, "currency": resolved_currency, "status": "error", "detail": str(e)}