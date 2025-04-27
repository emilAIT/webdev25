from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from Backend.db import connect_db
from flask_socketio import emit, join_room, leave_room
import time
import os
from flask import current_app
from collections import defaultdict
import datetime
import pytz

# Create blueprint
bp = Blueprint("chat", __name__, url_prefix="/chat")

# This will be set by the app when the blueprint is registered
socketio = None

# Track online users
online_users = set()

def init_socketio(socket_instance):
    """Initialize the socketio instance from the main app"""
    global socketio
    socketio = socket_instance

def require_auth():
    if 'user_id' not in session:
        return jsonify({"message": "Unauthorized"}), 401
    return None

# Main chat page route
@bp.route('/')
def chat_index():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    # Render the chat template
    return render_template('chat.html')

# --- Direct Messages --- 
# Removing HTTP route for send_message since we're using WebSocket
# @bp.route("/send_message", methods=["POST"])
# def send_message():
#     auth = require_auth()
#     if auth: return auth
    
#     data = request.get_json()
#     conn = connect_db()
#     cursor = conn.cursor()
#     cursor.execute("""
#         INSERT INTO messages (sender_id, receiver_id, message, time)
#         VALUES (?, ?, ?, datetime('now'))
#     """, (session['user_id'], data['receiver_id'], data['message']))
#     conn.commit()
#     return jsonify({"message": "Message sent"}), 200

@bp.route("/get_messages/<int:receiver_id>", methods=["GET"])
def get_messages(receiver_id):
    auth = require_auth()
    if auth: return auth
    
    cursor = connect_db().cursor()
    cursor.execute("""
        SELECT sender_id, receiver_id, message, time 
        FROM messages 
        WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
        ORDER BY time ASC
    """, (session['user_id'], receiver_id, receiver_id, session['user_id']))
    
    return jsonify(cursor.fetchall()), 200

# --- Groups --- 
@bp.route("/groups", methods=["GET"])
def get_groups():
    auth = require_auth()
    if auth: return auth
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Get groups that the user is a member of with their last message info
    cursor.execute("""
        SELECT g.id, g.group_name, g.admin_id, g.group_picture, 
               (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
               (SELECT MAX(time) FROM group_messages WHERE group_id = g.id) as last_message_time,
               (SELECT message FROM group_messages WHERE group_id = g.id ORDER BY time DESC LIMIT 1) as last_message,
               (SELECT sender_id FROM group_messages WHERE group_id = g.id ORDER BY time DESC LIMIT 1) as last_message_sender_id,
               (SELECT username FROM users WHERE id = (
                   SELECT sender_id FROM group_messages WHERE group_id = g.id ORDER BY time DESC LIMIT 1
               )) as last_message_sender
        FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
        ORDER BY last_message_time DESC NULLS LAST
    """, (session['user_id'],))
    
    groups = []
    for row in cursor.fetchall():
        groups.append({
            'id': row[0],
            'name': row[1],
            'admin_id': row[2],
            'picture': row[3],
            'member_count': row[4],
            'is_admin': row[2] == session['user_id'],
            'last_message_time': row[5],
            'last_message': row[6],
            'last_message_sender_id': row[7],
            'last_message_sender': row[8]
        })
    
    conn.close()
    return jsonify(groups), 200

@bp.route("/group/<int:group_id>", methods=["GET"])
def get_group(group_id):
    auth = require_auth()
    if auth: return auth
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Check if user is a member of the group
    cursor.execute("""
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ?
    """, (group_id, session['user_id']))
    
    if not cursor.fetchone():
        return jsonify({"message": "Not a member of this group"}), 403
    
    # Get group info
    cursor.execute("""
        SELECT g.id, g.group_name, g.admin_id, g.group_picture,
               (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
        FROM groups g
        WHERE g.id = ?
    """, (group_id,))
    
    group = cursor.fetchone()
    if not group:
        return jsonify({"message": "Group not found"}), 404
    
    # Get group members
    cursor.execute("""
        SELECT u.id, u.username, u.profile_picture, u.name,
               (u.id = g.admin_id) as is_admin
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.group_id = ?
    """, (group_id,))
    
    members = []
    for row in cursor.fetchall():
        members.append({
            'id': row[0],
            'username': row[1],
            'profile_picture': row[2],
            'name': row[3],
            'is_admin': bool(row[4])
        })
    
    result = {
        'id': group[0],
        'name': group[1],
        'admin_id': group[2],
        'picture': group[3],
        'member_count': group[4],
        'is_admin': group[2] == session['user_id'],
        'members': members
    }
    
    conn.close()
    return jsonify(result), 200

@bp.route("/create_group", methods=["POST"])
def create_group():
    auth = require_auth()
    if auth: return auth
    
    # Handle multipart/form-data requests (for group image upload)
    if request.content_type and 'multipart/form-data' in request.content_type:
        group_name = request.form.get('group_name')
        member_ids = request.form.getlist('member_ids')
        group_description = request.form.get('description', '')
        group_picture = None
        
        # Handle uploaded image
        if 'group_picture' in request.files:
            file = request.files['group_picture']
            if file and file.filename:
                # Generate a secure filename
                filename = f"group_{int(time.time())}_{session['user_id']}_{file.filename}"
                filepath = os.path.join('uploads/group_images', filename)
                file.save(filepath)
                group_picture = filename
    else:
        # Handle JSON requests
        data = request.get_json()
        group_name = data.get('group_name')
        member_ids = data.get('member_ids', [])
        group_description = data.get('description', '')
        group_picture = None
    
    if not group_name:
        return jsonify({"message": "Group name is required"}), 400
        
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Start a transaction
        conn.execute("BEGIN TRANSACTION")
        
        # Create the group
        cursor.execute("""
            INSERT INTO groups (group_name, admin_id, group_picture, description)
            VALUES (?, ?, ?, ?)
        """, (group_name, session['user_id'], group_picture, group_description))
        
        group_id = cursor.lastrowid
        
        # Add the creator as a member
        cursor.execute("""
            INSERT INTO group_members (group_id, user_id)
            VALUES (?, ?)
        """, (group_id, session['user_id']))
        
        # Add all selected members
        for member_id in member_ids:
            if int(member_id) != session['user_id']:  # Skip if it's the creator (already added)
                cursor.execute("""
                    INSERT INTO group_members (group_id, user_id)
                    VALUES (?, ?)
                """, (group_id, member_id))
        
        # Get the creator's username for notifications
        cursor.execute("SELECT username FROM users WHERE id = ?", (session['user_id'],))
        creator_username = cursor.fetchone()[0]
        
        conn.commit()
        
        # Send notifications to all members
        if socketio:
            for member_id in member_ids:
                if int(member_id) != session['user_id']:  # Don't notify yourself
                    notification = {
                        'type': 'added_to_group',
                        'group_id': group_id,
                        'group_name': group_name,
                        'added_by': creator_username,
                        'message': f"{creator_username} added you to the group '{group_name}'"
                    }
                    socketio.emit('notification', notification, room=str(member_id))
        
        return jsonify({
            "group_id": group_id,
            "message": "Group created successfully",
            "member_count": len(member_ids) + 1  # +1 for the creator
        }), 200
        
    except Exception as e:
        # Rollback in case of error
        conn.rollback()
        return jsonify({"message": f"Failed to create group: {str(e)}"}), 500
        
    finally:
        conn.close()

@bp.route("/add_to_group", methods=["POST"])
def add_to_group():
    auth = require_auth()
    if auth: return auth
    
    data = request.get_json()
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)",
                   (data['group_id'], data['user_id']))
    conn.commit()
    return jsonify({"message": "User added to group"}), 200

@bp.route("/send_group_message", methods=["POST"])
def send_group_message():
    auth = require_auth()
    if auth: return auth
    
    data = request.get_json()
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO group_messages (group_id, sender_id, message, time)
        VALUES (?, ?, ?, datetime('now'))
    """, (data['group_id'], session['user_id'], data['message']))
    conn.commit()
    return jsonify({"message": "Group message sent"}), 200

@bp.route("/get_group_messages/<int:group_id>", methods=["GET"])
def get_group_messages(group_id):
    auth = require_auth()
    if auth: return auth
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Check if user is a member of the group
    cursor.execute("""
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ?
    """, (group_id, session['user_id']))
    
    if not cursor.fetchone():
        return jsonify({"message": "Not a member of this group"}), 403
    
    # Get messages with sender username
    cursor.execute("""
        SELECT gm.sender_id, u.username, gm.message, gm.time 
        FROM group_messages gm
        JOIN users u ON gm.sender_id = u.id
        WHERE gm.group_id = ? 
        ORDER BY gm.time ASC
    """, (group_id,))
    
    messages = cursor.fetchall()
    conn.close()
    
    return jsonify(messages), 200

# --- Contacts --- 
@bp.route("/contacts", methods=["GET"])
def get_contacts():
    auth = require_auth()
    if auth: return auth
    
    current_app.logger.info(f"Fetching contacts for user_id: {session['user_id']}")
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Get contacts with their last messages
    cursor.execute("""
        WITH LastMessages AS (
            SELECT 
                CASE 
                    WHEN sender_id = ? THEN receiver_id
                    WHEN receiver_id = ? THEN sender_id
                END as contact_id,
                message,
                time,
                ROW_NUMBER() OVER (PARTITION BY 
                    CASE 
                        WHEN sender_id = ? THEN receiver_id
                        WHEN receiver_id = ? THEN sender_id
                    END 
                ORDER BY time DESC) as rn
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
        )
        SELECT 
            c.contact_id,
            u.username as display_name,
            lm.message as last_message,
            lm.time as last_message_time
        FROM contacts c
        JOIN users u ON c.contact_id = u.id
        LEFT JOIN LastMessages lm ON c.contact_id = lm.contact_id AND lm.rn = 1
        WHERE c.user_id = ?
        ORDER BY lm.time DESC NULLS LAST
    """, (session['user_id'], session['user_id'], 
          session['user_id'], session['user_id'],
          session['user_id'], session['user_id'],
          session['user_id']))
    
    contacts = []
    for row in cursor.fetchall():
        contact = [row[0], row[1]]  # Keep the original format [id, username]
        if row[2]:  # If there's a last message
            contact.extend([row[2], row[3]])  # Add message and timestamp
        contacts.append(contact)
    
    current_app.logger.info(f"Found {len(contacts)} contacts: {contacts}")
    conn.close()
    
    return jsonify(contacts), 200

@bp.route("/add_contact", methods=["POST"])
def add_contact():
    auth = require_auth()
    if auth: return auth
    
    data = request.get_json()
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Start a transaction
        conn.execute("BEGIN TRANSACTION")
        
        # Add the contact to the current user's contacts
        cursor.execute("""
            INSERT OR IGNORE INTO contacts (user_id, contact_id, display_name)
            VALUES (?, ?, ?)
        """, (session['user_id'], data['contact_id'], data.get('display_name')))
        
        # Also add the current user to the contact's contacts list (bidirectional relationship)
        cursor.execute("""
            INSERT OR IGNORE INTO contacts (user_id, contact_id, display_name)
            VALUES (?, ?, NULL)
        """, (data['contact_id'], session['user_id']))
        
        # Get the current user's info for notifications
        cursor.execute("SELECT username FROM users WHERE id = ?", (session['user_id'],))
        user_result = cursor.fetchone()
        
        # Check if user exists before accessing the username
        current_username = user_result[0] if user_result else "Unknown user"
        
        # Commit the transaction
        conn.commit()
        
        # Emit a real-time notification to the other user if they're online
        if socketio:
            notification = {
                'type': 'contact_added',
                'user_id': session['user_id'],
                'username': current_username,
                'message': f"{current_username} added you as a contact"
            }
            socketio.emit('notification', notification, room=str(data['contact_id']))
        
        return jsonify({"message": "Contact added"}), 200
    
    except Exception as e:
        # Rollback in case of error
        conn.rollback()
        # Log the detailed error
        current_app.logger.error(f"Error in add_contact: {e}", exc_info=True) 
        return jsonify({"message": f"Failed to add contact: {str(e)}"}), 500
        
    finally:
        conn.close()

# --- User Info ---
@bp.route("/user_info", methods=["GET"])
def get_user_info():
    auth = require_auth()
    if auth: return auth
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Get all users except the current user
    cursor.execute("""
        SELECT id, username, profile_picture, name FROM users
        WHERE id != ?
    """, (session['user_id'],))
    
    users = []
    for row in cursor.fetchall():
        users.append({
            'id': row[0],
            'username': row[1],
            'profile_picture': row[2],
            'name': row[3]
        })
    
    conn.close()
    return jsonify(users), 200

@bp.route("/user_info/<int:user_id>", methods=["GET"])
def get_user_info_by_id(user_id):
    auth = require_auth()
    if auth: return auth
    
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, username, profile_picture, name, info 
            FROM users WHERE id = ?
        """, (user_id,))
        
        user = cursor.fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        return jsonify({
            'id': user[0],
            'username': user[1],
            'profile_picture': user[2],
            'name': user[3],
            'bio': user[4]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching user info: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch user info"}), 500
        
    finally:
        conn.close()

# --- User Search ---
@bp.route("/search_users", methods=["GET"])
def search_users():
    auth = require_auth()
    if auth: return auth
    
    search_term = request.args.get('term', '')
    if not search_term:
        return jsonify([]), 200
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Search for users by username or email
    cursor.execute("""
        SELECT id, username, email, profile_picture, name FROM users
        WHERE (username LIKE ? OR email LIKE ?) AND id != ?
    """, (f"%{search_term}%", f"%{search_term}%", session['user_id']))
    
    users = []
    for row in cursor.fetchall():
        users.append({
            'id': row[0],
            'username': row[1],
            'email': row[2],
            'profile_picture': row[3],
            'name': row[4]
        })
    
    conn.close()
    return jsonify(users), 200

# --- Socket.IO event handlers ---
def register_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        print('Client connected')
        if 'user_id' in session:
            user_id = session['user_id']
            print(f'User {user_id} connected')
            # Add user to online users
            online_users.add(user_id)
            # Join a room with the user's ID
            join_room(str(user_id))
            # Broadcast user's online status to all users
            emit('user_status', {
                'user_id': user_id,
                'status': 'online'
            }, broadcast=True)
        else:
            print('Anonymous user connected')

    @socketio.on('disconnect')
    def handle_disconnect():
        if 'user_id' in session:
            user_id = session['user_id']
            print(f'User {user_id} disconnected')
            # Remove user from online users
            online_users.discard(user_id)
            # Broadcast user's offline status to all users
            emit('user_status', {
                'user_id': user_id,
                'status': 'offline'
            }, broadcast=True)
        print('Client disconnected')

    @socketio.on('request_online_users')
    def handle_online_users_request():
        if 'user_id' not in session:
            return
        
        # Send current online users to the requesting client
        for user_id in online_users:
            emit('user_status', {
                'user_id': user_id,
                'status': 'online'
            })

    @socketio.on('join')
    def handle_join(data):
        room = data.get('room')
        if not room:
            return
        
        # Get username if available
        username = None
        if 'username' in session:
            username = session['username']
        
        # Join the room
        join_room(str(room))
        print(f'Client joined room: {room}')
        
        # Check if this is a group room
        if isinstance(room, str) and room.startswith('group_'):
            group_id = room.split('_')[1]
            print(f'User {username} joined group room: {group_id}')
            
            # Notify others in the group that this user has joined
            if username:
                emit('user_joined_group', {
                    'username': username,
                    'user_id': session.get('user_id'),
                    'group_id': group_id,
                    'timestamp': time.time()
                }, room=room, include_self=False)
        
        # If we have the username, emit a status update to notify others
        elif username:
            emit('user_status', {
                'username': username,
                'status': 'online'
            }, broadcast=True, include_self=False)

    @socketio.on('leave')
    def handle_leave(data):
        room = data.get('room')
        if room:
            leave_room(room)
            print(f'Client left room: {room}')

    @socketio.on('send_message')
    def handle_message(data):
        # Get sender info from session
        sender_id = session.get('user_id')
        sender_username = session.get('username')
        
        # Get message details from data
        receiver_username = data.get('receiver_username')
        receiver_id = data.get('receiver_id')
        message = data.get('message')
        group_id = data.get('group_id')
        message_id = data.get('message_id', str(int(time.time())) + str(sender_id))
        
        if not sender_id:
            return {'status': 'error', 'message': 'Not authenticated'}
        
        if not message:
            return {'status': 'error', 'message': 'No message provided'}
        
        # Get current time in Kyrgyzstan timezone
        kyrgyzstan_tz = pytz.timezone('Asia/Bishkek')
        current_time = datetime.datetime.now(kyrgyzstan_tz)
        
        try:
            if group_id:
                # Group message
                room = f'group_{group_id}'
                
                # Store the message in the database with Kyrgyzstan time
                conn = connect_db()
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO group_messages (group_id, sender_id, message, time)
                    VALUES (?, ?, ?, ?)
                """, (group_id, sender_id, message, current_time))
                
                conn.commit()
                conn.close()
                
                # Emit message to the entire group room
                emit('new_message', {
                    'sender_id': sender_id,
                    'sender_username': sender_username,
                    'message': message,
                    'group_id': group_id,
                    'timestamp': current_time.isoformat(),
                    'message_id': message_id
                }, room=room)
                
                return {'status': 'success', 'message': 'Group message sent'}
            
            elif receiver_username or receiver_id:
                # Direct message - find the best room to emit to
                target_room = None
                
                # Prioritize receiver_id if available
                if receiver_id:
                    target_room = str(receiver_id)
                # Otherwise use username
                elif receiver_username:
                    # Look up the user ID from username
                    conn = connect_db()
                    cursor = conn.cursor()
                    
                    cursor.execute("SELECT id FROM users WHERE username = ?", (receiver_username,))
                    result = cursor.fetchone()
                    
                    if result:
                        receiver_id = result[0]
                        target_room = str(receiver_id)
                    
                    conn.close()
                
                if not target_room:
                    return {'status': 'error', 'message': 'Could not determine recipient'}
                
                # Store the message in the database with Kyrgyzstan time
                conn = connect_db()
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO messages (sender_id, receiver_id, message, time)
                    VALUES (?, ?, ?, ?)
                """, (sender_id, receiver_id, message, current_time))
                
                conn.commit()
                conn.close()
                
                # Send to the recipient with Kyrgyzstan time
                message_data = {
                    'sender_id': sender_id,
                    'sender_username': sender_username,
                    'receiver_id': receiver_id,
                    'message': message,
                    'timestamp': current_time.isoformat(),
                    'message_id': message_id
                }
                
                emit('new_message', message_data, room=target_room)
                return {'status': 'success', 'message': 'Message sent'}
            
            return {'status': 'error', 'message': 'Invalid message type'}
            
        except Exception as e:
            print(f"Error sending message: {str(e)}")
            return {'status': 'error', 'message': 'Failed to send message'}

    @socketio.on('update_message_status')
    def handle_status_update(data):
        """Handle status updates for messages and broadcast to relevant users"""
        try:
            # Extract data
            message_id = data.get('message_id')
            status = data.get('status', 'read')  # Default to 'read'
            chat_id = data.get('chat_id')  # This could be user_id or group_id
            chat_type = data.get('chat_type', 'direct')  # 'direct' or 'group'
            
            # Sender info (the one updating the status)
            updater_id = session.get('user_id')
            updater_username = session.get('username')
            
            if not message_id or not chat_id or not updater_id:
                print(f"Missing data for status update: {data}")
                return {'status': 'error', 'message': 'Incomplete data for status update'}
                
            conn = connect_db()
            cursor = conn.cursor()
            current_time = datetime.datetime.now(pytz.timezone('Asia/Bishkek')).strftime('%Y-%m-%d %H:%M:%S')

            if chat_type == 'direct':
                # Update direct message status
                cursor.execute("""
                    UPDATE messages 
                    SET status = ?, read_at = ?
                    WHERE id = ? AND receiver_id = ?
                """, (status, current_time if status == 'read' else None, message_id, updater_id))
                
                # Get sender info for notification
                cursor.execute("""
                    SELECT sender_id, receiver_id 
                    FROM messages 
                    WHERE id = ?
                """, (message_id,))
                
                msg_info = cursor.fetchone()
                if msg_info:
                    sender_room = str(msg_info[0])
                
                # Emit status update to the original message sender
                emit('message_status', {
                    'message_id': message_id,
                    'status': status,
                        'chat_id': updater_id,
                    'updated_by': updater_username,
                        'timestamp': current_time
                }, room=sender_room)
                
            elif chat_type == 'group':
                # Update group message status
                cursor.execute("""
                    UPDATE group_message_status 
                    SET status = ?, read_at = ?
                    WHERE message_id = ? AND user_id = ?
                """, (status, current_time if status == 'read' else None, message_id, updater_id))
                
                # Get group info for notification
                cursor.execute("""
                    SELECT group_id 
                    FROM group_messages 
                    WHERE id = ?
                """, (message_id,))
                
                group_info = cursor.fetchone()
                if group_info:
                    group_room = f'group_{group_info[0]}'
                
                emit('message_status', {
                    'message_id': message_id,
                    'status': status,
                    'chat_id': chat_id,
                    'updated_by': updater_username,
                        'user_id': updater_id,
                        'timestamp': current_time
                    }, room=group_room, include_self=False)
                
            conn.commit()
            conn.close()
                
            return {'status': 'success', 'message': 'Status update processed'}
            
        except Exception as e:
            print(f"Error processing status update: {str(e)}")
            return {'status': 'error', 'message': str(e)}

@bp.route('/chat/last_message/<int:contact_id>')
def get_last_message(contact_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
        
    conn = connect_db()
    cursor = conn.cursor()
    
    # Get the last message between the user and the contact
    cursor.execute("""
        SELECT message, time
        FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY time DESC 
        LIMIT 1
    """, (user_id, contact_id, contact_id, user_id))
    
    result = cursor.fetchone()
    conn.close()
    
    if result:
        return jsonify({
            'message': result[0],
            'timestamp': result[1].isoformat() if result[1] else None
        })
    
    return jsonify({
        'message': '',
        'timestamp': None
    })

@bp.route("/leave_group", methods=["POST"])
def leave_group():
    auth = require_auth()
    if auth: return auth
    
    data = request.get_json()
    group_id = data.get('group_id')
    
    if not group_id:
        return jsonify({"message": "Group ID is required"}), 400
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Check if user is a member of the group
    cursor.execute("""
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ?
    """, (group_id, session['user_id']))
    
    if not cursor.fetchone():
        conn.close()
        return jsonify({"message": "Not a member of this group"}), 403
    
    # Check if user is the admin
    cursor.execute("""
        SELECT admin_id FROM groups 
        WHERE id = ?
    """, (group_id,))
    
    group_info = cursor.fetchone()
    if not group_info:
        conn.close()
        return jsonify({"message": "Group not found"}), 404
        
    admin_id = group_info[0]
    
    # If user is admin, transfer admin rights to another member if possible
    if admin_id == session['user_id']:
        # Find another member to transfer admin rights to
        cursor.execute("""
            SELECT user_id FROM group_members 
            WHERE group_id = ? AND user_id != ?
            LIMIT 1
        """, (group_id, session['user_id']))
        
        new_admin = cursor.fetchone()
        
        if new_admin:
            # Transfer admin rights to another member
            cursor.execute("""
                UPDATE groups SET admin_id = ? WHERE id = ?
            """, (new_admin[0], group_id))
            
            # Add a system message to the group chat about admin change
            current_time = datetime.datetime.now(pytz.timezone('Asia/Bishkek'))
            
            # Get usernames for notification
            cursor.execute("SELECT username FROM users WHERE id = ?", (session['user_id'],))
            old_admin_result = cursor.fetchone()
            old_admin_name = old_admin_result[0] if old_admin_result else "Unknown"
            
            cursor.execute("SELECT username FROM users WHERE id = ?", (new_admin[0],))
            new_admin_result = cursor.fetchone()
            new_admin_name = new_admin_result[0] if new_admin_result else "Unknown"
            
            system_message = f"[SYSTEM] Admin rights transferred from {old_admin_name} to {new_admin_name}"
            
            # Generate a unique message ID
            message_id = f"system_{int(time.time())}_{group_id}"
            
            cursor.execute("""
                INSERT INTO group_messages (group_id, sender_id, message, time, message_id)
                VALUES (?, ?, ?, ?, ?)
            """, (group_id, session['user_id'], system_message, current_time, message_id))
        else:
            # If no other members, delete the group instead of leaving
            cursor.execute("DELETE FROM groups WHERE id = ?", (group_id,))
            cursor.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
            cursor.execute("DELETE FROM group_messages WHERE group_id = ?", (group_id,))
            
            conn.commit()
            conn.close()
            return jsonify({"message": "You were the last member. Group has been deleted."}), 200
    
    # Remove user from group
    cursor.execute("""
        DELETE FROM group_members 
        WHERE group_id = ? AND user_id = ?
    """, (group_id, session['user_id']))
    
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Successfully left the group"}), 200

@bp.route("/delete_group", methods=["POST"])
def delete_group():
    auth = require_auth()
    if auth: return auth
    
    data = request.get_json()
    group_id = data.get('group_id')
    
    if not group_id:
        return jsonify({"message": "Group ID is required"}), 400
    
    conn = connect_db()
    cursor = conn.cursor()
    
    # Check if user is the admin
    cursor.execute("""
        SELECT admin_id FROM groups 
        WHERE id = ?
    """, (group_id,))
    
    result = cursor.fetchone()
    if not result:
        conn.close()
        return jsonify({"message": "Group not found"}), 404
    
    if result[0] != session['user_id']:
        conn.close()
        return jsonify({"message": "Only group admin can delete the group"}), 403
    
    # Delete group and all related data
    cursor.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
    cursor.execute("DELETE FROM group_messages WHERE group_id = ?", (group_id,))
    cursor.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Group deleted successfully"}), 200

@bp.route('/mark_messages_read', methods=['POST'])
def mark_messages_read():
    """Mark messages as read for a specific chat"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.get_json()
        chat_id = data.get('chat_id')
        chat_type = data.get('chat_type', 'direct')  # 'direct' or 'group'
        
        if not chat_id:
            return jsonify({'error': 'Chat ID is required'}), 400

        conn = connect_db()
        cursor = conn.cursor()
        current_time = datetime.datetime.now(pytz.timezone('Asia/Bishkek')).strftime('%Y-%m-%d %H:%M:%S')

        if chat_type == 'direct':
            # Mark direct messages as read
            cursor.execute("""
                UPDATE messages 
                SET status = 'read', read_at = ?
                WHERE receiver_id = ? AND sender_id = ? AND status != 'read'
            """, (current_time, user_id, chat_id))
            
            # Get the updated messages to notify the sender
            cursor.execute("""
                SELECT id, sender_id, receiver_id 
                FROM messages 
                WHERE receiver_id = ? AND sender_id = ? AND status = 'read' AND read_at = ?
            """, (user_id, chat_id, current_time))
            
            updated_messages = cursor.fetchall()
            
        else:  # group chat
            # Mark group messages as read
            cursor.execute("""
                UPDATE group_message_status 
                SET status = 'read', read_at = ?
                WHERE user_id = ? AND message_id IN (
                    SELECT id FROM group_messages 
                    WHERE group_id = ? AND sender_id != ?
                )
            """, (current_time, user_id, chat_id, user_id))
            
            # Get the updated messages to notify group members
            cursor.execute("""
                SELECT gm.id, gm.sender_id, gm.group_id
                FROM group_messages gm
                JOIN group_message_status gms ON gm.id = gms.message_id
                WHERE gm.group_id = ? AND gms.user_id = ? AND gms.status = 'read' AND gms.read_at = ?
            """, (chat_id, user_id, current_time))
            
            updated_messages = cursor.fetchall()

        conn.commit()
        conn.close()

        # Notify relevant users about the status update
        for msg in updated_messages:
            if chat_type == 'direct':
                # Notify the sender that their messages were read
                sender_room = str(msg[1])  # sender_id
                emit('message_status', {
                    'message_id': msg[0],  # message_id
                    'status': 'read',
                    'chat_id': user_id,  # the reader's id
                    'timestamp': current_time
                }, room=sender_room)
            else:
                # Notify group members about the read status
                group_room = f'group_{msg[2]}'  # group_id
                emit('message_status', {
                    'message_id': msg[0],  # message_id
                    'status': 'read',
                    'chat_id': chat_id,
                    'user_id': user_id,  # who read the message
                    'timestamp': current_time
                }, room=group_room)

        return jsonify({'status': 'success', 'message': 'Messages marked as read'})

    except Exception as e:
        print(f"Error marking messages as read: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/get_unread_count', methods=['GET'])
def get_unread_count():
    """Get count of unread messages for the current user"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        conn = connect_db()
        cursor = conn.cursor()

        # Get unread direct messages count
        cursor.execute("""
            SELECT sender_id, COUNT(*) as count
            FROM messages
            WHERE receiver_id = ? AND status != 'read'
            GROUP BY sender_id
        """, (user_id,))
        
        direct_unread = {row[0]: row[1] for row in cursor.fetchall()}

        # Get unread group messages count
        cursor.execute("""
            SELECT gm.group_id, COUNT(*) as count
            FROM group_messages gm
            JOIN group_message_status gms ON gm.id = gms.message_id
            WHERE gms.user_id = ? AND gms.status != 'read'
            GROUP BY gm.group_id
        """, (user_id,))
        
        group_unread = {row[0]: row[1] for row in cursor.fetchall()}

        conn.close()

        return jsonify({
            'direct': direct_unread,
            'groups': group_unread
        })

    except Exception as e:
        print(f"Error getting unread count: {str(e)}")
        return jsonify({'error': str(e)}), 500