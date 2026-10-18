"""Secure document handling and Chief's grounded document answers."""
import unittest
from datetime import date, timedelta
from app.services.document_security import safe_filename, valid_upload, storage_path, clean_extraction
from app.services.document_reasoning import document_reply


class SecurityTests(unittest.TestCase):
    def test_pdf_and_image_magic_bytes(self):
        self.assertTrue(valid_upload(b"%PDF-1.7\nexample", "application/pdf"))
        self.assertTrue(valid_upload(bytes.fromhex("ffd8ff") + b"test", "image/jpeg"))
        self.assertTrue(valid_upload(bytes.fromhex("89504e470d0a1a0a") + b"test", "image/png"))
        self.assertTrue(valid_upload(b"RIFF1234WEBPcontents", "image/webp"))
        self.assertFalse(valid_upload(b"<html>phishing</html>", "application/pdf"))
        self.assertFalse(valid_upload(b"%PDF-1.7", "image/jpeg"))
        self.assertFalse(valid_upload(b"fake", "application/octet-stream"))
        self.assertFalse(valid_upload(b"%PDF-1.7" + b"0" * (20 * 1024 * 1024), "application/pdf"))

    def test_filename_is_bounded_and_never_traverses(self):
        self.assertEqual(safe_filename("../../private/passport.pdf", "application/pdf"), "passport.pdf")
        self.assertEqual(safe_filename("folder\\photo.png", "image/jpeg"), "photo.jpg")
        self.assertTrue(len(safe_filename("x" * 400, "image/png")) <= 94)

    def test_legacy_paths_are_household_scoped(self):
        h = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        path = h + "/111/test.pdf"
        self.assertEqual(storage_path("storage://documents/" + path, h), path)
        self.assertEqual(storage_path("https://storage.invalid/storage/v1/object/public/documents/" + path, h), path)
        self.assertIsNone(storage_path("storage://documents/other/111/test.pdf", h))
        self.assertIsNone(storage_path("storage://documents/" + h + "/../private.pdf", h))
        self.assertIsNone(storage_path("https://storage.invalid/storage/v1/object/public/documents/" + h + "/%2e%2e/other", h))

    def test_untrusted_ai_cannot_overwrite_record_owner(self):
        result = clean_extraction({
            "household_id": "attack", "uploaded_by": "attack",
            "title": "Warranty", "document_type": "warranty", "expiry_date": "2026-02-30",
            "issue_date": "2026-10-18", "key_fields": {"serial": "ABC"},
            "file_url": "https://attacker.invalid",
        }, "backup.pdf")
        self.assertNotIn("household_id", result)
        self.assertNotIn("uploaded_by", result)
        self.assertNotIn("file_url", result)
        self.assertIsNone(result["expiry_date"])
        self.assertEqual(result["issue_date"], "2026-10-18")


class ReasoningTests(unittest.TestCase):
    def test_near_expiry_uses_real_dates_not_stale_alerts(self):
        date_soon = (date.today() + timedelta(days=12)).isoformat()
        context = {
            "source_status": {"documents": "available", "document_alerts": "available"},
            "documents": [
                {"title": "Passport", "document_type": "passport", "expiry_date": date_soon},
                {"title": "Lease", "document_type": "lease", "expiry_date": None},
            ],
            "alerts": [],
        }
        reply = document_reply("Which documents need renewal soon?", context)
        self.assertIn("Passport", reply)
        self.assertIn(date_soon, reply)
        self.assertIn("no expiry date saved", reply)

    def test_no_coverage_hallucination(self):
        reply = document_reply("Does my insurance cover water damage?", {
            "source_status": {"documents": "available"},
            "documents": [{"title": "Home Insurance", "document_type": "insurance",
                           "summary": "Potential water damage", "expiry_date": None}],
        })
        self.assertIn("cannot confirm coverage", reply)

    def test_unavailable_is_not_reported_empty(self):
        reply = document_reply("When does my passport expire?", {
            "source_status": {"documents": "unavailable"}, "documents": []
        })
        self.assertIn("couldn't check", reply)


if __name__ == "__main__":
    unittest.main()
