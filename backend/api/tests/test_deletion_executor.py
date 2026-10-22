"""Test the operator-only destructive pathway against a fake two-member DB."""
import time
import unittest
from types import SimpleNamespace
from fastapi import HTTPException
from app.services.deletion_plan import build_deletion_plan, USER_OWNED, SHARED_SENSITIVE
from app.services.deletion_executor import operator_signature, execute_member_deletion

REQ="00000000-0000-4000-8000-000000000011"
USER="00000000-0000-4000-8000-000000000012"
OWNER="00000000-0000-4000-8000-000000000019"
HOME="00000000-0000-4000-8000-000000000013"
SECRET="A-very-long-test-only-operator-secret-do-not-use"

class Q:
    def __init__(self,db,table):
        self.db=db;self.table=table;self.filters=[];self.cap=999;self.single=False
        self.deleted=False;self.changed=None
    def select(self,*args):return self
    def eq(self,k,v):self.filters.append((k,v));return self
    def limit(self,n):self.cap=n;return self
    def maybe_single(self):self.single=True;return self
    def delete(self):self.deleted=True;return self
    def update(self,x):self.changed=x;return self
    def execute(self):
        items=self.db.rows[self.table]
        found=[row for row in items if all(str(row.get(k))==str(v) for k,v in self.filters)]
        limited=found[:self.cap]
        if self.changed is not None:
            for row in limited: row.update(self.changed)
            self.db.writes+=len(limited)
        if self.deleted:
            self.db.rows[self.table]=[row for row in items if row not in limited]
            self.db.writes+=len(limited)
        result = (limited[0] if limited else None) if self.single else limited
        return SimpleNamespace(data=result)

class Storage:
    def __init__(self):
        self.objects=set()
    def from_(self,bucket):
        if bucket != "documents":raise AssertionError()
        return self
    def list(self,path,options=None):
        folder=path.rstrip("/") + "/"
        children=set()
        for name in self.objects:
            if not name.startswith(folder):
                continue
            rest=name[len(folder):]
            child=rest.split("/",1)[0]
            if "/" in rest:
                children.add((child,True))
            else:
                children.add((child,False))
        return [{"name":name,"id":None if directory else "file-object",
                 "metadata":None if directory else {"size":1}}
                for name,directory in sorted(children)]
    def remove(self,paths):
        for path in paths:
            self.objects.discard(path)


class AuthAdmin:
    def __init__(self,db):self.db=db;self.deleted=[]
    def delete_user(self,uid):
        self.deleted.append(uid)
        self.db.rows["users"]=[r for r in self.db.rows["users"] if r["id"]!=uid]

class DB:
    def __init__(self):
        self.rows={t:[] for t in set(USER_OWNED)|set(SHARED_SENSITIVE)}
        self.rows["account_deletion_requests"]=[{"id":REQ,"user_id":USER,"status":"requested","household_id_at_request":HOME}]
        self.rows["household_members"]=[{"id":"one","household_id":HOME,"user_id":USER,"role":"member"},
                                        {"id":"two","household_id":HOME,"user_id":OWNER,"role":"owner"}]
        self.rows["households"]=[{"id":HOME,"created_by":OWNER}]
        self.rows["users"]=[{"id":USER,"household_id":HOME},{"id":OWNER,"household_id":HOME}]
        self.rows["chat_messages"]=[{"id":"mine","user_id":USER,"household_id":HOME},
                                    {"id":"other","user_id":OWNER,"household_id":HOME}]
        self.rows["push_tokens"]=[{"id":"my-push","user_id":USER}]
        self.rows["analytics_events"]=[{"id":"my-event","user_id":USER}]
        self.writes=0;self.storage=Storage()
        self.admin=AuthAdmin(self)
        self.auth=SimpleNamespace(admin=self.admin)
    def table(self,name):return Q(self,name)

def approved(db,now=1720000000):
    plan=build_deletion_plan(REQ,db)
    expires=now+300
    return {"request_id":REQ,"expected_digest":plan["snapshot_sha256"],
            "expires_at":expires,"approval":operator_signature(
                request_id=REQ,user_id=USER,digest=plan["snapshot_sha256"],
                expires_at=expires,secret=SECRET),
            "operator_key":SECRET,"now":now,
            "subscription_verifier":lambda _:"free"}

class ExecutorTests(unittest.TestCase):
    def test_deletes_simple_member_without_touching_owner(self):
        db=DB()
        result=execute_member_deletion(db=db,**approved(db))
        self.assertEqual(result["status"],"completed")
        self.assertEqual(db.admin.deleted,[USER])
        self.assertEqual([r["user_id"] for r in db.rows["household_members"]],[OWNER])
        self.assertEqual([r["user_id"] for r in db.rows["chat_messages"]],[OWNER])
        self.assertEqual(db.rows["users"],[{"id":OWNER,"household_id":HOME}])

    def test_plan_drift_aborts_before_any_write(self):
        db=DB();args=approved(db)
        db.rows["chat_messages"].append({"id":"new","user_id":USER,"household_id":HOME})
        with self.assertRaises(HTTPException):execute_member_deletion(db=db,**args)
        self.assertEqual(db.writes,0)
    def test_wrong_approval_aborts(self):
        db=DB();args=approved(db);args["approval"]="wrong"
        with self.assertRaises(HTTPException):execute_member_deletion(db=db,**args)
        self.assertEqual(db.writes,0)
    def test_paid_subscription_aborts(self):
        db=DB();args=approved(db);args["subscription_verifier"]=lambda _:"home"
        with self.assertRaises(HTTPException):execute_member_deletion(db=db,**args)
        self.assertEqual(db.writes,0)
    def test_storage_objects_block_delete(self):
        db=DB();db.storage.objects={HOME+"/unknown/orphan.pdf"}
        with self.assertRaises(HTTPException):execute_member_deletion(db=db,**approved(db))
        self.assertEqual(db.writes,0)
    def test_deletes_private_documents_but_keeps_other_members_storage(self):
        db=DB()
        my_file=HOME+"/doc-a/personal.pdf"
        other_file=HOME+"/doc-b/household-insurance.pdf"
        db.rows["documents"]=[
            {"id":"a","household_id":HOME,"uploaded_by":USER,
             "file_url":"storage://documents/"+my_file,"visibility":"private"},
            {"id":"b","household_id":HOME,"uploaded_by":OWNER,
             "file_url":"storage://documents/"+other_file,"visibility":"private"},
        ]
        db.storage.objects={my_file,other_file}
        result=execute_member_deletion(db=db,**approved(db))
        self.assertEqual(result["status"],"completed")
        self.assertEqual(db.storage.objects,{other_file})
        self.assertEqual([d["id"] for d in db.rows["documents"]],["b"])

    def test_shared_uploaded_document_requires_family_review(self):
        db=DB()
        own_file=HOME+"/doc-a/shared.pdf"
        db.rows["documents"]=[{"id":"a","household_id":HOME,
                               "uploaded_by":USER,"visibility":"household",
                               "file_url":"storage://documents/"+own_file}]
        db.storage.objects={own_file}
        with self.assertRaises(HTTPException):
            execute_member_deletion(db=db,**approved(db))
        self.assertEqual(db.writes,0)
        self.assertEqual(db.storage.objects,{own_file})

    def test_missing_orphan_storage_blocks_before_writes(self):
        db=DB()
        own_file=HOME+"/doc-a/private.pdf"
        orphan_file=HOME+"/doc-z/orphan.pdf"
        db.rows["documents"]=[{"id":"a","household_id":HOME,"uploaded_by":USER,
                               "visibility":"private",
                               "file_url":"storage://documents/"+own_file}]
        db.storage.objects={own_file,orphan_file}
        with self.assertRaises(HTTPException):
            execute_member_deletion(db=db,**approved(db))
        self.assertEqual(db.writes,0)
        self.assertEqual(db.storage.objects,{own_file,orphan_file})

    def test_unlisted_document_object_blocks_before_writes(self):
        db=DB()
        own_file=HOME+"/doc-a/missing.pdf"
        db.rows["documents"]=[{"id":"a","household_id":HOME,"uploaded_by":USER,
                               "visibility":"private",
                               "file_url":"storage://documents/"+own_file}]
        with self.assertRaises(HTTPException):
            execute_member_deletion(db=db,**approved(db))
        self.assertEqual(db.writes,0)

    def test_finance_connections_block_delete(self):
        db=DB();db.rows["finance_connections"]=[{"id":"bank","owner_user_id":USER,"household_id":HOME}]
        with self.assertRaises(HTTPException):execute_member_deletion(db=db,**approved(db))
        self.assertEqual(db.writes,0)
    def test_owner_approval_blocked(self):
        db=DB();db.rows["household_members"][0]["role"]="owner"
        with self.assertRaises(HTTPException):execute_member_deletion(db=db,**approved(db))
        self.assertEqual(db.writes,0)

if __name__=="__main__":
    unittest.main()
