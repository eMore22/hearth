"""Deterministic transaction analysis: no AI, no provider access, no transfers."""
from collections import defaultdict
from datetime import date
from typing import Iterable
from app.services.bank_adapters import TransactionSnapshot

def monthly_spending(transactions: Iterable[TransactionSnapshot]) -> dict[str, dict[str, int]]:
    """Group outflows by currency and YYYY-MM. Never add distinct currencies."""
    totals: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for tx in transactions:
        if tx.currency not in ("CAD", "NGN"):
            continue
        try:
            month = date.fromisoformat(tx.booked_at[:10]).strftime("%Y-%m")
        except (ValueError, TypeError):
            continue
        # Positive and negative signs differ by provider; adapters MUST first
        # normalize debits to negative minor units and credits to positive.
        if tx.amount_minor < 0:
            totals[tx.currency][month] += -tx.amount_minor
    return {currency: dict(sorted(months.items())) for currency, months in sorted(totals.items())}

def possible_recurring_charges(transactions: Iterable[TransactionSnapshot]) -> list[dict]:
    """Return REVIEW SUGGESTIONS only, never payment or cancellation commands."""
    groups = defaultdict(list)
    for tx in transactions:
        if tx.amount_minor >= 0 or not tx.merchant or tx.currency not in ("CAD","NGN"):
            continue
        try:
            booked = date.fromisoformat(tx.booked_at[:10])
        except (ValueError, TypeError):
            continue
        merchant = " ".join(tx.merchant.casefold().split())[:100]
        if merchant:
            groups[(tx.currency,merchant)].append((booked, -tx.amount_minor))
    found = []
    for (currency, merchant), entries in groups.items():
        entries.sort()
        unique_months = {d.strftime("%Y-%m") for d, _ in entries}
        if len(unique_months) < 2:
            continue
        recent = entries[-3:]
        amounts = [amount for _, amount in recent]
        if max(amounts) - min(amounts) > max(100, min(amounts) // 5):
            continue
        found.append({"merchant": merchant, "currency": currency,
                      "estimated_amount_minor": round(sum(amounts)/len(amounts)),
                      "months_observed": len(unique_months),
                      "status": "possible_recurring_charge_not_verified"})
    return sorted(found, key=lambda x: (x["currency"],x["merchant"]))
