import json
from datetime import datetime, date
from typing import Any, Dict, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.config import settings


class DocumentAgent(BaseHouseholdAgent):
    """
    Document Vault & Expiry Agent using Claude Vision
    """

    SYSTEM_PROMPT = """You are Hearth's Document Agent.
You help households manage their important documents.
You extract structured information from documents and answer questions about them.
Always respond in valid JSON when asked to extract data.
Be precise, helpful, and concise."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "extract":
            return self.extract_document(input_data["image_bytes"])
        elif action == "answer":
            return self.answer_question(input_data["question"], input_data.get("documents", []))
        elif action == "check_expiries":
            return self.check_expiries(input_data["documents"])
        else:
            raise ValueError(f"Unknown action: {action}")

    def extract_document(self, image_bytes: bytes) -> Dict:
        """Extract using Claude Vision directly"""
        import base64
        img_b64 = base64.b64encode(image_bytes).decode()

        prompt = """Extract structured information from this document image.

Return ONLY valid JSON:
{
  "document_type": "passport|insurance|warranty|lease|medical|vehicle_registration|other",
  "title": "short human-readable title",
  "issuer": "who issued this document or null",
  "holder_name": "name on the document or null",
  "issue_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "document_number": "reference number or null",
  "key_fields": {"field_name": "value"},
  "summary": "one sentence plain English summary"
}"""

        try:
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=self.SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}},
                        {"type": "text", "text": prompt}
                    ]
                }]
            )
            clean = response.content[0].text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except Exception as e:
            print(f"⚠️ Claude Vision failed: {e}")
            return self._safe_fallback()

    def answer_question(self, question: str, documents: list) -> str:
        if not documents:
            return "You haven't added any documents yet."

        context = "\n\n".join([f"{d.get('title')}: {d.get('summary')}" for d in documents])
        prompt = f"""Answer this question based only on the documents below:

Documents:
{context}

Question: {question}"""

        return self.ask_claude(prompt, system=self.SYSTEM_PROMPT)

    def check_expiries(self, documents: list) -> list:
        """
        Check all documents for upcoming expiries.
        Returns list of alerts with urgency levels.
        Called by the documents router.
        """
        today = date.today()
        alerts = []

        for doc in documents:
            expiry_str = doc.get("expiry_date")
            if not expiry_str:
                continue

            try:
                expiry = datetime.strptime(expiry_str, "%Y-%m-%d").date()
                days_until = (expiry - today).days

                if days_until < 0:
                    urgency = "expired"
                elif days_until <= 7:
                    urgency = "critical"
                elif days_until <= 30:
                    urgency = "urgent"
                elif days_until <= 90:
                    urgency = "upcoming"
                else:
                    continue  # Not due for alert yet

                alerts.append({
                    "document_id": doc.get("id"),
                    "title": doc.get("title"),
                    "expiry_date": expiry_str,
                    "days_until_expiry": days_until,
                    "urgency": urgency,
                    "message": self._expiry_message(doc.get("title"), days_until, urgency)
                })

            except (ValueError, TypeError):
                continue

        return alerts

    def _expiry_message(self, title: str, days: int, urgency: str) -> str:
        """Generate a human-friendly alert message."""
        if urgency == "expired":
            return f"⚠️ Your {title} has expired. Renew it as soon as possible."
        elif urgency == "critical":
            return f"🚨 Your {title} expires in {days} day{'s' if days != 1 else ''}. Act now."
        elif urgency == "urgent":
            return f"⏰ Your {title} expires in {days} days. Time to renew."
        else:
            return f"📅 Your {title} expires in {days} days. Plan ahead."

    def _safe_fallback(self) -> Dict:
        return {
            "document_type": "other",
            "title": "Uploaded Document",
            "issuer": None,
            "holder_name": None,
            "issue_date": None,
            "expiry_date": None,
            "document_number": None,
            "key_fields": {},
            "summary": "Document uploaded. Text extraction was not possible."
        }