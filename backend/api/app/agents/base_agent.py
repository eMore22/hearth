import json
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
        self._nvidia_client = None

    @property
    def nvidia_client(self):
        """Return a shared NVIDIA client, initialising on first use."""
        if self._nvidia_client is None:
            try:
                from app.services.nvidia_client import get_nvidia_client
                self._nvidia_client = get_nvidia_client()
            except Exception:
                self._nvidia_client = None
        return self._nvidia_client

    def load_household_context(self) -> Dict[str, Any]:
        return {}

    @abstractmethod
    def run(self, input_data: Any) -> Any:
        pass

    def ask_claude(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 1024
    ) -> str:
        """
        Try Anthropic first. If credits are low or unavailable,
        fall back to NVIDIA free endpoint. If both fail, return
        a safe JSON error string so callers never crash.
        """
        messages = [{"role": "user", "content": prompt}]
        kwargs = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system

        # --- Try Anthropic ---
        try:
            response = self.client.messages.create(**kwargs)
            return response.content[0].text
        except Exception as anthropic_error:
            print(f"⚠️ Anthropic unavailable: {anthropic_error}. Trying NVIDIA fallback...")

        # --- Try NVIDIA fallback ---
        try:
            if self.nvidia_client:
                result = self.nvidia_client.complete(
                    task="simple_chat",
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.3
                )
                if result:
                    return result
        except Exception as nvidia_error:
            print(f"⚠️ NVIDIA fallback also failed: {nvidia_error}")

        # --- Both failed — return safe fallback ---
        return json.dumps({
            "error": "AI model temporarily unavailable",
            "message": "Both Anthropic and NVIDIA endpoints are currently unreachable. Please try again shortly."
        })

    def ask_nvidia(
        self,
        task: str,
        messages: list,
        max_tokens: int = 1024,
        temperature: float = 0.3
    ) -> str:
        """Use the NVIDIA model directly — bypasses Anthropic entirely."""
        try:
            if self.nvidia_client:
                result = self.nvidia_client.complete(
                    task=task,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                if result:
                    return result
        except Exception as e:
            print(f"⚠️ NVIDIA direct call failed: {e}")

        return json.dumps({"error": "NVIDIA client unavailable"})

    def log_action(
        self,
        action: str,
        result: Any,
        metadata: Optional[Dict] = None
    ):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "household_id": self.household_id,
            "user_id": self.user_id,
            "action": action,
            "result": str(result)[:500],
            "metadata": metadata or {}
        }
        self.action_log.append(entry)
        return entry