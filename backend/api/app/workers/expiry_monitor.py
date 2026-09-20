"""
Runs hourly. For each household, at their local 9am, scans documents for
upcoming expiries and sends a push. Previously never sent any push at all —
the notification line was a commented-out TODO — and the task name never
matched what Beat was calling, so this has likely never fired end-to-end.
"""
import asyncio
from app.workers.celery_app import celery_app
from app.dependencies import get_supabase_admin
from app.agents.document_agent import DocumentAgent
from app.services.push_service import send_push_to_household
from app.utils.timezone_utils import is_local_target_time

TARGET_LOCAL_HOUR = 9


@celery_app.task(name="expiry_monitor.check_all_expiries")
def check_all_expiries():
    supabase = get_supabase_admin()
    households = supabase.table("households").select("id, timezone").execute()

    checked = 0
    for household in households.data or []:
        household_id = household["id"]
        if not is_local_target_time(household.get("timezone"), TARGET_LOCAL_HOUR):
            continue
        checked += 1

        docs = supabase.table("documents")\
            .select("*")\
            .eq("household_id", household_id)\
            .not_.is_("expiry_date", "null")\
            .execute()

        if not docs.data:
            continue

        agent = DocumentAgent(household_id=household_id, user_id="system")
        alerts = agent.check_expiries(docs.data)

        if not alerts:
            continue

        for alert in alerts:
            supabase.table("document_alerts").upsert({
                "household_id": household_id,
                "document_id": alert["document_id"],
                "urgency": alert["urgency"],
                "message": alert["message"],
                "days_until_expiry": alert["days_until_expiry"],
            }, on_conflict="document_id,urgency").execute()

        top_alerts = ", ".join(a["message"] for a in alerts[:3] if a.get("message"))
        try:
            asyncio.run(send_push_to_household(
                household_id=household_id,
                title="📄 Document alerts",
                body=top_alerts or f"{len(alerts)} document(s) need attention.",
                data={"type": "document_expiry", "count": len(alerts)},
                supabase=supabase,
            ))
        except Exception as e:
            print(f"⚠️ Expiry push failed for household {household_id}: {e}")

    return f"Expiry check complete — {checked} household(s) at local 9am this run"
