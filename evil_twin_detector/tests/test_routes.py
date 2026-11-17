"""Integration tests for Flask routes (runs when Flask is installed)."""

import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HAS_FLASK = importlib.util.find_spec("flask") is not None and importlib.util.find_spec("flask_sqlalchemy") is not None


@unittest.skipUnless(HAS_FLASK, "Flask not installed in sandbox")
class TestFlaskRoutes(unittest.TestCase):
    def setUp(self):
        from app import create_app

        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "SECRET_KEY": "test-secret-key",
            }
        )
        self.client = self.app.test_client()

    def test_first_run_setup_and_login_protection(self):
        res = self.client.get("/dashboard", follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        self.assertIn("/setup", res.headers["Location"])

        setup_res = self.client.post(
            "/setup",
            data={
                "username": "admin",
                "password": "StrongPassword123!",
                "confirm_password": "StrongPassword123!",
            },
            follow_redirects=True,
        )
        self.assertEqual(setup_res.status_code, 200)
        self.assertIn(b"Security Operations Dashboard", setup_res.data)

    def test_approved_ap_crud_and_demo_scan(self):
        self.client.post(
            "/setup",
            data={
                "username": "admin",
                "password": "StrongPassword123!",
                "confirm_password": "StrongPassword123!",
            },
        )
        ap_res = self.client.post(
            "/api/access-points",
            json={
                "ssid": "CCUK_Campus_WiFi",
                "bssid": "A4:2B:8C:10:44:01",
                "expected_security": "WPA2",
                "description": "Main Library",
            },
        )
        self.assertEqual(ap_res.status_code, 201)

        scan_res = self.client.post("/api/scan", json={"demo_mode": True})
        self.assertEqual(scan_res.status_code, 200)
        payload = scan_res.get_json()
        self.assertTrue(payload["ok"])
        self.assertGreaterEqual(payload["alerts_created"], 1)


if __name__ == "__main__":
    unittest.main()
