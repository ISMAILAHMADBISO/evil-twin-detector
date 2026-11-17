"""Approved Access Point registry CRUD routes."""

import re

from flask import Blueprint, jsonify, render_template, request

from database.db import db
from database.models import ApprovedAccessPoint
from routes.auth import login_required
from scanner.windows_scanner import normalize_bssid

access_points_bp = Blueprint("access_points", __name__)

MAC_PATTERN = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$")


def _validate_ap_payload(data: dict) -> tuple[dict | None, str | None]:
    ssid = (data.get("ssid") or "").strip()
    raw_bssid = (data.get("bssid") or "").strip()
    expected_security = (data.get("expected_security") or "").strip()
    description = (data.get("description") or "").strip()
    status = (data.get("status") or "Active").strip()

    if not ssid:
        return None, "SSID is required."
    if not MAC_PATTERN.match(raw_bssid):
        return None, "BSSID must be a valid MAC address (e.g., AA:BB:CC:DD:EE:FF)."
    if not expected_security:
        return None, "Expected security configuration is required."
    if status not in ("Active", "Inactive"):
        return None, "Status must be 'Active' or 'Inactive'."

    return {
        "ssid": ssid,
        "bssid": normalize_bssid(raw_bssid),
        "expected_security": expected_security,
        "description": description,
        "status": status,
    }, None


@access_points_bp.route("/approved-access-points")
@login_required
def approved_access_points_page():
    aps = ApprovedAccessPoint.query.order_by(ApprovedAccessPoint.created_at.desc()).all()
    return render_template("approved_access_points.html", access_points=[a.to_dict() for a in aps])


@access_points_bp.route("/api/access-points", methods=["GET"])
@login_required
def list_access_points():
    search = (request.args.get("search") or "").strip().lower()
    status_filter = (request.args.get("status") or "").strip()

    query = ApprovedAccessPoint.query
    if status_filter in ("Active", "Inactive"):
        query = query.filter_by(status=status_filter)

    rows = query.order_by(ApprovedAccessPoint.created_at.desc()).all()
    if search:
        rows = [
            r
            for r in rows
            if search in r.ssid.lower()
            or search in r.bssid.lower()
            or search in (r.description or "").lower()
        ]
    return jsonify({"access_points": [r.to_dict() for r in rows]})


@access_points_bp.route("/api/access-points", methods=["POST"])
@login_required
def create_access_point():
    data = request.get_json(silent=True) or request.form.to_dict()
    cleaned, err = _validate_ap_payload(data)
    if err:
        return jsonify({"error": err}), 400

    existing = ApprovedAccessPoint.query.filter_by(bssid=cleaned["bssid"]).first()
    if existing:
        return (
            jsonify(
                {
                    "error": f"BSSID {cleaned['bssid']} is already registered under SSID '{existing.ssid}'."
                }
            ),
            409,
        )

    ap = ApprovedAccessPoint(**cleaned)
    db.session.add(ap)
    db.session.commit()
    return jsonify({"access_point": ap.to_dict()}), 201


@access_points_bp.route("/api/access-points/<int:ap_id>", methods=["PUT", "PATCH"])
@login_required
def update_access_point(ap_id: int):
    ap = ApprovedAccessPoint.query.get_or_404(ap_id)
    data = request.get_json(silent=True) or request.form.to_dict()
    cleaned, err = _validate_ap_payload(data)
    if err:
        return jsonify({"error": err}), 400

    duplicate = ApprovedAccessPoint.query.filter(
        ApprovedAccessPoint.bssid == cleaned["bssid"],
        ApprovedAccessPoint.id != ap_id,
    ).first()
    if duplicate:
        return (
            jsonify({"error": f"Another record already uses BSSID {cleaned['bssid']}."}),
            409,
        )

    ap.ssid = cleaned["ssid"]
    ap.bssid = cleaned["bssid"]
    ap.expected_security = cleaned["expected_security"]
    ap.description = cleaned["description"]
    ap.status = cleaned["status"]
    db.session.commit()
    return jsonify({"access_point": ap.to_dict()})


@access_points_bp.route("/api/access-points/<int:ap_id>", methods=["DELETE"])
@login_required
def delete_access_point(ap_id: int):
    ap = ApprovedAccessPoint.query.get_or_404(ap_id)
    db.session.delete(ap)
    db.session.commit()
    return jsonify({"deleted": True, "id": ap_id})
