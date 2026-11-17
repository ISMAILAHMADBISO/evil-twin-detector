"""Rule-based Evil Twin detection package."""

from detection.rule_engine import (
    CLASSIFICATION_AUTHORISED,
    CLASSIFICATION_SUSPICIOUS,
    CLASSIFICATION_UNKNOWN,
    ApprovedAPProfile,
    DetectionDecision,
    RuleBasedDetectionEngine,
)

__all__ = [
    "RuleBasedDetectionEngine",
    "ApprovedAPProfile",
    "DetectionDecision",
    "CLASSIFICATION_AUTHORISED",
    "CLASSIFICATION_SUSPICIOUS",
    "CLASSIFICATION_UNKNOWN",
]
