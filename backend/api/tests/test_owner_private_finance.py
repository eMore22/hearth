"""Bank data belongs to its linker and only household owner can view it in Profile."""
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.services.owner_private_finance import require_household_owner, owner_bank_profile


class Table:
    def __init__(self, result):
        self.result = result
        self.filters = []

    def select(self, *args):
        return self
    def eq(self, key, value):
        self.filters.append((key,value))
        return self
    def gt(self, *args):
        return self
    def is_(self, *args):
        return self
    def in_(self, *args):
        return self
    def limit(self, *args):
        return self
    def maybe_single(self):
        return self
    def execute(self):
        return SimpleNamespace(data=self.result)


class DB:
    def __init__(self, role="owner", connections=None, accounts=None):
        self.tables = {
            "household_members": Table({"role": role} if role else None),
            "finance_connections": Table(connections or []),
            "finance_accounts": Table(accounts or []),
        }

    def table(self, name):
        return self.tables[name]


class OwnerFinanceTests(unittest.TestCase):
    owner = {"id": "00000000-0000-4000-8000-000000000001",
             "household_id": "00000000-0000-4000-8000-000000000002"}

    def test_members_never_receive_private_balances(self):
        db = DB(role="member", accounts=[{"balance_minor":1234500}])
        with patch("app.services.owner_private_finance.get_supabase_admin", return_value=db):
            with self.assertRaises(HTTPException) as err:
                owner_bank_profile(self.owner)
        self.assertEqual(err.exception.status_code, 403)
        self.assertEqual(db.tables["finance_accounts"].filters, [])

    def test_owner_only_sees_linked_owner_accounts_no_other_household(self):
        db = DB(connections=[
            {"id": "plaid-item", "provider": "plaid", "country_code": "CA"},
            {"id": "mono-item", "provider": "mono", "country_code": "NG"}
        ], accounts=[
            {"id":"a","display_name":"Plaid Checking","currency":"CAD",
             "balance_minor":123450,"connection_id":"plaid-item","masked_account":"****0000",
             "balance_updated_at":"2026-10-18"}
        ])
        with patch("app.services.owner_private_finance.get_supabase_admin", return_value=db):
            result = owner_bank_profile(self.owner)
        self.assertTrue(result["owner_only"])
        self.assertEqual(result["accounts"][0]["balance_minor"], 123450)
        self.assertEqual(len(result["mono_connections"]), 1)
        self.assertNotIn("provider_connection_ref", str(result))
        self.assertIn(("owner_user_id",self.owner["id"]), db.tables["finance_accounts"].filters)
        self.assertIn(("household_id",self.owner["household_id"]), db.tables["finance_accounts"].filters)

    def test_an_expired_or_revoked_link_cannot_be_returned_by_queries(self):
        db=DB()
        with patch("app.services.owner_private_finance.get_supabase_admin", return_value=db):
            result=owner_bank_profile(self.owner)
        self.assertEqual(result["accounts"],[])
        self.assertEqual(result["mono_connections"],[])
        self.assertFalse(result["payments_enabled"])

    def test_missing_role_fails_closed(self):
        with patch("app.services.owner_private_finance.get_supabase_admin",return_value=DB(role=None)):
            with self.assertRaises(HTTPException) as err:
                require_household_owner(self.owner)
        self.assertEqual(err.exception.status_code,403)


if __name__ == "__main__":
    unittest.main()
