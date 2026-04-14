from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.grocery_agent import GroceryAgent
from app.models.user import User

router = APIRouter(prefix="/grocery", tags=["grocery"])

@router.post("/meal-plan/generate")
async def generate_meal_plan(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "generate_meal_plan", "preferences": body.get("preferences", {}), "inventory": body.get("inventory", [])})

@router.post("/shopping-list")
async def create_shopping_list(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "create_shopping_list", "meal_plan": body.get("meal_plan"), "inventory": body.get("inventory", [])})

@router.post("/waste-alert")
async def waste_alert(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "waste_alert", "inventory": body.get("inventory", [])})

@router.post("/meal-plan/modify")
async def modify_meal(request: Request, current_user: User = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.household_id, user_id=str(current_user.id))
    return agent.run({"action": "modify_meal", "current_plan": body.get("current_plan"), "day": body.get("day"), "new_preference": body.get("new_preference")})