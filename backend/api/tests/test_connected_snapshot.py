"""Shared household context is useful but never includes sensitive bank data."""
import unittest
from types import SimpleNamespace
from fastapi import HTTPException
from app.services.connected_snapshot import shared_household_snapshot


class Query:
    def __init__(self, data):
        self.data = data
        self.filters = []
    def select(self, fields):
        self.fields = fields
        return self
    def eq(self, field, value):
        self.filters.append((field, value))
        return self
    def limit(self, number):
        self.number = number
        return self
    def maybe_single(self):
        self.single = True
        return self
    def execute(self):
        if getattr(self, "single", False):
            return SimpleNamespace(data=self.data)
        return SimpleNamespace(data=[
            {k: row.get(k) for k in self.fields.split(",")}
            for row in self.data if all(row.get(k)==v for k,v in self.filters)
        ][:self.number])

class FakeDB:
    def __init__(self):
        self.tables = {
            "households": {"name":"Our Home", "country":"CA","currency":"CAD"},
            "bills": [{"household_id":"mine","name":"Electricity","currency":"CAD",
                       "amount":100,"category":"electricity","is_active":True},
                      {"household_id":"other","name":"SECRET HOUSEHOLD",
                       "currency":"CAD","amount":300,"category":"water"}],
            "grocery_inventory":[{"household_id":"mine","name":"Milk","quantity":2}],
            "tasks":[{"household_id":"mine","title":"Laundry","is_completed":False}],
            "ha_devices":[{"household_id":"mine","friendly_name":"Main Water Valve",
                           "last_state":"off","last_state_at":"2026-10-01"}],
        }
    def table(self, name):
        return Query(self.tables[name])

class SnapshotTests(unittest.TestCase):
    def test_member_can_pull_shared_non_sensitive_household_context(self):
        result=shared_household_snapshot({"id":"member","household_id":"mine"},FakeDB())
        self.assertEqual(result["visibility"],"household_members")
        self.assertEqual(len(result["bills"]),1)
        self.assertNotIn("SECRET HOUSEHOLD",str(result))
        self.assertEqual(result["utilities"]["utilities"][0]["currency"],"CAD")
        self.assertEqual(result["groceries"][0]["name"],"Milk")
        self.assertEqual(result["devices_last_known"][0]["last_state"],"off")
        self.assertFalse(result["bank_balances_included"])
        self.assertFalse(result["bank_transactions_included"])
        self.assertFalse(result["medical_records_included"])
        self.assertFalse(result["document_contents_included"])
        self.assertFalse(result["third_party_live_pull_enabled"])

    def test_nonmember_rejected(self):
        with self.assertRaises(HTTPException):
            shared_household_snapshot({"id":"nobody"},FakeDB())


if __name__=="__main__":
    unittest.main()
