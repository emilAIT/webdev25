from flask import Blueprint, jsonify, request, render_template, session, redirect, url_for, send_file
from dbinit import get_db_connection
import sqlite3
from datetime import datetime, timedelta
from io import BytesIO

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# Helper function to check if user is admin
def is_admin():
    # Временно отключаем проверку для тестирования
    # ВНИМАНИЕ: В рабочем приложении верните правильную проверку
    return True
    
    # Оригинальный код проверки:
    # if 'user_id' not in session:
    #     return False
    # 
    # conn = get_db_connection()
    # cursor = conn.cursor()
    # cursor.execute("SELECT is_admin FROM users WHERE id = ?", (session['user_id'],))
    # user = cursor.fetchone()
    # conn.close()
    # 
    # # Исправленная проверка: sqlite3.Row не имеет метода get()
    # if user is None:
    #     return False
    # 
    # # Проверяем, есть ли колонка is_admin и равна ли она 1
    # try:
    #     return user['is_admin'] == 1
    # except (IndexError, KeyError):
    #     # Если колонка не существует или произошла ошибка
    #     return False

@admin_bp.before_request
def check_admin():
    """Check if user is admin for all admin API routes"""
    # Временно отключаем проверку для тестирования
    # ВНИМАНИЕ: В рабочем приложении верните проверку авторизации
    return None
    
    # Оригинальный код проверки:
    # if not is_admin() and request.path != '/api/admin/login':
    #     return jsonify({"success": False, "message": "Unauthorized"}), 403

@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get admin dashboard statistics"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get users count
    cursor.execute("SELECT COUNT(*) as count FROM users")
    users_count = cursor.fetchone()['count']
    
    # Get messages count
    cursor.execute("SELECT COUNT(*) as count FROM messages")
    messages_count = cursor.fetchone()['count']
    
    # Get chats count
    cursor.execute("SELECT COUNT(*) as count FROM chats")
    chats_count = cursor.fetchone()['count']
    
    # Get groups count
    cursor.execute("SELECT COUNT(*) as count FROM group_chats")
    groups_count = cursor.fetchone()['count']
    
    # Get active users (approximation: users who sent a message in the last 24h)
    cursor.execute("""
    SELECT COUNT(DISTINCT sender_id) as count 
    FROM messages 
    WHERE timestamp >= datetime('now', '-1 day')
    """)
    active_users = cursor.fetchone()['count']
    
    # Get messages today
    cursor.execute("""
    SELECT COUNT(*) as count 
    FROM messages 
    WHERE date(timestamp) = date('now')
    """)
    messages_today = cursor.fetchone()['count']
    
    # Get daily messages for the last 7 days
    daily_messages = []
    for i in range(7):
        day = datetime.now() - timedelta(days=i)
        cursor.execute("""
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE date(timestamp) = date(?)
        """, (day.strftime('%Y-%m-%d'),))
        count = cursor.fetchone()['count']
        daily_messages.append({
            "date": day.strftime('%Y-%m-%d'),
            "count": count
        })
    
    conn.close()
    
    stats = {
        "users_count": users_count,
        "messages_count": messages_count,
        "chats_count": chats_count,
        "groups_count": groups_count,
        "active_users": active_users,
        "messages_today": messages_today,
        "daily_messages": daily_messages
    }
    
    return jsonify({"success": True, "stats": stats})

@admin_bp.route('/users', methods=['GET'])
def get_users():
    """Get users with pagination and search"""
    page = int(request.args.get('page', 1))
    per_page = 10
    offset = (page - 1) * per_page
    search_query = request.args.get('q', '')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get total count
    if search_query:
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE nickname LIKE ?", (f'%{search_query}%',))
    else:
        cursor.execute("SELECT COUNT(*) as count FROM users")
    
    total = cursor.fetchone()['count']
    
    # Get users
    if search_query:
        cursor.execute("""
        SELECT u.id, u.nickname, u.created_at, 
               (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) as message_count,
               COALESCE(u.is_admin, 0) as is_admin,
               1 as is_active
        FROM users u
        WHERE u.nickname LIKE ?
        ORDER BY u.id DESC
        LIMIT ? OFFSET ?
        """, (f'%{search_query}%', per_page, offset))
    else:
        cursor.execute("""
        SELECT u.id, u.nickname, u.created_at, 
               (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) as message_count,
               COALESCE(u.is_admin, 0) as is_admin,
               1 as is_active
        FROM users u
        ORDER BY u.id DESC
        LIMIT ? OFFSET ?
        """, (per_page, offset))
    
    users = []
    for row in cursor.fetchall():
        user = dict(row)
        # Добавляем URL для фото пользователя
        user['photo_url'] = f"/api/admin/user-photo/{user['id']}"
        user['last_login_at'] = None
        user['email'] = f"{user['nickname']}@example.com"  # Placeholder
        users.append(user)
    
    conn.close()
    
    # Calculate pagination info
    pages = (total // per_page) + (1 if total % per_page > 0 else 0)
    
    pagination = {
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "total": total
    }
    
    return jsonify({"success": True, "users": users, "pagination": pagination})

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user information"""
    data = request.json
    nickname = data.get('nickname')
    is_active = data.get('is_active')
    is_admin = data.get('is_admin')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if nickname is unique if it's being updated
        if nickname:
            cursor.execute("SELECT id FROM users WHERE nickname = ? AND id != ?", (nickname, user_id))
            if cursor.fetchone():
                return jsonify({"success": False, "message": "Никнейм уже используется"})
        
        # Update user data
        cursor.execute("""
        UPDATE users
        SET nickname = COALESCE(?, nickname),
            is_admin = COALESCE(?, is_admin)
        WHERE id = ?
        """, (nickname, 1 if is_admin else 0, user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({"success": True, "message": "Пользователь успешно обновлен"})
    except sqlite3.Error as e:
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка базы данных: {str(e)}"})

@admin_bp.route('/messages', methods=['GET'])
def get_messages():
    """Get messages with pagination"""
    page = int(request.args.get('page', 1))
    per_page = 20
    offset = (page - 1) * per_page
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute("SELECT COUNT(*) as count FROM messages")
    total = cursor.fetchone()['count']
    
    # Get messages with sender and chat info
    cursor.execute("""
    SELECT m.id, m.content, m.timestamp as created_at, m.chat_id,
           u.id as sender_id, u.nickname as sender_nickname,
           c.chat_type, c.chat_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    JOIN chats c ON m.chat_id = c.id
    ORDER BY m.timestamp DESC
    LIMIT ? OFFSET ?
    """, (per_page, offset))
    
    messages = []
    for row in cursor.fetchall():
        chat_type = row['chat_type']
        chat_name = row['chat_name']
        chat_info = {"id": row['chat_id'], "type": chat_type}
        
        if chat_type == 'dialog':
            # For dialogs, get the other user's name
            cursor.execute("""
            SELECT u.nickname
            FROM dialogs d
            JOIN users u ON (d.user1_id = u.id OR d.user2_id = u.id)
            WHERE d.chat_id = ? AND u.id != ?
            LIMIT 1
            """, (row['chat_id'], row['sender_id']))
            
            recipient = cursor.fetchone()
            if recipient:
                chat_info["recipient"] = recipient['nickname']
            else:
                chat_info["recipient"] = "Неизвестный пользователь"
        else:
            # For groups, use the chat name
            chat_info["name"] = chat_name or "Без названия"
        
        messages.append({
            "id": row['id'],
            "content": row['content'],
            "created_at": row['created_at'],
            "sender": {
                "id": row['sender_id'],
                "nickname": row['sender_nickname']
            },
            "chat": chat_info
        })
    
    conn.close()
    
    # Calculate pagination info
    pages = (total // per_page) + (1 if total % per_page > 0 else 0)
    
    pagination = {
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "total": total
    }
    
    return jsonify({"success": True, "messages": messages, "pagination": pagination})

@admin_bp.route('/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    """Delete a message"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM messages WHERE id = ?", (message_id,))
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({"success": False, "message": "Сообщение не найдено"})
        
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Сообщение удалено"})
    except sqlite3.Error as e:
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка базы данных: {str(e)}"})

@admin_bp.route('/groups', methods=['GET'])
def get_groups():
    """Get groups with pagination and search"""
    page = int(request.args.get('page', 1))
    per_page = 10
    offset = (page - 1) * per_page
    search_query = request.args.get('q', '')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get total count
    if search_query:
        cursor.execute("""
        SELECT COUNT(*) as count 
        FROM group_chats gc
        JOIN chats c ON gc.chat_id = c.id
        WHERE c.chat_name LIKE ?
        """, (f'%{search_query}%',))
    else:
        cursor.execute("SELECT COUNT(*) as count FROM group_chats")
    
    total = cursor.fetchone()['count']
    
    # Get groups
    if search_query:
        cursor.execute("""
        SELECT gc.id, gc.chat_id, c.chat_name as name, gc.description, gc.profile_photo,
               u.nickname as admin_name, c.created_at,
               (SELECT COUNT(*) FROM group_members WHERE group_chat_id = gc.id) as member_count,
               (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
        FROM group_chats gc
        JOIN chats c ON gc.chat_id = c.id
        JOIN users u ON gc.admin_id = u.id
        WHERE c.chat_name LIKE ?
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """, (f'%{search_query}%', per_page, offset))
    else:
        cursor.execute("""
        SELECT gc.id, gc.chat_id, c.chat_name as name, gc.description, gc.profile_photo,
               u.nickname as admin_name, c.created_at,
               (SELECT COUNT(*) FROM group_members WHERE group_chat_id = gc.id) as member_count,
               (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
        FROM group_chats gc
        JOIN chats c ON gc.chat_id = c.id
        JOIN users u ON gc.admin_id = u.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """, (per_page, offset))
    
    groups = []
    for row in cursor.fetchall():
        group = dict(row)
        # Add photo URL if exists
        if group['profile_photo']:
            group['photo_url'] = f"/api/group/{group['id']}/photo"
        else:
            group['photo_url'] = None
        del group['profile_photo']
        groups.append(group)
    
    conn.close()
    
    # Calculate pagination info
    pages = (total // per_page) + (1 if total % per_page > 0 else 0)
    
    pagination = {
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "total": total
    }
    
    return jsonify({"success": True, "groups": groups, "pagination": pagination})

@admin_bp.route('/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a group"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Get chat_id for the group
        cursor.execute("SELECT chat_id FROM group_chats WHERE id = ?", (group_id,))
        group = cursor.fetchone()
        if not group:
            conn.close()
            return jsonify({"success": False, "message": "Группа не найдена"})
        
        chat_id = group['chat_id']
        
        # Delete all messages in the chat
        cursor.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
        
        # Delete all group members
        cursor.execute("DELETE FROM group_members WHERE group_chat_id = ?", (group_id,))
        
        # Delete the group_chat
        cursor.execute("DELETE FROM group_chats WHERE id = ?", (group_id,))
        
        # Delete the chat
        cursor.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Группа удалена"})
    except sqlite3.Error as e:
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка базы данных: {str(e)}"})

@admin_bp.route('/user-photo/<int:user_id>', methods=['GET'])
def get_user_photo(user_id):
    """Get user profile photo by ID for admin panel"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT profile_photo FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if user and user['profile_photo']:
        return send_file(
            BytesIO(user['profile_photo']),
            mimetype='image/jpeg'
        )
    
    # Если фото не найдено, возвращаем стандартное изображение
    return redirect('/static/images/default-profile.png')
