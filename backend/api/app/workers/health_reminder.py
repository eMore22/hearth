"""
Daily task to send medication reminders and check health schedules.
"""
from celery import shared_task
from datetime import datetime
from app.services.household_service import get_all_households
from app.services.health_service import get_active_medications
from app.workers.notification_sender import send_notification_to_user


@shared_task(name="health.daily_reminders")
def daily_health_reminders():
    """
    Runs daily. Sends medication reminders based on schedules.
    """
    households = get_all_households()
    now = datetime.now()
    current_time_of_day = "morning"  # Could be more granular
    
    for hh in households:
        try:
            # Get all members with active medications
            medications = get_active_medications(hh.id)
            for med in medications:
                schedule = med.get("schedule", {})
                if current_time_of_day in schedule:
                    meds_to_take = schedule[current_time_of_day]
                    message = f"Time to take: {', '.join(meds_to_take)}"
                    send_notification_to_user(
                        user_id=med["user_id"],
                        title="💊 Medication reminder",
                        body=message,
                        data={"type": "health", "medications": meds_to_take}
                    )
        except Exception as e:
            print(f"Health reminder failed for household {hh.id}: {e}")