from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_supabase, get_supabase_admin, get_current_user

router = APIRouter()


class CreateHouseholdRequest(BaseModel):
    name: str
    address: Optional[str] = None
    country: Optional[str] = None


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"


@router.post("/")
async def create_household(
    payload: CreateHouseholdRequest,
    user=Depends(get_current_user),
):
    """
    Create a new household and set the current user as owner.
    Uses admin client to bypass RLS on insert — RLS still
    protects reads via get_my_household_id().
    """
    # Admin client bypasses RLS for writes
    supabase = get_supabase_admin()

    try:
        # Check if user already has a household
        existing = supabase.table("household_members")\
            .select("household_id")\
            .eq("user_id", user["id"])\
            .limit(1)\
            .execute()

        if existing.data and len(existing.data) > 0:
            # Return existing household instead of creating duplicate
            household = supabase.table("households")\
                .select("*")\
                .eq("id", existing.data[0]["household_id"])\
                .single()\
                .execute()
            return household.data

        # Create household
        household = supabase.table("households").insert({
            "name": payload.name,
            "address": payload.address,
            "country": payload.country,
            "created_by": user["id"]
        }).execute()

        if not household.data:
            raise HTTPException(status_code=400, detail="Failed to create household")

        household_id = household.data[0]["id"]

        # Add user as owner
        supabase.table("household_members").insert({
            "household_id": household_id,
            "user_id": user["id"],
            "role": "owner"
        }).execute()

        return household.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def get_my_household(
    user=Depends(get_current_user),
):
    supabase = get_supabase_admin()

    try:
        member = supabase.table("household_members")\
            .select("household_id, role, households(*)")\
            .eq("user_id", user["id"])\
            .limit(1)\
            .execute()

        if not member.data or len(member.data) == 0:
            return {}

        return member.data[0]

    except Exception:
        return {}


@router.get("/members")
async def get_members(
    user=Depends(get_current_user),
):
    supabase = get_supabase_admin()

    try:
        member_row = supabase.table("household_members")\
            .select("household_id")\
            .eq("user_id", user["id"])\
            .limit(1)\
            .execute()

        if not member_row.data or len(member_row.data) == 0:
            raise HTTPException(status_code=404, detail="No household found")

        members = supabase.table("household_members")\
            .select("*")\
            .eq("household_id", member_row.data[0]["household_id"])\
            .execute()

        return members.data or []

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invite")
async def invite_member(
    payload: InviteMemberRequest,
    user=Depends(get_current_user),
):
    supabase = get_supabase_admin()

    try:
        member_row = supabase.table("household_members")\
            .select("household_id")\
            .eq("user_id", user["id"])\
            .limit(1)\
            .execute()

        if not member_row.data:
            raise HTTPException(status_code=404, detail="No household found")

        household_id = member_row.data[0]["household_id"]

        # Find user by email
        users = supabase.auth.admin.list_users()
        invited_user = next(
            (u for u in users if u.email == payload.email), None
        )

        if not invited_user:
            raise HTTPException(
                status_code=404,
                detail="No Hearth account found with that email"
            )

        supabase.table("household_members").insert({
            "household_id": household_id,
            "user_id": invited_user.id,
            "role": payload.role
        }).execute()

        return {"message": f"{payload.email} added to household"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))