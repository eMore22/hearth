"""
For production, consider running GLiNER locally for zero‑latency, total privacy.
Example: from gliner import GLiNER; model = GLiNER.from_pretrained("urchade/gliner_base")
This service uses a generic NVIDIA model as a fallback.
"""
from app.services.nvidia_client import get_nvidia_client

def detect_pii(text: str) -> list[dict]:
    client = get_nvidia_client()
    return client.detect_pii(text)

def redact_pii(text: str) -> str:
    """Replace detected PII with [REDACTED]."""
    pii_list = detect_pii(text)
    redacted = text
    for item in pii_list:
        redacted = redacted.replace(item["value"], "[REDACTED]")
    return redacted