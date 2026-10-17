"""One-shot, non-persistent Plaid Sandbox account preview.

Exchanges a Sandbox public token, fetches simulated account metadata, then
revokes the Plaid Item. Never persists the access token or exposes it to the app.
This does not create a durable bank connection or transaction sync.
"""
import os
from decimal import Decimal, InvalidOperation
import httpx

class PlaidPreviewUnavailable(RuntimeError):
    pass

async def preview_sandbox_accounts(public_token: str) -> list[dict]:
    if not public_token or not public_token.startswith("public-sandbox-") or len(public_token) > 512:
        raise PlaidPreviewUnavailable("Invalid Sandbox public token")
    client_id = os.getenv("PLAID_CLIENT_ID", "").strip()
    secret = os.getenv("PLAID_SANDBOX_SECRET", "").strip()
    if not client_id or not secret:
        raise PlaidPreviewUnavailable("Plaid Sandbox is not configured")
    common = {"client_id": client_id, "secret": secret}
    access_token = None
    async with httpx.AsyncClient(base_url="https://sandbox.plaid.com", timeout=16.0) as client:
        try:
            exchange = await client.post("/item/public_token/exchange",
                                         json={**common, "public_token": public_token})
            exchange.raise_for_status()
            access_token = exchange.json().get("access_token")
            if not isinstance(access_token, str) or not access_token:
                raise PlaidPreviewUnavailable("Plaid Sandbox did not return an access token")
            accounts = await client.post("/accounts/get",
                                         json={**common, "access_token": access_token})
            accounts.raise_for_status()
            preview = []
            for account in accounts.json().get("accounts", [])[:30]:
                currency = (account.get("balances") or {}).get("iso_currency_code")
                balance = (account.get("balances") or {}).get("current")
                amount_minor = None
                if currency == "CAD" and balance is not None:
                    try:
                        amount_minor = int((Decimal(str(balance))*100).quantize(Decimal("1")))
                    except (InvalidOperation, ValueError):
                        amount_minor = None
                preview.append({"name": str(account.get("name") or "Account")[:80],
                                "mask": str(account.get("mask") or "")[-4:],
                                "currency": currency, "balance_minor": amount_minor,
                                "is_sandbox": True})
            return preview
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise PlaidPreviewUnavailable("Plaid Sandbox account preview failed") from None
        finally:
            if access_token:
                try:
                    revoke = await client.post("/item/remove",json={**common,"access_token":access_token})
                    revoke.raise_for_status()
                except httpx.HTTPError:
                    # Never return a successful preview if test Item revocation fails.
                    # We cannot safely persist or reveal the token; operator remediation needed.
                    raise PlaidPreviewUnavailable("Sandbox Item cleanup could not be confirmed") from None
