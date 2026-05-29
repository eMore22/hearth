from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.health_agent import HealthAgent

router = APIRouter(tags=["health"])

@router.get("/medications")
async def get_medications(current_user: dict = Depends(get_current_user)):
    return []

@router.post("/triage")
async def triage(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = HealthAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "triage", "symptoms": body.get("symptoms"), "patient_profile": body.get("patient_profile", {})})

@router.post("/home-care")
async def home_care(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = HealthAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "home_care", "condition": body.get("condition")})

@router.post("/medication-schedule")
async def medication_schedule(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = HealthAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "medication_reminder", "medications": body.get("medications", [])})