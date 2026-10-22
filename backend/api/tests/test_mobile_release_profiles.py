"""Safety invariants for two Android variants (offline, no EAS credentials)."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MOBILE = ROOT / "apps" / "mobile"

class AndroidReleaseProfileTests(unittest.TestCase):
    def test_public_build_excludes_sandbox_links(self):
        profiles = json.loads((MOBILE / "eas.json").read_text())["build"]
        public = profiles["production"]["env"]
        internal = profiles["internalTest"]["env"]
        self.assertEqual(public["EXPO_PUBLIC_BANKING_SANDBOX_UI"], "false")
        self.assertEqual(public["EXPO_PUBLIC_PLAID_SANDBOX_DEMO"], "false")
        self.assertEqual(internal["EXPO_PUBLIC_BANKING_SANDBOX_UI"], "true")
        self.assertEqual(internal["EXPO_PUBLIC_PLAID_SANDBOX_DEMO"], "true")

    def test_every_public_bank_surface_uses_production_gate(self):
        files = [
            MOBILE / "app" / "(tabs)" / "finance.tsx",
            MOBILE / "app" / "(tabs)" / "profile.tsx",
            MOBILE / "app" / "(tabs)" / "integrations.tsx",
            MOBILE / "src" / "components" / "finance" / "MonoSandboxPanel.tsx",
            MOBILE / "src" / "components" / "finance" / "PlaidSandboxPreview.tsx",
        ]
        for path in files:
            with self.subTest(path=path.name):
                value = path.read_text()
                self.assertTrue(
                    ("isInternalBankingSandboxBuild" in value or
                     "EXPO_PUBLIC_BANKING_SANDBOX_UI" in value),
                    f"Missing release bank gate: {path}"
                )

    def test_public_app_still_offers_manual_finance(self):
        source = (MOBILE / "app" / "(tabs)" / "finance.tsx").read_text()
        for phrase in ("Estimated monthly commitments", "Upcoming bill dates", "Manage bills"):
            self.assertIn(phrase, source)

if __name__ == "__main__":
    unittest.main()
