from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.bill_agent import BillAgent
from app.models.user import User

router = APIRouter(tags=["bills"])

@router.get("/")
async def list_bills(current_user: User = Depends(get_current_user)):
    return []

@router.post("/analyze")
async def analyze_bill(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = BillAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "analyze_bill", "bill_data": body})

@router.post("/detect-unused")
async def detect_unused(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = BillAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "detect_unused_subscriptions", "bills": body.get("bills", [])})

@router.post("/negotiation-script")
async def negotiation_script(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = BillAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({
        "action": "generate_negotiation_script",
        "provider": body.get("provider"),
        "current_plan": body.get("current_plan"),
        "account_age_months": body.get("account_age_months", 12)
    })

@router.get("/monthly-report")
async def monthly_report(current_user: User = Depends(get_current_user)):
    bills = []
    previous = []
    agent = BillAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "monthly_report", "bills": bills, "previous_month_bills": previous})