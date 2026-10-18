import unittest
from unittest.mock import patch
from fastapi import HTTPException
from app.routers.finance import _identity, _sandbox_tester, capabilities, payment_availability

class FinanceRoutesTests(unittest.TestCase):
    def test_verified_household_required(self):
        for user in ({}, {"id":"u"}, {"household_id":"h"}):
            with self.assertRaises(HTTPException):
                _identity(user)
    def test_no_payment_execution(self):
        user={"id":"user-one","household_id":"household-one"}
        self.assertFalse(capabilities(current_user=user)["payment_execution_enabled"])
        self.assertFalse(payment_availability(current_user=user)["available"])

    def test_sandbox_requires_explicit_allowlist(self):
        user={"id":"test-user","household_id":"test-home"}
        with patch.dict("os.environ",{"PLAID_SANDBOX_DEMO_ENABLED":"false","PLAID_SANDBOX_TESTER_USER_IDS":"test-user"}):
            with self.assertRaises(HTTPException):
                _sandbox_tester(user)
        with patch.dict("os.environ",{"PLAID_SANDBOX_DEMO_ENABLED":"true","PLAID_SANDBOX_TESTER_USER_IDS":"another-user"}):
            with self.assertRaises(HTTPException):
                _sandbox_tester(user)
        with patch.dict("os.environ",{"PLAID_SANDBOX_DEMO_ENABLED":"true","PLAID_SANDBOX_TESTER_USER_IDS":"test-user"}):
            with patch("app.routers.finance.require_household_owner", return_value=("test-user","test-home")):
                self.assertEqual(_sandbox_tester(user),"test-user")


    def test_general_accounts_exclude_plaid_sandbox(self):
        from unittest.mock import MagicMock
        from app.routers.finance import list_accounts
        db = MagicMock()
        query = db.table.return_value.select.return_value
        # Supabase query-builder methods return themselves for chaining.
        for method in ("eq", "neq", "is_", "gt", "limit", "in_"):
            getattr(query, method).return_value = query
        query.execute.return_value.data = []
        with patch("app.routers.finance.get_supabase_admin", return_value=db):
            result = list_accounts(current_user={"id": "test-user", "household_id": "test-home"})
        self.assertEqual(result["accounts"], [])
        query.neq.assert_any_call("provider", "plaid")
        query.neq.assert_any_call("provider", "mono")
        self.assertEqual(query.neq.call_count, 2)

if __name__=="__main__":
    unittest.main()
