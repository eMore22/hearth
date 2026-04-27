from app.services.embed_service import EmbeddingService

class RAGService:
    def __init__(self):
        self.embed_service = EmbeddingService()
    
    def add_household_data(self, texts: list[str], metadata: list[dict] = None):
        self.embed_service.add_documents(texts, metadata)
    
    def retrieve_context(self, query: str, top_k: int = 5) -> str:
        results = self.embed_service.search(query, top_k)
        if not results:
            return ""
        context = "Relevant household information:\n" + "\n".join(
            f"• {r['text']}" for r in results
        )
        return context