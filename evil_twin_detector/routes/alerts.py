"""Security alert management routes."""

from flask import Blueprint, jsonify, render_template, request

from database.models import SecurityAlert
from routes.auth import login_required
from services.alert_service import mark_alert_reviewed, resolve_alert

alerts_bp = Blueprint("alerts", __name__)


@alerts_bp.route("/alerts")
@login_required
def alerts_page():
    alerts = SecurityAlert.query.order_by(SecurityAlert.created_at.desc()).all()
    return render_template("alerts.html", alerts=[a.to_dict() for a in alerts])


@alerts_bp.route("/api/alerts", methods=["GET"])
@login_required
def list_alerts():
    severity = (request.args.get("severity") or "").strip()
    status = (request.args.get("status") or "").strip()

    query = SecurityAlert.query
    if severity:
        query = query.filter_by(severity=severity)
    if status:
        query = query.filter_by(status=status)

    rows = query.order_by(SecurityAlert.created_at.desc()).all()
    return jsonify({"alerts": [a.to_dict() for a in rows]})


@alerts_bp.route("/api/alerts/<int:alert_id>/review", methods=["POST"])
@login_required
def review_alert_route(alert_id: int):
    alert = SecurityAlert.query.get_or_404(alert_id)
    updated = mark_alert_reviewed(alert)
    return jsonify({"alert": updated.to_dict()})


@alerts_bp.route("/api/alerts/<int:alert_id>/resolve", methods=["POST"])
@login_required
def resolve_alert_route(alert_id: int):
    alert = SecurityAlert.query.get_or_404(alert_id)
    updated = resolve_alert(alert)
    return jsonify({"alert": updated.to_dict()})
