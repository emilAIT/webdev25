-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT,
    profile_picture TEXT,
    info TEXT,
    security_question TEXT NOT NULL,
    secret_word TEXT NOT NULL,
    registration_date TEXT
); 