"""HA credential encryption rollout, strict failure, and tenant migration."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from cryptography.fernet import Fernet
from fastapi import HTTPException
from app.services.ha_credentials import TOKEN_PREFIX, encrypt_ha_token, read_ha_token, migrate_active_ha_credentials

H = "00000000-0000-4000-8000-000000000011"


class FakeTable:
    def __init__(self, row):
        self.row = row
        self.filters = []
        self.change = None
        self.single = False
        self.writes = 0
    def select(self, *args): return self
    def limit(self, count): return self
    def update(self, values): self.change = values; return self
    def eq(self, name, value): self.filters.append((name, value)); return self
    def maybe_single(self): self.single = True; return self
    def execute(self):
        allowed = all(self.row.get(k) == v for k, v in self.filters)
        self.filters = []
        if self.change is not None:
            values = self.change
            self.change = None
            if allowed:
                self.writes += 1
                self.row.update(values)
                return SimpleNamespace(data=[dict(self.row)])
            return SimpleNamespace(data=[])
        if not self.single:
            return SimpleNamespace(data=[dict(self.row)] if allowed else [])
        return SimpleNamespace(data=dict(self.row) if allowed else None)


class FakeDB:
    def __init__(self, token, household=H):
        self.conn = FakeTable({"household_id": household, "is_active": True,
                               "ha_access_token": token})
    def table(self, name):
        assert name == "ha_connections"
        return self.conn


class CredentialTests(unittest.TestCase):
    def setUp(self):
        self.key = Fernet.generate_key().decode()
        self.secret = "sample-home-assistant-credential-do-not-use"

    def test_encryption_round_trip_and_no_plaintext_storage(self):
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", self.key):
            ciphertext = encrypt_ha_token(self.secret)
            self.assertTrue(ciphertext.startswith(TOKEN_PREFIX))
            self.assertNotIn(self.secret, ciphertext)
            db = FakeDB(ciphertext)
            self.assertEqual(read_ha_token(H, db.conn.row, db), self.secret)
            self.assertEqual(db.conn.writes, 0)

    def test_plaintext_legacy_row_is_atomically_upgraded(self):
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", self.key):
            db = FakeDB(self.secret)
            self.assertEqual(read_ha_token(H, dict(db.conn.row), db), self.secret)
            self.assertEqual(db.conn.writes, 1)
            self.assertTrue(db.conn.row["ha_access_token"].startswith(TOKEN_PREFIX))
            self.assertEqual(read_ha_token(H, dict(db.conn.row), db), self.secret)

    def test_missing_key_refuses_legacy_and_new_tokens(self):
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", ""):
            db = FakeDB(self.secret)
            with self.assertRaises(HTTPException) as e:
                read_ha_token(H, dict(db.conn.row), db)
            self.assertEqual(e.exception.status_code, 503)
            self.assertEqual(db.conn.writes, 0)
            with self.assertRaises(HTTPException):
                encrypt_ha_token(self.secret)

    def test_wrong_key_and_tampered_ciphertext_fail_closed(self):
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", self.key):
            ciphertext = encrypt_ha_token(self.secret)
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode()):
            with self.assertRaises(HTTPException) as e:
                read_ha_token(H, FakeDB(ciphertext).conn.row, FakeDB(ciphertext))
            self.assertEqual(e.exception.status_code, 503)

    def test_cross_household_plaintext_cannot_be_migrated(self):
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", self.key):
            db = FakeDB(self.secret, household="00000000-0000-4000-8000-000000000012")
            with self.assertRaises(HTTPException):
                read_ha_token(H, dict(db.conn.row), db)
            self.assertEqual(db.conn.writes, 0)
            self.assertEqual(db.conn.row["ha_access_token"], self.secret)


    def test_startup_migration_encrypts_legacy_row_once(self):
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", self.key):
            db = FakeDB(self.secret)
            first = migrate_active_ha_credentials(db)
            self.assertEqual(first["migrated"], 1)
            self.assertEqual(first["failed"], 0)
            self.assertTrue(db.conn.row["ha_access_token"].startswith(TOKEN_PREFIX))
            second = migrate_active_ha_credentials(db)
            self.assertEqual(second["migrated"], 0)
            self.assertEqual(second["failed"], 0)
            self.assertEqual(db.conn.writes, 1)

    def test_startup_migration_refuses_missing_key(self):
        with patch("app.services.ha_credentials.settings.HA_TOKEN_ENCRYPTION_KEY", ""):
            db = FakeDB(self.secret)
            result = migrate_active_ha_credentials(db)
            self.assertEqual(result["migrated"], 0)
            self.assertEqual(result["failed"], 1)
            self.assertEqual(db.conn.writes, 0)

if __name__ == "__main__":
    unittest.main()
