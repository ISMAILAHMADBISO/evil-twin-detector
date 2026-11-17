"""Scan orchestration service connecting WifiScanner, RuleBasedDetectionEngine, and SQLite."""

from __future__ import annotations

from datetime import datetime, timezone

from database.db import db
from database.models import (
    ApplicationSetting,
    ApprovedAccessPoint,
    DetectionEvent,
    ScanSession,
    WirelessObservation,
)
from detection.rule_engine import ApprovedAPProfile, RuleBasedDetectionEngine
from scanner.wifi_scanner import ScannerError, WifiScanner
from services.alert_service import create_alert_for_event


def _get_setting_bool(key: str, default: bool = False) -> bool:
    row = ApplicationSetting.query.filter_by(setting_key=key).first()
    if row is None:
        return default
    return row.setting_value.strip().lower() == "true"


def execute_wireless_scan(demo_mode_override: bool | None = None) -> dict:
    """Run a scan session, evaluate observations, persist results, and raise alerts."""
    demo_mode = (
        demo_mode_override
        if demo_mode_override is not None
        else _get_setting_bool("demo_mode", False)
    )
    alerts_enabled = _get_setting_bool("alerts_enabled", True)

    scan_session = ScanSession(
        started_at=datetime.now(timezone.utc),
        status="Running",
        networks_found=0,
        is_demo=demo_mode,
    )
    db.session.add(scan_session)
    db.session.commit()

    scanner = WifiScanner()
    try:
        scan_result = scanner.scan(demo_mode=demo_mode)
    except ScannerError as exc:
        scan_session.status = "Failed"
        scan_session.completed_at = datetime.now(timezone.utc)
        scan_session.error_message = str(exc)
        db.session.commit()
        return {
            "ok": False,
            "error": str(exc),
            "scan_session": scan_session.to_dict(),
            "observations": [],
        }

    approved_rows = ApprovedAccessPoint.query.all()
    profiles = [
        ApprovedAPProfile(
            ssid=row.ssid,
            bssid=row.bssid,
            expected_security=row.expected_security,
            status=row.status,
            description=row.description,
        )
        for row in approved_rows
    ]
    engine = RuleBasedDetectionEngine(profiles)

    saved_observations = []
    alerts_created = 0
    for net in scan_result.networks:
        decision = engine.evaluate(
            ssid=net.ssid,
            bssid=net.bssid,
            security=net.security,
            signal_strength=net.signal_strength,
            channel=net.channel,
            frequency=net.frequency,
            timestamp=net.timestamp,
        )
        obs = WirelessObservation(
            scan_session_id=scan_session.id,
            ssid=decision.ssid,
            bssid=decision.bssid,
            signal_strength=decision.signal_strength,
            channel=decision.channel,
            security=decision.security,
            frequency=decision.frequency,
            classification=decision.classification,
            detection_reason=decision.reason,
            is_demo=demo_mode,
        )
        db.session.add(obs)
        db.session.flush()

        event = DetectionEvent(
            observation_id=obs.id,
            triggered_rule=decision.triggered_rule,
            classification=decision.classification,
            reason=decision.reason,
        )
        db.session.add(event)
        db.session.flush()

        alert = create_alert_for_event(
            event=event,
            ssid=decision.ssid,
            bssid=decision.bssid,
            alerts_enabled=alerts_enabled,
        )
        if alert is not None:
            alerts_created += 1

        item = obs.to_dict()
        item["triggered_rule"] = decision.triggered_rule
        item["supporting_indicators"] = decision.supporting_indicators
        saved_observations.append(item)

    scan_session.status = "Completed"
    scan_session.completed_at = datetime.now(timezone.utc)
    scan_session.networks_found = len(saved_observations)
    db.session.commit()

    return {
        "ok": True,
        "scan_session": scan_session.to_dict(),
        "observations": saved_observations,
        "alerts_created": alerts_created,
        "platform": scan_result.platform_name,
        "is_demo": scan_result.is_demo,
    }
