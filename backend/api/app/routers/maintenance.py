from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.maintenance_agent import MaintenanceAgent
from app.models.user import User

router = APIRouter(tags=["maintenance"])

@router.get("/tasks")
async def get_tasks(current_user: User = Depends(get_current_user)):
    return []

@router.post("/calendar/generate")
async def generate_calendar(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = MaintenanceAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "generate_calendar", "home_profile": body.get("home_profile", {})})

@router.post("/diagnose")
async def diagnose(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = MaintenanceAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "diagnose_problem", "description": body.get("description"), "photos": body.get("photos")})

@router.post("/estimate-cost")
async def estimate_cost(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = MaintenanceAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "estimate_cost", "appliance": body.get("appliance"), "issue": body.get("issue")})

@router.get("/diy/{task_name}")
async def diy_instructions(task_name: str, current_user: User = Depends(get_current_user)):
    agent = MaintenanceAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "get_diy_instructions", "task_name": task_name})