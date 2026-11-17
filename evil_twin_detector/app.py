"""EvilTwin Detector Flask application entry point."""

import os

from flask import Flask, session

from config import Config
from database.db import init_db
from routes import register_blueprints


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
    )
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    init_db(app)
    register_blueprints(app)

    @app.context_processor
    def inject_globals():
        return {
            "app_name": app.config.get("APP_NAME", "EvilTwin Detector"),
            "app_subtitle": app.config.get("APP_SUBTITLE", "Wi-Fi Security Monitoring System"),
            "current_username": session.get("username"),
        }

    return app


if __name__ == "__main__":
    application = create_app()
    port = int(os.environ.get("PORT", 5000))
    application.run(host="127.0.0.1", port=port, debug=False)
