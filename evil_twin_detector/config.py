"""Application configuration for EvilTwin Detector."""

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)


def _load_or_create_secret_key() -> str:
    env_key = os.environ.get("EVILTWIN_SECRET_KEY")
    if env_key:
        return env_key
    secret_file = INSTANCE_DIR / ".secret_key"
    if secret_file.exists():
        return secret_file.read_text(encoding="utf-8").strip()
    generated = secrets.token_hex(32)
    secret_file.write_text(generated, encoding="utf-8")
    return generated


class Config:
    APP_NAME = "EvilTwin Detector"
    APP_SUBTITLE = "Wi-Fi Security Monitoring System"
    SECRET_KEY = _load_or_create_secret_key()
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{INSTANCE_DIR / 'eviltwin_detector.db'}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    DEFAULT_SCAN_INTERVAL_SECONDS = 30
    SCAN_TIMEOUT_SECONDS = 15
