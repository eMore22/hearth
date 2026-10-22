"""Check static public legal endpoints require no Auth and describe reality."""
import unittest
from app.main import app
from fastapi.testclient import TestClient


class LegalPagesTests(unittest.TestCase):
    def test_public_policies_are_accessible_without_login(self):
        client = TestClient(app)
        for path, text in (("/privacy-policy", "Privacy Policy"),
                               ("/terms-of-service", "Terms of Service"),
                               ("/account-deletion", "Delete your Hearth HQ account")):
            response = client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn(text, response.text)
            self.assertIn("Hearth", response.text)

    def test_privacy_page_does_not_claim_completed_deletion(self):
        client = TestClient(app)
        response = client.get("/privacy-policy")
        self.assertIn("Hearth will not claim", response.text)
        self.assertNotIn("permanently deleted within 30 days", response.text)

if __name__ == "__main__":
    unittest.main()
