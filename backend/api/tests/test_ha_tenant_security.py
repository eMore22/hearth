"""Per-household Home Assistant credentials and safe physical actions."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import HTTPException
from app.services.ha_security import (
    webhook_token, check_webhook_token, public_https_host, household_owner,
)
from app.routers.automation import receive_webhook, execute_action, ExecuteActionRequest

H1 = "00000000-0000-4000-8000-000000000001"
H2 = "00000000-0000-4000-8000-000000000002"
USER = "00000000-0000-4000-8000-000000000003"
CONNECTED_AT = "2026-10-19T10:00:00+00:00"


class Query:
    def __init__(self, data):
        self.data=data
        self.filters=[]
        self.writes=0
    def select(self, *a, **kw):
        return self
    def eq(self, key, value):
        self.filters.append((key,value))
        return self
    def maybe_single(self):
        return self
    def execute(self):
        return SimpleNamespace(data=self.data)
    def insert(self, data):
        self.writes+=1
        return self
    def update(self, data):
        self.writes+=1
        return self


class DB:
    def __init__(self, role="owner", active=True):
        self.members=Query({"role":role})
        self.connection=Query({"ha_connected_at":CONNECTED_AT} if active else None)
        self.events=Query([])
    def table(self, name):
        return {
          "household_members":self.members,
          "ha_connections":self.connection,
          "ha_events":self.events,
          "ha_devices":self.events,
        }[name]


class Req:
    def __init__(self, body:bytes):
        self.body=body
    async def stream(self):
        yield self.body


class WebhookIsolationTests(unittest.IsolatedAsyncioTestCase):
    def test_tenant_tokens_are_distinct_and_root_secret_is_not_accepted(self):
        with patch("app.services.ha_security.settings.HA_WEBHOOK_SECRET","global-root-pretend-test"):
            token=webhook_token(H1,CONNECTED_AT)
            self.assertEqual(len(token),64)
            self.assertTrue(check_webhook_token(H1,CONNECTED_AT,token))
            self.assertFalse(check_webhook_token(H2,CONNECTED_AT,token))
            self.assertFalse(check_webhook_token(H1,"2026-10-19T11:00:00+00:00",token))
            self.assertFalse(check_webhook_token(H1,CONNECTED_AT,"global-root-pretend-test"))

    def test_local_private_hosts_and_credentials_rejected(self):
        for host in (
            "http://example.com", "https://127.0.0.1",
            "https://169.254.169.254", "https://192.168.1.15",
            "https://localhost", "https://homeassistant.local",
            "https://user:pass@example.org", "https://example.org:8123",
            "https://example.org/?redirect=private", "https://example.internal",
        ):
            with self.assertRaises(HTTPException,msg=host):
                public_https_host(host)
        self.assertEqual(public_https_host("https://house.example.org"),"house.example.org")

    def test_household_member_cannot_manage_ha_credentials(self):
        db=DB(role="member")
        with self.assertRaises(HTTPException) as e:
            household_owner({"id":USER,"household_id":H1},db)
        self.assertEqual(e.exception.status_code,403)

    async def test_old_global_key_cannot_write_events(self):
        db=DB()
        event=('{"entity_id":"sensor.water","event_type":"state_changed",'
               '"new_state":"wet"}').encode()
        with patch("app.services.ha_security.settings.HA_WEBHOOK_SECRET","global-root-pretend-test"), \\
             patch("app.routers.automation.get_supabase_admin",return_value=db):
            with self.assertRaises(HTTPException) as error:
                await receive_webhook(Req(event),
                   x_hearth_household_id=H1,
                   x_hearth_webhook_token="global-root-pretend-test")
        self.assertEqual(error.exception.status_code,401)
        self.assertEqual(db.events.writes,0)

    async def test_household_owner_needed_before_device_call(self):
        db=DB(role="member")
        with patch("app.routers.automation.get_supabase_admin",return_value=db), \\
             patch("app.services.ha_security.get_supabase_admin",return_value=db):
            with self.assertRaises(HTTPException) as e:
                await execute_action(
                    ExecuteActionRequest(entity_id="lock.front_door",action="unlock"),
                    current_user={"id":USER,"household_id":H1})
        self.assertEqual(e.exception.status_code,403)


if __name__=="__main__":
    unittest.main()
