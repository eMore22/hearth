"""Chief conversations must be private within a shared household."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.routers.chief_of_staff import get_history, clear_history, chat

HOUSEHOLD="00000000-0000-4000-8000-000000000020"
ALICE="00000000-0000-4000-8000-000000000021"
BOB="00000000-0000-4000-8000-000000000022"

class Query:
    def __init__(self, db):
        self.db=db
        self.filters=[]
        self.deleting=False
        self.order_desc=False
        self.cap=1000
    def select(self,*args):return self
    def eq(self,key,value):
        self.filters.append((key,value));return self
    def order(self,key,desc=False):
        self.order_desc=desc;return self
    def limit(self,n):
        self.cap=n;return self
    def delete(self):
        self.deleting=True;return self
    def execute(self):
        rows=[r for r in self.db.records if all(r.get(k)==v for k,v in self.filters)]
        if self.deleting:
            self.db.records=[r for r in self.db.records if r not in rows]
            return SimpleNamespace(data=rows)
        return SimpleNamespace(data=list(reversed(rows))[:self.cap]
                               if self.order_desc else rows[:self.cap])

class DB:
    def __init__(self):
        self.records=[
            {"id":"a-1","household_id":HOUSEHOLD,"user_id":ALICE,"role":"user","content":"Alice private health question"},
            {"id":"b-1","household_id":HOUSEHOLD,"user_id":BOB,"role":"user","content":"Bob confidential financial question"},
            {"id":"a-2","household_id":HOUSEHOLD,"user_id":ALICE,"role":"assistant","content":"Private response"},
        ]
    def table(self,name):
        if name!="chat_messages":
            raise AssertionError("Unexpected backend access: "+name)
        return Query(self)

class Request:
    async def json(self): return {"message":"How are my bills?"}

class ChatPrivacyTests(unittest.IsolatedAsyncioTestCase):
    async def test_member_cannot_read_other_members_history(self):
        db=DB()
        with patch("app.routers.chief_of_staff.get_supabase_admin",return_value=db):
            history=await get_history({"id":ALICE,"household_id":HOUSEHOLD})
        self.assertEqual({x["user_id"] for x in history},{ALICE})
        self.assertEqual(len(history),2)
        self.assertNotIn("Bob confidential",str(history))

    async def test_clear_deletes_only_own_history(self):
        db=DB()
        with patch("app.routers.chief_of_staff.get_supabase_admin",return_value=db):
            result=await clear_history({"id":ALICE,"household_id":HOUSEHOLD})
        self.assertEqual(result["status"],"cleared")
        self.assertEqual(len(db.records),1)
        self.assertEqual(db.records[0]["user_id"],BOB)

    async def test_model_memory_excludes_other_member_chats(self):
        db=DB()
        with (patch("app.routers.chief_of_staff.get_supabase_admin",return_value=db),
              patch("app.routers.chief_of_staff.load_household_context",return_value={"source_status":{}}),
              patch("app.routers.chief_of_staff.ChiefOfStaffAgent") as agent,
              patch("app.routers.chief_of_staff._log_chat_exchange"),
              patch("app.routers.chief_of_staff.log_event")):
            agent.return_value.process_chat=AsyncMock(return_value={"message":"Okay","category":"bills"})
            result=await chat(Request(),current_user={"id":ALICE,"household_id":HOUSEHOLD})
            history=agent.return_value.process_chat.await_args.kwargs["conversation_history"]
        self.assertEqual(result["message"],"Okay")
        self.assertEqual(len(history),2)
        self.assertNotIn("Bob confidential",str(history))
        self.assertIn("Alice private",str(history))


if __name__=="__main__":
    unittest.main()
