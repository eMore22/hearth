from fastapi import APIRouter, Depends, Request, HTTPException
from datetime import date, timedelta
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.maintenance_agent import MaintenanceAgent

router = APIRouter(tags=["maintenance"])


@router.get("/tasks")
async def get_tasks(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        return []
    supabase = get_supabase_admin()
    try:
        result = supabase.table("maintenance_tasks")\
            .select("*")\
            .eq("household_id", household_id)\
            .eq("is_active", True)\
            .order("next_due_date")\
            .execute()
        tasks = result.data or []
        # Aliased to the existing frontend MaintenanceTask shape
        # (name/due_date/interval_days) so maintenanceStore.ts doesn't need
        # changes. diy_friendly/season/completed have no column in the real
        # maintenance_tasks table — returned as honest defaults, not
        # fabricated per-task data.
        return [
            {
                "id": t["id"],
                "name": t["title"],
                "due_date": t.get("next_due_date"),
                "interval_days": t.get("frequency_days"),
                "diy_friendly": True,
                "season": None,
                "completed": False,
                "estimated_cost": t.get("estimated_cost"),
                "category": t.get("category"),
                "description": t.get("description"),
            }
            for t in tasks
        ]
    except Exception:
        return []


@router.post("/tasks")
async def create_task(request: Request, current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="Create a household first")
    body = await request.json()
    supabase = get_supabase_admin()
    try:
        result = supabase.table("maintenance_tasks").insert({
            "household_id": household_id,
            "title": body.get("name") or body.get("title"),
            "description": body.get("description"),
            "category": body.get("category"),
            "frequency_days": body.get("interval_days") or body.get("frequency_days"),
            "next_due_date": body.get("due_date") or body.get("next_due_date"),
            "estimated_cost": body.get("estimated_cost"),
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    try:
        body = await request.json()
    except Exception:
        body = {}
    try:
        task_res = supabase.table("maintenance_tasks").select("*").eq("id", task_id).maybe_single().execute()
        task = task_res.data
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        today = date.today()
        supabase.table("maintenance_history").insert({
            "task_id": task_id,
            "cost": body.get("cost"),
            "notes": body.get("notes"),
            "done_by": str(current_user["id"]),
        }).execute()

        update_data = {"last_done_date": today.isoformat()}
        frequency_days = task.get("frequency_days")
        if frequency_days:
            update_data["next_due_date"] = (today + timedelta(days=frequency_days)).isoformat()
        else:
            update_data["is_active"] = False  # One-off task — done, not recurring

        supabase.table("maintenance_tasks").update(update_data).eq("id", task_id).execute()
        return {"status": "completed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calendar/generate")
async def generate_calendar(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = MaintenanceAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "generate_calendar", "home_profile": body.get("home_profile", {})})


@router.post("/diagnose")
async def diagnose(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = MaintenanceAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "diagnose_problem", "description": body.get("description"), "photos": body.get("photos")})


@router.post("/estimate-cost")
async def estimate_cost(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = MaintenanceAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "estimate_cost", "appliance": body.get("appliance"), "issue": body.get("issue")})


@router.get("/diy/{task_name}")
async def diy_instructions(task_name: str, current_user: dict = Depends(get_current_user)):
    agent = MaintenanceAgent(household_id=current_user.get("household_id"), user_id=str(current_user["id"]))
    return agent.run({"action": "get_diy_instructions", "task_name": task_name})