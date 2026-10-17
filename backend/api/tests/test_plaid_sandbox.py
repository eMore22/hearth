import unittest
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.plaid_sandbox import create_sandbox_link_token, PlaidSandboxUnavailable

class PlaidSandboxTests(unittest.IsolatedAsyncioTestCase):
    async def test_requires_credentials(self):
        with patch.dict("os.environ", {"PLAID_CLIENT_ID":"", "PLAID_SANDBOX_SECRET":""}):
            with self.assertRaises(PlaidSandboxUnavailable):
                await create_sandbox_link_token(user_id="user-1")

    async def test_can_only_call_sandbox_with_canadian_android_configuration(self):
        response=MagicMock()
        response.json.return_value={"link_token":"link-sandbox-test"}
        response.raise_for_status.return_value=None
        http_client=AsyncMock()
        http_client.post.return_value=response
        http_client.__aenter__.return_value=http_client
        http_client.__aexit__.return_value=False
        with patch.dict("os.environ", {"PLAID_CLIENT_ID":"test-client", "PLAID_SANDBOX_SECRET":"test-secret"}):
            with patch("app.services.plaid_sandbox.httpx.AsyncClient", return_value=http_client):
                result=await create_sandbox_link_token(user_id="user-1")
        self.assertEqual(result,"link-sandbox-test")
        args,kwargs=http_client.post.call_args
        self.assertEqual(args[0],"https://sandbox.plaid.com/link/token/create")
        self.assertEqual(kwargs["json"]["country_codes"],["CA"])
        self.assertEqual(kwargs["json"]["android_package_name"],"com.emore22.hearth")
        self.assertEqual(kwargs["json"]["products"],["transactions"])
        self.assertNotIn("redirect_uri",kwargs["json"])
if __name__=="__main__":
    unittest.main()
