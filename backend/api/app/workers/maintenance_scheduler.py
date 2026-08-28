Runs hourly. At each household's local 10am, checks maintenance_tasks due
within 7 days and sends a reminder. Queries Supabase directly.
"""
from datetime import timedelta
import asyncio
from app.workers.celery_app import celery_app
from app.dependencies import get_supabase_admin
from app.services.push_service import send_push_to_household
from app.utils.timezone_utils import is_local_target_time, get_local_now

TARGET_HOUR = 10


@celery_app.task(name="maintenance.daily_check")
def daily_maintenance_check():
    supabase = get_supabase_admin()
    households = supabase.table("households").select("id, timezone").execute()

    for hh in households.data or []:
        household_id = hh["id"]
        if not is_local_target_time(hh.get("timezone"), TARGET_HOUR):
            continue

        try:
            today_local = get_local_now(hh.get("timezone")).date()
            week_out = today_local + timedelta(days=7)

            tasks_res = supabase.table("maintenance_tasks")\
                .select("*")\
                .eq("household_id", household_id)\
                .eq("is_active", True)\
                .not_.is_("next_due_date", "null")\
                .gte("next_due_date", today_local.isoformat())\
                .lte("next_due_date", week_out.isoformat())\
                .execute()
            upcoming = tasks_res.data or []

            if not upcoming:
                continue

            names = [t["title"] for t in upcoming[:3]]
            message = f"Upcoming: {', '.join(names)}"
            if len(upcoming) > 3:
                message += f" and {len(upcoming) - 3} more"

            asyncio.run(send_push_to_household(
                household_id=household_id,
                title="🔧 Maintenance reminders",
                body=message,
                data={"type": "maintenance", "tasks": upcoming},
                supabase=supabase,
            ))
        except Exception as e:
            print(f"Maintenance check failed for household {household_id}: {e}")