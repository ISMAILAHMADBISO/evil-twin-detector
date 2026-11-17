"""Database initialization and safe seeding of default settings."""

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

DEFAULT_SETTINGS = {
    "scan_interval_seconds": "30",
    "auto_scan_enabled": "false",
    "alerts_enabled": "true",
    "alert_on_unknown": "false",
    "demo_mode": "false",
    "preferred_interface": "auto",
}


def init_db(app) -> None:
    """Create tables safely and seed default application settings."""
    from database.models import ApplicationSetting

    db.init_app(app)
    with app.app_context():
        db.create_all()
        for key, value in DEFAULT_SETTINGS.items():
            existing = ApplicationSetting.query.filter_by(setting_key=key).first()
            if existing is None:
                db.session.add(ApplicationSetting(setting_key=key, setting_value=value))
        db.session.commit()
