"""Validate document uploads and private storage references.

Do not trust a client MIME label, path or document-model JSON to authorize
arbitrary files or overwrite server-controlled fields.
"""
import re
from datetime import date
from urllib.parse import unquote, urlsplit

ALLOWED = {
    "application/pdf": (".pdf",),
    "image/jpeg": (".jpg", ".jpeg"),
    "image/png": (".png",),
    "image/webp": (".webp",),
}


def safe_filename(filename: str | None, mime: str) -> str:
    if mime not in ALLOWED:
        raise ValueError("Unsupported document type")
    stem = re.sub(r"[^a-zA-Z0-9._-]", "_", str(filename or "document").replace("\\", "/").split("/")[-1])
    stem = (stem.rsplit(".", 1)[0][:90]).strip("._-") or "document"
    return stem + ALLOWED[mime][0]


def valid_upload(data: bytes, mime: str) -> bool:
    if not data or len(data) > 20 * 1024 * 1024:
        return False
    return {
        "application/pdf": lambda: data.startswith(b"%PDF-"),
        "image/jpeg": lambda: data.startswith(b"\xff\xd8\xff"),
        "image/png": lambda: data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": lambda: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    }.get(mime, lambda: False)()


def storage_path(reference: str | None, household_id: str) -> str | None:
    if not isinstance(reference, str) or not reference:
        return None
    if reference.startswith("storage://documents/"):
        path = reference[len("storage://documents/"):]
    else:
        # Previously stored private files may still have public-style URLs.
        # Read the object path only; never return/use the untrusted host URL.
        parsed = urlsplit(reference)
        legacy = "/storage/v1/object/public/documents/"
        if parsed.scheme != "https" or legacy not in parsed.path:
            return None
        path = unquote(parsed.path.split(legacy, 1)[-1])
    if (not path.startswith(household_id + "/") or
        any(seg in ("", ".", "..") for seg in path.split("/")) or
        any(ch in path for ch in ("\\", "?", "#", "\\x00"))):
        return None
    return path


def clean_extraction(extracted: dict, fallback_filename: str) -> dict:
    """Return only approved extraction keys; validate dates and bound output."""
    if not isinstance(extracted, dict):
        extracted = {}
    result = {}
    for key, cap in [("title", 180), ("document_type", 40), ("issuer", 160),
                     ("holder_name", 140), ("document_number", 100), ("summary", 600)]:
        raw = extracted.get(key)
        result[key] = str(raw).strip()[:cap] if raw is not None else None
    result["title"] = result["title"] or fallback_filename
    types = {"passport", "insurance", "warranty", "lease", "medical",
             "vehicle_registration", "other", "national_id", "driver_license"}
    if result["document_type"] not in types:
        result["document_type"] = "other"
    for key in ("issue_date", "expiry_date"):
        raw = extracted.get(key)
        try:
            parsed = date.fromisoformat(raw) if isinstance(raw, str) and len(raw) == 10 else None
            result[key] = parsed.isoformat() if parsed else None
        except ValueError:
            result[key] = None
    fields = extracted.get("key_fields")
    result["key_fields"] = (
        {str(k)[:60]: str(v)[:200] for k, v in list(fields.items())[:16]
         if isinstance(k, str) and isinstance(v, (str, int, float))}
        if isinstance(fields, dict) else {}
    )
    return result
