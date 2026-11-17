"""Database and evaluation service unit tests."""

import importlib.util
import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from detection.rule_engine import ApprovedAPProfile, RuleBasedDetectionEngine
from services.evaluation_service import compute_evaluation_metrics, evaluate_labelled_case

HAS_FLASK_SQLALCHEMY = importlib.util.find_spec("flask_sqlalchemy") is not None


class TestEvaluationAndSQLite(unittest.TestCase):
    def test_evaluation_metrics_empty_safe(self):
        metrics = compute_evaluation_metrics([])
        self.assertFalse(metrics["has_data"])
        self.assertIsNone(metrics["precision"])
        self.assertIsNone(metrics["detection_rate"])
        self.assertIsNone(metrics["false_positive_rate"])

    def test_evaluation_metrics_calculations(self):
        engine = RuleBasedDetectionEngine(
            [
                ApprovedAPProfile(
                    ssid="Campus_Net",
                    bssid="AA:BB:CC:11:22:33",
                    expected_security="WPA2",
                )
            ]
        )
        c1, t1, _ = evaluate_labelled_case(engine, "Campus_Net", "AA:BB:CC:11:22:33", "WPA2")
        c2, t2, _ = evaluate_labelled_case(engine, "Campus_Net", "FF:EE:DD:11:22:33", "Open")
        c3, t3, _ = evaluate_labelled_case(engine, "CoffeeShop", "12:34:56:78:9A:BC", "WPA2")

        metrics = compute_evaluation_metrics(
            [
                {"expected_classification": "Legitimate", "actual_classification": c1, "detection_time_ms": t1},
                {"expected_classification": "Simulated Evil Twin", "actual_classification": c2, "detection_time_ms": t2},
                {"expected_classification": "Unknown", "actual_classification": c3, "detection_time_ms": t3},
            ]
        )
        self.assertTrue(metrics["has_data"])
        self.assertEqual(metrics["tp"], 1)
        self.assertEqual(metrics["fp"], 0)
        self.assertEqual(metrics["tn"], 2)
        self.assertEqual(metrics["fn"], 0)
        self.assertEqual(metrics["precision"], 1.0)
        self.assertEqual(metrics["detection_rate"], 1.0)
        self.assertEqual(metrics["false_positive_rate"], 0.0)

    def test_sqlite_schema_creation(self):
        conn = sqlite3.connect(":memory:")
        conn.execute(
            "CREATE TABLE approved_access_points (id INTEGER PRIMARY KEY, ssid TEXT, bssid TEXT UNIQUE)"
        )
        conn.execute(
            "INSERT INTO approved_access_points (ssid, bssid) VALUES (?, ?)",
            ("CCUK_WiFi", "A4:2B:8C:10:44:01"),
        )
        row = conn.execute("SELECT ssid, bssid FROM approved_access_points").fetchone()
        self.assertEqual(row, ("CCUK_WiFi", "A4:2B:8C:10:44:01"))
        conn.close()


@unittest.skipUnless(HAS_FLASK_SQLALCHEMY, "Flask-SQLAlchemy not installed in sandbox")
class TestFlaskSQLAlchemyModels(unittest.TestCase):
    def test_app_creates_tables(self):
        from app import create_app
        from database.models import ApprovedAccessPoint

        app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        with app.app_context():
            self.assertEqual(ApprovedAccessPoint.query.count(), 0)


if __name__ == "__main__":
    unittest.main()
