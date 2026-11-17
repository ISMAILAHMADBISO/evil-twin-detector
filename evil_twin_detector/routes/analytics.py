"""Performance evaluation and analytics routes."""

from flask import Blueprint, jsonify, render_template, request

from database.db import db
from database.models import ApprovedAccessPoint, EvaluationCase
from detection.rule_engine import ApprovedAPProfile, RuleBasedDetectionEngine
from routes.auth import login_required
from scanner.windows_scanner import normalize_bssid
from services.evaluation_service import compute_evaluation_metrics, evaluate_labelled_case

analytics_bp = Blueprint("analytics", __name__)

VALID_GROUND_TRUTHS = ("Legitimate", "Unknown", "Simulated Evil Twin")


@analytics_bp.route("/analytics")
@login_required
def analytics_page():
    cases = EvaluationCase.query.order_by(EvaluationCase.created_at.desc()).all()
    case_dicts = [c.to_dict() for c in cases]
    metrics = compute_evaluation_metrics(case_dicts)
    return render_template("analytics.html", cases=case_dicts, metrics=metrics)


@analytics_bp.route("/api/evaluation", methods=["GET"])
@login_required
def get_evaluation_summary():
    cases = EvaluationCase.query.order_by(EvaluationCase.created_at.desc()).all()
    case_dicts = [c.to_dict() for c in cases]
    metrics = compute_evaluation_metrics(case_dicts)
    return jsonify({"cases": case_dicts, "metrics": metrics})


@analytics_bp.route("/api/evaluation/cases", methods=["POST"])
@login_required
def add_evaluation_case():
    data = request.get_json(silent=True) or request.form.to_dict()
    ssid = (data.get("ssid") or "").strip()
    bssid = normalize_bssid(data.get("bssid") or "")
    observed_security = (data.get("observed_security") or "WPA2").strip()
    expected_security = (data.get("expected_security") or observed_security).strip()
    expected_classification = (data.get("expected_classification") or "").strip()
    test_description = (data.get("test_description") or "").strip()

    if not ssid or not bssid:
        return jsonify({"error": "SSID and BSSID are required."}), 400
    if expected_classification not in VALID_GROUND_TRUTHS:
        return (
            jsonify(
                {
                    "error": "Ground-truth category must be 'Legitimate', 'Unknown', or 'Simulated Evil Twin'."
                }
            ),
            400,
        )

    approved_rows = ApprovedAccessPoint.query.all()
    profiles = [
        ApprovedAPProfile(
            ssid=ap.ssid,
            bssid=ap.bssid,
            expected_security=ap.expected_security,
            status=ap.status,
            description=ap.description,
        )
        for ap in approved_rows
    ]
    engine = RuleBasedDetectionEngine(profiles)
    actual_classification, elapsed_ms, reason = evaluate_labelled_case(
        engine=engine,
        ssid=ssid,
        bssid=bssid,
        observed_security=observed_security,
    )

    case = EvaluationCase(
        ssid=ssid,
        bssid=bssid,
        expected_security=expected_security,
        observed_security=observed_security,
        expected_classification=expected_classification,
        actual_classification=actual_classification,
        detection_time_ms=elapsed_ms,
        test_description=test_description or reason,
    )
    db.session.add(case)
    db.session.commit()

    all_cases = [c.to_dict() for c in EvaluationCase.query.order_by(EvaluationCase.created_at.desc()).all()]
    metrics = compute_evaluation_metrics(all_cases)
    return jsonify({"case": case.to_dict(), "metrics": metrics}), 201


@analytics_bp.route("/api/evaluation/cases/<int:case_id>", methods=["DELETE"])
@login_required
def delete_evaluation_case(case_id: int):
    case = EvaluationCase.query.get_or_404(case_id)
    db.session.delete(case)
    db.session.commit()
    all_cases = [c.to_dict() for c in EvaluationCase.query.order_by(EvaluationCase.created_at.desc()).all()]
    return jsonify({"deleted": True, "metrics": compute_evaluation_metrics(all_cases)})
