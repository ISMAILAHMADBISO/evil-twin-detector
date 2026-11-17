"""SQLAlchemy database models for EvilTwin Detector."""

from datetime import datetime, timezone
from database.db import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(128), default="", nullable=False)
    role = db.Column(db.String(64), default="Administrator", nullable=False)
    status = db.Column(db.String(32), default="Active", nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    last_login_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name or self.username,
            "role": self.role,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }


class ApprovedAccessPoint(db.Model):
    __tablename__ = "approved_access_points"

    id = db.Column(db.Integer, primary_key=True)
    ssid = db.Column(db.String(128), nullable=False, index=True)
    bssid = db.Column(db.String(17), unique=True, nullable=False, index=True)
    expected_security = db.Column(db.String(64), nullable=False)
    description = db.Column(db.String(256), default="", nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    status = db.Column(db.String(32), default="Active", nullable=False, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ssid": self.ssid,
            "bssid": self.bssid,
            "expected_security": self.expected_security,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "status": self.status,
        }


class ScanSession(db.Model):
    __tablename__ = "scan_sessions"

    id = db.Column(db.Integer, primary_key=True)
    started_at = db.Column(db.DateTime, default=utc_now, nullable=False, index=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(32), default="Running", nullable=False)
    networks_found = db.Column(db.Integer, default=0, nullable=False)
    error_message = db.Column(db.Text, nullable=True)
    is_demo = db.Column(db.Boolean, default=False, nullable=False)

    observations = db.relationship(
        "WirelessObservation",
        backref="scan_session",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "networks_found": self.networks_found,
            "error_message": self.error_message,
            "is_demo": self.is_demo,
        }


class WirelessObservation(db.Model):
    __tablename__ = "wireless_observations"

    id = db.Column(db.Integer, primary_key=True)
    scan_session_id = db.Column(
        db.Integer, db.ForeignKey("scan_sessions.id"), nullable=False, index=True
    )
    ssid = db.Column(db.String(128), nullable=False, index=True)
    bssid = db.Column(db.String(17), nullable=False, index=True)
    signal_strength = db.Column(db.Integer, nullable=True)
    channel = db.Column(db.Integer, nullable=True)
    security = db.Column(db.String(64), nullable=False)
    frequency = db.Column(db.String(32), nullable=True)
    classification = db.Column(db.String(32), nullable=False, index=True)
    detection_reason = db.Column(db.Text, nullable=False)
    is_demo = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False, index=True)

    detection_events = db.relationship(
        "DetectionEvent",
        backref="observation",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "scan_session_id": self.scan_session_id,
            "ssid": self.ssid,
            "bssid": self.bssid,
            "signal_strength": self.signal_strength,
            "channel": self.channel,
            "security": self.security,
            "frequency": self.frequency,
            "classification": self.classification,
            "detection_reason": self.detection_reason,
            "is_demo": self.is_demo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DetectionEvent(db.Model):
    __tablename__ = "detection_events"

    id = db.Column(db.Integer, primary_key=True)
    observation_id = db.Column(
        db.Integer, db.ForeignKey("wireless_observations.id"), nullable=False, index=True
    )
    triggered_rule = db.Column(db.String(64), nullable=False, index=True)
    classification = db.Column(db.String(32), nullable=False, index=True)
    reason = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False, index=True)

    alerts = db.relationship(
        "SecurityAlert",
        backref="detection_event",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "observation_id": self.observation_id,
            "triggered_rule": self.triggered_rule,
            "classification": self.classification,
            "reason": self.reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SecurityAlert(db.Model):
    __tablename__ = "security_alerts"

    id = db.Column(db.Integer, primary_key=True)
    detection_event_id = db.Column(
        db.Integer, db.ForeignKey("detection_events.id"), nullable=False, index=True
    )
    title = db.Column(db.String(160), nullable=False)
    severity = db.Column(db.String(32), nullable=False, index=True)
    status = db.Column(db.String(32), default="Open", nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False, index=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self) -> dict:
        obs = self.detection_event.observation if self.detection_event else None
        return {
            "id": self.id,
            "detection_event_id": self.detection_event_id,
            "title": self.title,
            "severity": self.severity,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "ssid": obs.ssid if obs else None,
            "bssid": obs.bssid if obs else None,
            "detection_reason": self.detection_event.reason if self.detection_event else None,
            "triggered_rule": (
                self.detection_event.triggered_rule if self.detection_event else None
            ),
        }


class EvaluationCase(db.Model):
    __tablename__ = "evaluation_cases"

    id = db.Column(db.Integer, primary_key=True)
    ssid = db.Column(db.String(128), nullable=False)
    bssid = db.Column(db.String(17), nullable=False)
    expected_security = db.Column(db.String(64), default="WPA2", nullable=False)
    observed_security = db.Column(db.String(64), default="WPA2", nullable=False)
    expected_classification = db.Column(db.String(32), nullable=False)
    actual_classification = db.Column(db.String(32), nullable=False)
    detection_time_ms = db.Column(db.Float, default=0.0, nullable=False)
    test_description = db.Column(db.String(256), default="", nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ssid": self.ssid,
            "bssid": self.bssid,
            "expected_security": self.expected_security,
            "observed_security": self.observed_security,
            "expected_classification": self.expected_classification,
            "actual_classification": self.actual_classification,
            "detection_time_ms": self.detection_time_ms,
            "test_description": self.test_description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ApplicationSetting(db.Model):
    __tablename__ = "application_settings"

    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(64), unique=True, nullable=False, index=True)
    setting_value = db.Column(db.Text, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "setting_key": self.setting_key,
            "setting_value": self.setting_value,
        }
