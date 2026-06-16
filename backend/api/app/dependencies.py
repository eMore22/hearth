import os
import certifi
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from supabase import create_client, Client

os.environ['SSL_CERT_FILE'] = certifi.where()

security = HTTPBearer()

# Cached JWKS client — fetches Supabase's public signing keys once and caches
# them (default 5 min), so most requests verify with zero network calls.
_jwks_client: PyJWKClient | None = None


def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def get_supabase_admin() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    user_id = None
    email = None
    full_name = ""

    # ── Fast path: verify locally against Supabase's published public keys (JWKS) ──
    # Supabase signs access tokens with an asymmetric key (ES256 / ECC P-256).
    # The public key is fetched once from the JWKS endpoint and cached, so most
    # requests verify with zero network calls — avoiding the per-request hit to
    # Supabase's auth API (auth.get_user) that caused the 401 cascade under a
    # burst of ~10 parallel requests on dashboard load.
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        email = payload.get("email")
        full_name = (payload.get("user_metadata") or {}).get("full_name", "")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired. Please sign in again."
        )
    except Exception as e:
        print(f"⚠️ Local JWT verify failed ({e}), falling back to Supabase auth API")

    # ── Fallback: ask Supabase to verify ──
    # Used only if JWKS fetch/verification failed for some other reason
    # (network issue, key rotation in progress, etc.)
    if not user_id:
        try:
            supabase_user = supabase.auth.get_user(token)
            if not supabase_user or not supabase_user.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token"
                )
            user_id = supabase_user.user.id
            email = supabase_user.user.email
            full_name = supabase_user.user.user_metadata.get("full_name", "")
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

    # Household lookup — a Postgres query via PostgREST, not an auth-API call,
    # so it's safe under the same kind of parallel burst.
    household_id = None
    try:
        member = supabase.table("household_members")\
            .select("household_id")\
            .eq("user_id", user_id)\
            .maybe_single()\
            .execute()
        if member and member.data:
            household_id = member.data.get("household_id")
    except Exception:
        pass

    return {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "household_id": household_id,
    }


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