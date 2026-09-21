from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_current_user, get_supabase_admin
from app.agents.bill_agent import BillAgent
from app.services.analytics import log_event

router = APIRouter(tags=["bills"])


class CreateBillRequest(BaseModel):
    provider: str
    amount: float
    category: str = "other"
    billing_cycle: str = "monthly"
    currency: Optional[str] = None
    next_due_date: Optional[str] = None
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

    resolved_currency = payload.currency
    if not resolved_currency:
        agent = BillAgent(household_id=household_id, user_id=str(current_user["id"]))
        resolved_currency = agent._get_household_currency() or "USD"

    supabase = get_supabase_admin()
    try:
        insert_data = {
            "household_id": household_id,
            "name":         payload.provider,
            "provider":     payload.provider,
            "amount":       payload.amount,
            "category":     payload.category,
            "billing_cycle": payload.billing_cycle,
            "currency":     resolved_currency,
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


@router.delete("/{bill_id}")
async def delete_bill(
    bill_id: str,
    current_user: dict = Depends(get_current_user),
):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=400, detail="No household found")
    supabase = get_supabase_admin()
    try:
        # Soft delete via is_active, matching the flag every other bills
        # query already filters on — not a hard row delete, so historical
        # references (monthly reports, future bill_history) stay intact.
        result = supabase.table("bills")\
            .update({"is_active": False})\
            .eq("id", bill_id)\
            .eq("household_id", household_id)\
            .execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Bill not found")
        return {"message": "Bill deleted"}
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
