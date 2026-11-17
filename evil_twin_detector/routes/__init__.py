"""Flask Blueprint registration."""

from routes.access_points import access_points_bp
from routes.alerts import alerts_bp
from routes.analytics import analytics_bp
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.history import history_bp
from routes.scanner import scanner_bp
from routes.settings import settings_bp


def register_blueprints(app) -> None:
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(scanner_bp)
    app.register_blueprint(access_points_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(settings_bp)
