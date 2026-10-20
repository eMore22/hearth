"""Application-level encryption and zero-plaintext logging for HA access tokens.

Legacy rows are encrypted in place on first authorized read after deployment.
No token is returned to the mobile app or exposed to other households.
"""
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from app.config import settings

TOKEN_PREFIX = "hearth-ha-fernet:v1:"


def _cipher() -> Fernet:
    key = settings.HA_TOKEN_ENCRYPTION_KEY.strip()
    if not key:
        raise HTTPException(status_code=503, detail="Smart-home credential protection unavailable")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeError) as exc:
        raise HTTPException(status_code=503, detail="Smart-home credential protection unavailable") from exc


def encrypt_ha_token(token: str) -> str:
    if not isinstance(token, str) or not token or len(token) > 8192:
        raise HTTPException(status_code=422, detail="Invalid smart-home credential")
    if token.startswith(TOKEN_PREFIX):
        raise HTTPException(status_code=422, detail="Invalid smart-home credential")
    return TOKEN_PREFIX + _cipher().encrypt(token.encode("utf-8")).decode("ascii")


def _decrypt(value: str) -> str:
    try:
        clear = _cipher().decrypt(value[len(TOKEN_PREFIX):].encode("ascii"))
        return clear.decode("utf-8")
    except (InvalidToken, UnicodeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Smart-home credential unavailable; reconnect securely") from exc


def read_ha_token(household_id: str, connection: dict, db) -> str:
    """Decrypt a stored token, or atomically upgrade an older plaintext row.

    The legacy token cannot be used unless the encryption key is configured
    and its encrypted replacement has been committed successfully. This
    avoids silently continuing with unprotected storage.
    """
    value = connection.get("ha_access_token")
    if not isinstance(value, str) or not value:
        raise HTTPException(status_code=503, detail="Smart-home credential unavailable; reconnect securely")
    if value.startswith(TOKEN_PREFIX):
        return _decrypt(value)
    if value.startswith("hearth-ha-fernet:"):
        raise HTTPException(status_code=503, detail="Unsupported smart-home credential version")
    # Do not disclose cleartext when the key is missing, malformed or the
    # conditional database update cannot be confirmed.
    protected = encrypt_ha_token(value)
    try:
        upgraded = (db.table("ha_connections")
                    .update({"ha_access_token": protected})
                    .eq("household_id", str(household_id))
                    .eq("is_active", True)
                    .eq("ha_access_token", value)
                    .execute().data or [])
        if upgraded:
            return value
        # Concurrent migration: another request may have won the compare-and-set.
        newer = (db.table("ha_connections").select("ha_access_token")
                 .eq("household_id", str(household_id))
                 .eq("is_active", True)
                 .maybe_single().execute().data or {})
        current = newer.get("ha_access_token", "")
        if isinstance(current, str) and current.startswith(TOKEN_PREFIX):
            return _decrypt(current)
    except HTTPException:
        raise
    except Exception:
        pass
    raise HTTPException(status_code=503, detail="Smart-home credential migration unavailable")


def migrate_active_ha_credentials(db=None, max_rows: int = 100) -> dict:
    """Bounded, idempotent encryption migration of active legacy HA credentials.

    Invoke during API startup. Only counts are returned, never token values.
    Failed migrations cannot bypass the fail-closed read path.
    """
    from app.dependencies import get_supabase_admin
    if not 1 <= max_rows <= 500:
        raise ValueError("Invalid migration batch size")
    db = db or get_supabase_admin()
    try:
        rows = (db.table("ha_connections")
                .select("household_id,ha_access_token")
                .eq("is_active", True).limit(max_rows + 1)
                .execute().data or [])
    except Exception:
        return {"scanned": 0, "migrated": 0, "failed": 1, "truncated": False}
    migrated = 0
    failed = 0
    for row in rows[:max_rows]:
        household_id = str(row.get("household_id") or "")
        value = row.get("ha_access_token")
        if not household_id or not isinstance(value, str) or not value:
            failed += 1
        elif value.startswith(TOKEN_PREFIX):
            try:
                _decrypt(value)
            except HTTPException:
                failed += 1
        else:
            try:
                read_ha_token(household_id, row, db)
                migrated += 1
            except HTTPException:
                failed += 1
    return {"scanned": min(len(rows), max_rows), "migrated": migrated,
            "failed": failed, "truncated": len(rows) > max_rows}
