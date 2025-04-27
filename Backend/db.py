import sqlite3

def connect_db():
    conn = sqlite3.connect('chat.db')
    return conn

def create_tables():
    db = connect_db()
    cursor = db.cursor()
    cursor.execute('''
                   CREATE TABLE IF NOT EXISTS direct_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    photo TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
    );
    ''')

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            email TEXT NOT NULL,
            security_question TEXT NOT NULL,
            secret_word TEXT NOT NULL,
            name TEXT,
            profile_picture TEXT,
            info TEXT
        );
    ''')
    
    # Check if info column exists, add it if not
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    column_names = [column[1] for column in columns]
    
    if 'info' not in column_names:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN info TEXT")
            print("Added 'info' column to users table")
        except sqlite3.OperationalError:
            print("'info' column already exists")
    
    # Messages table - add status, is_edited, and timestamp fields
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            time DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'sent',
            is_edited INTEGER DEFAULT 0,
            delivered_at DATETIME,
            read_at DATETIME,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ''')
    
    # Groups table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_name TEXT NOT NULL,
            admin_id INTEGER NOT NULL,
            group_picture TEXT,
            description TEXT
        );
    ''')

    # Check if description column exists in groups table, add it if not
    cursor.execute("PRAGMA table_info(groups)")
    columns = cursor.fetchall()
    column_names = [column[1] for column in columns]
    
    if 'description' not in column_names:
        try:
            cursor.execute("ALTER TABLE groups ADD COLUMN description TEXT")
            print("Added 'description' column to groups table")
        except sqlite3.OperationalError:
            print("'description' column already exists")

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS group_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
    ''')

    # Group messages table - add is_edited flag
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS group_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            time TEXT NOT NULL,
            is_edited INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
    ''')
    
    # Group message status table - for tracking read/delivered status for each member
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS group_message_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'sent',
            delivered_at TEXT,
            read_at TEXT,
            UNIQUE (message_id, user_id),
            FOREIGN KEY (message_id) REFERENCES group_messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ''')
    
    # Banned users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS banned (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL
        );
    ''')
    
    # Contacts table
    cursor.execute('''
       CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    display_name TEXT,
    UNIQUE (user_id, contact_id),  -- Prevent duplicate contacts
    CHECK (user_id <> contact_id), -- Prevent self-contact
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE
);
    ''')
    
    # Group photos table (fixed missing closing parenthesis)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS group_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            photo TEXT NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
    ''')

    # Profile photos table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS profile_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            photo TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ''')

    # Group sended photos table (fixed missing closing parenthesis)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS group_sended_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            photo TEXT NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
    ''')

    # Real names table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS real_names (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL
        );
    ''')

    # Complaints table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id INTEGER NOT NULL,
            reported_user_id INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (reporter_id, reported_user_id),  -- Prevent duplicate reports
            FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ''')

    db.commit()
    db.close()
