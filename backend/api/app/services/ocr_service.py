from app.services.ai_gateway import get_ai_gateway, AIUnavailable

def perform_ocr(image_bytes: bytes) -> str:
    """Optional vision enhancement; core document storage does not require it."""
    try:
        return get_ai_gateway().nvidia_ocr(image_bytes)
    except AIUnavailable:
        return ""
