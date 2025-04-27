import sqlite3
from datetime import datetime

DB_PATH = "./talkflowchat.db"


# Function to add created_at to users table
def add_created_at_column(cursor):
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    column_names = [column[1] for column in columns]

    if "created_at" not in column_names:
        cursor.execute("ALTER TABLE users ADD COLUMN created_at TEXT")
        current_time = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE users SET created_at = ? WHERE created_at IS NULL", (current_time,)
        )
        print("Added created_at column to users table and updated existing rows.")
    else:
        print("created_at column already exists in users table.")


# Function to add last_read_timestamp to conversation_participants table
def add_last_read_timestamp_column(cursor):
    cursor.execute("PRAGMA table_info(conversation_participants)")
    columns = cursor.fetchall()
    column_names = [column[1] for column in columns]

    if "last_read_timestamp" not in column_names:
        cursor.execute(
            "ALTER TABLE conversation_participants ADD COLUMN last_read_timestamp TEXT"
        )
        print("Added last_read_timestamp column to conversation_participants table.")
    else:
        print(
            "last_read_timestamp column already exists in conversation_participants table."
        )


# Function to add read_at to messages table
def add_read_at_column(cursor):
    cursor.execute("PRAGMA table_info(messages)")
    columns = cursor.fetchall()
    column_names = [column[1] for column in columns]

    if "read_at" not in column_names:
        cursor.execute("ALTER TABLE messages ADD COLUMN read_at TEXT")
        print("Added read_at column to messages table.")
    else:
        print("read_at column already exists in messages table.")


def run_migrations():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        print("Running migrations...")
        add_created_at_column(cursor)
        add_last_read_timestamp_column(cursor)
        add_read_at_column(cursor)  # Add the new migration step

        conn.commit()
        print("Migrations completed successfully.")

    except sqlite3.Error as e:
        print(f"Database error during migration: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"An unexpected error occurred during migration: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")


if __name__ == "__main__":
    run_migrations()
