from app.services.nvidia_client import get_nvidia_client
import numpy as np

class EmbeddingService:
    def __init__(self):
        self.client = get_nvidia_client()
        self.store = []  # In-memory vector store: list of (embedding, text, metadata)
    
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return self.client.embed(texts)
    
    def add_documents(self, texts: list[str], metadata: list[dict] = None):
        embeddings = self.embed_texts(texts)
        for i, emb in enumerate(embeddings):
            self.store.append((emb, texts[i], metadata[i] if metadata else {}))
    
    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Semantic search using cosine similarity."""
        query_emb = self.embed_texts([query])[0]
        scores = []
        for emb, text, meta in self.store:
            score = np.dot(query_emb, emb) / (np.linalg.norm(query_emb) * np.linalg.norm(emb))
            scores.append((score, text, meta))
        scores.sort(key=lambda x: x[0], reverse=True)
        return [{"score": s, "text": t, "metadata": m} for s,t,m in scores[:top_k]]
    
    def rerank(self, query: str, documents: list[str], top_n: int = 5) -> list[str]:
        """Rerank using NVIDIA rerank model."""
        try:
            rankings = self.client.rerank(query, documents, top_n)
            # Assume rankings is list of {"index": int, "score": float}
            ranked = [documents[r["index"]] for r in sorted(rankings, key=lambda x: x["score"], reverse=True)]
            return ranked[:top_n]
        except:
            # Fallback to simple search
            results = self.search(query, top_n)
            return [r["text"] for r in results]