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
# them, so most requests verify with zero network calls.
#
# IMPORTANT: this client is self-healing. If a verification attempt fails
# for ANY reason (network blip, transient bad key fetch right after a Render
# redeploy, etc.), we discard this cached client below so the *next* request
# builds a brand new one from scratch — rather than getting permanently
# stuck reusing a client that's in a bad state for the rest of the process
# lifetime, which is what caused real users to get repeatedly 401'd until
# the next deploy.
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


def _reset_jwks_client():
    """Force the next call to _get_jwks_client() to build a fresh client."""
    global _jwks_client
    _jwks_client = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    user_id = None
    email = None
    full_name = ""
    jwks_error = None

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
        # Genuinely expired — no point falling back, the Supabase API would
        # reject this too. Fail fast with a clear message.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired. Please sign in again."
        )
    except Exception as e:
        jwks_error = e
        print(f"⚠️ Local JWT verify failed ({e}), falling back to Supabase auth API")
        # Self-heal: throw away the cached client. If this was caused by a
        # bad/stale key fetch (e.g. right after a deploy, or mid key-rotation
        # on Supabase's side), the next request gets a clean client instead
        # of repeating the same failure indefinitely.
        _reset_jwks_client()

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
            # Both verification paths failed. Log both errors clearly so
            # this is debuggable from Render logs instead of a bare 401.
            print(f"❌ Both JWT verification paths failed. JWKS error: {jwks_error} | Supabase API error: {e}")
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