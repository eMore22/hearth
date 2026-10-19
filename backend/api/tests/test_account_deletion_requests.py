"""Account deletion requests are owner-scoped and never silently erase accounts."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import HTTPException
from app.routers.account_deletion import (
    request_account_deletion, deletion_request_status,
    cancel_deletion_request, DeletionConfirmation,
)


class FakeTable:
    def __init__(self, rows):
        self.rows = rows
        self.ops = []
        self.filters = []
        self.insert_payload = None
    def select(self, x):
        self.ops.append("select")
        return self
    def eq(self, field, value):
        self.filters.append((field,value))
        return self
    def in_(self, *args):
        return self
    def order(self,*a,**kw):
        return self
    def limit(self,*args):
        return self
    def insert(self, payload):
        self.ops.append("insert")
        self.insert_payload = payload
        return self
    def update(self, payload):
        self.ops.append("update")
        return self
    def execute(self):
        return SimpleNamespace(data=self.rows)


class FakeDB:
    def __init__(self, rows=None):
        self.q = FakeTable(rows or [])
        self.auth = SimpleNamespace(admin=SimpleNamespace(
            delete_user=lambda *a,**kw: (_ for _ in ()).throw(AssertionError("Unexpected deletion"))))
    def table(self, name):
        assert name == "account_deletion_requests"
        return self.q


class DeletionRequestTests(unittest.IsolatedAsyncioTestCase):
    user = {"id":"00000000-0000-4000-8000-000000000001",
            "household_id":"00000000-0000-4000-8000-000000000002"}

    async def test_explicit_phrase_required(self):
        with self.assertRaises(HTTPException) as e:
            await request_account_deletion(DeletionConfirmation(confirmation="Delete"), self.user)
        self.assertEqual(e.exception.status_code, 422)

    async def test_existing_request_idempotent(self):
        db = FakeDB([{"id":"a","status":"requested"}])
        with patch("app.routers.account_deletion.get_supabase_admin",return_value=db):
            result=await request_account_deletion(DeletionConfirmation(confirmation="DELETE MY ACCOUNT"), self.user)
        self.assertEqual(result["request"]["status"],"requested")
        self.assertNotIn("insert",db.q.ops)
        self.assertIn(("user_id",self.user["id"]),db.q.filters)

    async def test_new_request_has_only_authenticated_scope(self):
        db=FakeDB([])
        data=[{"id":"a","status":"requested","requested_at":"2026-10-19"}]
        def execute():
            return SimpleNamespace(data=data if db.q.insert_payload else [])
        db.q.execute=execute
        with patch("app.routers.account_deletion.get_supabase_admin",return_value=db):
            result=await request_account_deletion(DeletionConfirmation(confirmation="DELETE MY ACCOUNT"), self.user)
        self.assertEqual(result["request"]["status"],"requested")
        self.assertEqual(db.q.insert_payload["user_id"],self.user["id"])
        self.assertEqual(db.q.insert_payload["household_id_at_request"],self.user["household_id"])
        self.assertNotIn("email",str(db.q.insert_payload))

    async def test_status_is_user_scoped(self):
        db=FakeDB([{"id":"a","status":"processing","requested_at":"2026-10-19"}])
        with patch("app.routers.account_deletion.get_supabase_admin",return_value=db):
            reply=await deletion_request_status(self.user)
        self.assertEqual(reply["request"]["status"],"processing")
        self.assertIn(("user_id",self.user["id"]),db.q.filters)

    async def test_cancel_only_unprocessed_request(self):
        db=FakeDB([{"status":"cancelled"}])
        with patch("app.routers.account_deletion.get_supabase_admin",return_value=db):
            result=await cancel_deletion_request(self.user)
        self.assertEqual(result["status"],"cancelled")
        self.assertIn(("status","requested"),db.q.filters)
        self.assertIn(("user_id",self.user["id"]),db.q.filters)


if __name__=="__main__":
    unittest.main()
