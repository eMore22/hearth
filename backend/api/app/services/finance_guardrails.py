"""Strict, provider-independent payment *proposal* validation.

No bank transfers happen here. Execution is intentionally not implemented.
All limits are server-owned and checked again at execution time by a future
regulated payment connector.
"""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Mapping

SUPPORTED_CURRENCIES = {"CAD", "NGN"}
MAX_REFERENCE_LENGTH = 128

@dataclass(frozen=True)
class PaymentPolicy:
    currency: str
    max_per_payment_minor: int
    max_daily_minor: int
    allowed_billers: frozenset[str]
    payments_enabled: bool = False

@dataclass(frozen=True)
class PaymentProposal:
    household_id: str
    payer_user_id: str
    biller_id: str
    currency: str
    amount_minor: int
    external_bill_reference: str
    idempotency_key: str

class PaymentBlocked(ValueError):
    pass

def parse_minor_units(amount: str, currency: str) -> int:
    """Parse *decimal strings* only; floats silently lose cents."""
    if currency not in SUPPORTED_CURRENCIES:
        raise PaymentBlocked("Unsupported currency")
    if not isinstance(amount, str):
        raise PaymentBlocked("Payment amount must be a decimal string")
    try:
        value = Decimal(amount)
    except (InvalidOperation, ValueError):
        raise PaymentBlocked("Invalid payment amount") from None
    if not value.is_finite() or value <= 0:
        raise PaymentBlocked("Payment amount must be positive")
    cents = value * 100
    if cents != cents.to_integral_value():
        raise PaymentBlocked("Payment amount cannot exceed two decimal places")
    return int(cents)

def validate_proposal(
    proposal: PaymentProposal,
    policy: PaymentPolicy,
    *,
    authenticated_user_id: str,
    authenticated_household_id: str,
    today_spent_minor: int,
    existing_idempotency_keys: set[str],
) -> None:
    """Validate proposal against authority, ownership, currency and limits.

    A successful validation only allows DRAFTING an approval request.
    It never authorizes executing a transaction.
    """
    if not authenticated_user_id or not authenticated_household_id:
        raise PaymentBlocked("Authentication required")
    if proposal.payer_user_id != authenticated_user_id or proposal.household_id != authenticated_household_id:
        raise PaymentBlocked("Payment scope mismatch")
    if proposal.currency not in SUPPORTED_CURRENCIES or policy.currency != proposal.currency:
        raise PaymentBlocked("Currency mismatch")
    if proposal.biller_id not in policy.allowed_billers:
        raise PaymentBlocked("Unapproved biller")
    if not isinstance(proposal.amount_minor, int) or isinstance(proposal.amount_minor, bool) or proposal.amount_minor <= 0:
        raise PaymentBlocked("Invalid payment amount")
    if proposal.amount_minor > policy.max_per_payment_minor:
        raise PaymentBlocked("Payment exceeds transaction limit")
    if today_spent_minor < 0 or today_spent_minor + proposal.amount_minor > policy.max_daily_minor:
        raise PaymentBlocked("Payment exceeds daily limit")
    if not proposal.external_bill_reference or len(proposal.external_bill_reference) > MAX_REFERENCE_LENGTH:
        raise PaymentBlocked("Invalid bill reference")
    if not proposal.idempotency_key or len(proposal.idempotency_key) > MAX_REFERENCE_LENGTH:
        raise PaymentBlocked("Invalid idempotency key")
    if proposal.idempotency_key in existing_idempotency_keys:
        raise PaymentBlocked("Duplicate payment request")
    if policy.payments_enabled:
        # Even an enabled policy cannot authorize money movement until an
        # independently reviewed execution and strong-auth flow exists.
        raise PaymentBlocked("Payment execution is not available yet")

def proposal_status() -> Mapping[str, object]:
    return {"bank_connections_enabled": False, "payment_execution_enabled": False,
            "recurring_payments_enabled": False, "provider": None}
