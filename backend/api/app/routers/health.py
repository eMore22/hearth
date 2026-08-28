from fastapi import APIRouter, Depends, Request, HTTPException
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.health_agent import HealthAgent

router = APIRouter(tags=["health"])


@router.get("/medications")
async def get_medications(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        return []
    supabase = get_supabase_admin()
    try:
        result = supabase.table("medications")\
            .select("*")\
            .eq("household_id", household_id)\
            .eq("is_active", True)\
            .execute()
        return result.data or []
    except Exception:
        return []


@router.post("/medications")
async def add_medication(request: Request, current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="Create a household first")
    body = await request.json()
    supabase = get_supabase_admin()
    try:
        result = supabase.table("medications").insert({
            "household_id": household_id,
            "member_name": body.get("member_name") or body.get("patient_id"),
            "name": body.get("name"),
            "dosage": body.get("dosage"),
            "frequency": body.get("frequency"),
            "start_date": body.get("start_date"),
            "end_date": body.get("end_date"),
            "notes": body.get("notes"),
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/triage")
async def triage(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    household_id = current_user.get("household_id")
    agent = HealthAgent(household_id=household_id, user_id=str(current_user["id"]))
    result = agent.run({
        "action": "triage",
        "symptoms": body.get("symptoms"),
        "patient_profile": body.get("patient_profile", {}),
    })

    # health_events exists in schema but nothing was ever writing to it —
    # triage results disappeared the moment the response was sent. Logged
    # here now so there's a real history, not just in-memory client state.
    if household_id:
        try:
            supabase = get_supabase_admin()
            supabase.table("health_events").insert({
                "household_id": household_id,
                "member_name": (body.get("patient_profile") or {}).get("name"),
                "symptoms": body.get("symptoms"),
                "triage_result": result.get("triage_level"),
                "ai_response": result.get("recommendation"),
            }).execute()
        except Exception as e:
            print(f"⚠️ Failed to log health_events: {e}")

    return result


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