
def add_friend(user_id, friend_id):
    if user_id == friend_id:
        return {"success": False, "error": "You cannot add yourself as a friend."}

    conn = connect_db()
    cursor = conn.cursor()