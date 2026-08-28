Runs hourly. At each household's local target hour/day, analyzes bills,
flags unused subscriptions weekly, and sends a spending report monthly.
Queries Supabase directly — app.services.household_service/bill_service
never existed anywhere in this codebase (confirmed via full-repo search),
so this import was silently breaking the whole module. Matches the direct-
query pattern already proven working in expiry_monitor.py/task_reminder.py.
"""
from datetime import date
import asyncio
from app.workers.celery_app import celery_app
from app.dependencies import get_supabase_admin
from app.agents.bill_agent import BillAgent
from app.services.push_service import send_push_to_household

from app.utils.timezone_utils import is_local_target_time

WEEKLY_HOUR = 14
WEEKLY_WEEKDAY = 0  # Monday
MONTHLY_HOUR = 12
MONTHLY_DAY = 1


def _get_households(supabase):
    result = supabase.table("households").select("id, timezone, currency").execute()
    return result.data or []


def _get_bills(supabase, household_id):
    result = supabase.table("bills")\
        .select("*")\
        .eq("household_id", household_id)\
        .eq("is_active", True)\
        .execute()
    return result.data or []


@celery_app.task(name="bill_monitor.weekly_analysis")
def weekly_bill_analysis():
    supabase = get_supabase_admin()
    for hh in _get_households(supabase):
        if not is_local_target_time(hh.get("timezone"), WEEKLY_HOUR, target_weekday=WEEKLY_WEEKDAY):
            continue
        household_id = hh["id"]
        try:
            bills = _get_bills(supabase, household_id)
            if not bills:
                continue
            agent = BillAgent(household_id=household_id, user_id="system")
            unused = agent.run({
                "action": "detect_unused_subscriptions",
                "bills": bills,
            })

            if unused:
                currency = hh.get("currency") or "USD"
                savings = sum(u.get("monthly_savings", 0) for u in unused)
                message = f"We found {len(unused)} subscriptions you might not be using. Potential savings: {currency} {savings:.2f}/month."
                asyncio.run(send_push_to_household(
                    household_id=household_id,
                    title="💰 Potential savings found",
                    body=message,
                    data={"type": "bill_insight", "unused": unused},
                    supabase=supabase,
                ))
        except Exception as e:
            print(f"Bill monitor failed for household {household_id}: {e}")


@celery_app.task(name="bill_monitor.monthly_report")
def monthly_bill_report():
    supabase = get_supabase_admin()
    for hh in _get_households(supabase):
        if not is_local_target_time(hh.get("timezone"), MONTHLY_HOUR, target_day_of_month=MONTHLY_DAY):
            continue
        household_id = hh["id"]
        try:
            current_bills = _get_bills(supabase, household_id)
            agent = BillAgent(household_id=household_id, user_id="system")
            report = agent.run({
                "action": "monthly_report",
                "bills": current_bills,
                "previous_month_bills": [],  # bill_history isn't wired up yet — separate follow-up
            })

            currency = hh.get("currency") or "USD"
            total_spent = report.get("total_spent", 0)
            today_label = date.today().strftime("%B")

            asyncio.run(send_push_to_household(
                household_id=household_id,
                title=f"📊 {today_label} Bill Report",
                body=f"Total spent this month: {currency} {total_spent:.2f}.",
                data={"type": "monthly_report", "report": report},
                supabase=supabase,
            ))
        except Exception as e:
            print(f"Monthly report failed for household {household_id}: {e}")