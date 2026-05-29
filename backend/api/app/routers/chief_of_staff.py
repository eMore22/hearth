from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.chief_of_staff_agent import ChiefOfStaffAgent

router = APIRouter(tags=["chief_of_staff"])


@router.post("/chat")
async def chat(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = ChiefOfStaffAgent(
        household_id=current_user.get("household_id"),
        user_id=str(current_user["id"])
    )
    # process_chat is async — must be awaited directly
    result = await agent.process_chat(
        message=body.get("message", ""),
        context=body.get("context", {}),
        conversation_history=body.get("conversation_history", [])
    )
    return result


@router.post("/dashboard-summary")
async def dashboard_summary(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = ChiefOfStaffAgent(
        household_id=current_user.get("household_id"),
        user_id=str(current_user["id"])
    )
    # get_dashboard_summary is sync — call directly
    return agent.get_dashboard_summary(body.get("household_data", {}))