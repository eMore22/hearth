"""Authenticated read-only utilities, based on saved household bills.

Future utility-provider payments are deliberately not implemented.
"""
import os
from typing import Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, get_supabase_admin
from app.services.utility_intelligence import summarize_utilities
from app.services.utility_provider_catalog import utility_provider_capabilities
from app.services.utility_sandbox import check_test_meter
from app.services.vtpass_sandbox import verify_test_meter, ready as vtpass_ready, VtpassSandboxUnavailable

router = APIRouter(tags=["Utilities"])


@router.get("/overview")
def overview(current_user: dict = Depends(get_current_user)):
    household_id = current_user.get("household_id")
    if not household_id:
        raise HTTPException(status_code=403, detail="Household membership required")
    try:
        db = get_supabase_admin()
        rows = (db.table("bills")
                .select("name,provider,category,amount,currency,next_due_date,is_active")
                .eq("household_id", household_id).eq("is_active", True)
                .limit(150).execute().data or [])
        house = (db.table("households").select("currency").eq("id", household_id)
                 .maybe_single().execute().data or {})
    except Exception:
        raise HTTPException(status_code=503, detail="Utility records are temporarily unavailable") from None
    return summarize_utilities(rows, house.get("currency"))


@router.get("/providers")
def providers(country: Literal["CA", "NG"], current_user: dict = Depends(get_current_user)):
    if not current_user.get("id") or not current_user.get("household_id"):
        raise HTTPException(status_code=403, detail="Household membership required")
    return utility_provider_capabilities(country)


@router.get("/capabilities")
def capabilities(current_user: dict = Depends(get_current_user)):
    if not current_user.get("household_id"):
        raise HTTPException(status_code=403, detail="Household membership required")
    return {
        "available_categories": ["electricity", "water", "internet", "gas", "television"],
        "manual_tracking_enabled": True,
        "real_provider_connections_enabled": False,
        "provider_meter_verification_enabled": False,
        "bill_payment_enabled": False,
    }


class TestMeterRequest(BaseModel):
    service_id: str = Field(min_length=1, max_length=50)
    meter_type: str = Field(min_length=1, max_length=20)
    meter_number: str = Field(pattern=r"^[0-9]{5,20}$")


@router.post("/sandbox/check-meter")
def check_meter(payload: TestMeterRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user.get("id") or "")
    if not user_id or not current_user.get("household_id"):
        raise HTTPException(status_code=403, detail="Household membership required")
    allowed = {x.strip() for x in os.getenv("UTILITIES_SANDBOX_TESTER_USER_IDS", "").split(",") if x.strip()}
    if os.getenv("UTILITIES_SANDBOX_DEMO_ENABLED", "").lower() != "true" or user_id not in allowed:
        raise HTTPException(status_code=404, detail="Utility simulation unavailable")
    try:
        return check_test_meter(payload.service_id, payload.meter_type, payload.meter_number)
    except ValueError:
        raise HTTPException(status_code=422, detail="Unsupported local test scenario") from None


@router.get("/sandbox/vtpass/capabilities")
def vtpass_capabilities(current_user: dict = Depends(get_current_user)):
    if not current_user.get("id") or not current_user.get("household_id"):
        raise HTTPException(status_code=403, detail="Household membership required")
    allowlist = {x.strip() for x in
                 os.getenv("VTPASS_SANDBOX_TESTER_USER_IDS", "").split(",") if x.strip()}
    return {
        "sandbox": True, "provider": "VTpass",
        "meter_verification_available": (str(current_user["id"]) in allowlist and vtpass_ready()),
        "real_meter_verification_enabled": False,
        "bill_payment_enabled": False,
    }


@router.post("/sandbox/vtpass/verify-meter")
async def vtpass_verify_meter(payload: TestMeterRequest,
                              current_user: dict = Depends(get_current_user)):
    user_id = str(current_user.get("id") or "")
    if not user_id or not current_user.get("household_id"):
        raise HTTPException(status_code=403, detail="Household membership required")
    allowlist = {x.strip() for x in
                 os.getenv("VTPASS_SANDBOX_TESTER_USER_IDS", "").split(",") if x.strip()}
    if user_id not in allowlist or not vtpass_ready():
        raise HTTPException(status_code=404, detail="VTpass Sandbox unavailable")
    if payload.service_id != "enugu-electric":
        raise HTTPException(status_code=422, detail="Unsupported test service")
    try:
        return await verify_test_meter(payload.meter_type, payload.meter_number)
    except ValueError:
        raise HTTPException(status_code=422, detail="Use only Sandbox meter examples") from None
    except VtpassSandboxUnavailable:
        raise HTTPException(status_code=503, detail="Sandbox provider verification unavailable") from None
