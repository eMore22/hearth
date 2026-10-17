"""Consent rules independent of any bank aggregator. No account is connected here."""
from dataclasses import dataclass
from datetime import datetime, timezone

READ_ONLY_SCOPES = frozenset({"accounts.read", "balances.read", "transactions.read"})
MAX_CONSENT_AGE_DAYS = 90

@dataclass(frozen=True)
class FinanceConsent:
    user_id: str
    household_id: str
    scopes: frozenset[str]
    accepted_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None

class ConsentNotGranted(PermissionError):
    pass

def require_read_consent(
    consent: FinanceConsent | None, *,
    user_id: str, household_id: str, scope: str,
    now: datetime | None = None,
) -> None:
    now = now or datetime.now(timezone.utc)
    if not user_id or not household_id or scope not in READ_ONLY_SCOPES:
        raise ConsentNotGranted("Unsupported access request")
    if consent is None or consent.user_id != user_id or consent.household_id != household_id:
        raise ConsentNotGranted("Account owner consent required")
    if consent.revoked_at is not None:
        raise ConsentNotGranted("Consent revoked")
    if consent.accepted_at.tzinfo is None or consent.expires_at.tzinfo is None:
        raise ConsentNotGranted("Invalid consent timestamps")
    if consent.accepted_at > now or consent.expires_at <= now or consent.expires_at <= consent.accepted_at:
        raise ConsentNotGranted("Consent expired or invalid")
    if (consent.expires_at - consent.accepted_at).days > MAX_CONSENT_AGE_DAYS:
        raise ConsentNotGranted("Consent duration exceeds allowed period")
    if not consent.scopes.issubset(READ_ONLY_SCOPES) or scope not in consent.scopes:
        raise ConsentNotGranted("Consent does not include requested scope")
