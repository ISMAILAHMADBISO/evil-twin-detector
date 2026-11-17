"""Unit tests for the Rule-Based Evil Twin Detection Engine (Rules 1-5)."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from detection.rule_engine import (
    CLASSIFICATION_AUTHORISED,
    CLASSIFICATION_SUSPICIOUS,
    CLASSIFICATION_UNKNOWN,
    ApprovedAPProfile,
    RuleBasedDetectionEngine,
)


class TestRuleBasedDetectionEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RuleBasedDetectionEngine(
            [
                ApprovedAPProfile(
                    ssid="CCUK_Campus_WiFi",
                    bssid="A4:2B:8C:10:44:01",
                    expected_security="WPA2",
                    status="Active",
                ),
                ApprovedAPProfile(
                    ssid="CCUK_Staff_Secure",
                    bssid="B8:27:EB:45:12:0A",
                    expected_security="WPA3",
                    status="Active",
                ),
                ApprovedAPProfile(
                    ssid="Legacy_Lab_AP",
                    bssid="11:22:33:44:55:66",
                    expected_security="WPA2",
                    status="Inactive",
                ),
            ]
        )

    def test_rule_1_registered_authorised_ap(self):
        decision = self.engine.evaluate(
            ssid="CCUK_Campus_WiFi",
            bssid="a4:2b:8c:10:44:01",
            security="WPA2-Personal",
            signal_strength=-50,
            channel=6,
            frequency="2.4 GHz",
        )
        self.assertEqual(decision.classification, CLASSIFICATION_AUTHORISED)
        self.assertIn("Rule 1", decision.triggered_rule)
        self.assertTrue(len(decision.supporting_indicators) >= 1)

    def test_rule_2_same_ssid_different_bssid_suspicious(self):
        decision = self.engine.evaluate(
            ssid="CCUK_Campus_WiFi",
            bssid="DE:AD:BE:EF:00:01",
            security="WPA2",
            signal_strength=-38,
            channel=11,
        )
        self.assertEqual(decision.classification, CLASSIFICATION_SUSPICIOUS)
        self.assertIn("Rule 2", decision.triggered_rule)
        self.assertIn("DE:AD:BE:EF:00:01", decision.reason)

    def test_rule_3_unknown_ap_not_marked_malicious(self):
        decision = self.engine.evaluate(
            ssid="Neighbor_Router_5G",
            bssid="C0:56:27:9A:33:E2",
            security="WPA2",
            signal_strength=-75,
            channel=149,
        )
        self.assertEqual(decision.classification, CLASSIFICATION_UNKNOWN)
        self.assertIn("Rule 3", decision.triggered_rule)

    def test_rule_4_unexpected_security_configuration(self):
        decision = self.engine.evaluate(
            ssid="CCUK_Staff_Secure",
            bssid="B8:27:EB:45:12:0A",
            security="Open",
            signal_strength=-52,
            channel=36,
        )
        self.assertEqual(decision.classification, CLASSIFICATION_SUSPICIOUS)
        self.assertIn("Rule 4", decision.triggered_rule)

    def test_rule_5_signal_and_channel_alone_not_suspicious(self):
        decision = self.engine.evaluate(
            ssid="CCUK_Campus_WiFi",
            bssid="A4:2B:8C:10:44:01",
            security="WPA2",
            signal_strength=-35,
            channel=11,
        )
        self.assertEqual(decision.classification, CLASSIFICATION_AUTHORISED)
        self.assertTrue(any("-35 dBm" in item for item in decision.supporting_indicators))


if __name__ == "__main__":
    unittest.main()
