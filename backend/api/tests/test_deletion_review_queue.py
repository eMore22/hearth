"""Deletion review queue must neither expose private data nor delete it."""
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from app.services.deletion_review_queue import pending_deletion_queue

REQUEST="00000000-0000-4000-8000-000000000011"

class Query:
    def __init__(self, rows):
        self.rows=rows
        self.states=None
        self.cap=None
    def select(self, *args): return self
    def in_(self, column, options):
        self.states=set(options)
        return self
    def order(self, *args, **kwargs): return self
    def limit(self, n):
        self.cap=n
        return self
    def execute(self):
        result=[r for r in self.rows if self.states is None or r.get("status") in self.states]
        return SimpleNamespace(data=result[:self.cap])

class DB:
    def __init__(self):
        self.rows=[
            {"id":REQUEST,"status":"requested","requested_at":"2026-10-01T00:00:00Z"},
            {"id":"cancelled","status":"cancelled","requested_at":"2026-10-01T00:00:00Z"},
            {"id":"processing","status":"processing","requested_at":"2026-10-20T00:00:00Z"},
        ]
        self.writes=0
    def table(self,name):
        assert name == "account_deletion_requests"
        return Query(self.rows)

class QueueTests(unittest.TestCase):
    def test_returns_only_pending_and_aging_without_personal_data(self):
        db=DB()
        result=pending_deletion_queue(db,now=datetime(2026,10,20,tzinfo=timezone.utc))
        self.assertEqual(len(result["items"]),2)
        self.assertEqual(result["overdue_count"],1)
        self.assertNotIn("user_id",str(result))
        self.assertFalse(result["destructive_actions_performed"])
        self.assertEqual(db.writes,0)

    def test_invalid_limits_rejected(self):
        with self.assertRaises(ValueError):
            pending_deletion_queue(DB(),limit=0)
        with self.assertRaises(ValueError):
            pending_deletion_queue(DB(),aging_days=0)

if __name__=="__main__":
    unittest.main()
