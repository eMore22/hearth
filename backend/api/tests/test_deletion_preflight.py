"""Deletion processing is intentionally blocked until verified safe."""
import unittest
from types import SimpleNamespace
from app.services.deletion_preflight import deletion_preflight

ID="00000000-0000-4000-8000-000000000011"
USER="00000000-0000-4000-8000-000000000012"
HOME="00000000-0000-4000-8000-000000000013"


class Q:
    def __init__(self,rows):
        self.rows=rows;self.filters=[];self.one=False
    def select(self,*a):return self
    def eq(self,key,value):
        self.filters.append((key,value));return self
    def maybe_single(self):self.one=True;return self
    def limit(self,*a):return self
    def execute(self):
        rows=[r for r in self.rows if all(str(r.get(k))==str(v) for k,v in self.filters)]
        return SimpleNamespace(data=rows[0] if self.one and rows else None if self.one else rows)


class DB:
    def __init__(self,role="member",other_member=True,bank=False,private_doc=True):
        self.data={
            "account_deletion_requests":[{"id":ID,"user_id":USER,"status":"requested","household_id_at_request":HOME}],
            "household_members":[{"household_id":HOME,"user_id":USER,"role":role}] +
                ([{"household_id":HOME,"user_id":"another-user","role":"member"}] if other_member else []),
            "finance_connections":[{"id":"bank","owner_user_id":USER}] if bank else [],
            "documents":[{"id":"d","uploaded_by":USER}] if private_doc else [],
            "health_events":[{"id":"health","household_id":HOME}],
            "medications":[],
            "family_health_profiles":[],
            "chat_messages":[],
        }
    def table(self,name):return Q(self.data.get(name,[]))


class PreflightTests(unittest.TestCase):
    def test_member_with_health_and_documents_is_never_automatically_purged(self):
        report=deletion_preflight(ID,DB())
        self.assertFalse(report["automated_purge_authorized"])
        self.assertFalse(report["destructive_actions_performed"])
        self.assertEqual(report["evidence_counts"]["personal_documents"],1)
        self.assertTrue(any("user attribution" in reason for reason in report["blockers"]))

    def test_owner_cannot_delete_household_with_other_member(self):
        report=deletion_preflight(ID,DB(role="owner"))
        self.assertTrue(any("transfer ownership" in reason for reason in report["blockers"]))

    def test_bank_requires_revocation(self):
        report=deletion_preflight(ID,DB(bank=True))
        self.assertTrue(any("provider consents" in reason for reason in report["blockers"]))

    def test_even_empty_case_requires_operator_verification(self):
        db=DB(role="owner",other_member=False,private_doc=False)
        db.data["health_events"]=[]
        report=deletion_preflight(ID,db)
        self.assertFalse(report["automated_purge_authorized"])
        self.assertIn("Verify legally required retention, Auth deletion and personal data removal with the operator",report["blockers"])


if __name__=="__main__":unittest.main()
