import sqlite3
from datetime import datetime


# Create a simple migration script to add the created_at column
def add_created_at_column():
    # Connect to the SQLite database
    conn = sqlite3.connect("./talkflowchat.db")
    cursor = conn.cursor()

    try:
        # Check if the column already exists
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        column_names = [column[1] for column in columns]

        if "created_at" not in column_names:
            # SQLite doesn't allow adding columns with non-constant defaults
            # So we'll add the column without a default, then update existing rows
            cursor.execute("ALTER TABLE users ADD COLUMN created_at TEXT")

            # Update existing rows with the current timestamp
            current_time = datetime.utcnow().isoformat()
            cursor.execute("UPDATE users SET created_at = ?", (current_time,))

            print("Added created_at column to users table and updated existing rows")
        else:
            print("created_at column already exists")

        # Commit the changes
        conn.commit()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Close the connection
        conn.close()


# Add the column when the module is imported
if __name__ == "__main__":
    add_created_at_column()
