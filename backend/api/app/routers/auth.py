from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.dependencies import get_supabase

router = APIRouter()

EMAIL_CONFIRM_REDIRECT_URL = "https://www.hearthhq.online/email-confirmed.html"


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str


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

        # Supabase's own anti-enumeration protection means sign_up() on an
        # already-registered, already-confirmed email returns a response
        # that LOOKS successful — no account mutation happens, no real
        # email is sent — but user.identities comes back empty. Without
        # checking this, the app was telling repeat signups "Account
        # created" every time, which is exactly what confused this tester
        # into thinking multiple signup attempts were each resetting his
        # password. The account itself was never at risk (Supabase's own
        # protection prevented that) — this is purely a messaging fix.
        identities = getattr(res.user, "identities", None) or []
        if len(identities) == 0:
            return {
                "message": "An account with this email already exists. Try signing in, or use Forgot Password if you don't remember your password.",
                "already_registered": True,
            }

        return {
            "message": "Account created. Check your email to verify.",
            "user_id": res.user.id,
            "already_registered": False,
        }
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


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, supabase=Depends(get_supabase)):
    """
    Sends a password reset email containing a numeric recovery code, if this
    email is registered. Always returns the same success message regardless
    of whether the email actually exists — this is the one place enumeration
    protection has to be enforced deliberately in our own code, since
    Supabase's built-in masking is specific to sign_up(), not this endpoint.
    """
    try:
        supabase.auth.reset_password_for_email(payload.email)
    except Exception as e:
        print(f"⚠️ Password reset request failed (not shown to user): {e}")
    return {"message": "If an account exists for this email, a reset code has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, supabase=Depends(get_supabase)):
    """
    Completes a password reset: verifies the emailed OTP code, which
    establishes a real recovery session on this client, then uses that
    session to actually set the new password.
    """
    try:
        supabase.auth.verify_otp({
            "email": payload.email,
            "token": payload.token,
            "type": "recovery",
        })
        supabase.auth.update_user({"password": payload.new_password})
        return {"message": "Password updated. Please sign in with your new password."}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid or expired code. Please request a new one.")
