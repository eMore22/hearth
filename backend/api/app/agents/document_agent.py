import json
from datetime import datetime, date
from typing import Any, Dict, Optional
from app.agents.base_agent import BaseHouseholdAgent


class DocumentAgent(BaseHouseholdAgent):
    """
    Document Vault & Expiry Agent.
    Extraction order for images:
      1. Claude Vision  (claude-3-5-sonnet-20241022 → claude-3-haiku-20240307 fallback)
      2. NVIDIA Vision  (phi-3-vision via NvidiaClient)
      3. Safe fallback  (stores doc with placeholder data, never crashes)
    Extraction order for PDFs:
      1. Claude native document support (no NVIDIA equivalent — phi-3-vision
         only accepts images, so PDFs skip straight to Claude, then fallback)
      2. Safe fallback
    """

    SYSTEM_PROMPT = """You are Hearth's Document Agent.
You extract structured information from document images.
Always respond in valid JSON only — no markdown fences, no extra text."""

    EXTRACTION_PROMPT = """Extract structured information from this document.

Return ONLY valid JSON with exactly these fields:
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

    CLAUDE_MODELS = [
        "claude-opus-4-5",
        "claude-3-5-sonnet-20241022",
        "claude-3-haiku-20240307",
    ]

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "extract":
            return self.extract_document(
                input_data["image_bytes"],
                input_data.get("mime_type", "image/jpeg"),
            )
        elif action == "answer":
            return self.answer_question(
                input_data["question"], input_data.get("documents", [])
            )
        elif action == "check_expiries":
            return self.check_expiries(input_data["documents"])
        raise ValueError(f"Unknown action: {action}")

    def extract_document(self, file_bytes: bytes, mime_type: str = "image/jpeg") -> Dict:
        """
        Routes to the PDF-native path or the image path based on mime_type.
        Never raises — always returns a valid dict.
        """
        import base64
        file_b64 = base64.b64encode(file_bytes).decode()

        if mime_type == "application/pdf":
            result = self._try_claude_pdf(file_b64)
            if result:
                print(f"✅ Claude PDF extracted: {result.get('title')}")
                return result
            print("⚠️ PDF extraction failed — using safe fallback")
            return self._safe_fallback()

        # ── 1. Try Claude Vision (images only) ────────────────────────────
        result = self._try_claude_vision(file_b64)
        if result:
            print(f"✅ Claude Vision extracted: {result.get('title')}")
            return result

        # ── 2. Try NVIDIA Vision ────────────────────────────────────────────
        result = self._try_nvidia_vision(file_bytes)
        if result:
            print(f"✅ NVIDIA Vision extracted: {result.get('title')}")
            return result

        # ── 3. Safe fallback ────────────────────────────────────────────────
        print("⚠️ All vision methods failed — using safe fallback")
        return self._safe_fallback()

    def _try_claude_pdf(self, pdf_b64: str) -> Optional[Dict]:
        """Try each Claude model using native PDF document support."""
        for model in self.CLAUDE_MODELS:
            try:
                print(f"🤖 Trying Claude PDF extraction: {model}")
                response = self.client.messages.create(
                    model=model,
                    max_tokens=1024,
                    system=self.SYSTEM_PROMPT,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": "application/pdf",
                                    "data": pdf_b64,
                                },
                            },
                            {"type": "text", "text": self.EXTRACTION_PROMPT},
                        ],
                    }],
                )
                raw = response.content[0].text
                clean = raw.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean)
                if isinstance(parsed, dict) and "document_type" in parsed:
                    return parsed
            except json.JSONDecodeError as e:
                print(f"⚠️ {model} returned invalid JSON: {e}")
            except Exception as e:
                err = str(e).lower()
                if "not_found" in err or "invalid_model" in err or "model" in err:
                    print(f"⚠️ Model {model} not available: {e}")
                    continue
                print(f"⚠️ Claude PDF extraction error ({model}): {e}")
                break
        return None

    def _try_claude_vision(self, img_b64: str) -> Optional[Dict]:
        """Try each Claude model in CLAUDE_MODELS until one works."""
        for model in self.CLAUDE_MODELS:
            try:
                print(f"🤖 Trying Claude Vision model: {model}")
                response = self.client.messages.create(
                    model=model,
                    max_tokens=1024,
                    system=self.SYSTEM_PROMPT,
                    messages=[{
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
                            {"type": "text", "text": self.EXTRACTION_PROMPT},
                        ],
                    }],
                )
                raw  = response.content[0].text
                clean = raw.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean)
                if isinstance(parsed, dict) and "document_type" in parsed:
                    return parsed
            except json.JSONDecodeError as e:
                print(f"⚠️ {model} returned invalid JSON: {e}")
            except Exception as e:
                err = str(e).lower()
                if "not_found" in err or "invalid_model" in err or "model" in err:
                    print(f"⚠️ Model {model} not available: {e}")
                    continue
                print(f"⚠️ Claude Vision error ({model}): {e}")
                break
        return None

    def _try_nvidia_vision(self, image_bytes: bytes) -> Optional[Dict]:
        """Use NVIDIA phi-3-vision to OCR the document, then parse with Claude text."""
        try:
            if not self.nvidia_client:
                return None

            print("🤖 Trying NVIDIA Vision OCR...")
            ocr_text = self.nvidia_client.ocr(image_bytes)
            if not ocr_text or len(ocr_text.strip()) < 20:
                print("⚠️ NVIDIA OCR returned too little text")
                return None

            parse_prompt = f"""Extract structured document information from this OCR text.

OCR Text:
{ocr_text[:3000]}

{self.EXTRACTION_PROMPT}"""

            text_response = self.ask_claude(parse_prompt, system=self.SYSTEM_PROMPT, max_tokens=800)
            clean = text_response.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "document_type" in parsed:
                return parsed

        except Exception as e:
            print(f"⚠️ NVIDIA Vision fallback failed: {e}")
        return None

    def answer_question(self, question: str, documents: list) -> str:
        if not documents:
            return "You haven't added any documents yet."
        context = "\n\n".join([
            f"{d.get('title', 'Document')}: {d.get('summary', 'No summary')}"
            for d in documents
        ])
        prompt = f"""Answer this question based only on the documents below:

Documents:
{context}

Question: {question}"""
        return self.ask_claude(prompt, system=self.SYSTEM_PROMPT)

    def check_expiries(self, documents: list) -> list:
        today  = date.today()
        alerts = []
        for doc in documents:
            if not doc.get("expiry_date"):
                continue
            try:
                expiry   = datetime.strptime(doc["expiry_date"], "%Y-%m-%d").date()
                days     = (expiry - today).days
                urgency  = (
                    "expired"  if days < 0   else
                    "critical" if days <= 30  else
                    "urgent"   if days <= 60  else
                    "upcoming" if days <= 90  else None
                )
                if urgency:
                    alerts.append({
                        "document_id":      doc.get("id"),
                        "title":            doc.get("title", "Document"),
                        "days_until_expiry": days,
                        "urgency":          urgency,
                        "message": (
                            f"Your {doc.get('title', 'document')} has expired. "
                            f"Renew it as soon as possible."
                        ) if days < 0 else (
                            f"Your {doc.get('title', 'document')} expires in {days} days."
                        ),
                    })
            except Exception:
                continue
        return alerts

    def _safe_fallback(self) -> Dict:
        return {
            "document_type":   "other",
            "title":           "Uploaded Document",
            "issuer":          None,
            "holder_name":     None,
            "issue_date":      None,
            "expiry_date":     None,
            "document_number": None,
            "key_fields":      {},
            "summary":         "Document uploaded. Text extraction was not possible.",
        }
