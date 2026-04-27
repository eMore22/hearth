import json
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class GroceryAgent(BaseHouseholdAgent):
    """
    Module 3: Grocery & Meal Intelligence Agent

    Handles:
    - Weekly meal plan generation (NVIDIA Nano for speed/cost)
    - Shopping list creation
    - Food waste tracking and alerts
    - Dietary preference management
    - Translation stub for future Riva integration
    """

    SYSTEM_PROMPT = """You are Hearth's Grocery Agent.
You create healthy, budget-conscious meal plans based on household preferences.
You suggest recipes, generate precise shopping lists, and help reduce food waste.
Be practical, creative, and mindful of dietary restrictions."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "generate_meal_plan":
            return self.generate_meal_plan(input_data["preferences"], input_data.get("inventory", []))
        elif action == "create_shopping_list":
            return self.create_shopping_list(input_data["meal_plan"], input_data.get("inventory", []))
        elif action == "waste_alert":
            return self.generate_waste_alert(input_data["inventory"])
        elif action == "modify_meal":
            return self.modify_meal(input_data["current_plan"], input_data["day"], input_data["new_preference"])
        elif action == "translate_meal_plan":
            return self.translate_meal_plan(input_data["meal_plan"], input_data.get("target_language", "Spanish"))
        else:
            raise ValueError(f"Unknown action: {action}")

    def generate_meal_plan(self, preferences: Dict, inventory: List[Dict] = None) -> Dict:
        household_size = preferences.get("household_size", 2)
        diet = preferences.get("dietary_restrictions", [])
        budget = preferences.get("weekly_budget", 150)
        cuisines = preferences.get("cuisine_preferences", ["variety"])

        diet_str = ", ".join(diet) if diet else "none"
        inventory_str = ""
        if inventory:
            inv_items = [f"{i.get('name')} (expires {i.get('expiry', 'unknown')})" for i in inventory[:10]]
            inventory_str = "Current inventory items to use up:\n" + "\n".join(inv_items)

        prompt = f"""Create a 7-day meal plan (breakfast, lunch, dinner) for a household of {household_size}.
Dietary restrictions: {diet_str}
Preferred cuisines: {', '.join(cuisines)}
Weekly budget: ${budget}
{inventory_str}

Return ONLY valid JSON with this structure:
{{
  "week_of": "{date.today().isoformat()}",
  "days": [
    {{
      "day": "Monday",
      "breakfast": {{"name": "...", "ingredients": ["..."]}},
      "lunch": {{"name": "...", "ingredients": ["..."]}},
      "dinner": {{"name": "...", "ingredients": ["..."]}}
    }},
    ... (for 7 days)
  ],
  "estimated_cost": number,
  "notes": "any special tips"
}}"""

        # Try NVIDIA Nano first
        try:
            from app.services.nvidia_client import get_nvidia_client
            nvidia = get_nvidia_client()
            response = nvidia.complete(task="simple_chat", messages=[{"role": "user", "content": prompt}], max_tokens=2000)
            plan = json.loads(response)
            self.log_action("generate_meal_plan_nvidia", f"{len(plan.get('days', []))} days")
        except:
            # Fallback to Claude
            response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=2000)
            try:
                plan = json.loads(response)
            except:
                plan = {"error": "Could not generate plan", "days": []}
            self.log_action("generate_meal_plan_claude", f"{len(plan.get('days', []))} days")

        return plan

    def create_shopping_list(self, meal_plan: Dict, inventory: List[Dict] = None) -> Dict:
        all_ingredients = []
        for day in meal_plan.get("days", []):
            for meal in ["breakfast", "lunch", "dinner"]:
                meal_data = day.get(meal, {})
                ingredients = meal_data.get("ingredients", [])
                all_ingredients.extend(ingredients)

        inventory_names = [i.get("name", "").lower() for i in (inventory or [])]

        unique_ingredients = list(set(all_ingredients))
        need_to_buy = [ing for ing in unique_ingredients if ing.lower() not in inventory_names]

        prompt = f"""Categorize these grocery items into standard store sections:
{', '.join(need_to_buy)}

Return JSON:
{{
  "produce": ["item1", "item2"],
  "dairy": [...],
  "meat_seafood": [...],
  "pantry": [...],
  "frozen": [...],
  "bakery": [...],
  "other": [...]
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            categorized = json.loads(response)
        except:
            categorized = {"other": need_to_buy}

        shopping_list = {
            "week_of": meal_plan.get("week_of"),
            "categories": categorized,
            "total_items": len(need_to_buy),
            "estimated_cost": meal_plan.get("estimated_cost", 0)
        }

        self.log_action("create_shopping_list", f"{len(need_to_buy)} items")
        return shopping_list

    def generate_waste_alert(self, inventory: List[Dict]) -> List[Dict]:
        today = date.today()
        alerts = []
        for item in inventory:
            expiry_str = item.get("expiry_date")
            if not expiry_str:
                continue
            try:
                expiry = date.fromisoformat(expiry_str)
                days_left = (expiry - today).days
                if days_left <= 3:
                    prompt = f"Suggest one simple recipe that uses {item.get('name')} as a main ingredient. Return JSON: {{'recipe_name': '...', 'quick_instructions': '...'}}"
                    response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=200)
                    try:
                        suggestion = json.loads(response)
                    except:
                        suggestion = {"recipe_name": "Use soon", "quick_instructions": "Incorporate into a stir-fry or soup."}

                    alerts.append({
                        "item": item.get("name"),
                        "expiry_date": expiry_str,
                        "days_left": days_left,
                        "urgency": "critical" if days_left <= 1 else "warning",
                        "suggested_recipe": suggestion
                    })
            except:
                continue

        self.log_action("waste_alert", f"{len(alerts)} items")
        return alerts

    def modify_meal(self, current_plan: Dict, day: str, new_preference: str) -> Dict:
        prompt = f"""The user wants to replace the dinner for {day} because: "{new_preference}".
Current meal plan context: {json.dumps(current_plan)}

Suggest a new dinner that fits the same dietary pattern and household size.
Return JSON: {{"name": "...", "ingredients": ["..."]}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            new_meal = json.loads(response)
        except:
            new_meal = {"name": "Simple Pasta", "ingredients": ["pasta", "tomato sauce", "cheese"]}

        self.log_action("modify_meal", day)
        return new_meal

    def translate_meal_plan(self, meal_plan: Dict, target_language: str = "Spanish") -> Dict:
        """
        Translate meal plan using NVIDIA Riva Translate (stub – will be implemented when endpoint is available).
        For now, falls back to Claude.
        """
        prompt = f"""Translate this meal plan to {target_language}. Keep the same JSON structure, just translate the meal names and ingredients.
Meal plan: {json.dumps(meal_plan)}
Return ONLY valid JSON."""
        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=2000)
        try:
            return json.loads(response)
        except:
            return meal_plan