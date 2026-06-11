import boto3
import json
from datetime import datetime, date
from typing import Any, Dict, Optional
from app.agents.base_agent import BaseHouseholdAgent
from app.config import settings


class DocumentAgent(BaseHouseholdAgent):
    """
    Module 1: Document Vault & Expiry Agent
    Uses Claude (heavy) for extraction and Q&A.
    Improved OCR pipeline with better fallback.
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
        Extract structured info from a document image.
        Improved pipeline: NVIDIA OCR → AWS Textract → Safe fallback
        """
        raw_text = ""

        # Step 1: Try NVIDIA OCR (if available)
        try:
            from app.services.ocr_service import perform_ocr
            raw_text = perform_ocr(image_bytes) or ""
            if raw_text:
                print("✅ NVIDIA OCR succeeded")
        except Exception as e:
            print(f"⚠️ NVIDIA OCR failed: {e}")

        # Step 2: If NVIDIA OCR failed or gave nothing → Try AWS Textract
        if not raw_text or len(raw_text.strip()) < 15:
            print("🔄 Falling back to AWS Textract...")
            raw_text = self._run_textract(image_bytes)

        # Step 3: If we still have nothing useful → Return safe fallback
        if not raw_text or raw_text.startswith("[OCR failed") or len(raw_text.strip()) < 15:
            print("⚠️ All OCR methods failed — returning safe fallback")
            return self._safe_fallback("Could not extract readable text from document")

        # Step 4: Use Claude to extract structured data (Heavy task)
        prompt = f"""Extract structured information from this document text.

Document text:
{raw_text[:3500]}

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
            clean = response.replace("```json", "").replace("```", "").strip()
            extracted = json.loads(clean)
        except Exception as e:
            print(f"⚠️ JSON parse failed: {e} — using fallback")
            extracted = self._safe_fallback(raw_text[:200])

        self.log_action("extract_document", extracted.get("document_type", "unknown"))
        return extracted

    def answer_question(self, question: str, documents: list) -> str:
        """Q&A over stored documents. HEAVY — needs Claude for accuracy."""
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

    def _run_textract(self, image_bytes: bytes) -> str:
        """AWS Textract fallback OCR."""
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
            return f"[OCR failed: {str(e)}]"

    def _extract_with_vision(self, image_bytes: bytes) -> Dict:
        """NVIDIA vision model — direct image understanding."""
        try:
            import base64
            from app.services.nvidia_client import get_nvidia_client
            client = get_nvidia_client()
            if not client:
                return {}

            img_b64 = base64.b64encode(image_bytes).decode()
            prompt = """Extract structured information from this document image.
Return ONLY valid JSON:
{
  "document_type": "passport|insurance|warranty|lease|medical|vehicle_registration|other",
  "title": "short title",
  "issuer": "issuer name or null",
  "holder_name": "name on document or null",
  "issue_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "document_number": "reference number or null",
  "key_fields": {},
  "summary": "one sentence summary"
}"""
            response = client.complete(
                task="vision",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                    ]
                }],
                max_tokens=1024
            )
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except Exception as e:
            print(f"⚠️ Vision extraction error: {e}")
            return {}

    def _safe_fallback(self, raw_text: str = "") -> Dict:
        """
        Always returns a valid dict that can be inserted into the DB.
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
            "summary": raw_text[:200] if raw_text else "Document uploaded — text extraction failed. You can rename this document."
        }