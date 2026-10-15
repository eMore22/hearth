"""No provider credit or network access needed for these launch-regression tests."""
import asyncio
import unittest
from unittest.mock import patch

from app.services.ai_gateway import AIGateway, AIUnavailable
from app.agents.chief_of_staff_agent import ChiefOfStaffAgent


class GatewayTests(unittest.TestCase):
    def test_disabled_ai_never_calls_network(self):
        gateway = AIGateway()
        with patch("app.services.ai_gateway.settings.AI_ENABLED", False):
            with self.assertRaises(AIUnavailable):
                gateway.generate("Hello")

    def test_fallback_works_without_claude(self):
        gateway = AIGateway()
        with patch.object(gateway, "claude_messages", side_effect=AIUnavailable("off")):
            with patch.object(gateway, "nvidia_complete", return_value="ready") as nvidia:
                self.assertEqual(gateway.generate("Hello", heavy=True), "ready")
                nvidia.assert_called_once()


class ChiefTests(unittest.TestCase):
    def setUp(self):
        self.agent = ChiefOfStaffAgent("test-household", "test-user")
        self.devices = [{"entity_id": "lock.front_door", "friendly_name": "Front Door",
                         "domain": "lock", "is_actionable": True}]

    def test_known_intent_no_llm(self):
        self.assertEqual(asyncio.run(self.agent._classify_intent("Turn off the light")), "smart_home")

    def test_status_question_does_not_open_door(self):
        self.assertIsNone(self.agent._detect_device_command("Is the front door open?", self.devices))

    def test_unlock_does_not_lock(self):
        cmd = self.agent._detect_device_command("Unlock the front door", self.devices)
        self.assertIsNotNone(cmd)
        self.assertEqual(cmd["action"], "unlock")

    def test_bills_read_without_ai(self):
        reply = self.agent._deterministic_reply("show bills", "bills", {
            "bills": [{"provider": "Internet", "due_date": "2026-10-18"}]})
        self.assertIn("Internet", reply)


if __name__ == "__main__":
    unittest.main()
