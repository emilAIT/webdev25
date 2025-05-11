import sqlite3
import sys
from getpass import getpass

def create_admin():
    if len(sys.argv) != 2:
        print("Usage: python create_admin.py <username>")
        sys.exit(1)
    
    username = sys.argv[1]
    
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if not user:
        print(f"Error: User '{username}' not found")
        sys.exit(1)
    
    # Set user as admin
    cursor.execute("UPDATE users SET is_admin = 1 WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    
    print(f"Successfully set {username} as admin")

if __name__ == "__main__":
    create_admin() 