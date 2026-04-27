"""
Unified client for NVIDIA NIM endpoints (OpenAI‑compatible).
Usage:
    from app.services.nvidia_client import get_nvidia_client
    client = get_nvidia_client()
    response = client.chat.completions.create(
        model="nvidia/nemotron-3-nano-30b-instruct",
        messages=[...]
    )
"""

import os
from openai import OpenAI
from functools import lru_cache
from typing import Optional
from app.config import settings

class NvidiaClient:
    def __init__(self, api_key: str):
        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key
        )
        # Map our internal task names to actual NVIDIA model IDs
        self.models = {
            "intent": "nvidia/nemotron-3-nano-30b-instruct",
            "simple_chat": "nvidia/nemotron-3-nano-30b-instruct",
            "vision": "nvidia/llama-3.2-90b-vision-instruct",
            "ocr": "nvidia/nemotron-ocr-v1",
            "embed": "nvidia/llama-nemotron-embed-1b-v2",
            "rerank": "nvidia/llama-3.2-nv-rerankqa-1b-v2",
            "content_safety": "nvidia/nemotron-3-content-safety",
            "voice_stt": "nvidia/nemotron-asr-streaming",   # placeholder
            "voice_tts": "nvidia/magpie-tts-zeroshot",     # placeholder
            "translate": "nvidia/riva-translate-4b",
        }

    def get_model(self, task: str) -> str:
        """Return the model ID for a given task. Falls back to a default."""
        return self.models.get(task, self.models["simple_chat"])

    def complete(self, task: str, messages: list, max_tokens=1024, temperature=0.3, **kwargs):
        """Simple completion wrapper."""
        model = self.get_model(task)
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )
        return response.choices[0].message.content

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        model = self.get_model("embed")
        # NVIDIA's embedding endpoint may differ; adjust as needed
        embeddings = []
        for text in texts:
            resp = self.client.embeddings.create(
                model=model,
                input=text,
                encoding_format="float"
            )
            embeddings.append(resp.data[0].embedding)
        return embeddings

    def rerank(self, query: str, documents: list[str], top_n: int = 5) -> list[dict]:
        """Rerank documents using NVIDIA rerank model."""
        model = self.get_model("rerank")
        # The API likely expects a specific format; this is a simplified version.
        # You may need to adjust based on NVIDIA's actual API (may use /v1/ranking).
        # For now we use a compatibility wrapper.
        response = self.client.post(
            "/v1/ranking",
            json={
                "model": model,
                "query": {"text": query},
                "documents": [{"text": doc} for doc in documents],
                "top_n": top_n
            }
        )
        return response.json()["rankings"]

    def ocr(self, image_bytes: bytes) -> str:
        """Extract text from an image using NVIDIA OCR."""
        model = self.get_model("ocr")
        # Convert bytes to base64 for the API
        import base64
        img_b64 = base64.b64encode(image_bytes).decode()
        response = self.client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                    {"type": "text", "text": "Extract all text from this image."}
                ]
            }],
            max_tokens=1024
        )
        return response.choices[0].message.content

    def classify_intent(self, text: str) -> str:
        """Classify intent into one of: documents, bills, grocery, maintenance, health, general."""
        model = self.get_model("intent")
        response = self.client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": f"Classify this request into one category: documents, bills, grocery, maintenance, health, general. Only output the category.\nRequest: {text}"
            }],
            max_tokens=10,
            temperature=0
        )
        return response.choices[0].message.content.strip().lower()

    def detect_pii(self, text: str) -> list[dict]:
        """Detect PII using NVIDIA GLiNER (or a compatible model). Placeholder."""
        # NVIDIA may not have a direct GLiNER endpoint; we'll use a generic approach.
        # For production, consider running local GLiNER.
        model = self.get_model("simple_chat")
        prompt = f"Identify any personally identifiable information (PII) in this text. Return JSON list with type and value.\nText: {text}"
        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0
        )
        import json
        try:
            return json.loads(response.choices[0].message.content)
        except:
            return []

    # Voice stubs – implement when endpoints available
    def speech_to_text(self, audio_bytes: bytes) -> str:
        """Convert speech audio to text."""
        # TODO: implement with nemotron-asr-streaming
        return ""

    def text_to_speech(self, text: str) -> bytes:
        """Convert text to speech audio."""
        # TODO: implement with magpie-tts-zeroshot
        return b""

@lru_cache()
def get_nvidia_client() -> NvidiaClient:
    return NvidiaClient(api_key=settings.NVIDIA_API_KEY)