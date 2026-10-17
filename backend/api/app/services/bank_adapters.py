"""Bank data adapters: read-only boundary independent of country/provider.

Providers may return *facts* only; they cannot authorize payments or
create payee mandates. Raw tokens belong in an encrypted server vault, never
in Chief prompts, client storage, analytics or application logs.
"""
from dataclasses import dataclass
from typing import Protocol, Sequence

@dataclass(frozen=True)
class AccountSnapshot:
    provider: str
    provider_account_id: str
    currency: str
    display_name: str
    masked_account: str
    balance_minor: int | None
    as_of: str

@dataclass(frozen=True)
class TransactionSnapshot:
    provider: str
    provider_transaction_id: str
    provider_account_id: str
    amount_minor: int
    currency: str
    booked_at: str
    description: str
    merchant: str | None

class ReadOnlyBankAdapter(Protocol):
    async def list_accounts(self, *, connection_reference: str) -> Sequence[AccountSnapshot]:
        ...
    async def list_transactions(self, *, connection_reference: str, account_reference: str,
                                cursor: str | None = None) -> Sequence[TransactionSnapshot]:
        ...

class ProviderNotConfigured(RuntimeError):
    pass

class DisabledBankAdapter:
    """Explicit placeholder for sandbox/production before partner approval."""
    async def list_accounts(self, *, connection_reference: str) -> Sequence[AccountSnapshot]:
        raise ProviderNotConfigured("Bank connections are not enabled")
    async def list_transactions(self, *, connection_reference: str, account_reference: str,
                                cursor: str | None = None) -> Sequence[TransactionSnapshot]:
        raise ProviderNotConfigured("Bank connections are not enabled")

def transaction_key(transaction: TransactionSnapshot) -> tuple[str, str, str]:
    """Use provider namespace + account + transaction ID for deduplication."""
    if not transaction.provider or not transaction.provider_account_id or not transaction.provider_transaction_id:
        raise ValueError("Cannot deduplicate incomplete bank transaction")
    return (transaction.provider, transaction.provider_account_id, transaction.provider_transaction_id)
