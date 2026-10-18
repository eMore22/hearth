"""Read-only household utility summary with no payments or external credentials."""
from datetime import date
from decimal import Decimal, InvalidOperation

KEYWORDS = {
    "electricity": ("electricity", "power", "energy"),
    "water": ("water", "sewage"),
    "internet": ("internet", "broadband", "wifi", "fiber", "fibre"),
    "gas": ("gas", "lpg"),
    "television": ("television", "cable", "dstv", "gotv"),
}


def bill_category(bill: dict) -> str | None:
    category = str(bill.get("category") or "").casefold()
    name = str(bill.get("name") or bill.get("provider") or "").casefold()
    for kind, aliases in KEYWORDS.items():
        if category in (kind, *aliases) or any(alias in name for alias in aliases):
            return kind
    return None


def summarize_utilities(bills: list[dict], currency: str | None) -> dict:
    entries = []
    totals = {}
    for bill in bills[:150]:
        if bill.get("is_active") is False:
            continue
        kind = bill_category(bill)
        if not kind:
            continue
        saved_currency = str(bill.get("currency") or "").upper() or None
        amount = None
        try:
            value = Decimal(str(bill.get("amount")))
            if value.is_finite() and value >= 0:
                amount = value
        except (InvalidOperation, TypeError, ValueError):
            pass
        due = str(bill.get("next_due_date") or "")[:10] or None
        try:
            days_until_due = (date.fromisoformat(due) - date.today()).days if due else None
        except ValueError:
            days_until_due = None
            due = None
        entries.append({
            "name": str(bill.get("name") or bill.get("provider") or "Utility")[:100],
            "category": kind,
            "amount": str(amount) if amount is not None else None,
            "currency": saved_currency,
            "next_due_date": due,
            "days_until_due": days_until_due,
            "source": "saved_household_bill",
            "provider_connected": False,
            "payment_confirmed": False,
        })
        if amount is not None and saved_currency:
            key = (kind, saved_currency)
            totals[key] = totals.get(key, Decimal(0)) + amount
    entries.sort(key=lambda row: (row["days_until_due"] is None,
                                 row["days_until_due"] if row["days_until_due"] is not None else 999999))
    return {
        "household_currency": currency,
        "utilities": entries,
        "totals_by_category_and_currency": [
            {"category": kind, "currency": money, "total": str(value)}
            for (kind, money), value in sorted(totals.items())
        ],
        "provider_sync_enabled": False,
        "payments_enabled": False,
        "source": "manual_bills_only",
    }
