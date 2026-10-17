import unittest
from fastapi import HTTPException
from app.routers.finance import _identity, capabilities, payment_availability

class FinanceRoutesTests(unittest.TestCase):
    def test_verified_household_required(self):
        for user in ({}, {"id":"u"}, {"household_id":"h"}):
            with self.assertRaises(HTTPException):
                _identity(user)
    def test_no_payment_execution(self):
        user={"id":"user-one","household_id":"household-one"}
        self.assertFalse(capabilities(current_user=user)["payment_execution_enabled"])
        self.assertFalse(payment_availability(current_user=user)["available"])

if __name__=="__main__":
    unittest.main()
