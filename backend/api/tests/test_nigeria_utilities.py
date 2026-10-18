"""Utility and Nigerian Sandbox regression checks; no provider/network calls."""
import unittest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.services.utility_intelligence import summarize_utilities
from app.services.utility_sandbox import check_test_meter
from app.services.mono_sandbox import sandbox_ready, MonoSandboxError, list_institutions
from app.routers.nigeria_sandbox import require_tester, capabilities as mono_capabilities
from app.routers.utilities import check_meter, TestMeterRequest
from app.agents.chief_of_staff_agent import ChiefOfStaffAgent


class UtilityUnitTests(unittest.TestCase):
    def test_manual_bills_no_currency_conversion_or_inactive(self):
        overview = summarize_utilities([
            {"name": "Electricity", "category": "electricity", "amount": 8000,
             "currency": "NGN", "next_due_date": "2026-11-01", "is_active": True},
            {"name": "Power Co", "category": "electricity", "amount": 20,
             "currency": "USD", "is_active": True},
            {"name": "Cancelled Water", "category": "water", "amount": 5,
             "currency": "NGN", "is_active": False},
            {"name": "Food", "category": "groceries", "amount": 3, "currency": "NGN"},
        ], "NGN")
        self.assertEqual(len(overview["utilities"]), 2)
        self.assertEqual(len(overview["totals_by_category_and_currency"]), 2)
        self.assertFalse(overview["payments_enabled"])
        self.assertFalse(overview["provider_sync_enabled"])

    def test_meter_check_is_local_fixture_only(self):
        accepted = check_test_meter("enugu-electric", "prepaid", "1111111111111")
        self.assertTrue(accepted["valid"])
        self.assertFalse(accepted["provider_verified"])
        self.assertNotIn("1111111111111", str(accepted))
        self.assertFalse(check_test_meter("enugu-electric", "prepaid", "1234567890123")["valid"])
        with self.assertRaises(ValueError):
            check_test_meter("unknown-electric", "prepaid", "1111111111111")

    def test_utility_simulation_is_tester_only(self):
        payload = TestMeterRequest(service_id="enugu-electric", meter_type="prepaid",
                                   meter_number="1111111111111")
        user = {"id": "tester", "household_id": "house"}
        with patch.dict("os.environ", {"UTILITIES_SANDBOX_DEMO_ENABLED": "false",
                                       "UTILITIES_SANDBOX_TESTER_USER_IDS": "tester"}):
            with self.assertRaises(HTTPException):
                check_meter(payload, current_user=user)
        with patch.dict("os.environ", {"UTILITIES_SANDBOX_DEMO_ENABLED": "true",
                                       "UTILITIES_SANDBOX_TESTER_USER_IDS": "tester"}):
            self.assertTrue(check_meter(payload, current_user=user)["valid"])

    def test_chief_utility_answer_does_not_claim_verified_payment(self):
        with patch("app.agents.base_agent.get_ai_gateway"):
            agent = ChiefOfStaffAgent("house", "tester")
            self.assertEqual(agent._classify_intent.__name__, "_classify_intent")
            result = agent._deterministic_reply("Which electricity bills?", "utilities", {
                "source_status": {"utilities": "available"},
                "utilities": {"utilities": [
                    {"name": "Electricity", "category": "electricity",
                     "amount": "8000", "currency": "NGN", "next_due_date": None}
                ]},
            })
        self.assertIn("NGN 8000", result)
        self.assertIn("manually recorded", result)
        self.assertNotIn("paid successfully", result)


class MonoPrivacyTests(unittest.IsolatedAsyncioTestCase):
    async def test_mono_fails_closed_without_test_key(self):
        with patch.dict("os.environ", {"MONO_SANDBOX_DEMO_ENABLED": "false",
                                       "MONO_SANDBOX_SECRET_KEY": ""}):
            self.assertFalse(sandbox_ready())
            with self.assertRaises(MonoSandboxError):
                await list_institutions()

    async def test_mono_allowlist_does_not_expose_bank_data(self):
        user = {"id": "tester", "household_id": "house"}
        with patch.dict("os.environ", {"MONO_SANDBOX_DEMO_ENABLED": "false",
                                       "MONO_SANDBOX_TESTER_USER_IDS": "tester"}):
            with self.assertRaises(HTTPException):
                require_tester(user)
            self.assertFalse(mono_capabilities(current_user=user)["bank_linking_enabled"])
        with patch.dict("os.environ", {"MONO_SANDBOX_DEMO_ENABLED": "true",
                                       "MONO_SANDBOX_TESTER_USER_IDS": "tester"}):
            self.assertEqual(require_tester(user), "tester")


if __name__ == "__main__":
    unittest.main()
