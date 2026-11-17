"""Authentication routes with safe first-run administrator setup."""

from functools import wraps

from flask import (
    Blueprint,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

from database.db import db
from database.models import User

auth_bp = Blueprint("auth", __name__)


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required."}), 401
            if User.query.count() == 0:
                return redirect(url_for("auth.setup"))
            return redirect(url_for("auth.login"))
        return view_func(*args, **kwargs)

    return wrapped


@auth_bp.route("/setup", methods=["GET", "POST"])
def setup():
    if User.query.count() > 0:
        return redirect(url_for("auth.login"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        confirm = request.form.get("confirm_password") or ""

        if len(username) < 3:
            flash("Username must be at least 3 characters.", "danger")
            return render_template("login.html", setup_mode=True)
        if len(password) < 8:
            flash("Administrator password must be at least 8 characters.", "danger")
            return render_template("login.html", setup_mode=True)
        if password != confirm:
            flash("Passwords do not match.", "danger")
            return render_template("login.html", setup_mode=True)

        admin = User(
            username=username,
            password_hash=generate_password_hash(password),
        )
        db.session.add(admin)
        db.session.commit()
        session["user_id"] = admin.id
        session["username"] = admin.username
        flash("Administrator account created successfully.", "success")
        return redirect(url_for("dashboard.dashboard"))

    return render_template("login.html", setup_mode=True)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if User.query.count() == 0:
        return redirect(url_for("auth.setup"))
    if session.get("user_id"):
        return redirect(url_for("dashboard.dashboard"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        user = User.query.filter_by(username=username).first()

        if user and user.status == "Active" and check_password_hash(user.password_hash, password):
            from datetime import datetime, timezone

            user.last_login_at = datetime.now(timezone.utc)
            db.session.commit()
            session["user_id"] = user.id
            session["username"] = user.username
            return redirect(url_for("dashboard.dashboard"))

        flash("Invalid username or password.", "danger")

    return render_template("login.html", setup_mode=False)


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


@auth_bp.route("/api/admins", methods=["GET"])
@login_required
def list_admins():
    admins = User.query.order_by(User.id.asc()).all()
    return jsonify({"admins": [a.to_dict() for a in admins]})


@auth_bp.route("/api/admins", methods=["POST"])
@login_required
def create_admin():
    data = request.get_json(silent=True) or request.form.to_dict()
    username = (data.get("username") or "").strip()
    full_name = (data.get("full_name") or username).strip()
    role = (data.get("role") or "Administrator").strip()
    password = data.get("password") or ""

    if len(username) < 3 or len(password) < 8:
        return jsonify({"error": "Username (>=3 chars) and password (>=8 chars) are required."}), 400
    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({"error": f"Administrator '{username}' already exists."}), 409

    admin = User(
        username=username,
        full_name=full_name,
        role=role,
        status="Active",
        password_hash=generate_password_hash(password),
    )
    db.session.add(admin)
    db.session.commit()
    return jsonify({"admin": admin.to_dict()}), 201
