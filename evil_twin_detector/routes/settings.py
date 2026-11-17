"""Application settings, database backup, and restore routes."""

import platform
import shutil
from pathlib import Path

from flask import (
    Blueprint,
    current_app,
    jsonify,
    render_template,
    request,
    send_file,
)

from database.db import db
from database.models import ApplicationSetting
from routes.auth import login_required

settings_bp = Blueprint("settings", __name__)

ALLOWED_SETTING_KEYS = {
    "scan_interval_seconds",
    "auto_scan_enabled",
    "alerts_enabled",
    "alert_on_unknown",
    "demo_mode",
    "preferred_interface",
}


def _get_all_settings() -> dict:
    rows = ApplicationSetting.query.all()
    return {row.setting_key: row.setting_value for row in rows}


def _resolve_sqlite_path() -> Path | None:
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if uri.startswith("sqlite:///"):
        return Path(uri.replace("sqlite:///", "", 1))
    return None


@settings_bp.route("/settings")
@login_required
def settings_page():
    return render_template(
        "settings.html",
        settings=_get_all_settings(),
        host_platform=platform.system(),
    )


@settings_bp.route("/api/settings", methods=["GET"])
@login_required
def get_settings_api():
    return jsonify(
        {
            "settings": _get_all_settings(),
            "host_platform": platform.system(),
        }
    )


@settings_bp.route("/api/settings", methods=["POST", "PUT"])
@login_required
def update_settings_api():
    data = request.get_json(silent=True) or request.form.to_dict()
    for key, value in data.items():
        if key not in ALLOWED_SETTING_KEYS:
            continue
        str_val = str(value).strip()
        if key == "scan_interval_seconds":
            try:
                interval = max(5, min(3600, int(str_val)))
                str_val = str(interval)
            except ValueError:
                return jsonify({"error": "Scan interval must be a number between 5 and 3600."}), 400

        row = ApplicationSetting.query.filter_by(setting_key=key).first()
        if row is None:
            db.session.add(ApplicationSetting(setting_key=key, setting_value=str_val))
        else:
            row.setting_value = str_val

    db.session.commit()
    return jsonify({"settings": _get_all_settings()})


@settings_bp.route("/api/settings/backup", methods=["GET"])
@login_required
def backup_database():
    db_path = _resolve_sqlite_path()
    if not db_path or not db_path.exists():
        return jsonify({"error": "SQLite database file not found for backup."}), 404
    db.session.commit()
    return send_file(
        db_path,
        as_attachment=True,
        download_name="eviltwin_detector_backup.db",
    )


@settings_bp.route("/api/settings/restore", methods=["POST"])
@login_required
def restore_database():
    if "file" not in request.files:
        return jsonify({"error": "No backup file uploaded."}), 400
    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Selected file is empty."}), 400

    header = uploaded.stream.read(16)
    uploaded.stream.seek(0)
    if header != b"SQLite format 3\x00":
        return jsonify({"error": "Invalid SQLite database backup file."}), 400

    db_path = _resolve_sqlite_path()
    if not db_path:
        return jsonify({"error": "Restore is only supported for SQLite databases."}), 400

    temp_path = db_path.with_suffix(".restore.tmp")
    uploaded.save(temp_path)
    db.session.remove()
    db.engine.dispose()
    shutil.move(str(temp_path), str(db_path))
    return jsonify({"restored": True})
