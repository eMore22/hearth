import json
import re
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, Optional
from app.services.ai_gateway import get_ai_gateway, AIUnavailable
from app.dependencies import get_supabase_admin


class BaseHouseholdAgent(ABC):
    """
    Base class for all Hearth agents.
    Provides smart routing between Claude (heavy) and NVIDIA (light).
    """

    def __init__(self, household_id: str, user_id: str):
        self.household_id = household_id
        self.user_id = user_id
        self.gateway = get_ai_gateway()
        self.context: Dict[str, Any] = {}
        self.action_log: list = []
        self._nvidia_client = None

    @property
    def nvidia_client(self):
        """Legacy agent access is still routed through the shared AI gateway."""
        return self.gateway.nvidia_client

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

    def _get_household_country(self) -> Optional[str]:
        """
        Looks up this household's country. Returns None if there's no
        household_id or no country set — callers should treat that as
        "no location data," not default to any specific country.
        Shared across agents (previously duplicated only in GroceryAgent).
        """
        if not self.household_id:
            return None
        supabase = get_supabase_admin()
        try:
            result = supabase.table("households")\
                .select("country")\
                .eq("id", self.household_id)\
                .maybe_single()\
                .execute()
            if result.data:
                country = result.data.get("country")
                return country.strip() if country else None
            return None
        except Exception:
            return None

    def _get_household_currency(self) -> Optional[str]:
        """
        Looks up this household's own currency (set directly, or derived
        from Country at creation time — see country.ts on the frontend).
        Returns None rather than assuming any specific currency, so callers
        can apply their own last-resort fallback deliberately.
        """
        if not self.household_id:
            return None
        supabase = get_supabase_admin()
        try:
            result = supabase.table("households")\
                .select("currency")\
                .eq("id", self.household_id)\
                .maybe_single()\
                .execute()
            if result.data:
                currency = result.data.get("currency")
                return currency.strip() if currency else None
            return None
        except Exception:
            return None

    def _get_household_timezone(self) -> str:
        """
        Looks up this household's IANA timezone. Defaults to UTC for
        households created before timezone selection existed.
        """
        if not self.household_id:
            return "UTC"
        supabase = get_supabase_admin()
        try:
            result = supabase.table("households")\
                .select("timezone")\
                .eq("id", self.household_id)\
                .maybe_single()\
                .execute()
            if result.data:
                tz = result.data.get("timezone")
                return tz.strip() if tz else "UTC"
            return "UTC"
        except Exception:
            return "UTC"

    def load_household_context(self) -> Dict[str, Any]:
        """Override in subclasses to load relevant household data."""
        return {}

    @abstractmethod
    def run(self, input_data: Any) -> Any:
        pass

    # All providers, retries, timeouts and circuit breakers live in ai_gateway.
    AI_OFF_MESSAGE = (
        "Advanced AI is temporarily unavailable. I can still help you manage "
        "bills, documents, groceries, tasks and smart home devices."
    )

    def ask_claude(self, prompt: str, system: Optional[str] = None,
                   max_tokens: int = 1024) -> str:
        try:
            return self.gateway.generate(prompt, system=system, heavy=True,
                                         max_tokens=max_tokens)
        except AIUnavailable:
            return self.AI_OFF_MESSAGE

    def ask_light(self, prompt: str, max_tokens: int = 512,
                  temperature: float = 0.3) -> str:
        try:
            return self.gateway.generate(prompt, max_tokens=max_tokens,
                                         temperature=temperature, heavy=False)
        except AIUnavailable:
            return self.AI_OFF_MESSAGE

    def ask(self, prompt: str, heavy: bool = False,
            system: Optional[str] = None, max_tokens: int = 800) -> str:
        try:
            return self.gateway.generate(prompt, heavy=heavy, system=system,
                                         max_tokens=max_tokens)
        except AIUnavailable:
            return self.AI_OFF_MESSAGE

    def ask_nvidia(self, task: str, messages: list, max_tokens: int = 1024,
                   temperature: float = 0.3) -> str:
        try:
            return self.gateway.nvidia_complete(task, messages, max_tokens, temperature)
        except AIUnavailable:
            return self.AI_OFF_MESSAGE

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