"""Live wireless network scanner routes."""

from flask import Blueprint, jsonify, render_template, request

from database.models import ApplicationSetting, ScanSession, WirelessObservation
from routes.auth import login_required
from services.scan_service import execute_wireless_scan

scanner_bp = Blueprint("scanner", __name__)


@scanner_bp.route("/scanner")
@login_required
def scanner_page():
    latest_session = ScanSession.query.order_by(ScanSession.started_at.desc()).first()
    observations = []
    if latest_session:
        observations = (
            WirelessObservation.query.filter_by(scan_session_id=latest_session.id)
            .order_by(WirelessObservation.id.asc())
            .all()
        )
    demo_row = ApplicationSetting.query.filter_by(setting_key="demo_mode").first()
    interval_row = ApplicationSetting.query.filter_by(
        setting_key="scan_interval_seconds"
    ).first()
    return render_template(
        "scanner.html",
        latest_session=latest_session.to_dict() if latest_session else None,
        observations=[o.to_dict() for o in observations],
        demo_mode=(demo_row.setting_value.lower() == "true") if demo_row else False,
        scan_interval=int(interval_row.setting_value) if interval_row else 30,
    )


@scanner_bp.route("/api/scan", methods=["POST"])
@login_required
def trigger_scan():
    body = request.get_json(silent=True) or {}
    demo_override = body.get("demo_mode") if "demo_mode" in body else None
    result = execute_wireless_scan(demo_mode_override=demo_override)
    status_code = 200 if result.get("ok") else 422
    return jsonify(result), status_code
