from app.db.database import get_db_connection
from datetime import datetime

def create_group(name, admin_id, member_ids):
    """
    Create a new group chat
    
    Args:
        name: The name of the group
        admin_id: The user ID of the group admin/creator
        member_ids: List of user IDs to add to the group (should include the admin)
    
    Returns:
        The newly created group chat data
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Add the admin to member_ids if not already included
    if admin_id not in member_ids:
        member_ids.append(admin_id)
    
    try:
        # Create the group
        cursor.execute(
            "INSERT INTO group_chats (name, admin_id, created_at) VALUES (?, ?, ?)",
            (name, admin_id, datetime.now().isoformat())
        )
        group_id = cursor.lastrowid
        
        # Add all members to the group
        for member_id in member_ids:
            cursor.execute(
                "INSERT INTO group_members (group_id, user_id, added_at) VALUES (?, ?, ?)",
                (group_id, member_id, datetime.now().isoformat())
            )
        
        # Create initial system message
        cursor.execute(
            "INSERT INTO group_messages (group_id, sender_id, content, timestamp) VALUES (?, ?, ?, ?)",
            (group_id, admin_id, "Group created", datetime.now().isoformat())
        )
        
        conn.commit()
        
        # Get group details to return
        group = get_group_by_id(group_id)
        return group
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_group_by_id(group_id):
    """Get a group by its ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT g.id, g.name, g.admin_id, g.created_at,
               (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
               (SELECT content FROM group_messages WHERE group_id = g.id ORDER BY timestamp DESC LIMIT 1) as latest_message
        FROM group_chats g
        WHERE g.id = ?
        """,
        (group_id,)
    )
    group = cursor.fetchone()
    conn.close()
    
    if group:
        return dict(group)
    return None

def get_user_groups(user_id):
    """Get all groups for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT g.id, g.name, g.admin_id, g.created_at,
               (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
               (SELECT content FROM group_messages WHERE group_id = g.id ORDER BY timestamp DESC LIMIT 1) as latest_message,
               (SELECT timestamp FROM group_messages WHERE group_id = g.id ORDER BY timestamp DESC LIMIT 1) as timestamp
        FROM group_chats g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
        ORDER BY timestamp DESC
        """,
        (user_id,)
    )
    groups = [dict(group) for group in cursor.fetchall()]
    conn.close()
    
    # Format groups for frontend display
    formatted_groups = []
    for group in groups:
        formatted_groups.append({
            "id": group["id"],
            "user_name": group["name"],  # Use name as user_name for frontend compatibility
            "user_photo": "",  # No photo for group chats
            "latest_message": group["latest_message"] or "No messages yet",
            "timestamp": group["timestamp"] or group["created_at"],
            "is_group": True,  # Explicitly mark as group chat
            "member_count": group["member_count"],
            "unread": False  # Default to no unread messages for now
        })
    
    return formatted_groups

def add_group_message(group_id, user_id, content):
    """Add a message to a group chat"""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    try:
        # Check if user is a member of the group
        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, user_id)
        )
        is_member = cursor.fetchone()
        
        if not is_member:
            raise ValueError("User is not a member of this group")
        
        # Add message
        cursor.execute(
            "INSERT INTO group_messages (group_id, sender_id, content, timestamp) VALUES (?, ?, ?, ?)",
            (group_id, user_id, content, now)
        )
        
        message_id = cursor.lastrowid
        
        # Get sender info
        cursor.execute("SELECT nickname FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        sender_name = user["nickname"] if user else "Unknown User"
        
        conn.commit()
        
        return {
            "id": message_id,
            "group_id": group_id,
            "sender_id": user_id,
            "sender_name": sender_name,
            "content": content,
            "timestamp": now
        }
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_group_messages(group_id, user_id):
    """Get all messages for a group"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user is a member of the group
    cursor.execute(
        "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
        (group_id, user_id)
    )
    is_member = cursor.fetchone()
    
    if not is_member:
        conn.close()
        raise ValueError("User is not a member of this group")
    
    cursor.execute(
        """
        SELECT gm.id, gm.group_id, gm.sender_id, u.nickname as sender_name, 
               u.profile_photo as sender_photo, gm.content, gm.timestamp
        FROM group_messages gm
        JOIN users u ON gm.sender_id = u.id
        WHERE gm.group_id = ?
        ORDER BY gm.timestamp ASC
        """,
        (group_id,)
    )
    
    messages = []
    for message in cursor.fetchall():
        msg_dict = dict(message)
        msg_dict["is_sent_by_me"] = message["sender_id"] == user_id
        messages.append(msg_dict)
    
    conn.close()
    return messages

def get_group_members(group_id):
    """Get all members of a group"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT u.id, u.nickname as name, u.email, u.profile_photo
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ?
        """,
        (group_id,)
    )
    members = [dict(member) for member in cursor.fetchall()]
    conn.close()
    return members
