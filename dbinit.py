import sqlite3
from sqlite3 import Row
import bcrypt
import os

def get_db_connection():
    """Create and return a database connection"""
    db_path = 'database.db'
    print(f"Connecting to database at: {os.path.abspath(db_path)}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def force_create_tables():
    """Create all necessary tables forcefully"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("Creating tables...")
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password TEXT NOT NULL,
        profile_photo BLOB DEFAULT NULL,
        is_verified BOOLEAN DEFAULT 0,
        verification_code TEXT,
        verification_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create chats table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_name TEXT,
        chat_type TEXT NOT NULL,  -- 'dialog' или 'group'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create dialogs table
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
    
    # Create group_chats table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        creator_id INTEGER NOT NULL,
        description TEXT,
        group_photo BLOB DEFAULT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (creator_id) REFERENCES users (id)
    )
    ''')
    
    # Create group_members table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        invited_by INTEGER,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_chat_id) REFERENCES group_chats (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (invited_by) REFERENCES users (id),
        UNIQUE(group_chat_id, user_id)
    )
    ''')
    
    # Create group_admins table (для поддержки нескольких администраторов)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        admin_level INTEGER DEFAULT 1, -- 1: обычный админ, 2: суперадмин/создатель
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_chat_id) REFERENCES group_chats (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(group_chat_id, user_id)
    )
    ''')
    
    # Create messages table with media support
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        media_content BLOB DEFAULT NULL,
        media_type TEXT DEFAULT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_edited BOOLEAN DEFAULT 0,
        edited_at TIMESTAMP DEFAULT NULL,
        reply_to INTEGER DEFAULT NULL,
        forwarded_from INTEGER DEFAULT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users (id),
        FOREIGN KEY (reply_to) REFERENCES messages(id),
        FOREIGN KEY (forwarded_from) REFERENCES messages(id)
    )
    ''')
    
    # Create message_reads table for tracking who read messages
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS message_reads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(message_id, user_id)
    )
    ''')
    
    conn.commit()
    conn.close()
    print("Tables created successfully")

def check_and_update_schema():
    """Check if the database schema needs updates and apply them"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if users table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if not cursor.fetchone():
        conn.close()
        print("Users table doesn't exist, forcing table creation...")
        force_create_tables()
        return
    
    # Check existing tables
    existing_tables = [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    
    # Check existing columns in messages table
    if 'messages' in existing_tables:
        cursor.execute("PRAGMA table_info(messages)")
        msg_columns = {col[1] for col in cursor.fetchall()}
        
        # Add missing columns to messages table
        needed_columns = {
            'media_content': 'BLOB DEFAULT NULL', 
            'media_type': 'TEXT DEFAULT NULL',
            'is_edited': 'BOOLEAN DEFAULT 0',
            'edited_at': 'TIMESTAMP DEFAULT NULL',
            'reply_to': 'INTEGER DEFAULT NULL',
            'forwarded_from': 'INTEGER DEFAULT NULL'
        }
        
        for col_name, col_type in needed_columns.items():
            if col_name not in msg_columns:
                print(f"Adding {col_name} column to messages table...")
                cursor.execute(f"ALTER TABLE messages ADD COLUMN {col_name} {col_type}")
    
    # Check group_chats table
    if 'group_chats' in existing_tables:
        cursor.execute("PRAGMA table_info(group_chats)")
        group_columns = {col[1] for col in cursor.fetchall()}
        
        if 'group_photo' not in group_columns:
            print("Adding group_photo column to group_chats table...")
            cursor.execute("ALTER TABLE group_chats ADD COLUMN group_photo BLOB DEFAULT NULL")
        
        # Проверяем переименование admin_id на creator_id
        if 'admin_id' in group_columns and 'creator_id' not in group_columns:
            print("Updating admin_id to creator_id in group_chats...")
            # SQLite не поддерживает переименование столбцов напрямую, 
            # поэтому создаем временную таблицу и копируем данные
            cursor.execute('''
                CREATE TABLE group_chats_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id INTEGER NOT NULL,
                    creator_id INTEGER NOT NULL,
                    description TEXT,
                    group_photo BLOB DEFAULT NULL,
                    FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
                    FOREIGN KEY (creator_id) REFERENCES users (id)
                )
            ''')
            cursor.execute('''
                INSERT INTO group_chats_new (id, chat_id, creator_id, description)
                SELECT id, chat_id, admin_id, description FROM group_chats
            ''')
            cursor.execute("DROP TABLE group_chats")
            cursor.execute("ALTER TABLE group_chats_new RENAME TO group_chats")
    
    # Check group_members table
    if 'group_members' in existing_tables:
        cursor.execute("PRAGMA table_info(group_members)")
        member_columns = {col[1] for col in cursor.fetchall()}
        
        if 'status' not in member_columns:
            print("Adding status column to group_members table...")
            cursor.execute("ALTER TABLE group_members ADD COLUMN status TEXT DEFAULT 'active'")
        
        if 'invited_by' not in member_columns:
            print("Adding invited_by column to group_members table...")
            cursor.execute("ALTER TABLE group_members ADD COLUMN invited_by INTEGER DEFAULT NULL")
    
    # Create new tables if they don't exist
    new_tables = {
        'group_admins': '''
            CREATE TABLE IF NOT EXISTS group_admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                admin_level INTEGER DEFAULT 1,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_chat_id) REFERENCES group_chats (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(group_chat_id, user_id)
            )
        ''',
        'message_reads': '''
            CREATE TABLE IF NOT EXISTS message_reads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(message_id, user_id)
            )
        '''
    }
    
    for table_name, create_sql in new_tables.items():
        if table_name not in existing_tables:
            print(f"Creating {table_name} table...")
            cursor.execute(create_sql)
    
    # Check users table columns
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Add missing columns
    if 'email' not in columns:
        print("Adding email column...")
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT UNIQUE")
    
    if 'is_verified' not in columns:
        print("Adding is_verified column...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0")
    
    if 'verification_code' not in columns:
        print("Adding verification_code column...")
        cursor.execute("ALTER TABLE users ADD COLUMN verification_code TEXT")
    
    if 'verification_expiry' not in columns:
        print("Adding verification_expiry column...")
        cursor.execute("ALTER TABLE users ADD COLUMN verification_expiry TIMESTAMP")
    
    conn.commit()
    conn.close()

def init_db():
    """Initialize database with required tables"""
    # Check if database file exists
    db_exists = os.path.exists('database.db')
    
    # If you want to reset the database, uncomment these lines
    if os.environ.get('RESET_DB', '').lower() == 'true':
        if db_exists:
            os.remove('database.db')
            print("Database reset: database.db removed")
            db_exists = False
    
    if not db_exists:
        print("Database file does not exist, creating new database...")
        force_create_tables()
    else:
        print("Database file already exists")
        check_and_update_schema()

# Directly initialize DB when this module is imported
init_db()

if __name__ == "__main__":
    print("Running explicit database initialization...")
    init_db()
    print("Database initialized successfully.")
