from app.workers.celery_app import celery_app
from app.dependencies import get_supabase_admin
from app.agents.document_agent import DocumentAgent


@celery_app.task
def check_all_expiries():
    """
    Runs daily at 8am UTC.
    Scans every household's documents for upcoming expiries.
    Sends push notifications for anything within 90 days.
    """
    supabase = get_supabase_admin()

    # Get all households
    households = supabase.table("households").select("id").execute()

    for household in households.data:
        household_id = household["id"]

        # Get all docs with expiry dates for this household
        docs = supabase.table("documents")\
            .select("*")\
            .eq("household_id", household_id)\
            .not_.is_("expiry_date", "null")\
            .execute()

        if not docs.data:
            continue

        # Run expiry check
        agent = DocumentAgent(household_id=household_id, user_id="system")
        alerts = agent.check_expiries(docs.data)

        for alert in alerts:
            # Log alert to DB
            supabase.table("document_alerts").upsert({
                "household_id": household_id,
                "document_id": alert["document_id"],
                "urgency": alert["urgency"],
                "message": alert["message"],
                "days_until_expiry": alert["days_until_expiry"],
            }, on_conflict="document_id,urgency").execute()

            # TODO: Send push notification via Firebase
            # notify_household(household_id, alert["message"])

    return f"Expiry check complete for {len(households.data)} households"
