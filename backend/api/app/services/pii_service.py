"""Best-effort identification, never use it as a sole security boundary."""
import re
from app.services.ai_gateway import get_ai_gateway, AIUnavailable

def detect_pii(text: str) -> list[dict]:
    values = []
    for kind, pattern in (
        ("email", r"(?<![\\w.])[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}"),
        ("phone", r"(?<!\\w)\\+?\\d[\\d ()-]{7,}\\d(?!\\w)"),
    ):
        for hit in re.finditer(pattern, text):
            values.append({"type": kind, "value": hit.group(0)})
    try:
        values.extend(get_ai_gateway().nvidia_detect_pii(text))
    except AIUnavailable:
        pass
    return [x for x in values if isinstance(x, dict) and isinstance(x.get("value"), str)]

def redact_pii(text: str) -> str:
    redacted = text
    for item in sorted(detect_pii(text), key=lambda x: len(x["value"]), reverse=True):
        redacted = redacted.replace(item["value"], "[REDACTED]")
    return redacted
