from app.db.database import get_db_connection


def create_message(chat_id: int, user_id: int, content: str, message_type: str = 'text') -> dict:
    """Create a new message in the database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """
            INSERT INTO messages (chat_id, sender_id, content, message_type, timestamp)
            VALUES (?, ?, ?, ?, datetime('now'))
            """,
            (chat_id, user_id, content, message_type)
        )
        conn.commit()
        
        # Get the created message
        cursor.execute(
            """
            SELECT m.*, u.nickname as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
            """,
            (cursor.lastrowid,)
        )
        message = cursor.fetchone()
        
        return dict(message) if message else None
    finally:
        conn.close()

def get_messages(chat_id: int, limit: int = 50, offset: int = 0) -> list:
    """Get messages for a chat"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """
            SELECT m.*, u.nickname as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.timestamp DESC
            LIMIT ? OFFSET ?
            """,
            (chat_id, limit, offset)
        )
        messages = cursor.fetchall()
        
        return [dict(message) for message in messages]
    finally:
        conn.close() 