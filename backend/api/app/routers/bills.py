from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.bill_agent import BillAgent
from app.services.analytics import log_event

router = APIRouter(tags=["bills"])


class CreateBillRequest(BaseModel):
    provider: str           # bill/service name — written to both name + provider columns
    amount: float
    category: str = "other"
    billing_cycle: str = "monthly"
    currency: str = "USD"
    next_due_date: Optional[str] = None   # ISO date string e.g. "2026-07-01"
    notes: Optional[str] = None


@router.get("/")
async def list_bills(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        return []
    supabase = get_supabase_admin()
    try:
        result = supabase.table("bills")\
            .select("*")\
            .eq("household_id", household_id)\
            .eq("is_active", True)\
            .order("created_at", desc=True)\
            .execute()
        return result.data or []
    except Exception:
        return []


@router.post("/")
async def create_bill(
    payload: CreateBillRequest,
    current_user: dict = Depends(get_current_user),
):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="Create a household first")

    supabase = get_supabase_admin()
    try:
        insert_data = {
            "household_id": household_id,
            "name":         payload.provider,        # table uses 'name' as primary label
            "provider":     payload.provider,         # also stored in provider for agent queries
            "amount":       payload.amount,
            "category":     payload.category,
            "billing_cycle": payload.billing_cycle,
            "currency":     payload.currency,
            "notes":        payload.notes,
            "is_active":    True,
        }
        if payload.next_due_date:
            insert_data["next_due_date"] = payload.next_due_date

        result = supabase.table("bills").insert(insert_data).execute()
        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to create bill")

        log_event(
            supabase=supabase,
            user_id=current_user["id"],
            household_id=household_id,
            event_name="bill_added_manually",
            module="bills",
            metadata={"category": payload.category, "billing_cycle": payload.billing_cycle},
        )

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/analyze")
async def analyze_bill(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = BillAgent(
        household_id=current_user.get("household_id"),
        user_id=str(current_user["id"])
    )
    return agent.run({"action": "analyze_bill", "bill_data": body})


@router.post("/detect-unused")
async def detect_unused(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    household_id = current_user.get("household_id")
    agent = BillAgent(
        household_id=household_id,
        user_id=str(current_user["id"])
    )
    result = agent.run({
        "action": "detect_unused_subscriptions",
        "bills": body.get("bills", [])
    })

    if household_id:
        log_event(
            supabase=get_supabase_admin(),
            user_id=current_user["id"],
            household_id=household_id,
            event_name="unused_subscriptions_checked",
            module="bills",
            metadata={"found_count": len(result) if isinstance(result, list) else 0},
        )

    return result


@router.post("/negotiation-script")
async def negotiation_script(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    agent = BillAgent(
        household_id=current_user.get("household_id"),
        user_id=str(current_user["id"])
    )
    return agent.run({
        "action": "generate_negotiation_script",
        "provider": body.get("provider"),
        "current_plan": body.get("current_plan"),
        "account_age_months": body.get("account_age_months", 12)
    })


@router.get("/monthly-report")
async def monthly_report(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    bills = []
    if household_id:
        supabase = get_supabase_admin()
        try:
            result = supabase.table("bills")\
                .select("*")\
                .eq("household_id", household_id)\
                .eq("is_active", True)\
                .execute()
            bills = result.data or []
        except Exception:
            pass
    agent = BillAgent(
        household_id=household_id,
        user_id=str(current_user["id"])
    )
    return agent.run({
        "action": "monthly_report",
        "bills": bills,
        "previous_month_bills": []
    })