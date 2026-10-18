"""Scans never invent bill amounts, payments or medical events."""
import io
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers
from app.routers.intake import unified_scan, _classify_intake


class FakeDB:
    def __init__(self):
        self.tables = []
        self.saved = None
        self.stored_path = None
    def storage(self):
        return self
    def from_(self, bucket):
        self.bucket = bucket
        return self
    def upload(self, path, contents, options):
        self.stored_path = path
        return {"path":path}
    def table(self, name):
        self.tables.append(name)
        return self
    def insert(self, record):
        self.saved = record
        return self
    def execute(self):
        return SimpleNamespace(data=[{"id":"scan-001"}])


class IntakeSafetyTests(unittest.IsolatedAsyncioTestCase):
    async def test_scanned_bill_is_private_draft_not_an_assumed_monthly_bill(self):
        db = FakeDB()
        file = UploadFile(
            filename="../utilities.jpg",
            file=io.BytesIO(bytes.fromhex("ffd8ff") + b"safe-test"),
            headers=Headers({"content-type":"image/jpeg"}),
        )
        with patch("app.routers.intake.get_supabase_admin", return_value=db), \
             patch("app.routers.intake.run_in_threadpool", new=AsyncMock(
                 return_value={"document_type":"other", "title":"Electricity bill",
                               "summary":"Monthly electricity bill"})), \
             patch("app.routers.intake.log_event"):
            result = await unified_scan(file=file,
                user={"id":"00000000-0000-4000-8000-000000000001",
                      "household_id":"00000000-0000-4000-8000-000000000002"})
        self.assertEqual(result["destination"], "Documents")
        self.assertEqual(result["suggested_destination"], "Bills")
        self.assertTrue(result["requires_review"])
        self.assertEqual(db.saved["visibility"], "private")
        self.assertEqual(db.saved["file_name"], "utilities.jpg")
        self.assertEqual(db.tables, ["documents"])
        self.assertNotIn("amount", db.saved)
        self.assertNotIn("billing_cycle", db.saved)

    async def test_type_spoofed_upload_is_rejected(self):
        file = UploadFile(
            filename="unsafe.pdf",file=io.BytesIO(b"<script>fake PDF</script>"),
            headers=Headers({"content-type":"application/pdf"}),
        )
        with self.assertRaises(HTTPException) as caught:
            await unified_scan(file=file, user={"id":"user","household_id":"home"})
        self.assertEqual(caught.exception.status_code, 415)

    def test_classification_is_advisory_only(self):
        self.assertEqual(_classify_intake("medical",
            {"title":"Clinical record","summary":"Hospital record"}), "medical_record")
        self.assertEqual(_classify_intake("other",
            {"title":"Water bill","summary":"Due monthly"}), "utility_bill")


if __name__ == "__main__":
    unittest.main()
