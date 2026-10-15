"""Household Finance projections must run without tokens or bank access."""
import unittest
from unittest.mock import patch

from app.agents.bill_agent import BillAgent


class FinanceEstimateTests(unittest.TestCase):
    def test_cycles_and_currency_are_consistent(self):
        agent = BillAgent(household_id="h", user_id="u")
        with patch.object(agent, "ask_claude", side_effect=AssertionError("LLM called")):
            result = agent.run({
                "action": "monthly_report",
                "currency": "NGN",
                "bills": [
                    {"provider": "Rent", "amount": 120000, "billing_cycle": "yearly", "currency": "NGN"},
                    {"provider": "Internet", "amount": 10000, "billing_cycle": "monthly", "currency": "NGN"},
                    {"provider": "Water", "amount": 2500, "billing_cycle": "quarterly", "currency": "NGN"},
                    {"provider": "Foreign", "amount": 20, "billing_cycle": "monthly", "currency": "USD"},
                    {"provider": "One-time", "amount": 500000, "billing_cycle": "once", "currency": "NGN"},
                ],
            })
        self.assertEqual(result["currency"], "NGN")
        self.assertEqual(result["estimated_monthly_total"], 20833.33)
        self.assertTrue(result["is_estimate"])
        self.assertFalse(result["change_available"])
        self.assertTrue(any("USD" in rec for rec in result["recommendations"]))
        self.assertTrue(any("unsupported" in rec for rec in result["recommendations"]))

    def test_unverified_spending_never_claims_bank_reconciliation(self):
        report = BillAgent("h", "u").generate_monthly_report([])
        self.assertEqual(report["total_spent"], 0)
        self.assertIn("not confirmed spending", report["summary"].lower())


if __name__ == "__main__":
    unittest.main()
