from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.agents.grocery_agent import GroceryAgent

router = APIRouter(tags=["grocery"])

@router.get("/inventory")
async def get_inventory(current_user: dict = Depends(get_current_user)):
    return []

@router.post("/meal-plan/generate")
async def generate_meal_plan(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "generate_meal_plan", "preferences": body.get("preferences", {}), "inventory": body.get("inventory", [])})

@router.post("/shopping-list")
async def create_shopping_list(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "create_shopping_list", "meal_plan": body.get("meal_plan"), "inventory": body.get("inventory", [])})

@router.post("/waste-alert")
async def waste_alert(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "waste_alert", "inventory": body.get("inventory", [])})

@router.post("/meal-plan/modify")
async def modify_meal(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "modify_meal", "current_plan": body.get("current_plan"), "day": body.get("day"), "new_preference": body.get("new_preference")})