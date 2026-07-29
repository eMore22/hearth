from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.dependencies import get_supabase

router = APIRouter()

# Where users land after tapping the email confirmation link.
# Update this to a real dedicated confirmation page once the
# landing page site is available to edit.
EMAIL_CONFIRM_REDIRECT_URL = "https://hearthhq.online/email-confirmed"


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/signup")
async def signup(payload: SignUpRequest, supabase=Depends(get_supabase)):
    try:
        res = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {"full_name": payload.full_name},
                "email_redirect_to": EMAIL_CONFIRM_REDIRECT_URL,
            }
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
            "user": {
                "id": res.user.id,
                "email": res.user.email,
                "user_metadata": res.user.user_metadata,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/signout")
async def signout(supabase=Depends(get_supabase)):
    supabase.auth.sign_out()
    return {"message": "Signed out"}


@router.post("/refresh")
async def refresh_token(payload: RefreshRequest, supabase=Depends(get_supabase)):
    try:
        res = supabase.auth.refresh_session(payload.refresh_token)
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Could not refresh token")
