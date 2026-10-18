"""Bill updates are explicit, household-scoped and never convert currency."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import HTTPException
from app.routers.bills import update_bill, UpdateBillRequest


class FakeQuery:
    def __init__(self, result):
        self.result = result
        self.filters = []
        self.payload = None

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def execute(self):
        return SimpleNamespace(data=self.result)


class FakeDatabase:
    def __init__(self, result):
        self.query = FakeQuery(result)

    def table(self, name):
        assert name == "bills"
        return self.query


class BillEditTests(unittest.IsolatedAsyncioTestCase):
    async def test_saved_currency_can_be_corrected_with_explicit_request(self):
        db = FakeDatabase([{"id": "a", "currency": "NGN", "next_due_date": "2026-11-01"}])
        with patch("app.routers.bills.get_supabase_admin", return_value=db):
            result = await update_bill(
                "00000000-0000-4000-8000-000000000001",
                UpdateBillRequest(currency="ngn", next_due_date="2026-11-01"),
                current_user={"id": "owner", "household_id": "my-house"})
        self.assertEqual(result["currency"], "NGN")
        self.assertEqual(db.query.payload["currency"], "NGN")
        self.assertEqual(db.query.filters, [
            ("id", "00000000-0000-4000-8000-000000000001"),
            ("household_id", "my-house"), ("is_active", True),
        ])
        self.assertNotIn("amount", db.query.payload)

    async def test_no_household_or_invalid_date_fails(self):
        with self.assertRaises(HTTPException) as error:
            await update_bill("00000000-0000-4000-8000-000000000001",
                              UpdateBillRequest(currency="NGN"), current_user={"id": "x"})
        self.assertEqual(error.exception.status_code, 403)
        with self.assertRaises(HTTPException) as error:
            await update_bill("00000000-0000-4000-8000-000000000001",
                              UpdateBillRequest(next_due_date="2026-02-30"),
                              current_user={"id": "x", "household_id": "a"})
        self.assertEqual(error.exception.status_code, 422)

    async def test_unsafe_currency_and_amount_fail(self):
        for request in (
            UpdateBillRequest(currency="US Dollar"),
            UpdateBillRequest(amount=-5),
        ):
            with self.assertRaises(HTTPException):
                await update_bill("00000000-0000-4000-8000-000000000001",
                                  request, current_user={"id": "x", "household_id": "a"})

    async def test_cannot_edit_another_household_bill(self):
        db = FakeDatabase([])
        with patch("app.routers.bills.get_supabase_admin", return_value=db):
            with self.assertRaises(HTTPException) as error:
                await update_bill("00000000-0000-4000-8000-000000000001",
                                  UpdateBillRequest(currency="NGN"),
                                  current_user={"id": "x", "household_id": "a"})
        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
