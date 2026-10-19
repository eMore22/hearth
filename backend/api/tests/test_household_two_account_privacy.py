"""Two-account privacy checks without touching customer documents or balances.

Exercises actual service/route functions using tenant-filtering fake DB, never
live Supabase Auth or personal private records.
"""
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import HTTPException
from app.routers.documents import access_document, change_visibility, ShareDocumentRequest
from app.services.owner_private_finance import require_household_owner, owner_bank_profile
from app.services.household_context import load_household_context

OWNER = "00000000-0000-4000-8000-000000000001"
MEMBER = "00000000-0000-4000-8000-000000000002"
OTHER = "00000000-0000-4000-8000-000000000003"
HOME = "00000000-0000-4000-8000-000000000004"
OTHER_HOME = "00000000-0000-4000-8000-000000000005"
FILE = "00000000-0000-4000-8000-000000000006"


class Rows:
    def __init__(self, items):
        self.items=items
        self.conditions=[]
        self.updated=None
    def select(self, *args, **kwargs): return self
    def eq(self, name, value):
        self.conditions.append((name,value))
        return self
    def maybe_single(self):return self
    def order(self, *args, **kwargs):return self
    def limit(self, *args):return self
    def gt(self, *args):return self
    def is_(self, *args):return self
    def in_(self, *args):return self
    def update(self, change):
        self.updated=change
        return self
    def execute(self):
        items=self.items if isinstance(self.items,list) else [self.items] if self.items else []
        matching=[row for row in items if all(row.get(key)==value for key,value in self.conditions)]
        if self.updated and matching:
            for row in matching: row.update(self.updated)
        return SimpleNamespace(data=matching[0] if getattr(self,"one",False) else matching)
    def single(self): self.one=True;return self


class Storage:
    def __init__(self):self.signed=0
    def from_(self, name):return self
    def create_signed_url(self,path,seconds):
        self.signed+=1
        return {"signedURL":"https://storage.example.invalid/private-test?token=SANDBOX"}


class FakeDB:
    def __init__(self):
        self.storage=Storage()
        self.tables={
            "documents":[
                {"id":FILE,"household_id":HOME,"uploaded_by":OWNER,
                 "title":"Private Passport", "document_type":"passport",
                 "visibility":"private",
                 "file_url":f"storage://documents/{HOME}/{FILE}/passport.pdf",
                 "file_name":"passport.pdf"},
                {"id":"00000000-0000-4000-8000-000000000007",
                 "household_id":OTHER_HOME,"uploaded_by":OTHER,
                 "title":"Other Family Secret","visibility":"household"},
            ],
            "household_members":[
                {"household_id":HOME,"user_id":OWNER,"role":"owner"},
                {"household_id":HOME,"user_id":MEMBER,"role":"member"},
                {"household_id":OTHER_HOME,"user_id":OTHER,"role":"owner"},
            ],
            "finance_connections":[{"id":"conn","household_id":HOME,
                                    "owner_user_id":OWNER,"status":"linked",
                                    "provider":"plaid","country_code":"CA"}],
            "finance_accounts":[{"id":"private","household_id":HOME,
                                 "owner_user_id":OWNER,"balance_minor":70000,
                                 "currency":"CAD","connection_id":"conn"}],
        }
        self.used={}
    def table(self,name):
        rows=Rows(self.tables.get(name,[]))
        self.used[name]=rows
        return rows


class TenantPrivacyTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db=FakeDB()
        self.doc_id=uuid.UUID(FILE)
        self.owner={"id":OWNER,"household_id":HOME}
        self.member={"id":MEMBER,"household_id":HOME}
        self.other={"id":OTHER,"household_id":OTHER_HOME}

    async def test_private_document_denied_to_member_and_other_household(self):
        with patch("app.routers.documents.get_supabase_admin",return_value=self.db):
            for user in (self.member,self.other):
                with self.assertRaises(HTTPException) as caught:
                    await access_document(self.doc_id,user=user,_=None)
                self.assertEqual(caught.exception.status_code,404)
        self.assertEqual(self.db.storage.signed,0)

    async def test_private_document_accessible_to_owner_only(self):
        with patch("app.routers.documents.get_supabase_admin",return_value=self.db):
            result=await access_document(self.doc_id,user=self.owner,_=None)
        self.assertTrue(result["url"].startswith("https://"))
        self.assertEqual(result["expires_in_seconds"],300)
        self.assertEqual(self.db.storage.signed,1)

    async def test_explicit_sharing_and_revocation(self):
        with patch("app.routers.documents.get_supabase_admin",return_value=self.db):
            with self.assertRaises(HTTPException):
                await change_visibility(self.doc_id,ShareDocumentRequest(visibility="household"),user=self.member,_=None)
            result=await change_visibility(self.doc_id,ShareDocumentRequest(visibility="household"),user=self.owner,_=None)
            self.assertEqual(result["visibility"],"household")
            shared=await access_document(self.doc_id,user=self.member,_=None)
            self.assertEqual(shared["name"],"passport.pdf")
            await change_visibility(self.doc_id,ShareDocumentRequest(visibility="private"),user=self.owner,_=None)
            with self.assertRaises(HTTPException):
                await access_document(self.doc_id,user=self.member,_=None)

    def test_bank_overview_forbidden_for_member(self):
        with patch("app.services.owner_private_finance.get_supabase_admin",return_value=self.db):
            with self.assertRaises(HTTPException) as caught:
                owner_bank_profile(self.member)
        self.assertEqual(caught.exception.status_code,403)
        self.assertNotIn("finance_connections",self.db.used)
        self.assertNotIn("finance_accounts",self.db.used)

    def test_unauthorized_bank_member_never_becomes_owner(self):
        with self.assertRaises(HTTPException) as caught:
            require_household_owner(self.other,self.db) if False else require_household_owner(self.member,self.db)
        self.assertEqual(caught.exception.status_code,403)
