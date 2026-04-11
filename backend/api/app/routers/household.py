from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.dependencies import get_supabase, get_current_user

router = APIRouter()


class CreateHouseholdRequest(BaseModel):
    name: str
    address: Optional[str] = None
    country: Optional[str] = None


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"  # owner | member


@router.post("/")
async def create_household(
    payload: CreateHouseholdRequest,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase)
):
    try:
        household = supabase.table("households").insert({
            "name": payload.name,
            "address": payload.address,
            "country": payload.country,
            "created_by": user.id
        }).execute()

        # Add creator as owner
        supabase.table("household_members").insert({
            "household_id": household.data[0]["id"],
            "user_id": user.id,
            "role": "owner"
        }).execute()

        return household.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def get_my_household(
    user=Depends(get_current_user),
    supabase=Depends(get_supabase)
):
    member = supabase.table("household_members")\
        .select("household_id, role, households(*)")\
        .eq("user_id", user.id)\
        .single()\
        .execute()

    if not member.data:
        raise HTTPException(status_code=404, detail="No household found. Create one first.")

    return member.data


@router.get("/members")
async def get_members(
    user=Depends(get_current_user),
    supabase=Depends(get_supabase)
):
    member_row = supabase.table("household_members")\
        .select("household_id")\
        .eq("user_id", user.id)\
        .single()\
        .execute()

    if not member_row.data:
        raise HTTPException(status_code=404, detail="No household found")

    members = supabase.table("household_members")\
        .select("*, users(email, raw_user_meta_data)")\
        .eq("household_id", member_row.data["household_id"])\
        .execute()

    return members.data
