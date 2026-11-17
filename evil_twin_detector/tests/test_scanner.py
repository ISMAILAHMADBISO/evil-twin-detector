"""Unit tests for Windows and Linux Wi-Fi scanner parsers and WifiScanner."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scanner.linux_scanner import parse_nmcli_output
from scanner.wifi_scanner import WifiScanner, get_demo_networks
from scanner.windows_scanner import (
    infer_frequency_band,
    normalize_bssid,
    normalize_security,
    parse_netsh_output,
    percent_to_dbm,
)

SAMPLE_NETSH = """
Interface name : Wi-Fi
There are 2 networks currently visible.

SSID 1 : CCUK_Campus_WiFi
    Network type            : Infrastructure
    Authentication          : WPA2-Personal
    Encryption              : CCMP
    BSSID 1                 : a4:2b:8c:10:44:01
         Signal             : 88%
         Radio type         : 802.11n
         Channel            : 6
         Basic rates (Mbps) : 1 2 5.5 11
    BSSID 2                 : de:ad:be:ef:11:99
         Signal             : 96%
         Radio type         : 802.11ac
         Channel            : 36

SSID 2 : Cafe_Free_WiFi
    Network type            : Infrastructure
    Authentication          : Open
    Encryption              : None
    BSSID 1                 : 00:1a:2b:3c:4d:5e
         Signal             : 54%
         Radio type         : 802.11g
         Channel            : 11
"""

SAMPLE_NMCLI = (
    "CCUK_Campus_WiFi:A4\\:2B\\:8C\\:10\\:44\\:01:84:6:2437 MHz:WPA2\n"
    "Neighbor_5G:C0\\:56\\:27\\:9A\\:33\\:E2:62:149:5745 MHz:WPA3\n"
)


class TestScannerParsers(unittest.TestCase):
    def test_parse_netsh_multiple_bssids(self):
        results = parse_netsh_output(SAMPLE_NETSH, scan_timestamp="2026-11-17T10:00:00Z")
        self.assertEqual(len(results), 3)
        self.assertEqual(results[0].ssid, "CCUK_Campus_WiFi")
        self.assertEqual(results[0].bssid, "A4:2B:8C:10:44:01")
        self.assertEqual(results[0].security, "WPA2")
        self.assertEqual(results[0].channel, 6)
        self.assertEqual(results[0].frequency, "2.4 GHz")
        self.assertEqual(results[1].bssid, "DE:AD:BE:EF:11:99")
        self.assertEqual(results[1].frequency, "5 GHz")
        self.assertEqual(results[2].ssid, "Cafe_Free_WiFi")
        self.assertEqual(results[2].security, "Open")

    def test_parse_nmcli_output(self):
        results = parse_nmcli_output(SAMPLE_NMCLI, scan_timestamp="2026-11-17T10:00:00Z")
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].bssid, "A4:2B:8C:10:44:01")
        self.assertEqual(results[0].frequency, "2.4 GHz")
        self.assertEqual(results[1].security, "WPA3")
        self.assertEqual(results[1].frequency, "5 GHz")

    def test_normalization_helpers(self):
        self.assertEqual(normalize_bssid("aa-bb-cc-dd-ee-ff"), "AA:BB:CC:DD:EE:FF")
        self.assertEqual(normalize_security("WPA3-Personal", "GCMP"), "WPA3")
        self.assertEqual(percent_to_dbm(100), -50)
        self.assertEqual(infer_frequency_band(36), "5 GHz")

    def test_demo_mode_isolation(self):
        scanner = WifiScanner()
        res = scanner.scan(demo_mode=True)
        self.assertTrue(res.is_demo)
        self.assertFalse(res.adapter_available)
        self.assertEqual(len(res.networks), len(get_demo_networks()))


if __name__ == "__main__":
    unittest.main()
