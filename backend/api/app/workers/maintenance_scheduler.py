"""
Daily task to check for upcoming maintenance tasks
and send reminders.
"""
from celery import shared_task
from datetime import date, timedelta
from app.agents.maintenance_agent import MaintenanceAgent
from app.services.household_service import get_all_households
from app.services.maintenance_service import get_maintenance_tasks
from app.workers.notification_sender import send_notification_to_household


@shared_task(name="maintenance.daily_check")
def daily_maintenance_check():
    """
    Runs daily. Checks for tasks due in the next 7 days
    and sends reminders.
    """
    households = get_all_households()
    today = date.today()
    
    for hh in households:
        try:
            tasks = get_maintenance_tasks(hh.id)
            upcoming = []
            for task in tasks:
                due_date = task.due_date
                if isinstance(due_date, str):
                    due_date = date.fromisoformat(due_date)
                days_until = (due_date - today).days
                if 0 <= days_until <= 7:
                    upcoming.append({
                        "name": task.name,
                        "due_date": due_date.isoformat(),
                        "days_until": days_until
                    })
            
            if upcoming:
                task_names = [t["name"] for t in upcoming[:3]]
                message = f"Upcoming: {', '.join(task_names)}"
                if len(upcoming) > 3:
                    message += f" and {len(upcoming)-3} more"
                
                send_notification_to_household(
                    household_id=hh.id,
                    title="🔧 Maintenance reminders",
                    body=message,
                    data={"type": "maintenance", "tasks": upcoming}
                )
        except Exception as e:
            print(f"Maintenance check failed for household {hh.id}: {e}")