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
    return agent.run({"action": "generate_meal_plan", "preferences": body.get("preferences", {})})

@router.post("/meal-plan/save")
async def save_meal_plan(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({
        "action": "save_custom_meal_plan",
        "meal_plan": body.get("meal_plan", {}),
        "household_id": current_user.get("household_id")
    })

@router.post("/shopping-list")
async def create_shopping_list(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "create_shopping_list", "meal_plan": body.get("meal_plan")})

@router.post("/shopping-list/generate")
async def generate_budget_shopping_list(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({
        "action": "generate_budget_shopping_list",
        "meal_plan": body.get("meal_plan", {}),
        "weekly_budget": body.get("weekly_budget", 0)
    })

@router.get("/budget")
async def get_budget(current_user: dict = Depends(get_current_user)):
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "get_budget", "household_id": current_user.get("household_id")})

@router.put("/budget")
async def set_budget(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = GroceryAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({
        "action": "set_budget",
        "household_id": current_user.get("household_id"),
        "weekly_budget": body.get("weekly_budget", 0),
        "currency": body.get("currency", "NGN")
    })

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