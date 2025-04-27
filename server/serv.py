from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from dbmanager import connect_db, init_db

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*")
init_db()

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name = data['name']
    email = data['email']
    password = generate_password_hash(data['password'])

    conn = connect_db()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', (name, email, password))
        conn.commit()
        return jsonify({'message': 'User registered'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email or Username already exists'}), 400
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    identifier = data['email']
    password = data['password']

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, email, password FROM users WHERE email = ? OR name = ?', (identifier, identifier))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user[3], password):
        return jsonify({
            'message': 'Login successful',
            'user_id': user[0],
            'name': user[1],
            'email': user[2]
        })
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/users', methods=['GET'])
def get_users():
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, email FROM users')
    users = cursor.fetchall()
    conn.close()
    return jsonify([{'id': u[0], 'name': u[1], 'email': u[2]} for u in users])

@app.route('/friends', methods=['GET'])
def get_friends():
    user_id = request.args.get('user_id')
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT users.id, users.name FROM users
        JOIN friends ON users.id = friends.friend_id
        WHERE friends.user_id = ?
    ''', (user_id,))
    friends = cursor.fetchall()
    conn.close()
    return jsonify([{'id': f[0], 'name': f[1]} for f in friends])

@app.route("/friends_add", methods=["POST"])
def add_friend():
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        friend_id = data.get("friend_id")

        # Проверка: данные переданы
        if user_id is None or friend_id is None:
            return jsonify({"success": False, "error": "Missing user_id or friend_id"}), 400

        # Проверка: сам себя
        if user_id == friend_id:
            return jsonify({"success": False, "error": "You cannot add yourself as a friend."}), 400

        conn = connect_db()
        cursor = conn.cursor()

        # Проверка на существование
        cursor.execute('''
            SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?
        ''', (user_id, friend_id))
        already_friends = cursor.fetchone()

        if already_friends:
            conn.close()
            return jsonify({"success": False, "error": "This user is already in your friend list."}), 400

        # Добавление в друзья
        cursor.execute('''
            INSERT INTO friends (user_id, friend_id) VALUES (?, ?)
        ''', (user_id, friend_id))

        # Взаимная дружба
        cursor.execute('''
            INSERT INTO friends (user_id, friend_id) VALUES (?, ?)
        ''', (friend_id, user_id))

        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Friend added successfully."}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/friends_remove', methods=['POST'])
def remove_friend():
    data = request.json
    user_id = data['user_id']
    friend_id = data['friend_id']

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM friends WHERE user_id = ? AND friend_id = ?', (user_id, friend_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Friend removed'})

@app.route('/messages_group/<int:group_id>', methods=['GET'])
def get_group_messages(group_id):
    user_id = int(request.args.get('user_id'))
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, sender_id, group_id, content, timestamp, status
        FROM messages
        WHERE group_id = ?
        ORDER BY timestamp ASC
    ''', (group_id,))
    messages = cursor.fetchall()

    messages_with_reads = []
    for m in messages:
        msg_id = m[0]
        cursor.execute('SELECT user_id FROM message_reads WHERE message_id = ?', (msg_id,))
        readers = [row[0] for row in cursor.fetchall()]
        messages_with_reads.append({
            'id': m[0], 'sender_id': m[1], 'group_id': m[2],
            'content': m[3], 'timestamp': m[4], 'status': m[5],
            'read_by': readers
        })

    conn.close()
    return jsonify(messages_with_reads)

@app.route('/groups', methods=['GET'])
def get_groups():
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, creator_id FROM groups')
    groups = cursor.fetchall()
    conn.close()
    return jsonify([{'id': g[0], 'name': g[1], 'creator_id': g[2]} for g in groups])

@app.route('/group_members_add', methods=['POST'])
def add_group_member():
    data = request.json
    group_id = data['group_id']
    user_id = data['user_id']

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', (group_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Member added'})

@app.route('/groups_user', methods=['GET'])
def get_user_groups():
    user_id = request.args.get('user_id')
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT g.id, g.name FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
    ''', (user_id,))

    groups = cursor.fetchall()
    conn.close()
    return jsonify([{'id': g[0], 'name': g[1]} for g in groups])

@app.route('/groups_create', methods=['POST'])
def create_group():
    data = request.json
    name = data['name']
    creator_id = data['creator_id']

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO groups (name, creator_id) VALUES (?, ?)', (name, creator_id))
    group_id = cursor.lastrowid
    cursor.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', (group_id, creator_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Group created', 'group_id': group_id})

@app.route('/groups/<int:group_id>', methods=['GET'])
def get_group_info(group_id):
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, creator_id FROM groups WHERE id = ?', (group_id,))
    group = cursor.fetchone()
    cursor.execute('SELECT user_id FROM group_members WHERE group_id = ?', (group_id,))
    members = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify({'id': group[0], 'name': group[1], 'creator_id': group[2], 'members': members})

@app.route('/groups_edit', methods=['POST'])
def edit_group():
    data = request.json
    group_id = data['group_id']
    name = data['name']
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE groups SET name = ? WHERE id = ?', (name, group_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Group updated'})

@app.route('/groups_delete', methods=['POST'])
def delete_group():
    data = request.json
    group_id = data['group_id']
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM group_members WHERE group_id = ?', (group_id,))
    cursor.execute('DELETE FROM messages WHERE group_id = ?', (group_id,))
    cursor.execute('DELETE FROM groups WHERE id = ?', (group_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Group deleted'})

@app.route('/communities_create', methods=['POST'])
def create_community():
    data = request.json
    name = data['name']
    creator_id = data['creator_id']
    group_ids = data.get('group_ids', [])

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO communities (name, creator_id) VALUES (?, ?)', (name, creator_id))
    community_id = cursor.lastrowid

    for group_id in group_ids:
        cursor.execute('INSERT INTO community_groups (community_id, group_id) VALUES (?, ?)', (community_id, group_id))

    conn.commit()
    conn.close()
    return jsonify({'message': 'Community created', 'community_id': community_id})

@app.route('/communities_user', methods=['GET'])
def get_user_communities():
    user_id = request.args.get('user_id')
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT c.id, c.name FROM communities c
        WHERE c.creator_id = ?
    ''', (user_id,))

    communities = cursor.fetchall()
    conn.close()
    return jsonify([{'id': c[0], 'name': c[1]} for c in communities])

@app.route('/community_groups/<int:community_id>', methods=['GET'])
def get_community_groups(community_id):
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT g.id, g.name FROM groups g
        JOIN community_groups cg ON g.id = cg.group_id
        WHERE cg.community_id = ?
    ''', (community_id,))

    groups = cursor.fetchall()
    conn.close()
    return jsonify([{'id': g[0], 'name': g[1]} for g in groups])

@app.route('/community_groups_delete', methods=['POST'])
def delete_community_group():
    data = request.json
    community_id = data['community_id']
    group_id = data['group_id']
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM community_groups WHERE community_id = ? AND group_id = ?', (community_id, group_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Group removed from community'})

@app.route('/community_groups_all', methods=['GET'])
def get_all_community_groups():
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT community_id, group_id FROM community_groups')
    community_groups = cursor.fetchall()
    conn.close()
    return jsonify([{'community_id': cg[0], 'group_id': cg[1]} for cg in community_groups])

@app.route('/community_groups_user', methods=['GET'])
def get_user_community_groups():
    user_id = request.args.get('user_id')
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT cg.community_id, cg.group_id
        FROM community_groups cg
        JOIN communities c ON cg.community_id = c.id
        WHERE c.creator_id = ?
    ''', (user_id,))
    community_groups = cursor.fetchall()
    conn.close()
    return jsonify([{'community_id': cg[0], 'group_id': cg[1]} for cg in community_groups])

@app.route('/messages/<int:friend_id>', methods=['GET'])
def get_messages(friend_id):
    current_user_id = int(request.args.get('user_id'))

    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, sender_id, receiver_id, group_id, content, timestamp, status
        FROM messages
        WHERE
            (sender_id = ? AND receiver_id = ?)
            OR
            (sender_id = ? AND receiver_id = ?)
        ORDER BY timestamp ASC
    ''', (current_user_id, friend_id, friend_id, current_user_id))
    messages = cursor.fetchall()

    messages_with_reads = []
    for m in messages:
        msg_id = m[0]
        cursor.execute('SELECT user_id FROM message_reads WHERE message_id = ?', (msg_id,))
        readers = [row[0] for row in cursor.fetchall()]
        messages_with_reads.append({
            'id': m[0], 'sender_id': m[1], 'receiver_id': m[2], 'group_id': m[3],
            'content': m[4], 'timestamp': m[5], 'status': m[6],
            'read_by': readers
        })

    conn.close()
    return jsonify(messages_with_reads)

@app.route('/messages_send', methods=['POST'])
def send_message():
    data = request.json
    sender_id = data['sender_id']
    receiver_id = data.get('receiver_id')
    group_id = data.get('group_id')
    content = data['content']

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO messages (sender_id, receiver_id, group_id, content)
        VALUES (?, ?, ?, ?)
    ''', (sender_id, receiver_id, group_id, content))
    conn.commit()
    message_id = cursor.lastrowid
    conn.close()

    # Отправляем сообщение получателю через WebSocket
    message = {
        'id': message_id,
        'sender_id': sender_id,
        'receiver_id': receiver_id,
        'group_id': group_id,
        'content': content
    }

    if group_id:
        room = f"group_{group_id}"
    else:
        room = f"user_{receiver_id}"
    socketio.emit('message_updated', message, room=room)

    return jsonify({'message': 'Message sent'})

@socketio.on('join')
def handle_join(data):
    user_id = data.get('user_id')
    group_id = data.get('group_id')

    if user_id:
        join_room(f"user_{user_id}")
        print(f"User {user_id} joined personal room user_{user_id}")
    if group_id:
        join_room(f"group_{group_id}")
        print(f"User joined group room group_{group_id}")

# Получение текущего соединения с БД (для новых API)
def get_db():
    if 'db' not in g:
        g.db = connect_db()
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# Удаление сообщения (новый REST API)
@app.route('/messages/<int:message_id>', methods=['DELETE'])
def delete_message_rest(message_id):
    db = get_db()

    cursor = db.execute('SELECT receiver_id, group_id FROM messages WHERE id = ?', (message_id,))
    row = cursor.fetchone()

    db.execute('DELETE FROM messages WHERE id = ?', (message_id,))
    db.commit()

    if row:
        receiver_id, group_id = row
        event = {
            'type': 'deleted',
            'message_id': message_id,
            'receiver_id': receiver_id,
            'group_id': group_id,
        }
        if group_id:
            socketio.emit('message_updated', event, room=f"group_{group_id}")
        elif receiver_id:
            socketio.emit('message_updated', event, room=f"user_{receiver_id}")

    return jsonify({'success': True})

# Редактирование сообщения (новый REST API)
@app.route('/messages/<int:message_id>', methods=['PUT'])
def edit_message_rest(message_id):
    content = request.json.get('content')
    if not content:
        return jsonify({'error': 'No content provided'}), 400

    db = get_db()

    cursor = db.execute('SELECT receiver_id, group_id FROM messages WHERE id = ?', (message_id,))
    row = cursor.fetchone()

    db.execute('UPDATE messages SET content = ? WHERE id = ?', (content, message_id))
    db.commit()

    if row:
        receiver_id, group_id = row
        event = {
            'type': 'edited',
            'message_id': message_id,
            'receiver_id': receiver_id,
            'group_id': group_id,
            'new_content': content,
        }
        if group_id:
            socketio.emit('message_updated', event, room=f"group_{group_id}")
        elif receiver_id:
            socketio.emit('message_updated', event, room=f"user_{receiver_id}")

    return jsonify({'success': True})

# Отметка сообщений как прочитанных
@socketio.on('message_read')
def handle_message_read(data):
    user_id = data.get('user_id')
    message_ids = data.get('message_ids', [])
    chat_id = data.get('chat_id')
    is_group = data.get('is_group', False)

    db = get_db()

    for msg_id in message_ids:
        db.execute('''
            INSERT INTO message_reads (user_id, message_id)
            VALUES (?, ?)
            ON CONFLICT DO NOTHING
        ''', (user_id, msg_id))

    db.commit()

    for msg_id in message_ids:
        cursor = db.execute('SELECT sender_id FROM messages WHERE id = ?', (msg_id,))
        row = cursor.fetchone()
        if not row:
            continue
        sender_id = row[0]

        cursor = db.execute('SELECT user_id FROM message_reads WHERE message_id = ?', (msg_id,))
        read_by = [r[0] for r in cursor.fetchall()]

        room = f"group_{chat_id}" if is_group else f"user_{sender_id}"
        socketio.emit('message_read', {
            'message_id': msg_id,
            'read_by': read_by
        }, room=room)

@app.route('/messages/mark_read', methods=['POST'])
def mark_read():
    user_id = request.json.get('user_id')
    message_ids = request.json.get('message_ids', [])

    if not user_id or not message_ids:
        return jsonify({'error': 'Missing user_id or message_ids'}), 400

    db = get_db()

    # Обновляем статус прочтения
    for msg_id in message_ids:
        db.execute('''
            INSERT INTO message_reads (user_id, message_id)
            VALUES (?, ?)
            ON CONFLICT DO NOTHING
        ''', (user_id, msg_id))

    db.commit()

    # Получим всю необходимую информацию по сообщениям
    cursor = db.execute(f'''
        SELECT id, sender_id, receiver_id, group_id, content, timestamp, status
        FROM messages
        WHERE id IN ({','.join('?' * len(message_ids))})
    ''', message_ids)

    messages = cursor.fetchall()

    for msg in messages:
        msg_id, sender_id, receiver_id, group_id, content, timestamp, status = msg

        # Получаем read_by для конкретного сообщения
        cursor = db.execute('SELECT user_id FROM message_reads WHERE message_id = ?', (msg_id,))
        read_by = [row[0] for row in cursor.fetchall()]

        # Готовим ивент
        message_event = {
            'id': msg_id,
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'group_id': group_id,
            'content': content,
            'timestamp': timestamp,
            'status': status,
            'read_by': read_by,
            'type': 'read_update'
        }

        if group_id:
            room = f"group_{group_id}"
        else:
            room = f"user_{sender_id}"

        socketio.emit('message_updated', message_event, room=room)

    return jsonify({'success': True})

def get_group_by_id(group_id):
    db = get_db()
    cur = db.execute('SELECT name, avatar_url FROM groups WHERE id = ?', (group_id,))
    row = cur.fetchone()
    if row:
        return type('Group', (object,), {'name': row[0], 'avatar_url': row[1]})()
    return None

def get_user_by_id(user_id):
    db = get_db()
    cur = db.execute('SELECT name FROM users WHERE id = ?', (user_id,))
    row = cur.fetchone()
    if row:
        return type('User', (object,), {'name': row[0]})()
    return None


@app.route('/chat_info/<int:chat_id>')
def get_chat_info(chat_id):
    is_group = request.args.get('is_group') == '1'

    if is_group:
        group = get_group_by_id(chat_id)  # своя функция
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        return jsonify({
            'name': group.name,
            'avatar': group.avatar_url or '/static/default_group.png'
        })

    else:
        user = get_user_by_id(chat_id)  # своя функция
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'name': user.name
        })
    
@app.route('/messages/set_status', methods=['POST'])
def set_status():
    data = request.json
    message_id = data['message_id']
    status = data['status']
    db = get_db()
    db.execute('UPDATE messages SET status = ? WHERE id = ?', (status, message_id))
    db.commit()
    return jsonify({'success': True})

if __name__ == '__main__':
    socketio.run(app,debug=True)