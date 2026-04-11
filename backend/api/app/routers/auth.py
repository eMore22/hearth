from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.dependencies import get_supabase

router = APIRouter()


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
async def signup(payload: SignUpRequest, supabase=Depends(get_supabase)):
    try:
        res = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {"data": {"full_name": payload.full_name}}
        })
        return {"message": "Account created. Check your email to verify.", "user_id": res.user.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
async def signin(payload: SignInRequest, supabase=Depends(get_supabase)):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password
        })
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user": {"id": res.user.id, "email": res.user.email}
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/signout")
async def signout(supabase=Depends(get_supabase)):
    supabase.auth.sign_out()
    return {"message": "Signed out"}


@router.post("/refresh")
async def refresh_token(refresh_token: str, supabase=Depends(get_supabase)):
    try:
        res = supabase.auth.refresh_session(refresh_token)
        return {"access_token": res.session.access_token}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Could not refresh token")
