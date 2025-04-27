from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
import os
from Backend.db import connect_db
from Backend.auth import is_authenticated

bp = Blueprint("user", __name__, url_prefix="/api/user")

UPLOAD_FOLDER = 'uploads/profile_photos'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@bp.route('/profile', methods=['GET'])
def get_profile():
    if not is_authenticated():
        return jsonify({"message": "Not authenticated"}), 401

    user_id = session.get('user_id')
    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT username, name, profile_picture, info
            FROM users
            WHERE id = ?
        """, (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "User not found"}), 404

        return jsonify({
            "username": user[0],
            "name": user[1] or "",
            "profile_picture": user[2],
            "bio": user[3] or ""
        }), 200

    finally:
        cursor.close()
        conn.close()

@bp.route('/update-profile', methods=['POST'])
def update_profile():
    if not is_authenticated():
        return jsonify({"message": "Not authenticated"}), 401

    user_id = session.get('user_id')
    data = request.get_json()
    
    updates = {}
    if 'name' in data:
        updates['name'] = data['name']
    if 'bio' in data:
        updates['info'] = data['bio']

    if not updates:
        return jsonify({"message": "No updates provided"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    try:
        set_clause = ', '.join(f"{k} = ?" for k in updates.keys())
        query = f"UPDATE users SET {set_clause} WHERE id = ?"
        values = list(updates.values()) + [user_id]
        
        cursor.execute(query, values)
        conn.commit()

        return jsonify({"message": "Profile updated successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Failed to update profile: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

@bp.route('/update-profile-picture', methods=['POST'])
def update_profile_picture():
    if not is_authenticated():
        print("Authentication failed for profile picture update")
        return jsonify({"message": "Not authenticated", "success": False}), 401

    if 'profile_picture' not in request.files:
        print("No profile_picture file in request")
        return jsonify({"message": "No file provided", "success": False}), 400

    file = request.files['profile_picture']
    if file.filename == '':
        print("Empty filename provided")
        return jsonify({"message": "No file selected", "success": False}), 400

    if not allowed_file(file.filename):
        print(f"Invalid file type: {file.filename}")
        return jsonify({"message": "File type not allowed", "success": False}), 400

    user_id = session.get('user_id')
    filename = secure_filename(f"{user_id}_{file.filename}")
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    print(f"Processing profile picture update for user {user_id}")
    print(f"Saving file to: {filepath}")

    conn = connect_db()
    cursor = conn.cursor()

    try:
        # Ensure upload directory exists
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Remove old profile picture if it exists
        cursor.execute("SELECT profile_picture FROM users WHERE id = ?", (user_id,))
        old_picture = cursor.fetchone()
        if old_picture and old_picture[0]:
            old_filepath = os.path.join(UPLOAD_FOLDER, old_picture[0])
            if os.path.exists(old_filepath):
                try:
                    os.remove(old_filepath)
                    print(f"Removed old profile picture: {old_filepath}")
                except Exception as e:
                    print(f"Failed to remove old profile picture: {e}")

        # Save the new file
        file.save(filepath)
        print(f"New profile picture saved successfully")

        # Update database
        cursor.execute("""
            UPDATE users
            SET profile_picture = ?
            WHERE id = ?
        """, (filename, user_id))
        conn.commit()
        print(f"Database updated successfully")

        return jsonify({
            "message": "Profile picture updated successfully",
            "success": True,
            "filename": filename
        }), 200

    except Exception as e:
        print(f"Error updating profile picture: {str(e)}")
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                print(f"Cleaned up failed upload: {filepath}")
            except Exception as cleanup_error:
                print(f"Failed to clean up failed upload: {cleanup_error}")
        conn.rollback()
        return jsonify({
            "message": f"Failed to update profile picture: {str(e)}",
            "success": False
        }), 500

    finally:
        cursor.close()
        conn.close()

@bp.route('/<int:user_id>/profile-picture', methods=['GET'])
def get_user_profile_picture(user_id):
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # First check the users table
        cursor.execute("SELECT profile_picture FROM users WHERE id = ?", (user_id,))
        profile_pic = cursor.fetchone()
        
        if profile_pic and profile_pic[0]:
            return jsonify({"photo_url": f"/uploads/profile_photos/{profile_pic[0]}"}), 200
            
        # If not found in users table, check profile_photos table
        cursor.execute("SELECT photo FROM profile_photos WHERE user_id = ?", (user_id,))
        profile_pic = cursor.fetchone()
        
        if profile_pic and profile_pic[0]:
            return jsonify({"photo_url": f"/uploads/profile_photos/{profile_pic[0]}"}), 200
            
        # If no profile picture found, return default avatar
        return jsonify({"photo_url": "Backend/static/images/contact_logo.png"}), 200
        
    except Exception as e:
        return jsonify({"message": f"Error fetching profile picture: {str(e)}"}), 500
        
    finally:
        cursor.close()
        conn.close() 