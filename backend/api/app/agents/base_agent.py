from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, Optional
from anthropic import Anthropic
from app.config import settings


class BaseHouseholdAgent(ABC):
    """
    Base class for all Hearth module agents.
    Every agent knows which household it belongs to,
    loads relevant context, and logs every action it takes.
    """

    def __init__(self, household_id: str, user_id: str):
        self.household_id = household_id
        self.user_id = user_id
        self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.context: Dict[str, Any] = {}
        self.action_log: list = []

    def load_household_context(self) -> Dict[str, Any]:
        """
        Override in each module agent to load
        relevant household data before running.
        """
        return {}

    @abstractmethod
    def run(self, input_data: Any) -> Any:
        """
        Core logic for this agent module.
        Must be implemented by every subclass.
        """
        pass

    def ask_claude(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 1024
    ) -> str:
        """Shared Claude API call for all agents."""
        messages = [{"role": "user", "content": prompt}]
        kwargs = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system

        response = self.client.messages.create(**kwargs)
        return response.content[0].text

    def log_action(
        self,
        action: str,
        result: Any,
        metadata: Optional[Dict] = None
    ):
        """
        Log every agent action with timestamp.
        Logged to memory for now — persisted to DB in each module's router.
        """
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "household_id": self.household_id,
            "user_id": self.user_id,
            "action": action,
            "result": str(result)[:500],  # truncate for log safety
            "metadata": metadata or {}
        }
        self.action_log.append(entry)
        return entry
