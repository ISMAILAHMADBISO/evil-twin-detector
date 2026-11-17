"""Application service layer."""

from services.evaluation_service import compute_evaluation_metrics, evaluate_labelled_case

try:
    from services.alert_service import (
        create_alert_for_event,
        mark_alert_reviewed,
        resolve_alert,
    )
except ModuleNotFoundError:
    create_alert_for_event = None
    mark_alert_reviewed = None
    resolve_alert = None

__all__ = [
    "create_alert_for_event",
    "mark_alert_reviewed",
    "resolve_alert",
    "evaluate_labelled_case",
    "compute_evaluation_metrics",
]
