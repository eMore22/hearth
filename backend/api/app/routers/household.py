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
    """Create a new household and set the current user as owner."""
    try:
        # Insert household with created_by
        household = supabase.table("households").insert({
            "name": payload.name,
            "address": payload.address,
            "country": payload.country,
            "created_by": user.id
        }).execute()

        household_id = household.data[0]["id"]

        # Add creator as owner in household_members
        supabase.table("household_members").insert({
            "household_id": household_id,
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
    """Get the current user's household (if any)."""
    member = supabase.table("household_members")\
        .select("household_id, role, households(*)")\
        .eq("user_id", user.id)\
        .maybe_single()\
        .execute()

    if not member.data:
        return {}

    return member.data


@router.get("/members")
async def get_members(
    user=Depends(get_current_user),
    supabase=Depends(get_supabase)
):
    """Get all members of the current user's household."""
    member_row = supabase.table("household_members")\
        .select("household_id")\
        .eq("user_id", user.id)\
        .maybe_single()\
        .execute()

    if not member_row.data:
        raise HTTPException(status_code=404, detail="No household found")

    members = supabase.table("household_members")\
        .select("*, users(email, raw_user_meta_data)")\
        .eq("household_id", member_row.data["household_id"])\
        .execute()

    return members.data