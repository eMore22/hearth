import unittest
from app.services.finance_guardrails import (
    PaymentBlocked, PaymentPolicy, PaymentProposal, parse_minor_units,
    proposal_status, validate_proposal,
)

class PaymentGuardrailTests(unittest.TestCase):
    def setUp(self):
        self.policy = PaymentPolicy("CAD", 10000, 20000, frozenset({"electricity-verified"}))
        self.proposal = PaymentProposal("home-a", "user-a", "electricity-verified", "CAD", 6000, "BILL123", "once-123")
        self.base = dict(authenticated_user_id="user-a", authenticated_household_id="home-a",
                         today_spent_minor=0, existing_idempotency_keys=set())

    def test_no_execution_even_if_policy_enabled(self):
        enabled = PaymentPolicy("CAD", 10000, 20000, frozenset({"electricity-verified"}), True)
        with self.assertRaises(PaymentBlocked):
            validate_proposal(self.proposal, enabled, **self.base)

    def test_valid_draft_does_not_transfer(self):
        self.assertIsNone(validate_proposal(self.proposal, self.policy, **self.base))
        self.assertFalse(proposal_status()["payment_execution_enabled"])

    def test_cross_household_blocked(self):
        with self.assertRaisesRegex(PaymentBlocked, "scope"):
            validate_proposal(self.proposal, self.policy, **{**self.base, "authenticated_household_id": "home-b"})

    def test_cross_user_blocked(self):
        with self.assertRaisesRegex(PaymentBlocked, "scope"):
            validate_proposal(self.proposal, self.policy, **{**self.base, "authenticated_user_id": "user-b"})

    def test_spending_limits(self):
        with self.assertRaisesRegex(PaymentBlocked, "daily"):
            validate_proposal(self.proposal, self.policy, **{**self.base, "today_spent_minor": 18000})
        high = PaymentProposal("home-a", "user-a", "electricity-verified", "CAD", 10001, "BILL123", "once-123")
        with self.assertRaisesRegex(PaymentBlocked, "transaction"):
            validate_proposal(high, self.policy, **self.base)

    def test_duplicate_prevention(self):
        with self.assertRaisesRegex(PaymentBlocked, "Duplicate"):
            validate_proposal(self.proposal, self.policy, **{**self.base, "existing_idempotency_keys": {"once-123"}})

    def test_unknown_biller(self):
        bad = PaymentProposal("home-a", "user-a", "somewhere", "CAD", 6000, "BILL123", "once-123")
        with self.assertRaisesRegex(PaymentBlocked, "biller"):
            validate_proposal(bad, self.policy, **self.base)

    def test_precision_and_currency(self):
        self.assertEqual(parse_minor_units("123.45", "CAD"), 12345)
        self.assertEqual(parse_minor_units("50.00", "NGN"), 5000)
        for amount in ("0", "-10", "1.234", "NaN", "Infinity", "oops"):
            with self.assertRaises(PaymentBlocked):
                parse_minor_units(amount, "CAD")
        with self.assertRaises(PaymentBlocked):
            parse_minor_units("10.00", "USD")
        with self.assertRaises(PaymentBlocked):
            parse_minor_units(0.1, "CAD")

if __name__ == "__main__":
    unittest.main()
