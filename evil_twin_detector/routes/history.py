"""Detection history routes."""

from datetime import datetime

from flask import Blueprint, jsonify, render_template, request

from database.models import DetectionEvent, WirelessObservation
from routes.auth import login_required

history_bp = Blueprint("history", __name__)


@history_bp.route("/history")
@login_required
def history_page():
    rows = (
        WirelessObservation.query.order_by(WirelessObservation.created_at.desc())
        .limit(200)
        .all()
    )
    return render_template("history.html", observations=[r.to_dict() for r in rows])


@history_bp.route("/api/history", methods=["GET"])
@login_required
def history_api():
    search = (request.args.get("search") or "").strip().lower()
    classification = (request.args.get("classification") or "").strip().upper()
    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()

    query = WirelessObservation.query
    if classification in ("AUTHORISED", "SUSPICIOUS", "UNKNOWN"):
        query = query.filter_by(classification=classification)

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(WirelessObservation.created_at >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(f"{end_date}T23:59:59")
            query = query.filter(WirelessObservation.created_at <= end_dt)
        except ValueError:
            pass

    rows = query.order_by(WirelessObservation.created_at.desc()).limit(500).all()
    results = []
    for r in rows:
        if search and search not in r.ssid.lower() and search not in r.bssid.lower():
            continue
        evt = DetectionEvent.query.filter_by(observation_id=r.id).first()
        item = r.to_dict()
        item["triggered_rule"] = evt.triggered_rule if evt else ""
        results.append(item)

    return jsonify({"observations": results})
