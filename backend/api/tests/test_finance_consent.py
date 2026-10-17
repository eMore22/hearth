import unittest
from datetime import datetime, timedelta, timezone
from app.services.finance_consent import FinanceConsent, ConsentNotGranted, require_read_consent

class ConsentTests(unittest.TestCase):
    def setUp(self):
        now=datetime(2026,10,17,tzinfo=timezone.utc)
        self.now=now
        self.consent=FinanceConsent("u1","h1",frozenset({"accounts.read","transactions.read"}),now-timedelta(days=1),now+timedelta(days=14))
        self.args={"user_id":"u1","household_id":"h1","scope":"transactions.read","now":now}
    def test_valid_read_scope(self):
        self.assertIsNone(require_read_consent(self.consent,**self.args))
    def test_cross_owner_and_household(self):
        for replacement in ({"user_id":"u2"},{"household_id":"h2"}):
            with self.assertRaises(ConsentNotGranted):
                require_read_consent(self.consent,**{**self.args,**replacement})
    def test_cannot_approve_payments(self):
        with self.assertRaises(ConsentNotGranted):
            require_read_consent(self.consent,**{**self.args,"scope":"payments.write"})
    def test_revoked_and_expired(self):
        revoked=FinanceConsent("u1","h1",self.consent.scopes,self.consent.accepted_at,self.consent.expires_at,self.now)
        expired=FinanceConsent("u1","h1",self.consent.scopes,self.now-timedelta(days=20),self.now-timedelta(days=1))
        for record in (revoked,expired,None):
            with self.assertRaises(ConsentNotGranted):
                require_read_consent(record,**self.args)
if __name__=="__main__":
    unittest.main()
