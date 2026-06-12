import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class GroceryAgent(BaseHouseholdAgent):
    """
    Grocery & Meal Planning Agent
    Uses Claude for heavy tasks (meal planning, shopping lists) and NVIDIA for light tasks.
    """

    SYSTEM_PROMPT = """You are Hearth's Grocery Agent.
You help households with meal planning, grocery lists, and reducing food waste.
Be practical, helpful, and concise."""

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
        """Generate weekly meal plan - uses Claude (heavy)"""
        prompt = f"""Create a 7-day meal plan based on these preferences:

{json.dumps(preferences)}

Return ONLY valid JSON:
{{
  "week_of": "YYYY-MM-DD",
  "days": [
    {{
      "day": "Monday",
      "breakfast": {{"name": "Meal name", "ingredients": ["item1", "item2"]}},
      "lunch": {{"name": "Meal name", "ingredients": ["item1", "item2"]}},
      "dinner": {{"name": "Meal name", "ingredients": ["item1", "item2"]}}
    }}
  ]
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=1500)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"week_of": "", "days": []}

    def create_shopping_list(self, meal_plan: Dict) -> Dict:
        """Create shopping list from meal plan - uses Claude (heavy)"""
        prompt = f"""Create a consolidated shopping list from this meal plan:

{json.dumps(meal_plan)}

Return ONLY valid JSON:
{{
  "categories": {{
    "Produce": ["item1", "item2"],
    "Dairy": ["item1"],
    "Meat": ["item1"],
    "Pantry": ["item1"]
  }},
  "total_items": number,
  "estimated_cost": number
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"categories": {}, "total_items": 0, "estimated_cost": 0}

    def check_waste_alerts(self, inventory: List[Dict]) -> List[Dict]:
        """Check for items about to expire - uses Claude (heavy)"""
        if not inventory:
            return []

        prompt = f"""Analyze this grocery inventory and flag items that are about to expire or should be used soon:

Inventory: {json.dumps(inventory)}

Return ONLY a JSON array:
[{{
  "item": "item name",
  "days_left": number,
  "suggested_recipe": {{"recipe_name": "name", "reason": "why"}}
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return []