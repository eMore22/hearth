Runs hourly. At each household's local Friday-evening target hour,
generates next week's meal plan and shopping list — for households that
have grocery preferences set. Queries Supabase directly (see bill_monitor.py
for why: household_service/grocery_service never existed in this codebase).
"""
import asyncio
from app.workers.celery_app import celery_app
from app.dependencies import get_supabase_admin
from app.agents.grocery_agent import GroceryAgent
from app.services.push_service import send_push_to_household
from app.utils.timezone_utils import is_local_target_time

TARGET_HOUR = 18
TARGET_WEEKDAY = 4  # Friday


@celery_app.task(name="grocery.weekly_meal_plan")
def generate_weekly_meal_plans():
    supabase = get_supabase_admin()
    households = supabase.table("households").select("id, timezone").execute()

    for hh in households.data or []:
        household_id = hh["id"]
        if not is_local_target_time(hh.get("timezone"), TARGET_HOUR, target_weekday=TARGET_WEEKDAY):
            continue

        try:
            prefs_res = supabase.table("household_preferences")\
                .select("*")\
                .eq("household_id", household_id)\
                .maybe_single()\
                .execute()
            prefs = prefs_res.data
            if not prefs:
                continue  # No grocery setup for this household yet

            agent = GroceryAgent(household_id=household_id, user_id="system")

            meal_plan = agent.run({
                "action": "generate_meal_plan",
                "preferences": prefs,
            })

            shopping_list = agent.run({
                "action": "create_shopping_list",
                "meal_plan": meal_plan,
            })

            # Real meal_plans columns are week_start/plan_data (confirmed
            # against schema.sql) — no unique constraint on household_id,
            # so this is an insert, matching save_custom_meal_plan() in
            # grocery_agent.py.
            try:
                supabase.table("meal_plans").insert({
                    "household_id": household_id,
                    "week_start": meal_plan.get("week_of") or None,
                    "plan_data": meal_plan,
                }).execute()
            except Exception as e:
                print(f"⚠️ meal_plans insert failed for household {household_id}: {e}")

            asyncio.run(send_push_to_household(
                household_id=household_id,
                title="🥗 Weekly meal plan ready",
                body="Your meal plan and shopping list are ready. Tap to view.",
                data={"type": "meal_plan", "plan": meal_plan, "shopping_list": shopping_list},
                supabase=supabase,
            ))
        except Exception as e:
            print(f"Meal planner failed for household {household_id}: {e}")