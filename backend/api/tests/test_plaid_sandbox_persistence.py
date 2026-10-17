import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, AsyncMock, patch
from cryptography.fernet import Fernet

from app.services.plaid_persistent_sandbox import (
    SandboxBankError, encrypt_sandbox_token, decrypt_sandbox_token,
    _assert_live_consent, _account_rows, connect_sandbox_bank
)
from app.services.plaid_sandbox_sync import (
    fetch_transaction_changes, _normalize_transaction,
)

class SandboxVaultTests(unittest.TestCase):
    def setUp(self):
        self.key = Fernet.generate_key().decode("ascii")

    def test_encrypted_token_roundtrip_without_plaintext(self):
        with patch.dict(os.environ, {"FINANCE_TOKEN_ENCRYPTION_KEY": self.key}):
            encrypted = encrypt_sandbox_token("access-sandbox-example")
            self.assertNotIn("access-sandbox-example", encrypted)
            self.assertEqual(decrypt_sandbox_token(encrypted), "access-sandbox-example")
            with self.assertRaises(SandboxBankError):
                encrypt_sandbox_token("access-production-secret")

    def test_wrong_key_fails_closed(self):
        with patch.dict(os.environ, {"FINANCE_TOKEN_ENCRYPTION_KEY": self.key}):
            encrypted = encrypt_sandbox_token("access-sandbox-example")
        with patch.dict(os.environ, {"FINANCE_TOKEN_ENCRYPTION_KEY": Fernet.generate_key().decode()}):
            with self.assertRaises(SandboxBankError):
                decrypt_sandbox_token(encrypted)

    def test_consent_revocation_and_expiry(self):
        expires = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        sample = {"status":"linked","consent_expires_at":expires,"consent_revoked_at":None}
        self.assertIsNone(_assert_live_consent(sample))
        for invalid in ({**sample,"status":"error"},
                        {**sample,"consent_revoked_at":datetime.now(timezone.utc).isoformat()},
                        {**sample,"consent_expires_at":(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()}):
            with self.assertRaises(SandboxBankError):
                _assert_live_consent(invalid)

    def test_foreign_currency_accounts_not_imported(self):
        data = [
            {"account_id":"ca-1","name":"Checking","mask":"1234","balances":{"iso_currency_code":"CAD","current":100.50}},
            {"account_id":"us-1","name":"USD","mask":"1000","balances":{"iso_currency_code":"USD","current":200}},
        ]
        rows = _account_rows(data,"conn-1","house-1","user-1")
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["balance_minor"],10050)
        self.assertNotIn("encrypted_access_token", rows[0])

class SandboxTransactionTests(unittest.IsolatedAsyncioTestCase):
    async def test_pagination_collects_all_before_cursor_commit(self):
        first = MagicMock(status_code=200)
        first.json.return_value = {
            "added":[{"transaction_id":"1"}],"modified":[],"removed":[],
            "next_cursor":"cursor-a","has_more":True,
        }
        second = MagicMock(status_code=200)
        second.json.return_value = {
            "added":[{"transaction_id":"2"}],"modified":[],"removed":[],
            "next_cursor":"cursor-b","has_more":False,
        }
        client = MagicMock()
        client.post = AsyncMock(side_effect=[first,second])
        with patch.dict(os.environ,{"PLAID_CLIENT_ID":"fake","PLAID_SANDBOX_SECRET":"fake"}):
            changes = await fetch_transaction_changes(client,"access-sandbox-example",None)
        self.assertEqual(len(changes["added"]),2)
        self.assertEqual(changes["next_cursor"],"cursor-b")
        self.assertEqual(client.post.call_args_list[0].kwargs["json"]["count"],500)
        self.assertEqual(client.post.call_args_list[1].kwargs["json"]["cursor"],"cursor-a")

    async def test_mutation_restarts_from_original_cursor(self):
        first = MagicMock(status_code=200)
        first.json.return_value = {
            "added":[{"transaction_id":"old"}],"modified":[],"removed":[],
            "next_cursor":"cursor-next","has_more":True,
        }
        failure = MagicMock(status_code=400)
        failure.json.return_value = {
            "error_code":"TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"}
        restart = MagicMock(status_code=200)
        restart.json.return_value = {
            "added":[{"transaction_id":"new"}],"modified":[],"removed":[],
            "next_cursor":"cursor-final","has_more":False,
        }
        client = MagicMock()
        client.post = AsyncMock(side_effect=[first,failure,restart])
        with patch.dict(os.environ,{"PLAID_CLIENT_ID":"fake","PLAID_SANDBOX_SECRET":"fake"}):
            changes = await fetch_transaction_changes(client,"access-sandbox-example","cursor-original")
        self.assertEqual([item["transaction_id"] for item in changes["added"]],["new"])
        self.assertEqual(client.post.call_args_list[2].kwargs["json"]["cursor"],"cursor-original")

    async def test_normalization_uses_negative_for_debits(self):
        from app.services.plaid_sandbox_sync import _normalize_transaction
        account = {"id":"local-1"}
        debit = {"transaction_id":"1","account_id":"pla-1","amount":16.45,
                 "iso_currency_code":"CAD","date":"2026-10-17","pending":False}
        converted = _normalize_transaction(debit,account,"house-1","user-1")
        self.assertEqual(converted["amount_minor"],-1645)
        self.assertEqual(converted["owner_user_id"],"user-1")
        self.assertIsNone(_normalize_transaction({**debit,"pending":True},account,"house-1","user-1"))
        self.assertIsNone(_normalize_transaction({**debit,"iso_currency_code":"USD"},account,"house-1","user-1"))

    async def test_explicit_consent_required_before_token_exchange(self):
        with self.assertRaises(SandboxBankError):
            await connect_sandbox_bank(public_token="public-sandbox-test",
                owner_id="u",household_id="h",consent_acknowledged=False)

if __name__ == "__main__":
    unittest.main()
