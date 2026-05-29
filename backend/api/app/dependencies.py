import os
import certifi
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from supabase import create_client, Client

os.environ['SSL_CERT_FILE'] = certifi.where()

security = HTTPBearer()


def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def get_supabase_admin() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        # Use admin client to verify token — more reliable than standard client
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        supabase_user = supabase.auth.get_user(token)

        if not supabase_user or not supabase_user.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )

        user = supabase_user.user

        # Try to get household_id — non-fatal if it fails
        household_id = None
        try:
            member = supabase.table("household_members")\
                .select("household_id")\
                .eq("user_id", user.id)\
                .maybe_single()\
                .execute()
            if member and member.data:
                household_id = member.data.get("household_id")
        except Exception:
            pass

        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.user_metadata.get("full_name", ""),
            "household_id": household_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        if "expired" in error_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired. Please sign in again."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


def require_module(module_name: str):
    """Gates a route behind a feature flag."""
    def check():
        active_modules = getattr(settings, "ACTIVE_MODULES", {})
        if not active_modules.get(module_name, False):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Module '{module_name}' is not yet available"
            )
    return check