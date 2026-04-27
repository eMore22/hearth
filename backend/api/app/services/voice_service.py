from app.services.nvidia_client import get_nvidia_client

class VoiceService:
    def __init__(self):
        self.client = get_nvidia_client()
    
    def transcribe(self, audio_bytes: bytes) -> str:
        return self.client.speech_to_text(audio_bytes)
    
    def synthesize(self, text: str) -> bytes:
        return self.client.text_to_speech(text)