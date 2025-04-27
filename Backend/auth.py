from flask import Blueprint, request, jsonify, session, current_app
from Backend.db import connect_db
import pytz
import datetime
from datetime import timedelta

bp = Blueprint("auth", __name__, url_prefix="/auth")


def is_authenticated():
    return "user_id" in session


@bp.route("/check_auth", methods=["GET"])
def check_auth():
    if is_authenticated():
        return jsonify({
            "authenticated": True,
            "username": session.get("username")
        }), 200
    return jsonify({"authenticated": False}), 401


@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    required_fields = ["email", "username", "password", "security_question", "secret_word"]

    if not all(data.get(field) for field in required_fields):
        return jsonify({"message": "All fields are required!"}), 400

    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Check for existing email or username
        cursor.execute("SELECT 1 FROM users WHERE email = ? OR username = ?", (data["email"], data["username"]))
        if cursor.fetchone():
            return jsonify({"message": "Email or Username already exists"}), 409

        # Get current time in Kyrgyzstan timezone
        kyrgyzstan_tz = pytz.timezone('Asia/Bishkek')
        current_time = datetime.datetime.now(kyrgyzstan_tz)

        # Register new user
        cursor.execute("""
            INSERT INTO users (username, email, password, security_question, secret_word, registration_date) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (data["username"], data["email"], data["password"], data["security_question"], data["secret_word"], current_time.isoformat()))
        conn.commit()

        user_id = cursor.lastrowid
        session.update({
            "user_id": user_id,
            "username": data["username"],
            "email": data["email"]
        })
        session.permanent = True

        return jsonify({
            "message": "User registered successfully",
            "username": data["username"],
            "user_id": user_id,
            "email": data["email"]
        }), 200

    except Exception as e:
        return jsonify({"message": f"Registration failed: {e}"}), 500

    finally:
        cursor.close()
        conn.close()


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    remember_me = data.get("remember_me", False)

    if not username or not password:
        return jsonify({"error": "Username and Password are required"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user or user[2] != password:  # Index 2 is password
            return jsonify({"error": "Invalid credentials"}), 400

        session.update({
            "user_id": user[0],
            "username": user[1],
            "email": user[3]
        })
        
        # If remember me is checked, make the session permanent
        session.permanent = remember_me

        return jsonify({
            "message": "Login successful",
            "username": user[1],
            "user_id": user[0],
            "email": user[3]
        }), 200

    finally:
        cursor.close()
        conn.close()


@bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    username = data.get("username")
    new_password = data.get("new_password")

    if not username or not new_password:
        return jsonify({"error": "Username and new password are required"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute("UPDATE users SET password = ? WHERE username = ?", (new_password, username))
        if cursor.rowcount == 0:
            return jsonify({"error": "User not found"}), 404
            
        conn.commit()
        return jsonify({"message": "Password reset successful"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Password reset failed: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()


@bp.route("/get-security-question", methods=["POST"])
def get_security_question():
    username = request.get_json().get("username")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT security_question FROM users WHERE username = ?", (username,))
        result = cursor.fetchone()

        if result:
            return jsonify({"security_question": result[0]}), 200
        return jsonify({"error": "User not found"}), 404

    finally:
        cursor.close()
        conn.close()


@bp.route("/verify-secret-word", methods=["POST"])
def verify_secret_word():
    data = request.get_json()
    username = data.get("username")
    secret_word = data.get("secret_word")

    if not username or not secret_word:
        return jsonify({"error": "Username and secret word are required"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT secret_word FROM users WHERE username = ?", (username,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"error": "User not found"}), 404
        
        if result[0] != secret_word:
            return jsonify({"error": "Incorrect secret word"}), 400

        return jsonify({"message": "Secret word verified"}), 200

    finally:
        cursor.close()
        conn.close()


@bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logout successful"}), 200


@bp.route("/favicon.ico")
def favicon():
    return "", 204
