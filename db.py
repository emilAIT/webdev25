import sqlite3

def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = [row['name'] for row in cur.fetchall()]

    if 'users' not in existing_tables:
        cur.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                bio TEXT,
                status TEXT,
                action TEXT DEFAULT 'active',
                theme TEXT DEFAULT 'blue'
            )
        """)
    else:
        # Migration for existing database
        cur.execute("PRAGMA table_info(users)")
        columns = [row['name'] for row in cur.fetchall()]
        if 'bio' not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN bio TEXT")
        if 'first_name' not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN first_name TEXT")
        if 'last_name' not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN last_name TEXT")
        if 'status' not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN status TEXT")
        if 'action' not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN action TEXT DEFAULT 'active'")
        if 'theme' not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'blue'")

    if 'contacts' not in existing_tables:
        cur.execute("""
            CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                contact_id INTEGER NOT NULL,
                contact_name TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (contact_id) REFERENCES users (id)
            )
        """)
    
    if 'messages' not in existing_tables:
        cur.execute("""
            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users (id),
                FOREIGN KEY (receiver_id) REFERENCES users (id)
            )
        """)

    if 'groups' not in existing_tables:
        cur.execute("""
            CREATE TABLE groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                creator_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users (id)
            )
        """)

    if 'group_members' not in existing_tables:
        cur.execute("""
            CREATE TABLE group_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (group_id) REFERENCES groups (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
    
    if 'settings' not in existing_tables:
        cur.execute("""
            CREATE TABLE settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL
            )
        """)
        default_settings = [
            ('message_encryption', 'false'),
            ('max_message_length', '500'),
            ('theme', 'blue')
        ]
        cur.executemany('INSERT INTO settings (key, value) VALUES (?, ?)', default_settings)
    
    conn.commit()
    conn.close()