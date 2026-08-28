Checks for household tasks that have become due and sends a push
notification once per task when that happens. Runs every 15 minutes —
unlike the daily/weekly agent-driven reminders, a task's due_at can be
any time of day, so a daily check would be too coarse.

Now calls push_service.send_push_to_household() directly instead of
notification_sender.send_notification_to_household(). That import chain
depends on app.services.user_service, which doesn't exist anywhere in this
codebase (confirmed via full-repo search) — same problem that broke
bill_monitor/meal_planner/maintenance_scheduler/health_reminder. Routing
through push_service.py instead, which is proven working (it's what sent
the successful test push earlier).
"""
from celery import shared_task
from datetime import datetime, timezone
import asyncio
from app.dependencies import get_supabase_admin
from app.services.push_service import send_push_to_household


@shared_task(name="tasks.check_due_tasks")
def check_due_tasks():
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()

    try:
        result = supabase.table("tasks")\
            .select("*")\
            .eq("is_completed", False)\
            .eq("is_sent", False)\
            .lte("due_at", now)\
            .execute()
        due_tasks = result.data or []
    except Exception as e:
        print(f"⚠️ check_due_tasks failed to query tasks: {e}")
        return

    for task in due_tasks:
        try:
            asyncio.run(send_push_to_household(
                household_id=task["household_id"],
                title="✅ Task due",
                body=task["title"],
                data={"type": "task_due", "task_id": task["id"]},
                supabase=supabase,
            ))
            supabase.table("tasks").update({"is_sent": True}).eq("id", task["id"]).execute()
        except Exception as e:
            print(f"⚠️ Failed to send reminder for task {task['id']}: {e}")