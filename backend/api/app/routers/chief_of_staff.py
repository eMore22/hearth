from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.chief_of_staff_agent import ChiefOfStaffAgent
from app.models.user import User

router = APIRouter(prefix="/chief", tags=["chief_of_staff"])

@router.post("/chat")
async def chat(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = ChiefOfStaffAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "chat", "message": body.get("message"), "context": body.get("context", {})})

@router.post("/dashboard-summary")
async def dashboard_summary(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = ChiefOfStaffAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "get_dashboard_summary", "household_data": body.get("household_data", {})})