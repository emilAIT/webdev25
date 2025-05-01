import sqlite3
from sqlite3 import Row
import os

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def column_exists(conn, table, column):
    """Check if a column exists in a table"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    return any(col['name'] == column for col in columns)

def init_db():
    """Initialize database with required tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        profile_photo BLOB DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create chats table (основная таблица для всех типов чатов)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_name TEXT,
        chat_type TEXT NOT NULL,  -- 'dialog' или 'group'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create dialogs table (для личных чатов между двумя пользователями)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS dialogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (user1_id) REFERENCES users (id),
        FOREIGN KEY (user2_id) REFERENCES users (id),
        UNIQUE(user1_id, user2_id)
    )
    ''')
    
    # Create group_chats table (для групповых чатов)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        admin_id INTEGER NOT NULL,
        description TEXT,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES users (id)
    )
    ''')
    
    # Add profile_photo column if it doesn't exist
    if not column_exists(conn, 'group_chats', 'profile_photo'):
        try:
            cursor.execute('ALTER TABLE group_chats ADD COLUMN profile_photo BLOB DEFAULT NULL')
            print("Added profile_photo column to group_chats table")
        except sqlite3.Error as e:
            print(f"Error adding profile_photo column: {e}")
    
    # Create group_members table (участники групповых чатов)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_chat_id) REFERENCES group_chats (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(group_chat_id, user_id)
    )
    ''')
    
    # Add role column if it doesn't exist
    if not column_exists(conn, 'group_members', 'role'):
        try:
            cursor.execute('ALTER TABLE group_members ADD COLUMN role TEXT DEFAULT "member"')
            print("Added role column to group_members table")
        except sqlite3.Error as e:
            print(f"Error adding role column: {e}")
    
    # Create messages table (для всех типов чатов)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT 0,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users (id)
    )
    ''')
    
    conn.commit()
    conn.close()
