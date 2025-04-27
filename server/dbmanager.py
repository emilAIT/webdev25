import sqlite3

DB_NAME = "chat.db"

def connect_db():
    return sqlite3.connect(DB_NAME)#,timeout=10,check_same_thread=False)

def init_db():
    conn = connect_db()
    cursor = conn.cursor()

    # Users
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )
    ''')

    # Friends
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS friends (
        user_id INTEGER,
        friend_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(friend_id) REFERENCES users(id)
    )
    ''')

    # Groups
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        creator_id INTEGER,
        FOREIGN KEY(creator_id) REFERENCES users(id)
    )
    ''')

    # Group members
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER,
        user_id INTEGER,
        FOREIGN KEY(group_id) REFERENCES groups(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')

    # Communities
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS communities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        creator_id INTEGER,
        FOREIGN KEY(creator_id) REFERENCES users(id)
    )
    ''')

    # Community groups
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS community_groups (
        community_id INTEGER,
        group_id INTEGER,
        FOREIGN KEY(community_id) REFERENCES communities(id),
        FOREIGN KEY(group_id) REFERENCES groups(id)
    )
    ''')

    # Messages
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        group_id INTEGER,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'unread',
        FOREIGN KEY(sender_id) REFERENCES users(id),
        FOREIGN KEY(receiver_id) REFERENCES users(id),
        FOREIGN KEY(group_id) REFERENCES groups(id)
    )
    ''')

    # Read status
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS message_reads (
    user_id INTEGER,
    message_id INTEGER,
    PRIMARY KEY (user_id, message_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);
    ''')


    conn.commit()
    conn.close()
