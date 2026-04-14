"""
Weekly task to analyze bills, detect unused subscriptions,
and generate monthly reports.
"""
from celery import shared_task
from datetime import date, timedelta
from app.agents.bill_agent import BillAgent
from app.services.bill_service import get_bills_for_household
from app.services.household_service import get_all_households
from app.workers.notification_sender import send_notification_to_household


@shared_task(name="bill_monitor.weekly_analysis")
def weekly_bill_analysis():
    """
    Runs every Monday. Analyzes bills for all households,
    flags unused subscriptions, and sends insights.
    """
    households = get_all_households()
    for hh in households:
        try:
            bills = get_bills_for_household(hh.id)
            agent = BillAgent(household_id=hh.id, user_id=hh.owner_id)
            
            # Detect unused subscriptions
            unused = agent.run({
                "action": "detect_unused_subscriptions",
                "bills": [b.dict() for b in bills]
            })
            
            if unused and len(unused) > 0:
                savings = sum(u.get("monthly_savings", 0) for u in unused)
                message = f"We found {len(unused)} subscriptions you might not be using. Potential savings: ${savings:.2f}/month."
                send_notification_to_household(
                    household_id=hh.id,
                    title="💰 Potential savings found",
                    body=message,
                    data={"type": "bill_insight", "unused": unused}
                )
        except Exception as e:
            print(f"Bill monitor failed for household {hh.id}: {e}")


@shared_task(name="bill_monitor.monthly_report")
def monthly_bill_report():
    """
    Runs on the 1st of each month. Generates a monthly cost report.
    """
    households = get_all_households()
    today = date.today()
    first_of_month = today.replace(day=1)
    last_month = first_of_month - timedelta(days=1)
    last_month_first = last_month.replace(day=1)

    for hh in households:
        try:
            current_bills = get_bills_for_household(hh.id)
            # In production, fetch historical bills from bill_history table
            previous_bills = []  # Placeholder
            
            agent = BillAgent(household_id=hh.id, user_id=hh.owner_id)
            report = agent.run({
                "action": "monthly_report",
                "bills": [b.dict() for b in current_bills],
                "previous_month_bills": previous_bills
            })
            
            send_notification_to_household(
                household_id=hh.id,
                title=f"📊 {today.strftime('%B')} Bill Report",
                body=report.get("summary", "Your monthly report is ready."),
                data={"type": "monthly_report", "report": report}
            )
        except Exception as e:
            print(f"Monthly report failed for household {hh.id}: {e}")