"""Security and cross-module Chief regression checks (no network)."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services.household_context import load_household_context
from app.services.household_reasoning import make_chief_prompt, offline_household_brief
from app.agents.chief_of_staff_agent import ChiefOfStaffAgent


class Query:
    def __init__(self, data, name):
        self.data, self.name = data, name
        self.filters = []
        self.fields = ""
    def select(self, fields):
        self.fields = fields
        return self
    def eq(self, key, value):
        self.filters.append((key, value))
        return self
    def order(self, key, desc=False):
        return self
    def limit(self, number):
        return self
    def execute(self):
        matched = [row for row in self.data.get(self.name, [])
                   if all(row.get(key) == value for key, value in self.filters)]
        return SimpleNamespace(data=[
            {key: row.get(key) for key in self.fields.split(",")}
            for row in matched
        ])


class FakeDB:
    def __init__(self):
        self.data = {
            "households": [{"id": "mine", "name": "Our Place", "currency": "NGN"}],
            "bills": [{"household_id": "mine", "name": "Electricity", "amount": 12500,
                       "currency": "NGN", "is_active": True}],
            "ha_connections": [{"household_id": "mine", "is_active": True,
                                "last_sync_at": "2026-10-15T09:30:00Z",
                                "ha_access_token": "DO-NOT-LEAK"}],
            "ha_devices": [{"household_id": "mine", "entity_id": "switch.main_valve",
                            "friendly_name": "Main Water Valve", "domain": "switch", "last_state": "off",
                            "is_actionable": True, "last_state_at": "2026-10-15T09:30:00Z"}],
            "household_tasks": [],
            "documents": [
                {"household_id": "mine", "title": "Home Insurance",
                 "document_type": "insurance", "summary": "Home water damage"},
                {"household_id": "theirs", "title": "Secret",
                 "document_type": "insurance", "summary": "OTHER HOUSEHOLD"},
            ],
        }
    def table(self, name):
        return Query(self.data, name)


class ChiefContextTests(unittest.TestCase):
    def test_household_isolation_and_secret_omission(self):
        overview = load_household_context("mine", FakeDB())
        self.assertEqual(overview["household"]["name"], "Our Place")
        self.assertEqual(len(overview["documents"]), 1)
        self.assertEqual(overview["documents"][0]["title"], "Home Insurance")
        self.assertEqual(overview["ha_devices"][0]["last_state"], "off")
        prompt = make_chief_prompt("Check water and insurance", overview, [])
        self.assertIn("Home Insurance", prompt)
        self.assertIn("Main Water Valve", prompt)
        self.assertIn("NGN", prompt)
        self.assertNotIn("DO-NOT-LEAK", prompt)
        self.assertNotIn("OTHER HOUSEHOLD", prompt)

    def test_old_device_status_is_not_claimed_live(self):
        overview = load_household_context("mine", FakeDB())
        self.assertEqual(overview["integrations"][0]["connected"], True)
        self.assertEqual(overview["smart_home_connected"], True)
        reply = offline_household_brief(overview)
        self.assertIn("Home Assistant: configured", reply)

    def test_chief_bills_use_next_due_date_and_skip_inactive(self):
        with patch("app.agents.base_agent.get_ai_gateway"):
            agent = ChiefOfStaffAgent("mine", "user")
            answer = agent._deterministic_reply("Which bills are due soon?", "bills", {
                "source_status": {"bills": "available"},
                "bills": [
                    {"name": "Electricity", "next_due_date": "2026-10-25",
                     "currency": "NGN", "amount": 8000, "is_active": True},
                    {"name": "Cancelled plan", "next_due_date": "2026-10-24",
                     "currency": "NGN", "amount": 2500, "is_active": False},
                ],
            })
        self.assertIn("Electricity due 2026-10-25, NGN 8000", answer)
        self.assertNotIn("Cancelled plan", answer)

    def test_chief_grocery_source_status_is_not_mistaken_for_empty(self):
        with patch("app.agents.base_agent.get_ai_gateway"):
            agent = ChiefOfStaffAgent("mine", "user")
            answer = agent._deterministic_reply("What's in my pantry?", "grocery", {
                "source_status": {"inventory": "unavailable", "legacy_inventory": "unavailable"},
                "inventory": [],
            })
        self.assertIn("couldn't check", answer)

    def test_client_context_cannot_create_device_command(self):
        with patch("app.agents.base_agent.get_ai_gateway"):
            agent = ChiefOfStaffAgent("mine", "user")
            verified = load_household_context("mine", FakeDB())
            self.assertIsNone(agent._detect_device_command(
                "Is the Main Water Valve on?", verified["ha_devices"]))
            action = agent._detect_device_command(
                "Turn on Main Water Valve", verified["ha_devices"])
            self.assertEqual(action["action"], "turn_on")

    def test_provider_outage_still_has_household_summary(self):
        context = load_household_context("mine", FakeDB())
        result = offline_household_brief(context)
        self.assertIn("Bills: 1 tracked", result)


if __name__ == "__main__":
    unittest.main()
