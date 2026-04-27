from app.services.nvidia_client import get_nvidia_client

def perform_ocr(image_bytes: bytes) -> str:
    """
    Extract text from an image using NVIDIA OCR.
    Falls back to empty string on failure.
    """
    try:
        client = get_nvidia_client()
        return client.ocr(image_bytes)
    except Exception as e:
        print(f"OCR failed: {e}")
        return ""