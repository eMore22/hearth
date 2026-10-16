"""The no-credit Claude path must favor a free, catalog-listed NVIDIA NIM."""
import unittest
from unittest.mock import Mock, patch
from app.services.ai_gateway import AIGateway
from app.services.nvidia_client import NvidiaClient

class NvidiaHostedModelsTests(unittest.TestCase):
    def test_reasoning_uses_free_hosted_model(self):
        client = object.__new__(NvidiaClient)
        with patch("app.services.nvidia_client.settings.NVIDIA_REASONING_MODEL", ""):
            self.assertEqual(client.get_model("reasoning"), "nvidia/nemotron-3-super-120b-a12b")
            self.assertEqual(client.get_model("intent"), "mistralai/mistral-nemotron")

    def test_reasoning_override_is_allowed(self):
        client = object.__new__(NvidiaClient)
        with patch("app.services.nvidia_client.settings.NVIDIA_REASONING_MODEL", "catalog/custom"):
            self.assertEqual(client.get_model("reasoning"), "catalog/custom")
            self.assertEqual(client.get_model("intent"), "mistralai/mistral-nemotron")

    def test_chief_prefers_nvidia_without_waiting_for_claude(self):
        gateway = AIGateway()
        gateway.nvidia_complete = Mock(return_value="Grounded household summary")
        gateway.claude_messages = Mock(side_effect=AssertionError("Claude invoked despite NVIDIA success"))
        self.assertEqual(gateway.generate("Summarize bills", heavy=True), "Grounded household summary")
        gateway.nvidia_complete.assert_called_once()
        gateway.claude_messages.assert_not_called()

if __name__ == "__main__":
    unittest.main()
