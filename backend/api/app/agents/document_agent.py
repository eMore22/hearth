import boto3
import json
from datetime import datetime, date
from typing import Any, Dict, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.config import settings


class DocumentAgent(BaseHouseholdAgent):
    """
    Module 1: Document Vault & Expiry Agent

    Handles:
    - OCR extraction from document photos
    - Expiry date detection and monitoring
    - Natural language Q&A over stored documents
    - Proactive expiry alerts
    """

    SYSTEM_PROMPT = """You are Hearth's Document Agent.
You help households manage their important documents.
You extract structured information from documents and answer questions about them.
Always respond in valid JSON when asked to extract data.
Be precise, helpful, and concise."""

    def run(self, input_data: Any) -> Any:
        """Entry point — routes to correct method based on input type."""
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
        Step 1: Run AWS Textract OCR on document image.
        Step 2: Send extracted text to Claude for structured extraction.
        Returns: dict with type, expiry_date, key_fields, summary
        """
        # OCR via AWS Textract
        raw_text = self._run_textract(image_bytes)

        # Structured extraction via Claude
        prompt = f"""Extract structured information from this document text.

Document text:
{raw_text}

Return ONLY valid JSON with this exact structure:
{{
  "document_type": "passport|insurance|warranty|lease|medical|vehicle_registration|other",
  "title": "short human-readable title",
  "issuer": "who issued this document",
  "holder_name": "name on the document if present",
  "issue_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "document_number": "policy/passport/reference number if present",
  "key_fields": {{"field_name": "value"}},
  "summary": "one sentence plain English summary of what this document is"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=1024)

        try:
            extracted = json.loads(response)
        except json.JSONDecodeError:
            # Fallback if Claude returns non-JSON
            extracted = {
                "document_type": "other",
                "title": "Unknown Document",
                "summary": raw_text[:200],
                "expiry_date": None,
                "key_fields": {}
            }

        self.log_action("extract_document", extracted.get("document_type", "unknown"))
        return extracted

    def answer_question(self, question: str, documents: list) -> str:
        """
        Natural language Q&A over the user's stored documents.
        e.g. "When does my car insurance expire?" / "What's my policy number?"
        """
        if not documents:
            return "You haven't added any documents to your vault yet. Add a document first and I can answer questions about it."

        # Build context from stored documents
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
        """
        Check all documents for upcoming expiries.
        Returns list of alerts with urgency levels.
        Called daily by the expiry_monitor worker.
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

        self.log_action("check_expiries", f"{len(alerts)} alerts generated")
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

    def _run_textract(self, image_bytes: bytes) -> str:
        """Run AWS Textract OCR on image bytes. Returns raw extracted text."""
        try:
            textract = boto3.client(
                "textract",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            response = textract.detect_document_text(
                Document={"Bytes": image_bytes}
            )
            lines = [
                block["Text"]
                for block in response.get("Blocks", [])
                if block["BlockType"] == "LINE"
            ]
            return "\n".join(lines)
        except Exception as e:
            # Fallback: return empty string, Claude will handle gracefully
            return f"[OCR failed: {str(e)}]"
