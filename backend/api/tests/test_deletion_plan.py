"""No-write deletion plan regression tests, including other members' records."""
import unittest
from types import SimpleNamespace
from fastapi import HTTPException
from app.services.deletion_plan import build_deletion_plan, execute_deletion
from app.services.deletion_plan import USER_OWNED

REQ="00000000-0000-4000-8000-000000000011"
USER="00000000-0000-4000-8000-000000000012"
HOME="00000000-0000-4000-8000-000000000013"
OTHER="00000000-0000-4000-8000-000000000014"

class Q:
    def __init__(self,rows,db):
        self.rows=rows
        self.db=db
        self.filters=[]
        self.single=False
        self.max_count=1000
    def select(self,*a): return self
    def eq(self,k,v):
        self.filters.append((k,v));return self
    def maybe_single(self): self.single=True; return self
    def limit(self,n): self.max_count=n;return self
    def execute(self):
        rows=[r for r in self.rows if all(str(r.get(k))==str(v) for k,v in self.filters)][:self.max_count]
        return SimpleNamespace(data=(rows[0] if rows else None) if self.single else rows)

class DB:
    def __init__(self):
        self.writes=0
        self.rows={name:[] for name in USER_OWNED}
        self.rows.update({
            "account_deletion_requests":[{"id":REQ,"user_id":USER,"status":"requested","household_id_at_request":HOME}],
            "household_members":[{"id":"m","user_id":USER,"household_id":HOME,"role":"member"},
                                 {"id":"m2","user_id":OTHER,"household_id":HOME,"role":"owner"}],
            "documents":[{"id":"own-doc","uploaded_by":USER,"household_id":HOME,
                          "file_url":f"storage://documents/{HOME}/abc/private.pdf","visibility":"private"},
                         {"id":"other-doc","uploaded_by":OTHER,"household_id":HOME,
                          "file_url":f"storage://documents/{HOME}/xyz/private.pdf","visibility":"private"}],
            "chat_messages":[{"id":"chat-a","user_id":USER,"household_id":HOME},
                             {"id":"chat-b","user_id":OTHER,"household_id":HOME}],
            "finance_connections":[{"id":"other-bank","owner_user_id":OTHER,"household_id":HOME}],
            "health_events":[{"id":"shared-health","household_id":HOME}],
            "medications":[], "family_health_profiles":[],
            "health_reminders":[], "household_preferences":[],
        })
    def table(self,name):return Q(self.rows.get(name,[]),self)

class PlanTests(unittest.TestCase):
    def test_personal_inventory_does_not_include_other_members(self):
        db=DB()
        plan=build_deletion_plan(REQ,db)
        self.assertEqual(plan["user_owned_counts"]["documents"],1)
        self.assertEqual(plan["user_owned_counts"]["chat_messages"],1)
        self.assertEqual(plan["user_owned_counts"]["finance_connections"],0)
        self.assertEqual(plan["document_checks"]["rows"],1)
        self.assertTrue(any("health_events" in b for b in plan["blockers"]))
        self.assertTrue(any("Storage objects" in b for b in plan["blockers"]))
        self.assertNotIn("other-bank",str(plan))
        self.assertNotIn("private.pdf",str(plan))
        self.assertEqual(db.writes,0)
        self.assertFalse(plan["execution_authorized"])

    def test_missing_document_reference_blocks(self):
        db=DB()
        db.rows["documents"][0]["file_url"]=f"storage://documents/{OTHER}/escape"
        plan=build_deletion_plan(REQ,db)
        self.assertEqual(plan["document_checks"]["invalid_paths"],1)
        self.assertTrue(any("invalid" in b for b in plan["blockers"]))

    def test_plan_fingerprint_changes_when_personal_records_change(self):
        db=DB()
        initial=build_deletion_plan(REQ,db)["snapshot_sha256"]
        db.rows["chat_messages"].append({"id":"extra","user_id":USER,"household_id":HOME})
        newer=build_deletion_plan(REQ,db)["snapshot_sha256"]
        self.assertNotEqual(initial,newer)

    def test_owner_household_requires_transfer(self):
        db=DB()
        db.rows["households"]=[{"id":HOME,"created_by":USER}]
        plan=build_deletion_plan(REQ,db)
        self.assertTrue(any("founded" in b for b in plan["blockers"]))

    def test_execution_always_refused_no_side_effects(self):
        db=DB()
        with self.assertRaises(HTTPException) as e:
            execute_deletion(REQ,db=db,approval=True)
        self.assertEqual(e.exception.status_code,503)
        self.assertEqual(db.writes,0)

if __name__=="__main__":
    unittest.main()
