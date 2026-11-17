"""Unified cross-platform Wi-Fi scanner interface with explicit Demo Mode separation."""

from __future__ import annotations

import argparse
import json
import platform
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import List, Optional

from scanner.linux_scanner import LinuxScanner, LinuxScannerError
from scanner.windows_scanner import DiscoveredNetwork, WindowsScanner, WindowsScannerError


class ScannerError(RuntimeError):
    """Unified scanner exception exposed to services and routes."""


@dataclass
class NetworkScanResult:
    networks: List[DiscoveredNetwork]
    platform_name: str
    is_demo: bool
    scanned_at: str
    adapter_available: bool
    error_message: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "networks": [n.to_dict() for n in self.networks],
            "platform_name": self.platform_name,
            "is_demo": self.is_demo,
            "scanned_at": self.scanned_at,
            "adapter_available": self.adapter_available,
            "error_message": self.error_message,
        }


def get_demo_networks(scan_timestamp: Optional[str] = None) -> List[DiscoveredNetwork]:
    """Return clearly separated synthetic wireless observations for Demo Mode only.

    Demo Mode is never mixed with live wireless scan sessions.
    """
    ts = scan_timestamp or datetime.now(timezone.utc).isoformat()
    return [
        DiscoveredNetwork(
            ssid="CCUK_Campus_WiFi",
            bssid="A4:2B:8C:10:44:01",
            signal_strength=-48,
            signal_percent=88,
            channel=6,
            security="WPA2",
            frequency="2.4 GHz",
            radio_type="802.11n",
            timestamp=ts,
        ),
        DiscoveredNetwork(
            ssid="CCUK_Campus_WiFi",
            bssid="DE:AD:BE:EF:11:99",
            signal_strength=-39,
            signal_percent=96,
            channel=11,
            security="Open",
            frequency="2.4 GHz",
            radio_type="802.11n",
            timestamp=ts,
        ),
        DiscoveredNetwork(
            ssid="CCUK_Staff_Secure",
            bssid="B8:27:EB:45:12:0A",
            signal_strength=-54,
            signal_percent=80,
            channel=36,
            security="WPA3",
            frequency="5 GHz",
            radio_type="802.11ax",
            timestamp=ts,
        ),
        DiscoveredNetwork(
            ssid="Neighbor_Fiber_5G",
            bssid="C0:56:27:9A:33:E2",
            signal_strength=-72,
            signal_percent=52,
            channel=149,
            security="WPA2",
            frequency="5 GHz",
            radio_type="802.11ac",
            timestamp=ts,
        ),
        DiscoveredNetwork(
            ssid="Library_Guest_AP",
            bssid="00:1A:2B:3C:4D:5E",
            signal_strength=-63,
            signal_percent=66,
            channel=1,
            security="WPA2",
            frequency="2.4 GHz",
            radio_type="802.11n",
            timestamp=ts,
        ),
    ]


class WifiScanner:
    """Modular wireless scanner supporting Windows WLAN, Linux nmcli, and explicit Demo Mode."""

    def __init__(self, timeout_seconds: int = 15) -> None:
        self.timeout_seconds = timeout_seconds
        self.system_name = platform.system()

    def scan(self, demo_mode: bool = False) -> NetworkScanResult:
        now = datetime.now(timezone.utc).isoformat()
        if demo_mode:
            return NetworkScanResult(
                networks=get_demo_networks(now),
                platform_name=f"{self.system_name} (Demo Mode)",
                is_demo=True,
                scanned_at=now,
                adapter_available=False,
                error_message=None,
            )

        if self.system_name == "Windows":
            scanner = WindowsScanner(timeout_seconds=self.timeout_seconds)
            try:
                networks = scanner.scan()
                return NetworkScanResult(
                    networks=networks,
                    platform_name="Windows",
                    is_demo=False,
                    scanned_at=now,
                    adapter_available=True,
                )
            except WindowsScannerError as exc:
                raise ScannerError(str(exc)) from exc

        if self.system_name == "Linux":
            scanner = LinuxScanner(timeout_seconds=self.timeout_seconds)
            try:
                networks = scanner.scan()
                return NetworkScanResult(
                    networks=networks,
                    platform_name="Linux",
                    is_demo=False,
                    scanned_at=now,
                    adapter_available=True,
                )
            except LinuxScannerError as exc:
                raise ScannerError(str(exc)) from exc

        raise ScannerError(
            f"Live wireless scanning is not implemented for operating system '{self.system_name}'."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EvilTwin Detector Wi-Fi Scanner CLI")
    parser.add_argument("--demo", action="store_true", help="Run in isolated Demo Mode")
    args = parser.parse_args()
    scanner = WifiScanner()
    try:
        result = scanner.scan(demo_mode=args.demo)
        print(json.dumps(result.to_dict(), indent=2))
    except ScannerError as err:
        print(json.dumps({"error": str(err), "adapter_available": False, "networks": []}))
        raise SystemExit(1)
