from datetime import datetime, timedelta
from app.db.database import get_db_connection
from app.db.user_crud import get_user_by_id, get_user_photo

def get_chat(chat_id, user_id):
    """Get a chat by ID and verify user is part of it"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM chats WHERE id = ? AND (user1_id = ? OR user2_id = ?)", 
        (chat_id, user_id, user_id)
    )
    chat = cursor.fetchone()
    conn.close()
    return chat

def get_user_chats(user_id):
    """Get all chats for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Find all chats where the user is either user1 or user2
    cursor.execute("""
        SELECT c.id, 
               CASE 
                   WHEN c.user1_id = ? THEN u2.nickname 
                   ELSE u1.nickname 
               END as other_user_name,
               CASE 
                   WHEN c.user1_id = ? THEN u2.id
                   ELSE u1.id
               END as other_user_id,
               CASE 
                   WHEN c.user1_id = ? THEN u2.profile_photo
                   ELSE u1.profile_photo
               END as other_user_photo,
               m.content as latest_message,
               m.sender_id,
               m.timestamp,
               (SELECT COUNT(*) FROM messages 
                WHERE chat_id = c.id AND sender_id != ? AND is_read = 0) as unread_count
        FROM chats c
        JOIN users u1 ON c.user1_id = u1.id
        JOIN users u2 ON c.user2_id = u2.id
        LEFT JOIN (
            SELECT m1.* 
            FROM messages m1
            JOIN (
                SELECT chat_id, MAX(timestamp) as max_timestamp 
                FROM messages 
                GROUP BY chat_id
            ) m2 ON m1.chat_id = m2.chat_id AND m1.timestamp = m2.max_timestamp
        ) m ON c.id = m.chat_id
        WHERE c.user1_id = ? OR c.user2_id = ?
        ORDER BY m.timestamp DESC
    """, (user_id, user_id, user_id, user_id, user_id, user_id))
    
    chats = cursor.fetchall()
    conn.close()
    
    result = []
    for chat in chats:
        sender = get_user_by_id(chat['sender_id']) if chat['sender_id'] else None
        sender_name = sender['nickname'] if sender else ""
        latest_message = f"{sender_name}: {chat['latest_message']}" if chat['latest_message'] else "No messages yet"
        
        # Обрабатываем фото профиля - напрямую из результата запроса
        user_photo = chat['other_user_photo']
        
        # Если фото None, пустая строка или "None" - устанавливаем None
        if user_photo in [None, "", "None"]:
            # Попробуем получить фото через функцию
            other_user_id = chat['other_user_id']
            user_photo = get_user_photo(other_user_id)
        
        # Format timestamp to readable format
        timestamp = "Just now"
        if chat['timestamp']:
            # Apply UTC+6 timezone to the timestamp
            dt = datetime.strptime(chat['timestamp'], '%Y-%m-%d %H:%M:%S') + timedelta(hours=6)
            now = datetime.now()
            diff = now - dt
            
            if diff.days > 0:
                timestamp = f"{diff.days}d"
            elif diff.seconds >= 3600:
                hours = diff.seconds // 3600
                timestamp = f"{hours}h"
            elif diff.seconds >= 60:
                minutes = diff.seconds // 60
                timestamp = f"{minutes}m"
            else:
                timestamp = "Just now"
        
        result.append({
            "id": chat['id'],
            "user_name": chat['other_user_name'],
            "user_photo": user_photo,
            "latest_message": latest_message,
            "timestamp": timestamp,
            "unread": chat['unread_count'] > 0
        })
    
    return result

def get_chat_messages(chat_id, user_id):
    """Get messages for a specific chat"""
    # Verify user is part of the chat
    chat = get_chat(chat_id, user_id)
    if not chat:
        return None
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get messages and mark them as read
    cursor.execute("""
        SELECT m.id, m.sender_id, u.nickname as sender_name, m.content, m.timestamp 
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.timestamp ASC
    """, (chat_id,))
    
    messages = cursor.fetchall()
    
    # Mark messages as read if they were sent by the other user
    cursor.execute(
        "UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_id != ? AND is_read = 0",
        (chat_id, user_id)
    )
    conn.commit()
    conn.close()
    
    return [
        {
            "id": msg['id'],
            "sender_id": msg['sender_id'],
            "sender_name": msg['sender_name'],
            "content": msg['content'],
            "timestamp": (datetime.strptime(msg['timestamp'], '%Y-%m-%d %H:%M:%S') + 
                        timedelta(hours=6)).strftime("%H:%M"),
            "is_sent_by_me": msg['sender_id'] == user_id
        }
        for msg in messages
    ]

def create_chat(user1_id, user2_id):
    """Create a new chat between two users or return existing one"""
    # Check if a chat already exists between these users
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check both possible orders of users to find existing chat
    cursor.execute(
        "SELECT id FROM chats WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        (user1_id, user2_id, user2_id, user1_id)
    )
    existing_chat = cursor.fetchone()
    
    if existing_chat:
        # Chat already exists, return its details
        chat_id = existing_chat['id']
        conn.close()
        
        # Get chat details in the format needed for the frontend
        chat_details = get_user_chats(user1_id)
        for chat in chat_details:
            if chat['id'] == chat_id:
                return chat
        return None
    
    # No existing chat, create a new one
    cursor.execute(
        "INSERT INTO chats (user1_id, user2_id) VALUES (?, ?)",
        (user1_id, user2_id)
    )
    chat_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Get the other user details
    other_user = get_user_by_id(user2_id)
    user_photo = None
    if other_user and 'profile_photo' in other_user:
        user_photo = other_user['profile_photo']
        if user_photo in [None, "", "None"]:
            user_photo = None
    
    # Return the new chat in the format needed by frontend
    return {
        "id": chat_id,
        "user_name": other_user['nickname'],
        "user_photo": user_photo,
        "latest_message": "No messages yet",
        "timestamp": "Just now",
        "unread": False
    }

def create_message(chat_id, user_id, content):
    """Create a new message in a chat"""
    # Verify user is part of the chat
    chat = get_chat(chat_id, user_id)
    if not chat:
        return None
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)",
        (chat_id, user_id, content)
    )
    message_id = cursor.lastrowid
    conn.commit()
    
    # Get the created message
    cursor.execute(
        "SELECT m.id, m.sender_id, u.nickname as sender_name, m.content, m.timestamp FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?",
        (message_id,)
    )
    message = cursor.fetchone()
    conn.close()
    
    return {
        "id": message['id'],
        "sender_id": message['sender_id'],
        "sender_name": message['sender_name'],
        "content": message['content'],
        "timestamp": (datetime.strptime(message['timestamp'], '%Y-%m-%d %H:%M:%S') + 
                    timedelta(hours=6)).strftime("%H:%M"),
        "is_sent_by_me": True
    }
