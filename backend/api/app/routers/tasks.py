from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.dependencies import get_current_user, get_supabase_admin

router = APIRouter(tags=["tasks"])


class CreateTaskRequest(BaseModel):
    title: str
    notes: Optional[str] = None
    due_at: Optional[str] = None  # ISO 8601, e.g. "2026-08-15T14:00:00Z"


@router.get("/")
async def list_tasks(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")
    supabase = get_supabase_admin()
    result = supabase.table("tasks")\
        .select("*")\
        .eq("household_id", household_id)\
        .order("due_at", desc=False)\
        .execute()
    return result.data or []


@router.post("/")
async def create_task(payload: CreateTaskRequest, current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")
    supabase = get_supabase_admin()
    try:
        result = supabase.table("tasks").insert({
            "household_id": household_id,
            "created_by": current_user["id"],
            "title": payload.title,
            "notes": payload.notes,
            "due_at": payload.due_at,
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/complete")
async def complete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    try:
        result = supabase.table("tasks").update({
            "is_completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", task_id).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    try:
        supabase.table("tasks").delete().eq("id", task_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
