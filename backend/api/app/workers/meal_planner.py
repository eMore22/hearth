"""
Weekly task to generate meal plans for households.
Runs every Sunday evening.
"""
from celery import shared_task
from app.agents.grocery_agent import GroceryAgent
from app.services.household_service import get_all_households
from app.services.grocery_service import get_household_preferences, get_inventory
from app.workers.notification_sender import send_notification_to_household


@shared_task(name="grocery.weekly_meal_plan")
def generate_weekly_meal_plans():
    """
    Runs every Sunday. Generates a meal plan for the upcoming week
    for each household with grocery preferences set.
    """
    households = get_all_households()
    for hh in households:
        try:
            prefs = get_household_preferences(hh.id)
            if not prefs:
                continue  # Skip households without grocery setup
                
            inventory = get_inventory(hh.id)
            agent = GroceryAgent(household_id=hh.id, user_id=hh.owner_id)
            
            meal_plan = agent.run({
                "action": "generate_meal_plan",
                "preferences": prefs,
                "inventory": [i.dict() for i in inventory]
            })
            
            # Also generate shopping list
            shopping_list = agent.run({
                "action": "create_shopping_list",
                "meal_plan": meal_plan,
                "inventory": [i.dict() for i in inventory]
            })
            
            # Save to DB (to be implemented)
            # save_meal_plan(hh.id, meal_plan)
            # save_shopping_list(hh.id, shopping_list)
            
            send_notification_to_household(
                household_id=hh.id,
                title="🥗 Weekly meal plan ready",
                body="Your meal plan and shopping list are ready. Tap to view.",
                data={"type": "meal_plan", "plan": meal_plan, "shopping_list": shopping_list}
            )
        except Exception as e:
            print(f"Meal planner failed for household {hh.id}: {e}")