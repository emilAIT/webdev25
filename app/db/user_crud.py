import sqlite3
from app.db.database import get_db_connection
from app.utils.password import get_password_hash

def get_user_by_phone(phone):
    """Get user from database by phone number"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_by_email(email):
    """Get user from database by email"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    """Get user from database by ID"""
    if user_id is None:
        return None
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return user

def create_user(nickname, email, phone, password):
    """Create a new user in the database"""
    hashed_password = get_password_hash(password)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (nickname, email, phone, password_hash) VALUES (?, ?, ?, ?)",
            (nickname, email, phone, hashed_password)
        )
        user_id = cursor.lastrowid
        conn.commit()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None
    finally:
        conn.close()

def update_user_photo(user_id, photo_path):
    """Update user's profile photo path in database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE users SET profile_photo = ? WHERE id = ?",
            (photo_path, user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error updating user photo: {e}")
        return False
    finally:
        conn.close()

def update_user_profile(user_id, nickname, email, phone):
    """Update user profile information"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE users SET nickname = ?, email = ?, phone = ? WHERE id = ?",
            (nickname, email, phone, user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error updating user profile: {e}")
        return False
    finally:
        conn.close()

def get_user_photo(user_id):
    """Get user's profile photo path from database"""
    if user_id is None:
        return None
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT profile_photo FROM users WHERE id = ?", (user_id,))
        result = cursor.fetchone()
        photo = result["profile_photo"] if result else None
        
        # Проверяем, что фото не None, не пустая строка и не строка 'None'
        if photo in [None, "", "None"]:
            return None
            
        return photo
    except Exception as e:
        print(f"Error getting user photo: {e}")
        return None
    finally:
        conn.close()

def search_users(query):
    """
    Search for users by nickname, email, or phone
    Returns a list of users matching the query
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Use LIKE query with wildcards to search across multiple fields
    search_pattern = f"%{query}%"
    cursor.execute("""
        SELECT id, nickname, email, phone, profile_photo FROM users 
        WHERE nickname LIKE ? OR email LIKE ? OR phone LIKE ?
        LIMIT 21
    """, (search_pattern, search_pattern, search_pattern))
    
    users = []
    for row in cursor.fetchall():
        users.append({
            "id": row[0],
            "name": row[1],  # Using nickname as name
            "email": row[2],
            "phone": row[3],
            "profile_photo": row[4] if row[4] not in [None, "", "None"] else None
        })
    
    conn.close()
    return users

def change_user_password(user_id, new_password):
    """Change user's password in the database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        hashed_password = get_password_hash(new_password)
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hashed_password, user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error changing user password: {e}")
        return False
    finally:
        conn.close()
