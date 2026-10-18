"""Home Assistant status: saved configuration is not proof of live reachability."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.routers.automation import get_ha_status


class Query:
    def __init__(self, row=None, count=0):
        self.row = row
        self.count = count

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return SimpleNamespace(data=self.row, count=self.count)


class FakeDB:
    def __init__(self, connected=True):
        self.connection = Query({
            "ha_instance_url": "https://example.invalid",
            "ha_access_token": "NOT-FOR-USER-RESPONSES",
            "ha_connected_at": "2026-10-01T21:57:34Z",
            "last_sync_at": "2026-10-01T23:15:11Z",
        } if connected else None)
        self.devices = Query(count=7)

    def table(self, name):
        return self.connection if name == "ha_connections" else self.devices


class HomeAssistantStatusTests(unittest.IsolatedAsyncioTestCase):
    async def check_status(self, connected, reachable):
        db = FakeDB(connected=connected)
        bridge = MagicMock()
        bridge.ping = AsyncMock(return_value=reachable)
        with patch("app.routers.automation.get_supabase_admin", return_value=db):
            with patch("app.routers.automation.build_ha_bridge", return_value=bridge):
                result = await get_ha_status(current_user={"household_id": "mine"})
        self.assertNotIn("ha_access_token", result)
        self.assertNotIn("NOT-FOR-USER-RESPONSES", str(result))
        return result, bridge

    async def test_stale_simulator_is_configured_but_offline(self):
        result, bridge = await self.check_status(connected=True, reachable=False)
        self.assertTrue(result["connected"])
        self.assertFalse(result["reachable"])
        self.assertEqual(result["device_count"], 7)
        self.assertEqual(result["last_sync_at"], "2026-10-01T23:15:11Z")
        bridge.ping.assert_awaited_once()

    async def test_live_instance_is_reachable(self):
        result, bridge = await self.check_status(connected=True, reachable=True)
        self.assertTrue(result["connected"])
        self.assertTrue(result["reachable"])
        bridge.ping.assert_awaited_once()

    async def test_no_connection_is_not_online(self):
        result, bridge = await self.check_status(connected=False, reachable=True)
        self.assertEqual(result, {"connected": False, "reachable": False})
        bridge.ping.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
