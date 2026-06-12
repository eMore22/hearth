import json
from datetime import datetime, date
from typing import Any, Dict, Optional
from app.agents.base_agent import BaseHouseholdAgent


class DocumentAgent(BaseHouseholdAgent):
    """
    Module 1: Document Vault & Expiry Agent
    Uses Claude Vision directly for document extraction — no OCR pipeline needed.
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
        """
        Extract structured info from a document using Claude Vision directly.
        No OCR needed — Claude reads the image and returns structured JSON.
        """
        import base64

        img_b64 = base64.b64encode(image_bytes).decode()

        prompt = """Extract structured information from this document image.
Return ONLY valid JSON with this exact structure:
{
  "document_type": "passport|insurance|warranty|lease|medical|vehicle_registration|other",
  "title": "short human-readable title",
  "issuer": "who issued this document or null",
  "holder_name": "name on the document or null",
  "issue_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "document_number": "policy/passport/reference number or null",
  "key_fields": {"field_name": "value"},
  "summary": "one sentence plain English summary of what this document is"
}"""

        try:
            # Claude Vision — direct image understanding (Heavy task)
            response = self.client.messages.create(
                model="claude-opus-4-5",
                max_tokens=1024,
                system=self.SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": img_b64,
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
            )

            raw_response = response.content[0].text
            print(f"✅ Claude Vision response: {raw_response[:200]}")

            clean = raw_response.replace("```json", "").replace("```", "").strip()
            extracted = json.loads(clean)
            self.log_action("extract_document_vision", extracted.get("document_type", "unknown"))
            return extracted

        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parse failed: {e} — using safe fallback")
            return self._safe_fallback("Claude Vision returned unstructured response")

        except Exception as e:
            print(f"⚠️ Claude Vision extraction failed: {e}")
            return self._safe_fallback("Claude Vision failed to extract document")

    def answer_question(self, question: str, documents: list) -> str:
        """Q&A over stored documents. Uses Claude for accuracy."""
        if not documents:
            return "You haven't added any documents to your vault yet. Add a document first and I can answer questions about it."

        doc_context = "\n\n".join([
            f"Document: {d.get('title', 'Unknown')}\n"
            f"Type: {d.get('document_type', 'unknown')}\n"
            f"Expiry: {d.get('expiry_date', 'not specified')}\n"
            f"Key fields: {json.dumps(d.get('key_fields', {}))}\n"
            f"Summary: {d.get('summary', '')}"
            for d in documents
        ])

        prompt = f"""The user has these documents in their Hearth vault:

{doc_context}

User question: {question}

Answer the question directly and concisely based only on the documents above.
If the answer isn't in their documents, say so clearly."""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        self.log_action("answer_question", question[:100])
        return response

    def check_expiries(self, documents: list) -> list:
        """Check all documents for upcoming expiries. Pure Python — no AI needed."""
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
                    continue

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

        self.log_action("check_expiries", f"{len(alerts)} alerts generated")
        return alerts

    def _expiry_message(self, title: str, days: int, urgency: str) -> str:
        if urgency == "expired":
            return f"⚠️ Your {title} has expired. Renew it as soon as possible."
        elif urgency == "critical":
            return f"🚨 Your {title} expires in {days} day{'s' if days != 1 else ''}. Act now."
        elif urgency == "urgent":
            return f"⏰ Your {title} expires in {days} days. Time to renew."
        else:
            return f"📅 Your {title} expires in {days} days. Plan ahead."

    def _safe_fallback(self, reason: str = "") -> Dict:
        """
        Always returns a valid dict that can be inserted into the DB.
        Prevents 400 errors when extraction fails.
        """
        return {
            "document_type": "other",
            "title": "Uploaded Document",
            "issuer": None,
            "holder_name": None,
            "issue_date": None,
            "expiry_date": None,
            "document_number": None,
            "key_fields": {},
            "summary": f"Document uploaded. {reason}. You can rename this document in the vault."
        }