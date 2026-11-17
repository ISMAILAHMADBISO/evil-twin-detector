"""Security alert generation and lifecycle management service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from database.db import db
from database.models import DetectionEvent, SecurityAlert


def determine_alert_severity(triggered_rule: str) -> str:
    rule_lower = (triggered_rule or "").lower()
    if "rule 2" in rule_lower or "rule 4" in rule_lower:
        return "High"
    return "Medium"


def create_alert_for_event(
    event: DetectionEvent,
    ssid: str,
    bssid: str,
    alerts_enabled: bool = True,
) -> Optional[SecurityAlert]:
    """Generate a security alert when a suspicious access point is detected."""
    if not alerts_enabled:
        return None
    if event.classification != "SUSPICIOUS":
        return None

    severity = determine_alert_severity(event.triggered_rule)
    title = f"Suspicious Access Point Detected: {ssid} ({bssid})"
    alert = SecurityAlert(
        detection_event_id=event.id,
        title=title,
        severity=severity,
        status="Open",
    )
    db.session.add(alert)
    return alert


def mark_alert_reviewed(alert: SecurityAlert) -> SecurityAlert:
    alert.status = "Reviewed"
    alert.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()
    return alert


def resolve_alert(alert: SecurityAlert) -> SecurityAlert:
    alert.status = "Resolved"
    if not alert.reviewed_at:
        alert.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()
    return alert
