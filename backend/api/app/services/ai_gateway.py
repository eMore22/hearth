"""Single outbound provider boundary for Hearth's optional AI features.

Core household storage, reminders, actions and queries must never depend on this
module. All network provider calls are bounded and use a per-process circuit
breaker to avoid continually charging or timing out during outages.
"""
import logging
import time
from functools import lru_cache
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class AIUnavailable(Exception):
    """No usable model is currently available."""


class AIGateway:
    def __init__(self):
        self._anthropic = None
        self._nvidia = None
        self._blocked_until = {"claude": 0.0, "nvidia": 0.0}

    def _ready(self, provider: str) -> bool:
        if not settings.AI_ENABLED or time.monotonic() < self._blocked_until[provider]:
            return False
        key = settings.ANTHROPIC_API_KEY if provider == "claude" else settings.NVIDIA_API_KEY
        return bool(key and key.strip() and not key.startswith("your-"))

    @property
    def nvidia_client(self):
        if not self._ready("nvidia"):
            return None
        if self._nvidia is None:
            from app.services.nvidia_client import get_nvidia_client
            self._nvidia = get_nvidia_client()
        return self._nvidia

    def _claude(self):
        if not self._ready("claude"):
            raise AIUnavailable("Claude unavailable")
        if self._anthropic is None:
            from anthropic import Anthropic
            self._anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY,
                                        timeout=18.0, max_retries=1)
        return self._anthropic

    def claude_messages(self, **kwargs):
        try:
            return self._claude().messages.create(**kwargs)
        except Exception as exc:
            self._blocked_until["claude"] = time.monotonic() + 60.0
            logger.warning("Hearth AI provider temporarily unavailable: claude (%s)", type(exc).__name__)
            raise AIUnavailable("Claude unavailable") from exc

    def nvidia_complete(self, task: str, messages: list, max_tokens: int = 512,
                        temperature: float = 0.3) -> str:
        try:
            client = self.nvidia_client
            if client is None:
                raise AIUnavailable("NVIDIA unavailable")
            return client.complete(task=task, messages=messages,
                                   max_tokens=max_tokens, temperature=temperature)
        except Exception as exc:
            self._blocked_until["nvidia"] = time.monotonic() + 60.0
            logger.warning("Hearth AI provider temporarily unavailable: nvidia (%s)", type(exc).__name__)
            raise AIUnavailable("NVIDIA unavailable") from exc

    def nvidia_ocr(self, image_bytes: bytes) -> str:
        try:
            client = self.nvidia_client
            if client is None:
                raise AIUnavailable("NVIDIA unavailable")
            return client.ocr(image_bytes)
        except Exception as exc:
            self._blocked_until["nvidia"] = time.monotonic() + 60.0
            logger.warning("Hearth AI vision temporarily unavailable (%s)", type(exc).__name__)
            raise AIUnavailable("NVIDIA vision unavailable") from exc

    def nvidia_embed(self, texts: list) -> list:
        try:
            client = self.nvidia_client
            if client is None:
                raise AIUnavailable("Embeddings unavailable")
            return client.embed(texts)
        except Exception as exc:
            self._blocked_until["nvidia"] = time.monotonic() + 60.0
            raise AIUnavailable("Embeddings unavailable") from exc

    def nvidia_detect_pii(self, value: str) -> list:
        try:
            client = self.nvidia_client
            if client is None:
                raise AIUnavailable("PII provider unavailable")
            return client.detect_pii(value)
        except Exception as exc:
            self._blocked_until["nvidia"] = time.monotonic() + 60.0
            raise AIUnavailable("PII provider unavailable") from exc

    def generate(self, prompt: str, *, system: Optional[str] = None, heavy: bool = False,
                 max_tokens: int = 800, temperature: float = 0.3) -> str:
        messages = [{"role": "user", "content": prompt}]
        providers = ("claude", "nvidia") if heavy else ("nvidia", "claude")
        for provider in providers:
            try:
                if provider == "claude":
                    kwargs = {"model": settings.CLAUDE_MODEL,
                              "max_tokens": max_tokens, "messages": messages}
                    if system:
                        kwargs["system"] = system
                    response = self.claude_messages(**kwargs)
                    content = response.content[0].text
                else:
                    nvidia_messages = ([{"role": "system", "content": system}] if system else []) + messages
                    content = self.nvidia_complete("reasoning" if heavy else "simple_chat",
                                                   nvidia_messages, max_tokens, temperature)
                if content and content.strip():
                    return content
            except AIUnavailable:
                continue
        raise AIUnavailable("Advanced AI is temporarily unavailable")


@lru_cache(maxsize=1)
def get_ai_gateway() -> AIGateway:
    return AIGateway()
