"""Rule-Based Evil Twin Access Point Detection Engine.

Implements five explainable rules:
- Rule 1: Registered BSSID with matching expected security -> AUTHORISED
- Rule 2: Approved SSID advertised by an unregistered BSSID -> SUSPICIOUS
- Rule 3: Unregistered BSSID & unregistered SSID -> UNKNOWN
- Rule 4: Registered BSSID with unexpected security configuration -> SUSPICIOUS
- Rule 5: Signal strength and channel supporting indicators (never sole proof)
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Iterable, List, Optional

from scanner.windows_scanner import normalize_bssid, normalize_security

CLASSIFICATION_AUTHORISED = "AUTHORISED"
CLASSIFICATION_SUSPICIOUS = "SUSPICIOUS"
CLASSIFICATION_UNKNOWN = "UNKNOWN"


@dataclass
class ApprovedAPProfile:
    ssid: str
    bssid: str
    expected_security: str
    status: str = "Active"
    description: str = ""


@dataclass
class DetectionDecision:
    ssid: str
    bssid: str
    signal_strength: Optional[int]
    channel: Optional[int]
    security: str
    frequency: Optional[str]
    classification: str
    triggered_rule: str
    reason: str
    supporting_indicators: List[str]
    timestamp: str

    def to_dict(self) -> dict:
        return asdict(self)


def _security_matches(observed: str, expected: str) -> bool:
    norm_obs = normalize_security(observed)
    norm_exp = normalize_security(expected)
    return norm_obs.upper() == norm_exp.upper()


class RuleBasedDetectionEngine:
    """Evaluates discovered wireless networks against approved AP baselines."""

    def __init__(self, approved_access_points: Iterable[ApprovedAPProfile]) -> None:
        active_aps = [
            ap
            for ap in approved_access_points
            if (ap.status or "Active").strip().lower() == "active"
        ]
        self.by_bssid = {normalize_bssid(ap.bssid): ap for ap in active_aps}
        self.by_ssid: dict[str, list[ApprovedAPProfile]] = {}
        for ap in active_aps:
            key = ap.ssid.strip().lower()
            self.by_ssid.setdefault(key, []).append(ap)

    def _build_supporting_indicators(
        self,
        signal_strength: Optional[int],
        channel: Optional[int],
        frequency: Optional[str],
    ) -> List[str]:
        """Rule 5: Supporting indicators for analyst investigation only."""
        indicators: List[str] = []
        if signal_strength is not None:
            if signal_strength >= -45:
                indicators.append(
                    f"Strong RSSI ({signal_strength} dBm) — nearby transmitter; inspect physical proximity."
                )
            else:
                indicators.append(f"Observed signal strength: {signal_strength} dBm.")
        if channel is not None:
            band_label = f" ({frequency})" if frequency else ""
            indicators.append(f"Operating on Channel {channel}{band_label}.")
        return indicators

    def evaluate(
        self,
        ssid: str,
        bssid: str,
        security: str,
        signal_strength: Optional[int] = None,
        channel: Optional[int] = None,
        frequency: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> DetectionDecision:
        obs_ssid = (ssid or "").strip() or "<Hidden Network>"
        obs_bssid = normalize_bssid(bssid)
        obs_security = normalize_security(security)
        obs_timestamp = timestamp or datetime.now(timezone.utc).isoformat()
        indicators = self._build_supporting_indicators(signal_strength, channel, frequency)

        registered_ap = self.by_bssid.get(obs_bssid)

        # Rule 1 & Rule 4: BSSID exists in the approved access point registry
        if registered_ap is not None:
            if _security_matches(obs_security, registered_ap.expected_security):
                if registered_ap.ssid.strip().lower() != obs_ssid.lower():
                    # Registered hardware MAC broadcasting an unexpected SSID -> Rule 2/4 hybrid check
                    return DetectionDecision(
                        ssid=obs_ssid,
                        bssid=obs_bssid,
                        signal_strength=signal_strength,
                        channel=channel,
                        security=obs_security,
                        frequency=frequency,
                        classification=CLASSIFICATION_SUSPICIOUS,
                        triggered_rule="Rule 4: Unexpected Configuration",
                        reason=(
                            f"Registered BSSID {obs_bssid} is broadcasting SSID '{obs_ssid}' "
                            f"instead of expected '{registered_ap.ssid}'."
                        ),
                        supporting_indicators=indicators,
                        timestamp=obs_timestamp,
                    )
                return DetectionDecision(
                    ssid=obs_ssid,
                    bssid=obs_bssid,
                    signal_strength=signal_strength,
                    channel=channel,
                    security=obs_security,
                    frequency=frequency,
                    classification=CLASSIFICATION_AUTHORISED,
                    triggered_rule="Rule 1: Registered Access Point",
                    reason=(
                        f"BSSID {obs_bssid} and security ({obs_security}) match the "
                        f"approved profile for '{registered_ap.ssid}'."
                    ),
                    supporting_indicators=indicators,
                    timestamp=obs_timestamp,
                )

            return DetectionDecision(
                ssid=obs_ssid,
                bssid=obs_bssid,
                signal_strength=signal_strength,
                channel=channel,
                security=obs_security,
                frequency=frequency,
                classification=CLASSIFICATION_SUSPICIOUS,
                triggered_rule="Rule 4: Unexpected Security Configuration",
                reason=(
                    f"Registered BSSID {obs_bssid} ('{registered_ap.ssid}') advertised "
                    f"{obs_security} instead of expected {registered_ap.expected_security}."
                ),
                supporting_indicators=indicators,
                timestamp=obs_timestamp,
            )

        # Rule 2: Same SSID as an approved network, but unregistered BSSID
        matching_ssid_aps = self.by_ssid.get(obs_ssid.lower())
        if matching_ssid_aps:
            expected_bssids = ", ".join(ap.bssid for ap in matching_ssid_aps)
            return DetectionDecision(
                ssid=obs_ssid,
                bssid=obs_bssid,
                signal_strength=signal_strength,
                channel=channel,
                security=obs_security,
                frequency=frequency,
                classification=CLASSIFICATION_SUSPICIOUS,
                triggered_rule="Rule 2: Same SSID, Different BSSID",
                reason=(
                    f"Unregistered BSSID {obs_bssid} is advertising approved SSID '{obs_ssid}'. "
                    f"Registered BSSID(s): {expected_bssids}."
                ),
                supporting_indicators=indicators,
                timestamp=obs_timestamp,
            )

        # Rule 3: Unregistered access point that does not violate suspicious conditions
        return DetectionDecision(
            ssid=obs_ssid,
            bssid=obs_bssid,
            signal_strength=signal_strength,
            channel=channel,
            security=obs_security,
            frequency=frequency,
            classification=CLASSIFICATION_UNKNOWN,
            triggered_rule="Rule 3: Unknown Access Point",
            reason=(
                f"Access point '{obs_ssid}' ({obs_bssid}) is not present in the approved "
                "database and does not impersonate any registered SSID."
            ),
            supporting_indicators=indicators,
            timestamp=obs_timestamp,
        )

    def evaluate_batch(self, networks: Iterable[dict]) -> List[DetectionDecision]:
        results: List[DetectionDecision] = []
        for net in networks:
            results.append(
                self.evaluate(
                    ssid=net.get("ssid", ""),
                    bssid=net.get("bssid", ""),
                    security=net.get("security", "Unknown"),
                    signal_strength=net.get("signal_strength"),
                    channel=net.get("channel"),
                    frequency=net.get("frequency"),
                    timestamp=net.get("timestamp"),
                )
            )
        return results
