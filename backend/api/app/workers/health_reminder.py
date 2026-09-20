"""
Runs hourly. At each household's local 8am, reminds about all active
medications. The medications table tracks frequency as free text (e.g.
"twice daily"), not structured dose times, so this sends one daily summary
per household rather than per-dose reminders — the most accurate behavior
the current data model actually supports.
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from app.workers.celery_app import celery_app
from app.dependencies import get_supabase_admin
from app.services.push_service import send_push_to_household
from app.utils.timezone_utils import is_local_target_time

TARGET_HOUR = 8


@celery_app.task(name="health.daily_reminders")
def daily_health_reminders():
    supabase = get_supabase_admin()
    households = supabase.table("households").select("id, timezone").execute()

    for hh in households.data or []:
        household_id = hh["id"]
        if not is_local_target_time(hh.get("timezone"), TARGET_HOUR):
            continue

        try:
            meds_res = supabase.table("medications")\
                .select("*")\
                .eq("household_id", household_id)\
                .eq("is_active", True)\
                .execute()
            medications = meds_res.data or []
            if not medications:
                continue

            names = [f"{m['name']} ({m['dosage']})" if m.get("dosage") else m["name"] for m in medications]
            message = f"Today's medications: {', '.join(names)}"

            asyncio.run(send_push_to_household(
                household_id=household_id,
                title="💊 Medication reminder",
                body=message,
                data={"type": "health", "medications": names},
                supabase=supabase,
            ))

            now_iso = datetime.now(dt_timezone.utc).isoformat()
            for med in medications:
                supabase.table("health_reminders").insert({
                    "household_id": household_id,
                    "member_name": med.get("member_name"),
                    "reminder_type": "medication",
                    "title": f"Take {med['name']}",
                    "due_at": now_iso,
                    "is_sent": True,
                }).execute()
        except Exception as e:
            print(f"Health reminder failed for household {household_id}: {e}")
