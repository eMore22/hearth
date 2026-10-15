"""Regression tests for backend-verified Free/Home/Family permissions."""
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from fastapi import HTTPException

from app.services import subscriptions


class SubscriptionTests(unittest.TestCase):
    def setUp(self):
        subscriptions._cache.clear()

    def test_free_and_expired_are_not_premium(self):
        self.assertEqual(subscriptions.tier_from_customer({"subscriber": {"entitlements": {}}}), "free")
        self.assertEqual(subscriptions.tier_from_customer({
            "subscriber": {"entitlements": {"family": {}}}}), "free")
        self.assertEqual(subscriptions.tier_from_customer({
            "subscriber": {"entitlements": {"home": {"expires_date": "2020-01-01T00:00:00Z"}}}}), "free")

    def test_lifetime_and_active_family_win(self):
        self.assertEqual(subscriptions.tier_from_customer({
            "subscriber": {"entitlements": {"home": {"expires_date": None}}}}), "home")
        self.assertEqual(subscriptions.tier_from_customer({
            "subscriber": {"entitlements": {
                "home": {"expires_date": None},
                "family": {"expires_date": "2099-01-01T00:00:00Z"}
            }}}), "family")

    def test_valid_grace_period(self):
        result = subscriptions.tier_from_customer({
            "subscriber": {"entitlements": {"family": {
                "expires_date": "2020-01-01T00:00:00Z",
                "grace_period_expires_date": "2099-01-01T00:00:00Z",
            }}}})
        self.assertEqual(result, "family")

    def test_enforcement_off_never_locks_existing_members(self):
        with patch.object(subscriptions.settings, "BILLING_ENFORCEMENT_ENABLED", False), \
             patch.object(subscriptions.settings, "REVENUECAT_SECRET_API_KEY", ""):
            access = subscriptions.access_for({"id": "person", "household_id": "house"})
            self.assertFalse(access["enforced"])
            self.assertEqual(access["tier"], "free")

    def test_enforcement_on_with_no_secret_is_unavailable(self):
        with patch.object(subscriptions.settings, "BILLING_ENFORCEMENT_ENABLED", True), \
             patch.object(subscriptions.settings, "REVENUECAT_SECRET_API_KEY", ""):
            with self.assertRaises(subscriptions.BillingUnavailable):
                subscriptions.access_for({"id": "person"})

    def test_user_id_is_not_taken_from_request(self):
        with patch.object(subscriptions.settings, "REVENUECAT_SECRET_API_KEY", "test-key"), \
             patch.object(subscriptions, "_lookup_remote", return_value="home") as fetch:
            self.assertEqual(subscriptions.user_tier("real-user"), "home")
            fetch.assert_called_once_with("real-user")
            self.assertEqual(subscriptions.user_tier("real-user"), "home")
            fetch.assert_called_once()

    def test_outage_cache_grace_paid_only(self):
        with patch.object(subscriptions, "_lookup_remote", return_value="family"):
            self.assertEqual(subscriptions.user_tier("paid"), "family")
        with patch.object(subscriptions, "_lookup_remote", side_effect=subscriptions.BillingUnavailable("offline")):
            self.assertEqual(subscriptions.user_tier("paid"), "family")
            with self.assertRaises(subscriptions.BillingUnavailable):
                subscriptions.user_tier("unknown")

    def test_premium_routes_have_dependencies(self):
        from app.main import app
        cases = [
            ("POST", "/api/chief/chat"),
            ("POST", "/api/household/invite"),
            ("POST", "/api/intake/scan"),
            ("POST", "/api/automation/connect"),
            ("POST", "/api/documents/ask"),
            ("POST", "/api/grocery/meal-plan/generate"),
            ("POST", "/api/bills/negotiation-script"),
            ("POST", "/api/maintenance/diagnose"),
        ]
        for method, path in cases:
            route = next((x for x in app.routes if getattr(x, "path", None) == path
                          and method in getattr(x, "methods", set())), None)
            self.assertIsNotNone(route, f"{path}; routes: {[(x.path, x.methods) for x in app.routes if hasattr(x, 'methods')]}")
            self.assertTrue(any(
                dependency.call and dependency.call.__name__ == "check"
                for dependency in route.dependant.dependencies
            ), path)

if __name__ == "__main__":
    unittest.main()
