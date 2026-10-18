"""Chief chat never automatically actuates locks, doors or valves."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from app.routers.chief_of_staff import chat


class FakeQuery:
    def select(self, *args):
        return self
    def eq(self, *args):
        return self
    def order(self, *args, **kwargs):
        return self
    def limit(self, *args):
        return self
    def insert(self, *args):
        return self
    def execute(self):
        return SimpleNamespace(data=[])


class FakeDB:
    def table(self, name):
        return FakeQuery()


class FakeRequest:
    async def json(self):
        return {"message":"Unlock the front door"}


class TestChatSafety(unittest.IsolatedAsyncioTestCase):
    async def test_device_request_requires_confirmed_tap(self):
        command = {"entity_id": "lock.front_door", "action": "unlock"}
        async def respond(self, **kwargs):
            return {"message":"Sending device command.",
                    "category":"smart_home", "device_command":command,
                    "actions_taken":[], "proactive_suggestions":[]}
        context = {"smart_home_connected":False, "ha_devices":[],
                   "source_status":{"ha_devices":"available"}}
        with patch("app.routers.chief_of_staff.get_supabase_admin",return_value=FakeDB()), \
             patch("app.routers.chief_of_staff.load_household_context",return_value=context), \
             patch("app.routers.chief_of_staff.ChiefOfStaffAgent.process_chat",new=respond), \
             patch("app.routers.chief_of_staff._execute_device_command",new=AsyncMock()) as execute, \
             patch("app.routers.chief_of_staff.log_event"):
            response = await chat(FakeRequest(),current_user={"id":"person","household_id":"home"})
        self.assertTrue(response["device_confirmation_required"])
        self.assertIn("haven't changed",response["message"])
        self.assertNotIn("device_command",response)
        execute.assert_not_awaited()


if __name__=="__main__":
    unittest.main()
