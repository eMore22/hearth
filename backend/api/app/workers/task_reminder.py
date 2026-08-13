"""
Checks for household tasks that have become due and sends a push
notification once per task when that happens. Runs every 15 minutes —
unlike the daily/weekly agent-driven reminders, a task's due_at can be
any time of day, so a daily check would be too coarse.
"""
from celery import shared_task
from datetime import datetime, timezone
from app.dependencies import get_supabase_admin
from app.workers.notification_sender import send_notification_to_household


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
            send_notification_to_household(
                household_id=task["household_id"],
                title="✅ Task due",
                body=task["title"],
                data={"type": "task_due", "task_id": task["id"]},
            )
            supabase.table("tasks").update({"is_sent": True}).eq("id", task["id"]).execute()
        except Exception as e:
            print(f"⚠️ Failed to send reminder for task {task['id']}: {e}")
