"""Linux WLAN scanner using nmcli or iwlist/iw when available."""

from __future__ import annotations

import re
import shutil
import subprocess
from datetime import datetime, timezone
from typing import List, Optional

from scanner.windows_scanner import (
    DiscoveredNetwork,
    infer_frequency_band,
    normalize_bssid,
    normalize_security,
    percent_to_dbm,
)


class LinuxScannerError(RuntimeError):
    """Raised when Linux wireless scanning cannot access an adapter."""


def parse_nmcli_output(raw_output: str, scan_timestamp: Optional[str] = None) -> List[DiscoveredNetwork]:
    """Parse `nmcli -t -f SSID,BSSID,SIGNAL,CHAN,FREQ,SECURITY dev wifi list` output."""
    timestamp = scan_timestamp or datetime.now(timezone.utc).isoformat()
    networks: List[DiscoveredNetwork] = []

    for raw_line in raw_output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        # nmcli terse mode escapes colons inside values (such as MAC addresses) with '\:'
        fields = re.split(r"(?<!\\):", line)
        if len(fields) < 6:
            continue
        ssid_raw, bssid_raw, signal_raw, chan_raw, freq_raw, sec_raw = [
            f.replace("\\:", ":").strip() for f in fields[:6]
        ]
        if not bssid_raw:
            continue

        signal_pct: Optional[int] = int(signal_raw) if signal_raw.isdigit() else None
        rssi = percent_to_dbm(signal_pct) if signal_pct is not None else None
        channel: Optional[int] = int(chan_raw) if chan_raw.isdigit() else None

        band: Optional[str] = None
        freq_digits = re.search(r"(\d+)", freq_raw)
        if freq_digits:
            mhz = int(freq_digits.group(1))
            if 2400 <= mhz <= 2500:
                band = "2.4 GHz"
            elif 5000 <= mhz <= 5900:
                band = "5 GHz"
            elif mhz > 5900:
                band = "6 GHz"
        if not band:
            band = infer_frequency_band(channel)

        networks.append(
            DiscoveredNetwork(
                ssid=ssid_raw if ssid_raw else "<Hidden Network>",
                bssid=normalize_bssid(bssid_raw),
                signal_strength=rssi,
                signal_percent=signal_pct,
                channel=channel,
                security=normalize_security(sec_raw),
                frequency=band,
                timestamp=timestamp,
            )
        )

    return networks


class LinuxScanner:
    """Executes Linux Wi-Fi scan via nmcli when a wireless interface exists."""

    def __init__(self, timeout_seconds: int = 15) -> None:
        self.timeout_seconds = timeout_seconds

    def scan(self) -> List[DiscoveredNetwork]:
        if not shutil.which("nmcli"):
            raise LinuxScannerError(
                "No supported Linux wireless CLI ('nmcli') or wireless adapter detected in this environment."
            )
        try:
            proc = subprocess.run(
                [
                    "nmcli",
                    "-t",
                    "-f",
                    "SSID,BSSID,SIGNAL,CHAN,FREQ,SECURITY",
                    "dev",
                    "wifi",
                    "list",
                    "--rescan",
                    "yes",
                ],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise LinuxScannerError("Wireless scan timed out waiting for nmcli.") from exc
        except OSError as exc:
            raise LinuxScannerError(f"Failed to execute nmcli wireless scan: {exc}") from exc

        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "").strip()
            raise LinuxScannerError(err or "Linux wireless adapter unavailable.")

        return parse_nmcli_output(proc.stdout or "")
