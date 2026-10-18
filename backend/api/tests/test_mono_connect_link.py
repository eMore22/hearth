"""Mono Connect Link Sandbox security regression tests. All provider calls mocked."""
import json
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from starlette.requests import Request
from app.services.mono_connect_link import (
    MonoLinkError, _safe_balance, _valid_consent, config_ready,
    initiate, account_preview, revoke,
)
from app.routers.mono_webhooks import mono_event


def row(consent="linked", owner="owner", household="home"):
    return {
        "id": "de46c015-4935-41d9-b2cf-13cf5a634adb",
        "owner_user_id": owner,
        "household_id": household,
        "provider": "mono",
        "country_code": "NG",
        "status": consent,
        "provider_connection_ref": "6979274350b9c321c14524b1",
        "consent_scopes": ["accounts.read", "balances.read", "transactions.read"],
        "consent_expires_at": (datetime.now(timezone.utc)+timedelta(days=25)).isoformat(),
        "consent_revoked_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


class FakeQuery:
    def __init__(self, database, name):
        self.database=database
        self.name=name
        self.conditions=[]
        self.update_values=None
    def select(self, *args, **kwargs): return self
    def eq(self, key, value):
        self.conditions.append((key,value))
        return self
    def is_(self, key, value):
        self.conditions.append((key,None if value == "null" else value))
        return self
    def maybe_single(self): return self
    def update(self, value):
        self.update_values=value
        return self
    def execute(self):
        if self.name == "finance_consent_events":
            return SimpleNamespace(data=[{"id":"test-event"}])
        candidate=self.database.rows.get(self.name)
        if candidate and all(candidate.get(k)==v for k,v in self.conditions):
            if self.update_values:
                candidate.update(self.update_values)
                return SimpleNamespace(data=[dict(candidate)])
            return SimpleNamespace(data=dict(candidate))
        return SimpleNamespace(data=[] if self.update_values else None)
    def insert(self, *args, **kwargs): return self
    def order(self, *args, **kwargs): return self
    def limit(self, *args, **kwargs): return self


class FakeDB:
    def __init__(self, connection):
        self.rows={"finance_connections":connection}
    def table(self, name): return FakeQuery(self,name)


def test_request(body: dict):
    raw=json.dumps(body).encode()
    async def receive(): return {"type":"http.request","body":raw,"more_body":False}
    return Request({"type":"http","method":"POST","path":"/api/webhooks/mono",
                    "headers":[(b"content-length",str(len(raw)).encode())]},receive)


class MonoLinkSecurityTests(unittest.IsolatedAsyncioTestCase):
    def test_consent_required_and_expires(self):
        linked=row()
        self.assertTrue(_valid_consent(linked))
        linked["consent_revoked_at"]=datetime.now(timezone.utc).isoformat()
        self.assertFalse(_valid_consent(linked))
        linked["consent_revoked_at"]=None
        linked["consent_expires_at"]=(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat()
        self.assertFalse(_valid_consent(linked))

    def test_mono_balance_is_masked_and_ngn_only(self):
        data={"data":{"account":{"name":"Test","currency":"NGN","account_number":"0123456789",
                "balance":73573,"institution":{"name":"Demo Bank"},"bvn":"6115"},
                "meta":{"data_status":"AVAILABLE","retrieved_data":["balance","transactions","identity"]}}}
        response=_safe_balance(data)
        self.assertEqual(response["balance_minor"],73573)
        self.assertEqual(response["masked_account"],"••••6789")
        self.assertNotIn("0123456789",str(response))
        self.assertNotIn("6115",str(response))
        self.assertEqual(response["retrieved_data"],["balance","transactions"])
        data["data"]["account"]["currency"]="USD"
        with self.assertRaises(MonoLinkError):
            _safe_balance(data)

    async def test_pending_creation_requires_explicit_consent_and_test_key(self):
        with patch.dict("os.environ",{
            "MONO_SANDBOX_DEMO_ENABLED":"true",
            "MONO_SANDBOX_SECRET_KEY":"test_sk_unit_test_only",
            "MONO_SANDBOX_WEBHOOK_SECRET":"signing-test",
            "MONO_SANDBOX_APP_ID":"sample-app",
        }):
            self.assertTrue(config_ready())
            with self.assertRaises(MonoLinkError):
                await initiate(user_id="owner",household_id="home",email="x@example.org",
                               name="Tester",acknowledged=False)

    async def test_preview_is_denied_to_other_household(self):
        db=FakeDB(row())
        with patch("app.services.mono_connect_link._db",return_value=db),patch(
            "app.services.mono_connect_link._request",new_callable=AsyncMock
        ) as external:
            with self.assertRaises(MonoLinkError):
                await account_preview(user_id="attacker",household_id="other",
                    connection_id=row()["id"])
            external.assert_not_awaited()

    async def test_revoked_access_never_calls_mono(self):
        conn=row()
        conn["consent_revoked_at"]=datetime.now(timezone.utc).isoformat()
        db=FakeDB(conn)
        with patch("app.services.mono_connect_link._db",return_value=db),patch(
            "app.services.mono_connect_link._request",new_callable=AsyncMock
        ) as external:
            with self.assertRaises(MonoLinkError):
                await account_preview(user_id="owner",household_id="home",
                    connection_id=conn["id"])
            external.assert_not_awaited()

    async def test_invalid_webhook_header_never_writes(self):
        payload={"event":"mono.events.account_connected","data":{
            "id":"6979274350b9c321c14524b1","app":"sample-app",
            "meta":{"ref":row()["id"]}}}
        with patch.dict("os.environ",{
            "MONO_SANDBOX_DEMO_ENABLED":"true","MONO_SANDBOX_SECRET_KEY":"test_sk_unit_test",
            "MONO_SANDBOX_WEBHOOK_SECRET":"correct-signature","MONO_SANDBOX_APP_ID":"sample-app",
        }):
            with patch("app.routers.mono_webhooks.get_supabase_admin") as db:
                with self.assertRaises(HTTPException) as error:
                    await mono_event(test_request(payload), mono_webhook_secret="wrong")
                self.assertEqual(error.exception.status_code,401)
                db.assert_not_called()

    async def test_webhook_rejects_other_mono_app(self):
        payload={"event":"mono.events.account_connected","data":{
            "id":"6979274350b9c321c14524b1","app":"another-app",
            "meta":{"ref":row()["id"]}}}
        with patch.dict("os.environ",{
            "MONO_SANDBOX_DEMO_ENABLED":"true","MONO_SANDBOX_SECRET_KEY":"test_sk_unit_test",
            "MONO_SANDBOX_WEBHOOK_SECRET":"correct-signature","MONO_SANDBOX_APP_ID":"sample-app",
        }):
            with self.assertRaises(HTTPException) as error:
                await mono_event(test_request(payload), mono_webhook_secret="correct-signature")
            self.assertEqual(error.exception.status_code,400)

    async def test_valid_webhook_links_pending_once(self):
        conn=row("pending")
        db=FakeDB(conn)
        payload={"event":"mono.events.account_connected","data":{
            "id":"6979274350b9c321c14524b1","app":"sample-app",
            "meta":{"ref":conn["id"]}}}
        with patch.dict("os.environ",{
            "MONO_SANDBOX_DEMO_ENABLED":"true","MONO_SANDBOX_SECRET_KEY":"test_sk_unit_test",
            "MONO_SANDBOX_WEBHOOK_SECRET":"correct-signature","MONO_SANDBOX_APP_ID":"sample-app",
        }):
            with patch("app.routers.mono_webhooks.get_supabase_admin",return_value=db):
                self.assertEqual((await mono_event(test_request(payload),"correct-signature"))["received"],True)
                self.assertEqual(conn["status"],"linked")
                self.assertEqual((await mono_event(test_request(payload),"correct-signature"))["received"],True)

if __name__=="__main__": unittest.main()
