import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


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
        else:
            raise ValueError(f"Unknown action: {action}")

    def generate_meal_plan(self, preferences: Dict) -> Dict:
        """Generate a 7-day meal plan."""
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
        """Create a consolidated shopping list from a meal plan."""
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
        """Check inventory for items about to expire."""
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