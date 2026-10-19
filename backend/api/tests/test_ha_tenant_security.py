"""Per-household Home Assistant credentials and safe physical actions."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from app.services.ha_security import (
    webhook_token, check_webhook_token, public_https_host, household_owner,
)
from app.routers.automation import receive_webhook, execute_action, ExecuteActionRequest, _process_event_with_chief, sensitive_device_action

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
        self.devices=Query({"entity_id":"sensor.water"})
    def table(self, name):
        return {
          "household_members":self.members,
          "ha_connections":self.connection,
          "ha_events":self.events,
          "ha_devices":self.devices,
        }[name]


class Req:
    def __init__(self, body:bytes):
        self.body=body
    async def stream(self):
        yield self.body


class WebhookIsolationTests(unittest.IsolatedAsyncioTestCase):
    def test_tenant_tokens_are_distinct_and_root_secret_is_not_accepted(self):
        with patch("app.services.ha_security.settings.HA_WEBHOOK_SECRET","global-root-pretend-test"):
            token = webhook_token(H1, CONNECTED_AT)
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
        with (patch("app.services.ha_security.settings.HA_WEBHOOK_SECRET","global-root-pretend-test"),
              patch("app.routers.automation.get_supabase_admin",return_value=db)):
            with self.assertRaises(HTTPException) as error:
                await receive_webhook(Req(event),
                   x_hearth_household_id=H1,
                   x_hearth_webhook_token="global-root-pretend-test")
        self.assertEqual(error.exception.status_code,401)
        self.assertEqual(db.events.writes,0)

    async def test_valid_tenant_token_can_only_announce_known_device(self):
        db=DB()
        payload=b'{"entity_id":"sensor.water","event_type":"state_changed","new_state":"wet"}'
        with (patch("app.services.ha_security.settings.HA_WEBHOOK_SECRET","global-root-pretend-test"),
              patch("app.routers.automation.get_supabase_admin",return_value=db),
              patch("app.routers.automation.log_event"),
              patch("app.routers.automation._process_event_with_chief",new_callable=AsyncMock)):
            token=webhook_token(H1,CONNECTED_AT)
            result=await receive_webhook(Req(payload),x_hearth_household_id=H1,x_hearth_webhook_token=token)
        self.assertEqual(result["status"],"received")
        self.assertEqual(db.events.writes,1)
        self.assertIn(("household_id",H1),db.connection.filters)

    async def test_critical_alert_excludes_personal_insurance_document(self):
        class Rows:
            def __init__(self,rows):
                self.rows=rows;self.conditions=[]
            def select(self,*a,**kw):return self
            def eq(self,k,v):self.conditions.append((k,v));return self
            def limit(self,*a):return self
            def update(self,*a):return self
            def execute(self):
                return SimpleNamespace(data=[r for r in self.rows if all(r.get(k)==v for k,v in self.conditions)])
        class IsolationDB:
            def __init__(self):
                self.docs=Rows([
                    {"household_id":H1,"title":"PRIVATE LIFE COVERAGE","document_type":"insurance","visibility":"private"},
                    {"household_id":H1,"title":"Shared Home Coverage","document_type":"insurance","visibility":"household"}])
                self.members=Rows([{"household_id":H1,"user_id":USER}])
                self.events=Rows([])
            def table(self,name):
                return {"documents":self.docs,"household_members":self.members,"ha_events":self.events}[name]
        db=IsolationDB()
        with (patch("app.agents.chief_of_staff_agent.ChiefOfStaffAgent") as chief,
              patch("app.routers.automation.log_event"),
              patch("app.services.push_service.send_push_to_household",new_callable=AsyncMock)):
            chief.return_value.ask_claude.return_value="An event was detected; review the home."
            await _process_event_with_chief(H1,"sensor.water","state_changed","off","on",
                {"device_class":"moisture","friendly_name":"Water sensor"},db)
        prompt=chief.return_value.ask_claude.call_args.args[0]
        self.assertIn("Shared Home Coverage",prompt)
        self.assertNotIn("PRIVATE LIFE COVERAGE",prompt)
        self.assertIn(("visibility","household"),db.docs.conditions)

    def test_safety_sensitive_devices_require_confirmation(self):
        self.assertTrue(sensitive_device_action("lock","lock.front_door"))
        self.assertTrue(sensitive_device_action("cover","cover.garage"))
        self.assertTrue(sensitive_device_action("switch","switch.main_water_valve"))
        self.assertTrue(sensitive_device_action("input_boolean","input_boolean.gas_valve"))
        self.assertFalse(sensitive_device_action("light","light.kitchen"))
        self.assertFalse(sensitive_device_action("switch","switch.desk_lamp"))

    async def test_unconfirmed_lock_action_is_rejected_at_server(self):
        db=DB(role="owner")
        db.devices.data={"domain":"lock","is_actionable":True,
                         "entity_id":"lock.front_door"}
        with (patch("app.routers.automation.get_supabase_admin",return_value=db),
              patch("app.services.ha_security.get_supabase_admin",return_value=db)):
            with self.assertRaises(HTTPException) as caught:
                await execute_action(
                    ExecuteActionRequest(entity_id="lock.front_door",action="unlock"),
                    current_user={"id":USER,"household_id":H1})
        self.assertEqual(caught.exception.status_code,428)
        self.assertEqual(db.events.writes,0)

    async def test_household_owner_needed_before_device_call(self):
        db=DB(role="member")
        with (patch("app.routers.automation.get_supabase_admin",return_value=db),
              patch("app.services.ha_security.get_supabase_admin",return_value=db)):
            with self.assertRaises(HTTPException) as e:
                await execute_action(
                    ExecuteActionRequest(entity_id="lock.front_door",action="unlock"),
                    current_user={"id":USER,"household_id":H1})
        self.assertEqual(e.exception.status_code,403)


if __name__=="__main__":
    unittest.main()
