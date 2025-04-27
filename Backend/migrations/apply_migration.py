import sqlite3
import os

def apply_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database.db')
    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'schema.sql')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create users table from schema
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
            cursor.executescript(schema_sql)
        
        # Update existing users with current timestamp
        cursor.execute("UPDATE users SET registration_date = datetime('now') WHERE registration_date IS NULL")
        
        conn.commit()
        print("Migration successful!")
        
    except sqlite3.OperationalError as e:
        print(f"Error during migration: {e}")
    
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    apply_migration() 