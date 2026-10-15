"""Regression tests for the runtime failures observed in Hearth production."""
import unittest
from datetime import date, timedelta
from app.agents.grocery_agent import GroceryAgent


class GroceryRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.agent = GroceryAgent("test-household", "test-user")

    def test_waste_alert_route_alias_does_not_call_ai(self):
        soon = (date.today() + timedelta(days=1)).isoformat()
        alerts = self.agent.run({
            "action": "waste_alert",
            "inventory": [{"name": "Tomatoes", "expiry_date": soon}],
        })
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["item"], "Tomatoes")
        self.assertEqual(alerts[0]["days_left"], 1)
        self.assertEqual(alerts[0]["priority"], "high")

    def test_waste_alert_skips_invalid_and_later_dates(self):
        later = (date.today() + timedelta(days=10)).isoformat()
        self.assertEqual(self.agent.run({"action": "check_waste", "inventory": [
            {"name": "Rice", "expiry_date": later},
            {"name": "Bread", "expiry_date": "not-a-date"},
            {"name": "No Date"},
        ]}), [])

    def test_expired_item_is_not_declared_safe_to_eat(self):
        expired = (date.today() - timedelta(days=1)).isoformat()
        alerts = self.agent.run({"action": "waste_alert", "inventory": [
            {"name": "Milk", "expiry_date": expired},
        ]})
        self.assertIn("food safety", alerts[0]["suggested_action"].lower())


if __name__ == "__main__":
    unittest.main()
