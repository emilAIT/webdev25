from app import app, db
from models.user import User, Contact, Message, Block, Group, GroupMember, GroupMessage

def clear_database():
    print("Starting database cleanup...")
    try:
        with app.app_context():
            # Delete data in the correct order to respect foreign key constraints
            
            # 1. First delete group messages (depends on groups and users)
            group_msg_count = GroupMessage.query.delete()
            print(f"Deleted group messages: {group_msg_count}")
            
            # 2. Delete direct messages (depends on users)
            msg_count = Message.query.delete()
            print(f"Deleted direct messages: {msg_count}")
            
            # 3. Delete group members (depends on groups and users)
            group_member_count = GroupMember.query.delete()
            print(f"Deleted group members: {group_member_count}")
            
            # 4. Delete groups (depends on users as creators)
            group_count = Group.query.delete()
            print(f"Deleted groups: {group_count}")
            
            # 5. Delete blocks (depends on users)
            block_count = Block.query.delete()
            print(f"Deleted blocks: {block_count}")
            
            # 6. Delete contacts (depends on users)
            contact_count = Contact.query.delete()
            print(f"Deleted contacts: {contact_count}")
            
            # 7. Finally delete users
            user_count = User.query.delete()
            print(f"Deleted users: {user_count}")
            
            # Commit changes
            db.session.commit()
            print("Database successfully cleared of all data")
    
    except Exception as e:
        print(f"Error clearing database: {str(e)}")
        db.session.rollback()
        print("Database cleanup failed - rolling back changes")

if __name__ == "__main__":
    clear_database()
