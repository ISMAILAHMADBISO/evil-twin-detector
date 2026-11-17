"""Windows WLAN scanner built on netsh wlan facilities."""

from __future__ import annotations

import re
import subprocess
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import List, Optional


class WindowsScannerError(RuntimeError):
    """Raised when the Windows wireless adapter or WLAN service cannot scan."""


@dataclass
class DiscoveredNetwork:
    ssid: str
    bssid: str
    signal_strength: Optional[int]
    channel: Optional[int]
    security: str
    frequency: Optional[str]
    timestamp: str
    signal_percent: Optional[int] = None
    radio_type: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


def normalize_bssid(raw_bssid: str) -> str:
    """Normalize MAC address to uppercase colon-separated XX:XX:XX:XX:XX:XX."""
    cleaned = re.sub(r"[^0-9a-fA-F]", "", raw_bssid or "")
    if len(cleaned) != 12:
        return (raw_bssid or "").strip().upper()
    return ":".join(cleaned[i : i + 2].upper() for i in range(0, 12, 2))


def percent_to_dbm(percent: int) -> int:
    """Approximate RSSI in dBm from Windows signal percentage (0-100%)."""
    clamped = max(0, min(100, percent))
    return int(round((clamped / 2.0) - 100))


def normalize_security(auth_value: str, encryption_value: str = "") -> str:
    """Normalize Windows Authentication & Encryption fields into concise security tags."""
    combined = f"{auth_value} {encryption_value}".upper()
    if "WPA3" in combined:
        return "WPA3"
    if "WPA2" in combined:
        return "WPA2"
    if "WPA" in combined:
        return "WPA"
    if "WEP" in combined:
        return "WEP"
    if "OPEN" in combined or "NONE" in combined:
        return "Open"
    return auth_value.strip() or "Unknown"


def infer_frequency_band(channel: Optional[int], radio_type: str = "") -> Optional[str]:
    """Infer Wi-Fi frequency band from channel number or radio protocol."""
    radio_upper = (radio_type or "").upper()
    if "6E" in radio_upper or "802.11BE" in radio_upper and channel and channel > 177:
        return "6 GHz"
    if channel is not None:
        if 1 <= channel <= 14:
            return "2.4 GHz"
        if 32 <= channel <= 177:
            return "5 GHz"
    if "802.11A" in radio_upper or "802.11AC" in radio_upper:
        return "5 GHz"
    if "802.11B" in radio_upper or "802.11G" in radio_upper:
        return "2.4 GHz"
    return None


def parse_netsh_output(raw_output: str, scan_timestamp: Optional[str] = None) -> List[DiscoveredNetwork]:
    """Parse stdout from `netsh wlan show networks mode=bssid` into DiscoveredNetwork records."""
    timestamp = scan_timestamp or datetime.now(timezone.utc).isoformat()
    networks: List[DiscoveredNetwork] = []

    current_ssid: Optional[str] = None
    current_auth: str = ""
    current_encryption: str = ""
    current_bssid_entry: Optional[dict] = None

    def flush_bssid() -> None:
        nonlocal current_bssid_entry
        if current_bssid_entry and current_bssid_entry.get("bssid"):
            channel = current_bssid_entry.get("channel")
            radio_type = current_bssid_entry.get("radio_type") or ""
            signal_pct = current_bssid_entry.get("signal_percent")
            rssi = percent_to_dbm(signal_pct) if signal_pct is not None else None
            band = infer_frequency_band(channel, radio_type)
            networks.append(
                DiscoveredNetwork(
                    ssid=current_ssid if current_ssid else "<Hidden Network>",
                    bssid=normalize_bssid(current_bssid_entry["bssid"]),
                    signal_strength=rssi,
                    signal_percent=signal_pct,
                    channel=channel,
                    security=normalize_security(current_auth, current_encryption),
                    frequency=band,
                    radio_type=radio_type or None,
                    timestamp=timestamp,
                )
            )
        current_bssid_entry = None

    for raw_line in raw_output.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        ssid_match = re.match(r"^SSID\s+\d+\s*:\s*(.*)$", line, re.IGNORECASE)
        if ssid_match:
            flush_bssid()
            current_ssid = ssid_match.group(1).strip()
            current_auth = ""
            current_encryption = ""
            continue

        auth_match = re.match(r"^Authentication\s*:\s*(.+)$", line, re.IGNORECASE)
        if auth_match:
            current_auth = auth_match.group(1).strip()
            continue

        enc_match = re.match(r"^Encryption\s*:\s*(.+)$", line, re.IGNORECASE)
        if enc_match:
            current_encryption = enc_match.group(1).strip()
            continue

        bssid_match = re.match(r"^BSSID\s+\d+\s*:\s*([0-9a-fA-F:\-]+)$", line, re.IGNORECASE)
        if bssid_match:
            flush_bssid()
            current_bssid_entry = {"bssid": bssid_match.group(1).strip()}
            continue

        if current_bssid_entry is not None:
            sig_match = re.match(r"^Signal\s*:\s*(\d+)\s*%$", line, re.IGNORECASE)
            if sig_match:
                current_bssid_entry["signal_percent"] = int(sig_match.group(1))
                continue

            radio_match = re.match(r"^Radio type\s*:\s*(.+)$", line, re.IGNORECASE)
            if radio_match:
                current_bssid_entry["radio_type"] = radio_match.group(1).strip()
                continue

            chan_match = re.match(r"^Channel\s*:\s*(\d+)$", line, re.IGNORECASE)
            if chan_match:
                current_bssid_entry["channel"] = int(chan_match.group(1))
                continue

    flush_bssid()
    return networks


class WindowsScanner:
    """Executes Windows netsh WLAN scanning commands safely."""

    def __init__(self, timeout_seconds: int = 15) -> None:
        self.timeout_seconds = timeout_seconds

    def check_adapter_status(self) -> dict:
        """Inspect Windows WLAN interfaces to confirm a wireless adapter is available."""
        try:
            proc = subprocess.run(
                ["netsh", "wlan", "show", "interfaces"],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except FileNotFoundError as exc:
            return {"available": False, "error": f"netsh command not found: {exc}"}
        except subprocess.TimeoutExpired:
            return {"available": False, "error": "Timed out querying Windows WLAN interfaces."}

        output = (proc.stdout or "") + "\n" + (proc.stderr or "")
        lowered = output.lower()
        if "there is no wireless interface" in lowered:
            return {"available": False, "error": "No wireless adapter detected on this system."}
        if "wlansvc" in lowered or "not running" in lowered:
            return {
                "available": False,
                "error": "Windows WLAN AutoConfig service (wlansvc) is not running.",
            }
        if proc.returncode != 0 and not output.strip():
            return {"available": False, "error": "Unable to access Windows WLAN interface."}

        return {"available": True, "details": output.strip()}

    def scan(self) -> List[DiscoveredNetwork]:
        """Run `netsh wlan show networks mode=bssid` and return parsed access points."""
        try:
            proc = subprocess.run(
                ["netsh", "wlan", "show", "networks", "mode=bssid"],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except FileNotFoundError as exc:
            raise WindowsScannerError(
                "Windows 'netsh' utility is unavailable on this host."
            ) from exc
        except subprocess.TimeoutExpired as exc:
            raise WindowsScannerError(
                "Wireless scan timed out waiting for the Windows WLAN adapter."
            ) from exc
        except OSError as exc:
            raise WindowsScannerError(f"Failed to invoke wireless scanner: {exc}") from exc

        combined_output = f"{proc.stdout or ''}\n{proc.stderr or ''}".strip()
        lowered = combined_output.lower()

        if "there is no wireless interface" in lowered:
            raise WindowsScannerError("No wireless network adapter was found on this computer.")
        if "powered down" in lowered or "turned off" in lowered:
            raise WindowsScannerError("The wireless network adapter is currently turned off.")
        if "location permission" in lowered or "elevation" in lowered:
            raise WindowsScannerError(
                "Windows denied Wi-Fi scan access. Enable Location Services for desktop apps or run with required permissions."
            )
        if proc.returncode != 0:
            raise WindowsScannerError(
                combined_output or f"netsh exited with status code {proc.returncode}."
            )

        return parse_netsh_output(proc.stdout or "")
