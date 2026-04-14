from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.health_agent import HealthAgent
from app.models.user import User

router = APIRouter(prefix="/health", tags=["health"])

@router.post("/triage")
async def triage(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = HealthAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "triage", "symptoms": body.get("symptoms"), "patient_profile": body.get("patient_profile", {})})

@router.post("/home-care")
async def home_care(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = HealthAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "home_care", "condition": body.get("condition")})

@router.post("/medication-schedule")
async def medication_schedule(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = HealthAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "medication_reminder", "medications": body.get("medications", [])})