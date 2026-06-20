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
                input_data.get("currency", "NGN")
            )
        else:
            raise ValueError(f"Unknown action: {action}")

    def generate_meal_plan(self, preferences: Dict) -> Dict:
        prompt = f"""Create a realistic 7-day meal plan based on these preferences:

{json.dumps(preferences)}

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
            result = supabase.table("meal_plans").upsert({
                "household_id": household_id,
                "week_of": meal_plan.get("week_of"),
                "days": meal_plan.get("days", []),
                "estimated_cost": meal_plan.get("estimated_weekly_cost", 0),
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

        prompt = f"""Create a shopping list from these meal plan ingredients, estimate costs in NGN,
and compare to the user's weekly budget of ₦{weekly_budget:,.0f}.

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
        try:
            result = supabase.table("household_preferences")\
                .select("weekly_budget, currency")\
                .eq("household_id", household_id)\
                .maybe_single()\
                .execute()
            if result.data:
                return {
                    "weekly_budget": result.data.get("weekly_budget", 0),
                    "currency": result.data.get("currency", "NGN")
                }
            return {"weekly_budget": 0, "currency": "NGN"}
        except:
            return {"weekly_budget": 0, "currency": "NGN"}

    def set_budget(self, household_id: str, weekly_budget: float, currency: str = "NGN") -> Dict:
        supabase = get_supabase_admin()
        try:
            supabase.table("household_preferences").upsert({
                "household_id": household_id,
                "weekly_budget": weekly_budget,
                "currency": currency,
            }).execute()
            return {"weekly_budget": weekly_budget, "currency": currency, "status": "saved"}
        except Exception as e:
            return {"weekly_budget": weekly_budget, "currency": currency, "status": "error", "detail": str(e)}