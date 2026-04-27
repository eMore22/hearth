import os
import certifi
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from supabase import create_client, Client

# Fix SSL certificate issues on Windows
os.environ['SSL_CERT_FILE'] = certifi.where()

security = HTTPBearer()


def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def get_supabase_admin() -> Client:
    """Admin client — bypasses RLS. Use only in workers/server-side ops."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase)
):
    token = credentials.credentials
    print(f"🔑 Token received: {token[:20]}...")
    try:
        supabase_user = supabase.auth.get_user(token)
        print(f"✅ Supabase user: {supabase_user.user.id}")
        if not supabase_user or not supabase_user.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        # Fetch additional user data from public.users
        db_user = supabase.table("users").select("*").eq("id", supabase_user.user.id).maybe_single().execute()
        print(f"📋 DB user found: {db_user.data is not None}")
        
        user_data = {
            "id": supabase_user.user.id,
            "email": supabase_user.user.email,
            "household_id": db_user.data.get("household_id") if db_user.data else None,
            "full_name": supabase_user.user.user_metadata.get("full_name", "")
        }
        return user_data
    except Exception as e:
        print(f"❌ Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


def require_module(module_name: str):
    """Dependency factory — gates a route behind a feature flag."""
    def check():
        active_modules = getattr(settings, "ACTIVE_MODULES", {})
        if not active_modules.get(module_name, False):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Module '{module_name}' is not yet available"
            )
    return check