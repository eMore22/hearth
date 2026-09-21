"""
Unified client for NVIDIA NIM endpoints (OpenAI-compatible).
Usage:
    from app.services.nvidia_client import get_nvidia_client
    client = get_nvidia_client()
    text = client.complete(task="simple_chat", messages=[...])
"""

import json
import base64
from functools import lru_cache
from typing import Optional
from openai import OpenAI
from app.config import settings


class NvidiaClient:
    def __init__(self, api_key: str):
        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key
        )

        # meta/llama-3.1-8b-instruct reached end-of-life on NVIDIA NIM on
        # 2026-08-26 (confirmed absent from the live model catalog) and was
        # returning HTTP 410 on every call — silently forcing every "light"
        # call onto full-price Claude for weeks. Replaced with
        # mistralai/mistral-nemotron, confirmed live on the current catalog
        # and NVIDIA-post-trained specifically for instruction following and
        # function calling — a good fit for classify_intent()'s single-word
        # output requirement.
        self.models = {
            "simple_chat":    "mistralai/mistral-nemotron",
            "intent":         "mistralai/mistral-nemotron",
            "reasoning":      "nvidia/llama-3.1-nemotron-70b-instruct",
            "vision":         "microsoft/phi-3-vision-128k-instruct",
            "ocr":            "microsoft/phi-3-vision-128k-instruct",
            "embed":          "nvidia/nv-embedqa-e5-v5",
            # Not found in the current live catalog either — unconfirmed,
            # not yet hit in logs. Watch for the same 410 pattern here next.
            "content_safety": "meta/llama-guard-3-8b",
        }

    def get_model(self, task: str) -> str:
        return self.models.get(task, self.models["simple_chat"])

    def complete(
        self,
        task: str,
        messages: list,
        max_tokens: int = 1024,
        temperature: float = 0.3,
        **kwargs
    ) -> str:
        """Simple text completion. Returns string or raises."""
        model = self.get_model(task)
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )
        return response.choices[0].message.content

    def ocr(self, image_bytes: bytes) -> str:
        """Extract text from an image using vision model."""
        model = self.get_model("vision")
        img_b64 = base64.b64encode(image_bytes).decode()
        response = self.client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}
                    },
                    {
                        "type": "text",
                        "text": "Extract all text from this document image exactly as it appears."
                    }
                ]
            }],
            max_tokens=1024
        )
        return response.choices[0].message.content

    def classify_intent(self, text: str) -> str:
        """
        Classify user intent into one of:
        documents, bills, grocery, maintenance, health, general
        """
        response = self.client.chat.completions.create(
            model=self.get_model("intent"),
            messages=[{
                "role": "user",
                "content": (
                    "Classify this request into exactly one category: "
                    "documents, bills, grocery, maintenance, health, general.\n"
                    "Only output the single category word, nothing else.\n"
                    f"Request: {text}"
                )
            }],
            max_tokens=10,
            temperature=0
        )
        return response.choices[0].message.content.strip().lower()

    def embed(self, texts: list) -> list:
        """Generate embeddings for a list of texts."""
        model = self.get_model("embed")
        embeddings = []
        for text in texts:
            resp = self.client.embeddings.create(
                model=model,
                input=text,
                encoding_format="float"
            )
            embeddings.append(resp.data[0].embedding)
        return embeddings

    def detect_pii(self, text: str) -> list:
        """Detect PII in text. Returns list of {type, value} dicts."""
        response = self.client.chat.completions.create(
            model=self.get_model("simple_chat"),
            messages=[{
                "role": "user",
                "content": (
                    "Identify any personally identifiable information (PII) in this text. "
                    "Return ONLY a JSON array with objects containing 'type' and 'value'. "
                    "If no PII found return empty array [].\n"
                    f"Text: {text}"
                )
            }],
            max_tokens=500,
            temperature=0
        )
        try:
            content = response.choices[0].message.content
            content = content.replace("```json", "").replace("```", "").strip()
            return json.loads(content)
        except Exception:
            return []

    # Voice stubs — implement when endpoints are stable
    def speech_to_text(self, audio_bytes: bytes) -> str:
        return ""

    def text_to_speech(self, text: str) -> bytes:
        return b""


@lru_cache()
def get_nvidia_client() -> Optional[NvidiaClient]:
    """
    Returns NvidiaClient if NVIDIA_API_KEY is set, otherwise None.
    Cached so only one instance is created.
    """
    api_key = getattr(settings, "NVIDIA_API_KEY", None)
    if not api_key or api_key == "your-nvidia-api-key":
        return None
    try:
        return NvidiaClient(api_key=api_key)
    except Exception as e:
        print(f"⚠️ Could not initialise NVIDIA client: {e}")
        return None
