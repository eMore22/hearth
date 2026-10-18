"""Mono Sandbox expiry cleanup is fail-closed, retryable, and limited to Mono."""
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace
from app.workers.finance_sandbox_cleanup import expire_mono_sandbox_connections

RECORD = {
    "id": "5525a7e8-9cbe-47dd-ab02-3ee18c7c5fd1",
    "owner_user_id": "owner",
    "household_id": "house",
}

class Query:
    def __init__(self, db):
        self.db = db
        self.status = None
        self.country = None
        self.provider = None
        self.deleting = False
    def select(self, *args): return self
    def eq(self, key, val):
        if key == "status": self.status = val
        if key == "country_code": self.country = val
        if key == "provider": self.provider = val
        return self
    def lt(self, *args): return self
    def limit(self, *args): return self
    @property
    def not_(self): return self
    def is_(self, *args): return self
    def delete(self):
        self.deleting = True
        return self
    def execute(self):
        self.db.calls.append((self.provider, self.country, self.status, self.deleting))
        if self.provider != "mono" or self.country != "NG":
            raise AssertionError("Must never touch another banking provider")
        if self.deleting:
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=[dict(RECORD)] if self.status in self.db.present else [])


class DB:
    def __init__(self, present=("linked",)):
        self.present = present
        self.calls = []
    def table(self, name):
        if name != "finance_connections": raise AssertionError("unexpected table")
        return Query(self)


class MonoExpiryTests(unittest.TestCase):
    def test_not_configured_never_touches_database(self):
        with patch("app.services.mono_connect_link.config_ready", return_value=False):
            with patch("app.workers.finance_sandbox_cleanup.get_supabase_admin") as db:
                result = expire_mono_sandbox_connections.run()
        self.assertEqual(result, {"status": "not_configured"})
        db.assert_not_called()

    def test_expired_link_remote_unlink_and_pending_prune(self):
        db = DB()
        with patch("app.services.mono_connect_link.config_ready", return_value=True):
            with patch("app.workers.finance_sandbox_cleanup.get_supabase_admin", return_value=db):
                with patch("app.services.mono_connect_link.revoke", new_callable=AsyncMock) as revoke:
                    result = expire_mono_sandbox_connections.run()
        self.assertEqual(result, {"completed": 1, "failed": 0})
        revoke.assert_awaited_once_with(user_id="owner", household_id="house",
                                        connection_id=RECORD["id"])
        self.assertIn(("mono", "NG", "pending", True), db.calls)

    def test_remote_failure_leaves_item_retryable(self):
        db = DB(present=("error",))
        with patch("app.services.mono_connect_link.config_ready", return_value=True):
            with patch("app.workers.finance_sandbox_cleanup.get_supabase_admin", return_value=db):
                with patch("app.services.mono_connect_link.revoke", new_callable=AsyncMock,
                           side_effect=RuntimeError("transient provider outage")):
                    result = expire_mono_sandbox_connections.run()
        self.assertEqual(result, {"completed": 0, "failed": 1})


if __name__ == "__main__":
    unittest.main()
