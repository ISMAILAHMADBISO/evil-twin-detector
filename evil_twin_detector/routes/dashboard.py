"""Dashboard, detected networks overview, and About Project routes."""

from collections import OrderedDict

from flask import Blueprint, jsonify, redirect, render_template, url_for
from sqlalchemy import func

from database.db import db
from database.models import (
    ApplicationSetting,
    DetectionEvent,
    ScanSession,
    SecurityAlert,
    WirelessObservation,
)
from routes.auth import login_required

dashboard_bp = Blueprint("dashboard", __name__)


def _build_dashboard_payload() -> dict:
    total_discovered = WirelessObservation.query.count()
    authorised_count = WirelessObservation.query.filter_by(
        classification="AUTHORISED"
    ).count()
    suspicious_count = WirelessObservation.query.filter_by(
        classification="SUSPICIOUS"
    ).count()
    unknown_count = WirelessObservation.query.filter_by(
        classification="UNKNOWN"
    ).count()
    total_alerts = SecurityAlert.query.count()
    open_alerts = SecurityAlert.query.filter_by(status="Open").count()

    latest_session = ScanSession.query.order_by(ScanSession.started_at.desc()).first()
    recent_observations = (
        WirelessObservation.query.order_by(WirelessObservation.created_at.desc())
        .limit(10)
        .all()
    )
    recent_alerts = (
        SecurityAlert.query.order_by(SecurityAlert.created_at.desc()).limit(6).all()
    )
    recent_sessions = (
        ScanSession.query.order_by(ScanSession.started_at.desc()).limit(6).all()
    )

    demo_setting = ApplicationSetting.query.filter_by(setting_key="demo_mode").first()
    demo_mode = (demo_setting.setting_value.lower() == "true") if demo_setting else False

    # Build time-series buckets per scan session (chronological order)
    sessions_chron = (
        ScanSession.query.order_by(ScanSession.started_at.asc()).limit(12).all()
    )
    timeline_labels = []
    timeline_auth = []
    timeline_susp = []
    timeline_unk = []
    for s in sessions_chron:
        label = s.started_at.strftime("%H:%M:%S") if s.started_at else f"Scan #{s.id}"
        timeline_labels.append(label)
        timeline_auth.append(
            WirelessObservation.query.filter_by(
                scan_session_id=s.id, classification="AUTHORISED"
            ).count()
        )
        timeline_susp.append(
            WirelessObservation.query.filter_by(
                scan_session_id=s.id, classification="SUSPICIOUS"
            ).count()
        )
        timeline_unk.append(
            WirelessObservation.query.filter_by(
                scan_session_id=s.id, classification="UNKNOWN"
            ).count()
        )

    # Alert trend grouped by date
    alert_buckets: OrderedDict[str, int] = OrderedDict()
    all_alerts = SecurityAlert.query.order_by(SecurityAlert.created_at.asc()).all()
    for alert in all_alerts:
        day_key = alert.created_at.strftime("%Y-%m-%d") if alert.created_at else "Unknown"
        alert_buckets[day_key] = alert_buckets.get(day_key, 0) + 1

    return {
        "summary": {
            "total_discovered": total_discovered,
            "authorised": authorised_count,
            "suspicious": suspicious_count,
            "unknown": unknown_count,
            "total_alerts": total_alerts,
            "open_alerts": open_alerts,
        },
        "scanner_status": {
            "demo_mode": demo_mode,
            "last_scan": latest_session.to_dict() if latest_session else None,
        },
        "charts": {
            "distribution": {
                "Authorised": authorised_count,
                "Suspicious": suspicious_count,
                "Unknown": unknown_count,
            },
            "timeline": {
                "labels": timeline_labels,
                "authorised": timeline_auth,
                "suspicious": timeline_susp,
                "unknown": timeline_unk,
            },
            "alert_trends": {
                "labels": list(alert_buckets.keys()),
                "counts": list(alert_buckets.values()),
            },
        },
        "recent_observations": [o.to_dict() for o in recent_observations],
        "recent_alerts": [a.to_dict() for a in recent_alerts],
        "recent_sessions": [s.to_dict() for s in recent_sessions],
    }


@dashboard_bp.route("/")
def index():
    return redirect(url_for("dashboard.dashboard"))


@dashboard_bp.route("/dashboard")
@login_required
def dashboard():
    payload = _build_dashboard_payload()
    return render_template("dashboard.html", data=payload)


@dashboard_bp.route("/api/dashboard/summary")
@login_required
def dashboard_summary_api():
    return jsonify(_build_dashboard_payload())


@dashboard_bp.route("/networks")
@login_required
def networks():
    latest_session = (
        ScanSession.query.filter_by(status="Completed")
        .order_by(ScanSession.started_at.desc())
        .first()
    )
    observations = []
    if latest_session:
        rows = (
            WirelessObservation.query.filter_by(scan_session_id=latest_session.id)
            .order_by(WirelessObservation.classification.asc())
            .all()
        )
        for row in rows:
            evt = DetectionEvent.query.filter_by(observation_id=row.id).first()
            item = row.to_dict()
            item["triggered_rule"] = evt.triggered_rule if evt else ""
            observations.append(item)

    return render_template(
        "networks.html",
        observations=observations,
        latest_session=latest_session.to_dict() if latest_session else None,
    )


@dashboard_bp.route("/about")
@login_required
def about():
    return render_template("about.html")
