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
            self.assertEqual(_sandbox_tester(user),"test-user")

if __name__=="__main__":
    unittest.main()
