import sqlite3
from typing import List
from passlib.context import CryptContext

DATABASE = 'chat.db'

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Create tables if they don't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE,
            avatar TEXT DEFAULT '/static/images/avatar.png'
        )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        is_group BOOLEAN DEFAULT FALSE,
        creator_id INTEGER,
        avatar TEXT DEFAULT '/static/images/group.png',
        FOREIGN KEY (creator_id) REFERENCES users(id)
    )
''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_members (
        chat_id INTEGER,
        user_id INTEGER,
        PRIMARY KEY (chat_id, user_id),
        FOREIGN KEY (chat_id) REFERENCES chats(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
)
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            status INTEGER DEFAULT 0,
            FOREIGN KEY (chat_id) REFERENCES chats(id),
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            user_id INTEGER,
            contact_id INTEGER,
            PRIMARY KEY (user_id, contact_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (contact_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Check if migration is needed
    cursor.execute("PRAGMA table_info(messages)")
    columns = [col[1] for col in cursor.fetchall()]
    
        # Seed default users: admin и q с паролем "1"
    default_users = [("Daniyar", "1", "w@gmail.com"), ("Alymbek", "1", "q@gmail.com"), ("Almaz", "1", "a@gmail.com")]
    for username, raw_pwd, email in default_users:
        hashed = pwd_context.hash(raw_pwd)
        cursor.execute(
            "INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)",
            (username, hashed, email)
        )

    conn.commit()
    conn.close()

def migrate_messages_table():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        # Add receiver_id column if it doesn't exist
        cursor.execute('''
            ALTER TABLE messages ADD COLUMN receiver_id INTEGER
        ''')
        # Populate receiver_id for existing messages
        cursor.execute('''
            UPDATE messages
            SET receiver_id = (
                SELECT user_id
                FROM chat_members
                WHERE chat_id = messages.chat_id AND user_id != messages.user_id
            )
            WHERE EXISTS (
                SELECT 1
                FROM chat_members
                WHERE chat_id = messages.chat_id AND user_id != messages.user_id
            )
        ''')
        # Rename user_id to sender_id
        cursor.execute('''
            ALTER TABLE messages RENAME COLUMN user_id TO sender_id
        ''')
        conn.commit()
    except sqlite3.Error as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        conn.close()

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def create_user(username, password, email, avatar='/static/images/avatar.png'):
    conn = get_db()
    hashed_password = pwd_context.hash(password)
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password, email, avatar) VALUES (?, ?, ?, ?)", 
                      (username, hashed_password, email, avatar))
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "username": username, "email": email, "avatar": avatar}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def get_user(field_name, value):
    """
    Get a user by any field (username or email).
    
    Args:
        field_name: The field to search by ('username' or 'email')
        value: The value to search for
    
    Returns:
        A dictionary with user data if found, None otherwise
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE {field_name} = ?", (value,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_or_create_chat(chat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM chats WHERE id = ?", (chat_id,))
    chat = cursor.fetchone()
    conn.close()
    if chat:
        return chat['id']
    raise ValueError(f"Chat with ID {chat_id} does not exist")

def create_message(chat_id, sender_id, content):
    conn = get_db()
    cursor = conn.cursor()
    
    # Determine receiver_id for one-on-one chats
    cursor.execute('''
        SELECT user_id
        FROM chat_members
        WHERE chat_id = ? AND user_id != ?
    ''', (chat_id, sender_id))
    receiver = cursor.fetchone()
    receiver_id = receiver['user_id'] if receiver else None  # Null for group chats
    
    cursor.execute('''
        INSERT INTO messages (chat_id, sender_id, receiver_id, content, status)
        VALUES (?, ?, ?, ?, 0)
    ''', (chat_id, sender_id, receiver_id, content))
    conn.commit()
    message_id = cursor.lastrowid
    conn.close()
    return message_id

def get_messages(chat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT m.id, m.sender_id, m.receiver_id, m.content, m.timestamp, m.status, u.username as sender_username, u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.timestamp ASC
    ''', (chat_id,))
    messages = cursor.fetchall()
    conn.close()
    return [dict(msg) for msg in messages]

# Новый метод для обновления статуса сообщения

def mark_message_as_read(message_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE messages SET status = 1 WHERE id = ?', (message_id,))
    conn.commit()
    conn.close()

def get_all_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users")
    users = cursor.fetchall()
    conn.close()
    return [dict(user) for user in users]

def get_or_create_one_on_one_chat(user_id1, user_id2):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Check if a one-on-one chat exists between these two users
        cursor.execute('''
            SELECT c.id
            FROM chats c
            JOIN chat_members cm1 ON c.id = cm1.chat_id
            JOIN chat_members cm2 ON c.id = cm2.chat_id
            WHERE c.is_group = FALSE
            AND cm1.user_id = ? AND cm2.user_id = ?
            AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
        ''', (user_id1, user_id2))
        
        chat = cursor.fetchone()
        if chat:
            return chat['id']
        
        # Create a new chat
        cursor.execute("INSERT INTO chats (name, is_group) VALUES (?, FALSE)", (f"Chat_{user_id1}_{user_id2}",))
        chat_id = cursor.lastrowid
        
        # Add both users to the chat
        cursor.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)", (chat_id, user_id1))
        cursor.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)", (chat_id, user_id2))
        
        conn.commit()
        return chat_id
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        raise sqlite3.Error(f"Failed to create or retrieve chat: {e}")
    finally:
        conn.close()

def add_contact(user_id, contact_id):
    if user_id == contact_id:
        return False

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE id = ?", (contact_id,))
        if not cursor.fetchone():
            return False

        cursor.execute(
            "SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id)
        )
        if cursor.fetchone():
            return False

        cursor.execute(
            "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
            (user_id, contact_id)
        )
        cursor.execute(
            "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
            (contact_id, user_id)
        )

        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    finally:
        conn.close()
        
def create_group_chat(creator_id: int, group_name: str) -> int:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO chats (name, is_group, creator_id) VALUES (?, TRUE, ?)",
            (group_name, creator_id)
        )
        group_id = cursor.lastrowid
        # Добавляем создателя в группу как участника
        cursor.execute(
            "INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)",
            (group_id, creator_id)
        )
        conn.commit()
        return group_id
    except sqlite3.Error as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def add_group_members(group_id: int, user_ids: List[int]):
    conn = get_db()
    cursor = conn.cursor()
    try:
        for user_id in user_ids:
            cursor.execute(
                "INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)",
                (group_id, user_id)
            )
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_contacts(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.username,u.avatar
        FROM users u
        JOIN contacts c ON u.id = c.contact_id
        WHERE c.user_id = ?
    ''', (user_id,))
    contacts = cursor.fetchall()
    conn.close()
    return [dict(contact) for contact in contacts]

def search_users(query, current_user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username
        FROM users
        WHERE username LIKE ? AND id != ?
    ''', (f"%{query}%", current_user_id))
    users = cursor.fetchall()
    conn.close()
    return [dict(user) for user in users]
