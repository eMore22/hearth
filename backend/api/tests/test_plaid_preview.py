import unittest
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.plaid_preview import preview_sandbox_accounts, PlaidPreviewUnavailable

class SandboxPreviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_non_sandbox_token(self):
        with self.assertRaises(PlaidPreviewUnavailable):
            await preview_sandbox_accounts("public-production-abc")

    async def test_preview_revokes_item_and_never_returns_secret(self):
        exchange = MagicMock()
        exchange.json.return_value = {"access_token":"access-sandbox-private"}
        exchange.raise_for_status.return_value = None
        accounts = MagicMock()
        accounts.json.return_value = {"accounts":[{"name":"Chequing","mask":"1234",
            "balances":{"iso_currency_code":"CAD","current":125.30}}]}
        accounts.raise_for_status.return_value = None
        revoke = MagicMock()
        revoke.raise_for_status.return_value = None
        client = AsyncMock()
        client.post.side_effect = [exchange, accounts, revoke]
        client.__aenter__.return_value = client
        client.__aexit__.return_value = False
        with patch.dict("os.environ",{"PLAID_CLIENT_ID":"test","PLAID_SANDBOX_SECRET":"hidden"}):
            with patch("app.services.plaid_preview.httpx.AsyncClient",return_value=client):
                result=await preview_sandbox_accounts("public-sandbox-testing")
        self.assertEqual(result[0]["balance_minor"],12530)
        self.assertNotIn("access_token",result[0])
        self.assertEqual(client.post.call_args_list[-1].args[0],"/item/remove")
        self.assertEqual(client.post.call_args_list[-1].kwargs["json"]["access_token"],"access-sandbox-private")

if __name__=="__main__":
    unittest.main()
