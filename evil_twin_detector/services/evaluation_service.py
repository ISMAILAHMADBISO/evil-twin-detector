"""Performance evaluation service for the rule-based detection engine."""

from __future__ import annotations

import time
from typing import Iterable

from detection.rule_engine import (
    CLASSIFICATION_SUSPICIOUS,
    ApprovedAPProfile,
    RuleBasedDetectionEngine,
)


def evaluate_labelled_case(
    engine: RuleBasedDetectionEngine,
    ssid: str,
    bssid: str,
    observed_security: str,
) -> tuple[str, float, str]:
    """Run the detection engine on a single labelled test case and measure execution time in ms."""
    start = time.perf_counter()
    decision = engine.evaluate(ssid=ssid, bssid=bssid, security=observed_security)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return decision.classification, round(elapsed_ms, 4), decision.reason


def compute_evaluation_metrics(cases: Iterable[dict]) -> dict:
    """Compute TP, FP, TN, FN, Precision, Detection Rate, FPR, and Detection Time.

    Ground-truth categories:
    - 'Simulated Evil Twin' -> Expected positive detection (SUSPICIOUS)
    - 'Legitimate' / 'Unknown' -> Expected negative detection (AUTHORISED or UNKNOWN)
    """
    case_list = list(cases)
    total = len(case_list)
    if total == 0:
        return {
            "has_data": False,
            "total_cases": 0,
            "tp": 0,
            "fp": 0,
            "tn": 0,
            "fn": 0,
            "precision": None,
            "detection_rate": None,
            "false_positive_rate": None,
            "avg_detection_time_ms": None,
        }

    tp = 0
    fp = 0
    tn = 0
    fn = 0
    total_time_ms = 0.0

    for item in case_list:
        expected_gt = (item.get("expected_classification") or "").strip()
        actual = (item.get("actual_classification") or "").strip().upper()
        total_time_ms += float(item.get("detection_time_ms") or 0.0)

        is_actual_threat = expected_gt == "Simulated Evil Twin"
        is_predicted_threat = actual == CLASSIFICATION_SUSPICIOUS

        if is_actual_threat and is_predicted_threat:
            tp += 1
        elif is_actual_threat and not is_predicted_threat:
            fn += 1
        elif not is_actual_threat and is_predicted_threat:
            fp += 1
        else:
            tn += 1

    precision = (tp / (tp + fp)) if (tp + fp) > 0 else None
    detection_rate = (tp / (tp + fn)) if (tp + fn) > 0 else None
    false_positive_rate = (fp / (fp + tn)) if (fp + tn) > 0 else None
    avg_time_ms = total_time_ms / total

    return {
        "has_data": True,
        "total_cases": total,
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "precision": round(precision, 4) if precision is not None else None,
        "detection_rate": round(detection_rate, 4) if detection_rate is not None else None,
        "false_positive_rate": (
            round(false_positive_rate, 4) if false_positive_rate is not None else None
        ),
        "avg_detection_time_ms": round(avg_time_ms, 4),
    }


def build_engine_from_profiles(profiles: Iterable[ApprovedAPProfile]) -> RuleBasedDetectionEngine:
    return RuleBasedDetectionEngine(profiles)
