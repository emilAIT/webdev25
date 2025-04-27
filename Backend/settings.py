from flask import Blueprint, request, jsonify, send_from_directory, session
from Backend.db import connect_db
import os
from werkzeug.utils import secure_filename

# Create blueprint with a unique name
bp = Blueprint("settings", __name__)

# Settings for uploads
UPLOAD_FOLDER = 'uploads/profile_photos'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Function to check if the file extension is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@bp.route('/change_password', methods=['POST'])
def change_password():
    # Check if user is authenticated
    if 'user_id' not in session:
        return jsonify({"message": "Not authenticated"}), 401

    data = request.get_json()
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify({"message": "Both old and new passwords are required"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    try:
        # Get user's current password
        cursor.execute("SELECT password FROM users WHERE id = ?", (session['user_id'],))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"message": "User not found"}), 404

        stored_password = user[0]

        if stored_password != old_password:
            return jsonify({"message": "Current password is incorrect"}), 400

        # Update password
        cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_password, session['user_id']))
        conn.commit()

        return jsonify({"message": "Password changed successfully!"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Failed to change password: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

@bp.route('/users', methods=['GET'])
def get_all_users():
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT u.id, u.username, u.email, u.profile_picture
            FROM users u
        """)
        users = cursor.fetchall()
        
        user_list = []
        for user in users:
            # Get profile photo if available
            photo_url = None
            if user[3]:  # if profile_picture is not None
                photo_url = f"/uploads/profile_photos/{user[3]}"
            else:
                # Check if there's an entry in the profile_photos table
                cursor.execute("SELECT photo FROM profile_photos WHERE user_id = ?", (user[0],))
                photo_result = cursor.fetchone()
                if photo_result:
                    photo_url = f"/uploads/profile_photos/{photo_result[0]}"
            
            # Default to placeholder if no photo is found
            if not photo_url:
                photo_url = "/api/placeholder/50/50"
            
            user_list.append({
                "id": user[0],
                "username": user[1],
                "email": user[2],
                "profile_picture": photo_url
            })

        return jsonify({"users": user_list}), 200
        
    except Exception as e:
        return jsonify({"message": f"Error fetching users: {str(e)}"}), 500
        
    finally:
        conn.close()

@bp.route('/set_profile_photo', methods=['POST'])
def set_profile_photo():
    username = request.form.get('username')
    if 'photo' not in request.files:
        return jsonify({"message": "No file part"}), 400
    photo = request.files['photo']
    if photo.filename == '':
        return jsonify({"message": "No selected file"}), 400

    if photo and allowed_file(photo.filename):
        # Create directory if it doesn't exist
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Save the file securely
        filename = secure_filename(photo.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        photo.save(file_path)

        # Connect to the database
        conn = connect_db()
        cursor = conn.cursor()

        # Get the user ID based on username
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "User not found"}), 404

        user_id = user[0]

        # Update the profile photo path in the database
        cursor.execute("INSERT OR REPLACE INTO profile_photos (user_id, photo) VALUES (?, ?)", (user_id, filename))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "Profile photo updated successfully"}), 200

    return jsonify({"message": "Invalid file type. Only images are allowed."}), 400
    
@bp.route('/get_profile_photo', methods=['GET'])
def get_profile_photo():
    username = request.args.get('username')
    if not username:
        return jsonify({"message": "Username is required"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    # Get the profile photo file path from the database
    cursor.execute("SELECT p.photo FROM profile_photos p JOIN users u ON p.user_id = u.id WHERE u.username = ?", (username,))
    photo = cursor.fetchone()

    conn.close()

    if not photo:
        return jsonify({"message": "No profile photo found for this user"}), 404

    # Return the file path (relative path to be used for accessing the image)
    photo_path = photo[0]
    return jsonify({"photo_url": f"/uploads/profile_photos/{photo_path}"}), 200

# Serve uploaded profile photos in this Blueprint
@bp.route('/uploads/profile_photos/<filename>')
def uploaded_file(filename):
    return send_from_directory('uploads/profile_photos', filename)

# Create a route without /api prefix to serve uploaded profile photos
@bp.route('/get-profile-photo/<filename>', methods=['GET']) 
def get_profile_photo_by_filename(filename):
    return send_from_directory('uploads/profile_photos', filename)

@bp.route('/update-profile', methods=['POST'])
def update_profile():
    # Check if user is authenticated
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not authenticated"}), 401
    
    data = request.get_json()
    name = data.get('name')
    info = data.get('info')
    
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Update user's name if provided
        if name is not None:
            cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        
        # Store user info in the database (add info column if it doesn't exist)
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        if 'info' not in [col[1] for col in columns]:
            cursor.execute("ALTER TABLE users ADD COLUMN info TEXT")
        
        if info is not None:
            cursor.execute("UPDATE users SET info = ? WHERE id = ?", (info, user_id))
        
        conn.commit()
        return jsonify({"success": True, "message": "Profile updated successfully"}), 200
    
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Error updating profile: {str(e)}"}), 500
    
    finally:
        conn.close()

@bp.route('/update-profile-avatar', methods=['POST'])
def update_profile_avatar():
    # Check if user is authenticated
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not authenticated"}), 401
    
    if 'avatar' not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
    
    avatar = request.files['avatar']
    if avatar.filename == '':
        return jsonify({"success": False, "message": "No selected file"}), 400
    
    if avatar and allowed_file(avatar.filename):
        # Create directory if it doesn't exist
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Generate a unique filename (user_id + timestamp + original extension)
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        ext = avatar.filename.rsplit('.', 1)[1].lower()
        filename = f"user_{user_id}_{timestamp}.{ext}"
        
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        avatar.save(file_path)
        
        conn = connect_db()
        cursor = conn.cursor()
        
        try:
            # Update profile_picture in users table
            cursor.execute("UPDATE users SET profile_picture = ? WHERE id = ?", (filename, user_id))
            
            # Also update or insert into profile_photos table
            cursor.execute("SELECT id FROM profile_photos WHERE user_id = ?", (user_id,))
            existing = cursor.fetchone()
            
            if existing:
                cursor.execute("UPDATE profile_photos SET photo = ? WHERE user_id = ?", (filename, user_id))
            else:
                cursor.execute("INSERT INTO profile_photos (user_id, photo) VALUES (?, ?)", (user_id, filename))
            
            conn.commit()
            return jsonify({
                "success": True,
                "message": "Avatar updated successfully", 
                "photo_url": f"/uploads/profile_photos/{filename}"
            }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({"success": False, "message": f"Error updating avatar: {str(e)}"}), 500
        
        finally:
            conn.close()
    
    return jsonify({"success": False, "message": "Invalid file type. Only images are allowed."}), 400

@bp.route('/get-current-user', methods=['GET'])
def get_current_user():
    # Check if user is authenticated
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT u.id, u.username, u.name, u.info, u.profile_picture 
            FROM users u 
            WHERE u.id = ?
        ''', (user_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        # Get profile photo if available
        photo_url = None
        if user_data[4]:  # if profile_picture is not None
            photo_url = f"/uploads/profile_photos/{user_data[4]}"
        else:
            # Check if there's an entry in the profile_photos table
            cursor.execute("SELECT photo FROM profile_photos WHERE user_id = ?", (user_id,))
            photo_result = cursor.fetchone()
            if photo_result:
                photo_url = f"/uploads/profile_photos/{photo_result[0]}"
        
        # Default to placeholder avatar if no photo is found
        if not photo_url:
            photo_url = "Backend/static/images/contact_logo.png"
        
        user = {
            "id": user_data[0],
            "username": user_data[1],
            "name": user_data[2] if user_data[2] else user_data[1],  # Use username if name is not set
            "info": user_data[3],
            "avatar": photo_url
        }
        
        return jsonify({"success": True, "user": user}), 200
    
    except Exception as e:
        return jsonify({"success": False, "message": f"Error fetching user data: {str(e)}"}), 500
    
    finally:
        conn.close()

@bp.route('/check_admin_status', methods=['GET'])
def check_admin_status():
    if 'user_id' not in session:
        return jsonify({"is_admin": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,))
        result = cursor.fetchone()
        
        if result is None:
            return jsonify({"is_admin": False, "message": "User not found"}), 404
            
        is_admin = bool(result[0])
        return jsonify({"is_admin": is_admin}), 200
        
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return jsonify({"is_admin": False, "message": "Error checking admin status"}), 500
        
    finally:
        cursor.close()
        conn.close()

@bp.route('/users/<int:user_id>/report', methods=['POST'])
def report_user(user_id):
    # Check if user is authenticated
    if 'user_id' not in session:
        return jsonify({"message": "Not authenticated"}), 401

    reporter_id = session['user_id']
    
    # Prevent self-reporting
    if reporter_id == user_id:
        return jsonify({"message": "You cannot report yourself"}), 400

    conn = connect_db()
    cursor = conn.cursor()

    try:
        # Check if user has already reported this user
        cursor.execute("SELECT 1 FROM complaints WHERE reporter_id = ? AND reported_user_id = ?", 
                      (reporter_id, user_id))
        if cursor.fetchone():
            return jsonify({"message": "You have already reported this user"}), 400

        # Add the complaint
        cursor.execute("""
            INSERT INTO complaints (reporter_id, reported_user_id)
            VALUES (?, ?)
        """, (reporter_id, user_id))
        
        conn.commit()
        return jsonify({"message": "User reported successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Error reporting user: {str(e)}"}), 500

    finally:
        conn.close()

@bp.route('/users/<int:user_id>/details', methods=['GET'])
def get_user_details(user_id):
    # Check if user is authenticated
    if 'user_id' not in session:
        return jsonify({"message": "Not authenticated"}), 401

    conn = connect_db()
    cursor = conn.cursor()

    try:
        # Get user details
        cursor.execute("""
            SELECT u.id, u.username, u.email, u.name, u.profile_picture, u.info,
                   u.registration_date,
                   (SELECT COUNT(*) FROM group_members WHERE user_id = u.id) as group_count,
                   (SELECT COUNT(*) FROM complaints WHERE reported_user_id = u.id) as complaint_count
            FROM users u
            WHERE u.id = ?
        """, (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "User not found"}), 404

        # Get profile photo if available
        photo_url = None
        if user[4]:  # if profile_picture is not None
            photo_url = f"/uploads/profile_photos/{user[4]}"
        else:
            # Check if there's an entry in the profile_photos table
            cursor.execute("SELECT photo FROM profile_photos WHERE user_id = ?", (user_id,))
            photo_result = cursor.fetchone()
            if photo_result:
                photo_url = f"/uploads/profile_photos/{photo_result[0]}"

        # Default to placeholder avatar if no photo is found
        if not photo_url:
            photo_url = "Backend/static/images/contact_logo.png"

        return jsonify({
            "id": user[0],
            "username": user[1],
            "email": user[2],
            "name": user[3] if user[3] else user[1],  # Use username if name is not set
            "bio": user[5] if user[5] else "",  # info field is bio
            "profile_picture": photo_url,
            "registration_date": user[6],  # Now using actual registration date
            "group_count": user[7],  # Now using actual group count
            "complaint_count": user[8]  # Now using actual complaint count
        }), 200

    except Exception as e:
        return jsonify({"message": f"Error getting user details: {str(e)}"}), 500

    finally:
        conn.close()

@bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    # Check if user is authenticated
    if 'user_id' not in session:
        return jsonify({"message": "Not authenticated"}), 401

    conn = connect_db()
    cursor = conn.cursor()

    try:
        # Delete user's profile picture if exists
        cursor.execute("SELECT profile_picture FROM users WHERE id = ?", (user_id,))
        profile_pic = cursor.fetchone()
        if profile_pic and profile_pic[0]:
            pic_path = os.path.join(UPLOAD_FOLDER, profile_pic[0])
            if os.path.exists(pic_path):
                os.remove(pic_path)

        # Delete from profile_photos if exists
        cursor.execute("DELETE FROM profile_photos WHERE user_id = ?", (user_id,))

        # Delete user from database
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        conn.rollback()
        print(f"Error deleting user: {str(e)}")
        return jsonify({"message": f"Error deleting user: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()