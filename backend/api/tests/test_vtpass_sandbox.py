"""Read-only VTpass Sandbox adapter regression tests (no network)."""
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.services.vtpass_sandbox import verify_test_meter, VtpassSandboxUnavailable
from app.routers.utilities import vtpass_verify_meter, vtpass_capabilities, TestMeterRequest


class VTpassSandboxTests(unittest.IsolatedAsyncioTestCase):
    async def test_no_real_meter_or_enabled_flag(self):
        with patch.dict("os.environ", {"VTPASS_SANDBOX_ENABLED": "true",
                                       "VTPASS_SANDBOX_API_KEY": "test",
                                       "VTPASS_SANDBOX_SECRET_KEY": "test"}):
            with self.assertRaises(ValueError):
                await verify_test_meter("prepaid", "1234567890123")
        with patch.dict("os.environ", {"VTPASS_SANDBOX_ENABLED": "false",
                                       "VTPASS_SANDBOX_API_KEY": "test",
                                       "VTPASS_SANDBOX_SECRET_KEY": "test"}):
            with self.assertRaises(VtpassSandboxUnavailable):
                await verify_test_meter("prepaid", "1111111111111")

    async def test_provider_response_is_whitelisted_no_pii(self):
        response = MagicMock()
        response.json.return_value = {
            "code": "000", "content": {
                "Customer_Name": "PRIVATE PERSON",
                "Address": "PRIVATE ADDRESS",
                "Meter_Number": "1111111111111",
                "WrongBillersCode": False,
            }}
        response.raise_for_status.return_value = None
        context = AsyncMock()
        context.get = AsyncMock()
        context.post.return_value = response
        wrapper = MagicMock()
        wrapper.__aenter__ = AsyncMock(return_value=context)
        wrapper.__aexit__ = AsyncMock(return_value=None)
        with patch.dict("os.environ", {"VTPASS_SANDBOX_ENABLED": "true",
                                       "VTPASS_SANDBOX_API_KEY": "test",
                                       "VTPASS_SANDBOX_SECRET_KEY": "test"}):
            with patch("app.services.vtpass_sandbox.httpx.AsyncClient", return_value=wrapper):
                result = await verify_test_meter("prepaid", "1111111111111")
        self.assertTrue(result["provider_verified"])
        self.assertFalse(result["payments_enabled"])
        self.assertNotIn("PRIVATE", str(result))
        self.assertNotIn("1111111111111", str(result))
        self.assertEqual(context.post.await_args.args[0], "/api/merchant-verify")

    async def test_no_allowlist_means_no_vtpass_call(self):
        user = {"id": "tester", "household_id": "h"}
        payload = TestMeterRequest(service_id="enugu-electric", meter_type="prepaid",
                                   meter_number="1111111111111")
        with patch.dict("os.environ", {"VTPASS_SANDBOX_ENABLED": "true",
                                       "VTPASS_SANDBOX_TESTER_USER_IDS": "other",
                                       "VTPASS_SANDBOX_API_KEY": "test",
                                       "VTPASS_SANDBOX_SECRET_KEY": "test"}):
            self.assertFalse(vtpass_capabilities(current_user=user)["meter_verification_available"])
            with self.assertRaises(HTTPException) as err:
                await vtpass_verify_meter(payload, current_user=user)
            self.assertEqual(err.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
