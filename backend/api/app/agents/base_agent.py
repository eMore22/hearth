import json
import re
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, Optional
from anthropic import Anthropic
from app.config import settings


class BaseHouseholdAgent(ABC):
    """
    Base class for all Hearth agents.
    Provides smart routing between Claude (heavy) and NVIDIA (light).
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
        """Return shared NVIDIA client, initialising on first use."""
        if self._nvidia_client is None:
            try:
                from app.services.nvidia_client import get_nvidia_client
                self._nvidia_client = get_nvidia_client()
            except Exception:
                self._nvidia_client = None
        return self._nvidia_client

    @staticmethod
    def _extract_json(text: str) -> str:
        """
        Pull a JSON object/array out of a Claude response even if it added
        stray prose around it. Agents are told to return ONLY JSON, but this
        makes parsing resilient instead of failing on the first character
        that isn't '{'. Shared across all agents so every diagnose/triage
        call gets the same protection.
        """
        cleaned = text.replace("```json", "").replace("```", "").strip()
        match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        return match.group(1) if match else cleaned

    def load_household_context(self) -> Dict[str, Any]:
        """Override in subclasses to load relevant household data."""
        return {}

    @abstractmethod
    def run(self, input_data: Any) -> Any:
        pass

    # ── HEAVY: Claude for complex reasoning ──────────────────────────────────
    def ask_claude(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 1024
    ) -> str:
        """
        Use Claude for complex tasks.
        Falls back to NVIDIA if credits run out.
        """
        messages = [{"role": "user", "content": prompt}]
        kwargs = {
            "model": "claude-sonnet-4-6",
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system

        try:
            response = self.client.messages.create(**kwargs)
            self.log_action("claude_call", "success", {"max_tokens": max_tokens})
            return response.content[0].text
        except Exception as e:
            print(f"⚠️ Claude failed: {str(e)[:120]}. Falling back to NVIDIA...")
            return self.ask_light(prompt, max_tokens=max_tokens)

    # ── LIGHT: NVIDIA for fast cheap tasks ───────────────────────────────────
    def ask_light(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.3
    ) -> str:
        """
        Use NVIDIA for lightweight tasks.
        Falls back to Claude if NVIDIA fails.
        """
        if not self.nvidia_client:
            return self.ask_claude(prompt, max_tokens=max_tokens)

        try:
            result = self.nvidia_client.complete(
                task="simple_chat",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature
            )
            self.log_action("nvidia_call", "success")
            return result or json.dumps({"error": "Empty response from NVIDIA"})
        except Exception as e:
            print(f"⚠️ NVIDIA failed: {e}. Falling back to Claude...")
            try:
                messages = [{"role": "user", "content": prompt}]
                response = self.client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=max_tokens,
                    messages=messages,
                )
                return response.content[0].text
            except Exception:
                return json.dumps({"error": "Both AI providers temporarily unavailable"})

    # ── SMART ROUTER ─────────────────────────────────────────────────────────
    def ask(
        self,
        prompt: str,
        heavy: bool = False,
        system: Optional[str] = None,
        max_tokens: int = 800
    ) -> str:
        """
        Smart router — pick the right model automatically.
        heavy=True  → Claude  (reasoning, memory, quality output)
        heavy=False → NVIDIA  (speed, cost efficiency)
        """
        if heavy:
            return self.ask_claude(prompt, system=system, max_tokens=max_tokens)
        else:
            return self.ask_light(prompt, max_tokens=max_tokens)

    # ── LEGACY: direct NVIDIA call ────────────────────────────────────────────
    def ask_nvidia(
        self,
        task: str,
        messages: list,
        max_tokens: int = 1024,
        temperature: float = 0.3
    ) -> str:
        """Direct NVIDIA call for specific tasks (vision, OCR, rerank)."""
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
