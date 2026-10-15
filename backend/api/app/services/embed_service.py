"""Deterministic document text retrieval with optional semantic upgrades."""
import re
from app.services.ai_gateway import get_ai_gateway, AIUnavailable

def _tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{2,}", value.casefold()))

class EmbeddingService:
    def __init__(self):
        self.store = []

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        try:
            return get_ai_gateway().nvidia_embed(texts)
        except AIUnavailable:
            return []

    def add_documents(self, texts: list[str], metadata: list[dict] = None):
        for i, text in enumerate(texts):
            self.store.append((text, (metadata[i] if metadata and i < len(metadata) else {})))

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        q = _tokens(query)
        scored = []
        for value, metadata in self.store:
            words = _tokens(value)
            score = len(q & words) / max(len(q), 1)
            scored.append({"score": score, "text": value, "metadata": metadata})
        scored.sort(key=lambda r: r["score"], reverse=True)
        return scored[:max(top_k, 0)]

    def rerank(self, query: str, documents: list[str], top_n: int = 5) -> list[str]:
        q = _tokens(query)
        return sorted(documents, key=lambda value: len(q & _tokens(value)), reverse=True)[:max(top_n, 0)]
