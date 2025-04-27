import json
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_socketio import SocketIO, emit, join_room
import sqlite3
import bcrypt
import random
import string
import uuid
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
def safe_from_json(value):
    if value is None:
        return []
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return []

app.jinja_env.filters['from_json'] = safe_from_json
socketio = SocketIO(app, cors_allowed_origins="*", manage_session=False, async_mode='eventlet', logger=True, engineio_logger=True)

SENDER_EMAIL = "azimiwenbaev@gmail.com"
SENDER_APP_PASSWORD = "ghzhuqjdysngqwmm"

def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    # Create tables
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        surname TEXT,
        age INTEGER,
        interests TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS friends (
        user_id INTEGER,
        friend_id INTEGER,
        status TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(friend_id) REFERENCES users(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        content TEXT,
        timestamp TEXT,
        is_group BOOLEAN,
        group_id INTEGER,
        FOREIGN KEY(sender_id) REFERENCES users(id),
        FOREIGN KEY(receiver_id) REFERENCES users(id),
        FOREIGN KEY(group_id) REFERENCES groups(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        creator_id INTEGER,
        description TEXT,
        FOREIGN KEY(creator_id) REFERENCES users(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER,
        user_id INTEGER,
        FOREIGN KEY(group_id) REFERENCES groups(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS verification_codes (
        email TEXT,
        code TEXT,
        timestamp TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS reset_tokens (
        email TEXT,
        token TEXT,
        timestamp TEXT
    )''')

    # Convert existing interests to JSON array format
    c.execute("SELECT id, interests FROM users WHERE interests IS NOT NULL")
    users = c.fetchall()
    for user_id, interests in users:
        # Skip if already in JSON array format
        if interests.startswith('[') and interests.endswith(']'):
            continue
        # Convert string to array, splitting by comma if necessary
        if interests:
            interest_list = [i.strip().replace(' ', '') for i in interests.split(',')]
            interest_json = json.dumps(interest_list)
        else:
            interest_json = json.dumps([])
        c.execute("UPDATE users SET interests = ? WHERE id = ?", (interest_json, user_id))

    # Check and add 'description' column to groups table if missing
    c.execute("PRAGMA table_info(groups)")
    columns = [col[1] for col in c.fetchall()]
    if 'description' not in columns:
        c.execute("ALTER TABLE groups ADD COLUMN description TEXT")
        logging.info("Added missing 'description' column to groups table")

    # Commit all changes and close the connection
    conn.commit()
    conn.close()

def is_valid_input(text):
    allowed_chars = set('1234567890_qwertyuiopasdfghjklzxcvbnm')
    return all(char in allowed_chars for char in text)

def send_verification_email(email):
    code = ''.join(random.choices(string.digits, k=6))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("INSERT INTO verification_codes (email, code, timestamp) VALUES (?, ?, ?)",
              (email, code, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    conn.commit()
    conn.close()
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = email
    msg['Subject'] = "SomeMsger Verification Code"
    body = f"Your verification code is: {code}\nValid for 10 minutes."
    msg.attach(MIMEText(body, 'plain'))
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_APP_PASSWORD)
        server.sendmail(SENDER_EMAIL, email, msg.as_string())
        server.quit()
        logging.info(f"Verification code sent to {email}")
        return code
    except Exception as e:
        logging.error(f"Failed to send email: {e}")
        return None

def send_password_reset_email(email):
    token = str(uuid.uuid4())
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("INSERT INTO reset_tokens (email, token, timestamp) VALUES (?, ?, ?)",
              (email, token, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    conn.commit()
    conn.close()
    reset_link = f"{request.url_root}reset_password/{token}"
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = email
    msg['Subject'] = "SomeMsger Password Reset"
    body = f"Click to reset your password: {reset_link}\nValid for 1 hour."
    msg.attach(MIMEText(body, 'plain'))
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_APP_PASSWORD)
        server.sendmail(SENDER_EMAIL, email, msg.as_string())
        server.quit()
        logging.info(f"Reset link sent to {email}")
        return token
    except Exception as e:
        logging.error(f"Failed to send email: {e}")
        return None

@app.before_request
def before_request():
    if request.path.startswith('/socket.io/'):
        return
    if not session.get('user_id') and request.endpoint not in ('index', 'login', 'register', 'verify_code', 'forgot_password', 'reset_password'):
        return redirect(url_for('login'))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username_or_email = request.form['username_or_email'].lower()
        password = request.form['password'].encode('utf-8')
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username_or_email, username_or_email))
        user = c.fetchone()
        conn.close()
        if user and bcrypt.checkpw(password, user[3].encode('utf-8')):
            session['user_id'] = user[0]
            session['username'] = user[2]
            logging.info(f"Login successful: user_id={user[0]}, username={user[2]}")
            return redirect(url_for('chats'))
        return render_template('login.html', error="Invalid credentials")
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form['email'].lower()
        username = request.form['username'].lower()
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        if not is_valid_input(username):
            return render_template('register.html', error="Username: only 1234567890_qwertyuiopasdfghjklzxcvbnm")
        if not is_valid_input(password):
            return render_template('register.html', error="Password: only 1234567890_qwertyuiopasdfghjklzxcvbnm")
        if password != confirm_password:
            return render_template('register.html', error="Passwords do not match")
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        if c.fetchone():
            conn.close()
            return render_template('register.html', error="Username already exists")
        c.execute("SELECT * FROM users WHERE email = ?", (email,))
        if c.fetchone():
            conn.close()
            return render_template('register.html', error="Email already registered")
        code = send_verification_email(email)
        if not code:
            conn.close()
            return render_template('register.html', error="Failed to send verification code")
        session['pending_email'] = email
        session['pending_username'] = username
        session['pending_password'] = password
        conn.close()
        return redirect(url_for('verify_code'))
    return render_template('register.html')

@app.route('/verify_code', methods=['GET', 'POST'])
def verify_code():
    if 'pending_email' not in session:
        return redirect(url_for('register'))
    if request.method == 'POST':
        code = ''.join(request.form.get(f'digit{i}', '') for i in range(1, 7))
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute("SELECT code, timestamp FROM verification_codes WHERE email = ? ORDER BY timestamp DESC LIMIT 1",
                  (session['pending_email'],))
        record = c.fetchone()
        if record:
            stored_code, timestamp = record
            timestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
            if (datetime.now() - timestamp) > timedelta(minutes=10):
                conn.close()
                return render_template('verify_code.html', error="Code expired")
            if code == stored_code:
                hashed_password = bcrypt.hashpw(session['pending_password'].encode('utf-8'), bcrypt.gensalt())
                try:
                    c.execute("INSERT INTO users (email, username, password) VALUES (?, ?, ?)",
                              (session['pending_email'], session['pending_username'], hashed_password.decode('utf-8')))
                    conn.commit()
                except sqlite3.IntegrityError:
                    conn.close()
                    return render_template('verify_code.html', error="Username or email already taken")
                session.pop('pending_email', None)
                session.pop('pending_username', None)
                session.pop('pending_password', None)
                conn.close()
                return redirect(url_for('login'))
            conn.close()
            return render_template('verify_code.html', error="Invalid code")
        conn.close()
        return render_template('verify_code.html', error="No verification code found")
    return render_template('verify_code.html')

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form['email'].lower()
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = c.fetchone()
        conn.close()
        if user:
            token = send_password_reset_email(email)
            if not token:
                return render_template('forgot_password.html', error="Failed to send reset link")
            return render_template('forgot_password.html', message="Reset link sent to your email")
        return render_template('forgot_password.html', error="Email not found")
    return render_template('forgot_password.html')

@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT email, timestamp FROM reset_tokens WHERE token = ? ORDER BY timestamp DESC LIMIT 1", (token,))
    record = c.fetchone()
    if not record:
        conn.close()
        return render_template('reset_password.html', error="Invalid or expired token")
    email, timestamp = record
    timestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
    if (datetime.now() - timestamp) > timedelta(hours=1):
        conn.close()
        return render_template('reset_password.html', error="Token expired")
    if request.method == 'POST':
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        if not is_valid_input(password):
            return render_template('reset_password.html', error="Password: only 1234567890_qwertyuiopasdfghjklzxcvbnm")
        if password != confirm_password:
            return render_template('reset_password.html', error="Passwords do not match")
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        c.execute("UPDATE users SET password = ? WHERE email = ?",
                  (hashed_password.decode('utf-8'), email))
        c.execute("DELETE FROM reset_tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return redirect(url_for('login'))
    conn.close()
    return render_template('reset_password.html')

@app.route('/chats')
def chats():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT friend_id FROM friends WHERE user_id = ? AND status = 'accepted'", (session['user_id'],))
    friends = c.fetchall()
    friend_list = []
    for friend in friends:
        c.execute("SELECT username FROM users WHERE id = ?", (friend[0],))
        friend_list.append(c.fetchone()[0])
    c.execute("SELECT user_id FROM friends WHERE friend_id = ? AND status = 'pending'", (session['user_id'],))
    pending_requests = c.fetchall()
    pending_list = []
    for req in pending_requests:
        c.execute("SELECT username FROM users WHERE id = ?", (req[0],))
        pending_list.append(c.fetchone()[0])
    c.execute("SELECT g.id, g.name FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?", (session['user_id'],))
    groups = c.fetchall()
    conn.close()
    today_date = datetime.now().strftime("%b %d, %Y")
    yesterday = datetime.now() - timedelta(days=1)
    yesterday_date = yesterday.strftime("%b %d, %Y")
    return render_template('chats.html', friends=friend_list, pending_requests=pending_list, groups=groups, today_date=today_date, yesterday_date=yesterday_date)

@app.route('/chats/<username>')
def chat_user(username):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT id, name, surname, age, interests FROM users WHERE username = ?", (username,))
    friend = c.fetchone()
    if not friend:
        conn.close()
        return redirect(url_for('chats'))
    c.execute("SELECT m.*, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)) AND m.is_group = 0",
              (session['user_id'], friend[0], friend[0], session['user_id']))
    messages = c.fetchall()
    c.execute("SELECT friend_id FROM friends WHERE user_id = ? AND status = 'accepted'", (session['user_id'],))
    friends = c.fetchall()
    friend_list = []
    for f in friends:
        c.execute("SELECT username FROM users WHERE id = ?", (f[0],))
        friend_list.append(c.fetchone()[0])
    c.execute("SELECT g.id, g.name FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?", (session['user_id'],))
    groups = c.fetchall()
    conn.close()
    today_date = datetime.now().strftime("%b %d, %Y")
    yesterday = datetime.now() - timedelta(days=1)
    yesterday_date = yesterday.strftime("%b %d, %Y")
    return render_template('chat_user.html', username=username, friend=friend, messages=messages, friends=friend_list, groups=groups, session=session, today_date=today_date, yesterday_date=yesterday_date)

@app.route('/groups')
def groups():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT g.id, g.name FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?", (session['user_id'],))
    groups = c.fetchall()
    c.execute("SELECT friend_id FROM friends WHERE user_id = ? AND status = 'accepted'", (session['user_id'],))
    friends = c.fetchall()
    friend_list = []
    for friend in friends:
        c.execute("SELECT username FROM users WHERE id = ?", (friend[0],))
        friend_list.append(c.fetchone()[0])
    conn.close()
    return render_template('groups.html', groups=groups, friends=friend_list)

@app.route('/group/<group_id>')
def group_chat(group_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("PRAGMA table_info(groups)")
    columns = [col[1] for col in c.fetchall()]
    if 'description' in columns:
        c.execute("SELECT id, name, creator_id, description FROM groups WHERE id = ?", (group_id,))
    else:
        c.execute("SELECT id, name, creator_id, NULL as description FROM groups WHERE id = ?", (group_id,))
    group_data = c.fetchone()
    if not group_data:
        conn.close()
        return redirect(url_for('groups'))
    group_id, group_name, creator_id, description = group_data
    description = description or ""
    c.execute("SELECT m.*, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.is_group = 1 AND m.group_id = ?", (group_id,))
    messages = c.fetchall()
    c.execute("SELECT g.id, g.name FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?", (session['user_id'],))
    groups = c.fetchall()
    c.execute("SELECT u.id, u.username FROM users u JOIN group_members gm ON u.id = gm.user_id WHERE gm.group_id = ?", (group_id,))
    members = c.fetchall()
    c.execute("SELECT friend_id FROM friends WHERE user_id = ? AND status = 'accepted'", (session['user_id'],))
    friends = c.fetchall()
    friend_list = []
    for friend in friends:
        c.execute("SELECT username FROM users WHERE id = ?", (friend[0],))
        friend_list.append(c.fetchone()[0])
    # Fetch pending friend requests
    c.execute("SELECT user_id FROM friends WHERE friend_id = ? AND status = 'pending'", (session['user_id'],))
    pending_requests = c.fetchall()
    pending_list = []
    for req in pending_requests:
        c.execute("SELECT username FROM users WHERE id = ?", (req[0],))
        pending_list.append(c.fetchone()[0])
    conn.close()
    today_date = datetime.now().strftime("%b %d, %Y")
    yesterday = datetime.now() - timedelta(days=1)
    yesterday_date = yesterday.strftime("%b %d, %Y")
    return render_template('group_chat.html', group=group_name, group_id=group_id, description=description, messages=messages, groups=groups, members=members, creator_id=creator_id, session=session, friends=friend_list, pending_requests=pending_list, today_date=today_date, yesterday_date=yesterday_date)

@app.route('/groups/create')
def group_create():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT u.username FROM users u JOIN friends f ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'accepted'", (session['user_id'],))
    friends = c.fetchall()
    conn.close()
    return render_template('group_create.html', friends=[f[0] for f in friends])

@app.route('/create_group', methods=['POST'])
def create_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    group_name = request.form['group_name']
    description = request.form.get('description', '')
    usernames = request.form.getlist('usernames')
    if not group_name or not usernames:
        return jsonify({'error': 'Group name and at least one friend required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    try:
        c.execute("SELECT u.username FROM users u JOIN friends f ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'accepted'", (session['user_id'],))
        valid_friends = [f[0].lower() for f in c.fetchall()]
        invalid_usernames = [u for u in usernames if u.lower() not in valid_friends]
        if invalid_usernames:
            conn.close()
            return jsonify({'error': f'Only friends can be added: {", ".join(invalid_usernames)}'}), 400
        c.execute("INSERT INTO groups (name, creator_id, description) VALUES (?, ?, ?)", (group_name, session['user_id'], description))
        group_id = c.lastrowid
        c.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (group_id, session['user_id']))
        for username in usernames:
            c.execute("SELECT id FROM users WHERE username = ?", (username,))
            user = c.fetchone()
            if user and user[0] != session['user_id']:
                c.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (group_id, user[0]))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'group_id': group_id})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Group name already exists'}), 400

@app.route('/get_user_info', methods=['GET'])
def get_user_info():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'error': 'Not logged in'}), 401
    username = request.args.get('username')
    if not username:
        return jsonify({'status': 'error', 'error': 'Username required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT id, name, surname, age, interests FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    if not user:
        return jsonify({'status': 'error', 'error': 'User not found'}), 404
    interests = json.loads(user[4]) if user[4] else []
    return jsonify({
        'status': 'success',
        'user': {
            'id': user[0],
            'name': user[1] or '',
            'surname': user[2] or '',
            'age': user[3] if user[3] is not None else '',
            'interests': interests,
            'username': username
        }
    })

@app.route('/get_group_info', methods=['GET'])
def get_group_info():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'error': 'Not logged in'}), 401
    group_id = request.args.get('group_id')
    if not group_id:
        return jsonify({'status': 'error', 'error': 'Group ID required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, session['user_id']))
    if not c.fetchone():
        conn.close()
        return jsonify({'status': 'error', 'error': 'Not authorized'}), 403
    c.execute("PRAGMA table_info(groups)")
    columns = [col[1] for col in c.fetchall()]
    if 'description' in columns:
        c.execute("SELECT id, name, creator_id, description FROM groups WHERE id = ?", (group_id,))
    else:
        c.execute("SELECT id, name, creator_id, NULL as description FROM groups WHERE id = ?", (group_id,))
    group = c.fetchone()
    if not group:
        conn.close()
        return jsonify({'status': 'error', 'error': 'Group not found'}), 404
    c.execute("SELECT u.id, u.username FROM users u JOIN group_members gm ON u.id = gm.user_id WHERE gm.group_id = ?", (group_id,))
    members = c.fetchall()
    conn.close()
    return jsonify({
        'status': 'success',
        'group': {
            'id': group[0],
            'name': group[1],
            'creator_id': group[2],
            'description': group[3] or 'No description',
            'members': [{'id': m[0], 'username': m[1]} for m in members]
        }
    })

@app.route('/update_group_info', methods=['POST'])
def update_group_info():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    group_id = request.form['group_id']
    group_name = request.form['group_name']
    description = request.form.get('description', '')
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT creator_id FROM groups WHERE id = ?", (group_id,))
    group = c.fetchone()
    if not group or group[0] != session['user_id']:
        conn.close()
        return jsonify({'error': 'Only the creator can edit group info'}), 403
    try:
        c.execute("UPDATE groups SET name = ?, description = ? WHERE id = ?",
                  (group_name, description, group_id))
        conn.commit()
        socketio.emit('group_name_updated', {
            'group_id': group_id,
            'name': group_name,
            'description': description
        }, room=f"group_{group_id}")
        conn.close()
        return jsonify({'status': 'success'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Group name already exists'}), 400
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/add_to_group', methods=['POST'])
def add_to_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    group_id = request.form['group_id']
    username = request.form['username'].lower()
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT creator_id FROM groups WHERE id = ?", (group_id,))
    group = c.fetchone()
    if not group or group[0] != session['user_id']:
        conn.close()
        return jsonify({'error': 'Only the creator can add members'}), 403
    c.execute("SELECT u.id FROM users u JOIN friends f ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'accepted' AND u.username = ?", (session['user_id'], username))
    user = c.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User is not a friend'}), 400
    c.execute("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, user[0]))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'User already in group'}), 400
    c.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (group_id, user[0]))
    conn.commit()
    conn.close()
    socketio.emit('group_member_added', {
        'group_id': group_id,
        'username': username,
        'user_id': user[0]
    }, room=f"group_{group_id}")
    return jsonify({'status': 'success', 'username': username})

@app.route('/remove_from_group', methods=['POST'])
def remove_from_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    group_id = request.form['group_id']
    user_id = request.form['user_id']
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT creator_id FROM groups WHERE id = ?", (group_id,))
    group = c.fetchone()
    if not group or group[0] != session['user_id']:
        conn.close()
        return jsonify({'error': 'Only the creator can remove members'}), 403
    if int(user_id) == session['user_id']:
        conn.close()
        return jsonify({'error': 'Creator cannot be removed'}), 400
    c.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    username = c.fetchone()
    if not username:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    c.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, user_id))
    if c.rowcount == 0:
        conn.close()
        return jsonify({'error': 'User not in group'}), 400
    conn.commit()
    conn.close()
    socketio.emit('group_member_removed', {
        'group_id': group_id,
        'user_id': user_id,
        'username': username[0]
    }, room=f"group_{group_id}")
    return jsonify({'status': 'success'})

@app.route('/get_friends_for_group')
def get_friends_for_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    group_id = request.args.get('group_id')
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT u.username FROM users u JOIN friends f ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'accepted' AND u.id NOT IN (SELECT user_id FROM group_members WHERE group_id = ?)", (session['user_id'], group_id))
    friends = c.fetchall()
    conn.close()
    return jsonify({'friends': [f[0] for f in friends]})

@app.route('/edit_message', methods=['POST'])
def edit_message():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'error': 'ARKA logged in'}), 401
    user_id = session['user_id']
    message_id = request.form.get('message_id')
    content = request.form.get('content')
    is_group = request.form.get('is_group') == '1'
    group_id = request.form.get('group_id')
    if not message_id or not content:
        return jsonify({'status': 'error', 'error': 'Message ID and content required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT sender_id, receiver_id, group_id FROM messages WHERE id = ?', (message_id,))
    message = c.fetchone()
    if not message:
        conn.close()
        return jsonify({'status': 'error', 'error': 'Message not found'}), 404
    sender_id, receiver_id, msg_group_id = message
    if sender_id != user_id:
        conn.close()
        return jsonify({'status': 'error', 'error': 'Not authorized'}), 403
    if is_group:
        if not group_id or group_id != str(msg_group_id):
            conn.close()
            return jsonify({'status': 'error', 'error': 'Invalid group ID'}), 400
        c.execute('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', (group_id, user_id))
        if not c.fetchone():
            conn.close()
            return jsonify({'status': 'error', 'error': 'Not authorized'}), 403
        room = f"group_{group_id}"
    else:
        if not receiver_id:
            conn.close()
            return jsonify({'status': 'error', 'error': 'Invalid message'}), 400
        room = f"chat_{min(user_id, receiver_id)}_{max(user_id, receiver_id)}"
    c.execute('UPDATE messages SET content = ? WHERE id = ? AND sender_id = ?', (content, message_id, user_id))
    if c.rowcount == 0:
        conn.close()
        return jsonify({'status': 'error', 'error': 'Failed to update message'}), 400
    conn.commit()
    conn.close()
    socketio.emit('message_updated', {'message_id': message_id, 'content': content}, room=room)
    return jsonify({'status': 'success'})

@app.route('/delete_message', methods=['POST'])
def delete_message():
    if 'user_id' not in session:
        return jsonify("{'status': 'error', ratios': 'Not logged in'}"), 401
    user_id = session['user_id']
    message_id = request.form.get('message_id')
    is_group = request.form.get('is_group') == '1'
    group_id = request.form.get('group_id')
    if not message_id:
        return jsonify({'status': 'error', 'error': 'Message ID required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT sender_id, receiver_id, group_id FROM messages WHERE id = ?', (message_id,))
    message = c.fetchone()
    if not message:
        conn.close()
        return jsonify({'status': 'error', 'error': 'Message not found'}), 404
    sender_id, receiver_id, msg_group_id = message
    if sender_id != user_id:
        conn.close()
        return jsonify({'status': 'error', 'error': 'Not authorized'}), 403
    if is_group:
        if not group_id or group_id != str(msg_group_id):
            conn.close()
            return jsonify({'status': 'error', 'error': 'Invalid group ID'}), 400
        c.execute('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', (group_id, user_id))
        if not c.fetchone():
            conn.close()
            return jsonify({'status': 'error', 'error': 'Not authorized'}), 403
        room = f"group_{group_id}"
    else:
        if not receiver_id:
            conn.close()
            return jsonify({'status': 'error', 'error': 'Invalid message'}), 400
        room = f"chat_{min(user_id, receiver_id)}_{max(user_id, receiver_id)}"
    c.execute('DELETE FROM messages WHERE id = ? AND sender_id = ?', (message_id, user_id))
    if c.rowcount == 0:
        conn.close()
        return jsonify({'status': 'error', 'error': 'Failed to delete message'}), 400
    conn.commit()
    conn.close()
    socketio.emit('message_deleted', {'message_id': message_id}, room=room)
    return jsonify({'status': 'success'})

@app.route('/clear_private_chat', methods=['POST'])
def clear_private_chat():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'error': 'Not logged in'}), 401
    user_id = session['user_id']
    receiver = request.form.get('receiver')
    if not receiver:
        return jsonify({'status': 'error', 'error': 'Receiver required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    try:
        c.execute('SELECT id FROM users WHERE username = ?', (receiver,))
        result = c.fetchone()
        if not result:
            conn.close()
            return jsonify({'status': 'error', 'error': 'Receiver not found'}), 404
        receiver_id = result[0]
        c.execute('DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) AND is_group = 0',
                  (user_id, receiver_id, receiver_id, user_id))
        conn.commit()
        room = f"chat_{min(user_id, receiver_id)}_{max(user_id, receiver_id)}"
        socketio.emit('chat_cleared', {}, room=room)
        return jsonify({'status': 'success'})
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'status': 'error', 'error': f'Database error: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/clear_group_chat', methods=['POST'])
def clear_group_chat():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'error': 'Not logged in'}), 401
    user_id = session['user_id']
    group_id = request.form.get('group_id')
    if not group_id:
        return jsonify({'status': 'error', 'error': 'Group ID required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    try:
        c.execute('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', (group_id, user_id))
        if not c.fetchone():
            conn.close()
            return jsonify({'status': 'error', 'error': 'Not authorized'}), 403
        c.execute('DELETE FROM messages WHERE group_id = ? AND is_group = 1', (group_id,))
        conn.commit()
        socketio.emit('chat_cleared', {}, room=f"group_{group_id}")
        return jsonify({'status': 'success'})
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'status': 'error', 'error': f'Database error: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/settings/profile')
def settings_profile():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],))
    user = c.fetchone()
    conn.close()
    return render_template('settings_profile.html', user=user)

@app.route('/settings/styles')
def settings_styles():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('settings_styles.html')

@app.route('/settings/account')
def settings_account():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],))
    user = c.fetchone()
    conn.close()
    return render_template('settings_account.html', user=user)

@app.route('/update_profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    name = request.form['name']
    surname = request.form['surname']
    age = request.form['age']
    interests = request.form['interests']  # This is a JSON string
    interests_array = json.loads(interests)  # Parse to list
    # Remove spaces from interests and validate
    interests_array = [interest.strip().replace(' ', '') for interest in interests_array]
    interests_json = json.dumps(interests_array)  # Convert back to JSON string for storage
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("UPDATE users SET name = ?, surname = ?, age = ?, interests = ? WHERE id = ?",
              (name, surname, age, interests_json, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/update_username', methods=['POST'])
def update_username():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    username = request.form['username'].lower()
    if not is_valid_input(username):
        return jsonify({'error': 'Username: only 1234567890_qwertyuiopasdfghjklzxcvbnm'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    try:
        c.execute("UPDATE users SET username = ? WHERE id = ?",
                  (username, session['user_id']))
        conn.commit()
        session['username'] = username
        return jsonify({'status': 'success'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    finally:
        conn.close()

@app.route('/change_password', methods=['POST'])
def change_password():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    old_password = request.form['old_password'].encode('utf-8')
    new_password = request.form['new_password']
    confirm_password = request.form['confirm_password']
    if not is_valid_input(new_password):
        return jsonify({'error': 'New password: only 1234567890_qwertyuiopasdfghjklzxcvbnm'}), 400
    if new_password != confirm_password:
        return jsonify({'error': 'New passwords do not match'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT password FROM users WHERE id = ?", (session['user_id'],))
    user = c.fetchone()
    if not user or not bcrypt.checkpw(old_password, user[0].encode('utf-8')):
        conn.close()
        return jsonify({'error': 'Incorrect old password'}), 400
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    c.execute("UPDATE users SET password = ? WHERE id = ?",
              (hashed_password.decode('utf-8'), session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/search', methods=['GET', 'POST'])
def search():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    # Fetch pending friend requests
    c.execute("SELECT user_id FROM friends WHERE friend_id = ? AND status = 'pending'", (session['user_id'],))
    pending_requests = c.fetchall()
    pending_list = []
    for req in pending_requests:
        c.execute("SELECT username FROM users WHERE id = ?", (req[0],))
        pending_list.append(c.fetchone()[0])
    
    # Fetch current user's interests
    c.execute("SELECT interests FROM users WHERE id = ?", (session['user_id'],))
    user_interests = json.loads(c.fetchone()[0] or '[]')
    
    recommendations = []
    if request.method == 'GET' and user_interests:
        # Fetch all users except the current user
        c.execute("SELECT id, username, interests FROM users WHERE id != ?", (session['user_id'],))
        all_users = c.fetchall()
        
        # Get IDs of friends and pending requests to exclude them
        c.execute("SELECT friend_id FROM friends WHERE user_id = ? AND status IN ('accepted', 'pending')", (session['user_id'],))
        exclude_ids = set(f[0] for f in c.fetchall())
        c.execute("SELECT user_id FROM friends WHERE friend_id = ? AND status = 'pending'", (session['user_id'],))
        exclude_ids.update(f[0] for f in c.fetchall())
        
        # Find users with overlapping interests
        potential_recommendations = []
        for user_id, username, interests_json in all_users:
            if user_id in exclude_ids:
                continue
            interests = json.loads(interests_json or '[]')
            common_interests = set(user_interests).intersection(interests)
            if common_interests:
                potential_recommendations.append({
                    'user_id': user_id,
                    'username': username,
                    'common_interests_count': len(common_interests)
                })
        
        # Sort by number of common interests (descending) and limit to 10
        potential_recommendations.sort(key=lambda x: x['common_interests_count'], reverse=True)
        recommendations = potential_recommendations[:10]
    
    if request.method == 'POST':
        query = request.form.get('query', '').lower()
        # Fetch users matching the query
        c.execute("SELECT id, username FROM users WHERE username LIKE ? AND id != ?",
                  (f'%{query}%', session['user_id']))
        users = c.fetchall()
        # Prepare the response with friendship status
        user_list = []
        for user in users:
            user_id, username = user
            # Check if already friends or request sent
            c.execute("SELECT status FROM friends WHERE user_id = ? AND friend_id = ?",
                      (session['user_id'], user_id))
            relationship = c.fetchone()
            can_send_request = False
            if not relationship:  # No relationship exists
                can_send_request = True
            # If there's a relationship, check its status
            elif relationship[0] not in ['accepted', 'pending']:
                can_send_request = True
            user_list.append({
                'username': username,
                'can_send_request': can_send_request
            })
        conn.close()
        return jsonify({'users': user_list})
    
    conn.close()
    return render_template('search.html', pending_requests=pending_list, recommendations=recommendations)

@app.route('/send_friend_request', methods=['POST'])
def send_friend_request():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    username = request.form['username'].lower()
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    c.execute("SELECT * FROM friends WHERE user_id = ? AND friend_id = ?",
              (session['user_id'], user[0]))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'Request already sent or already friends'}), 400
    c.execute("INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)",
              (session['user_id'], user[0], 'pending'))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/accept_friend_request', methods=['POST'])
def accept_friend_request():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    username = request.form['username'].lower()
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    c.execute("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ? AND status = 'pending'",
              (user[0], session['user_id']))
    if c.rowcount == 0:
        conn.close()
        return jsonify({'error': 'No pending request found'}), 400
    c.execute("INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)",
              (session['user_id'], user[0], 'accepted'))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return redirect(url_for('index'))

@app.route('/send_message', methods=['POST'])
def send_message_http():
    if 'user_id' not in session:
        logging.error("HTTP send_message: User not authenticated")
        return jsonify({'error': 'Not logged in'}), 401
    content = request.form.get('content')
    receiver_username = request.form.get('receiver')
    is_group = request.form.get('is_group') == '1'
    group_id = request.form.get('group_id')
    timestamp = datetime.now().strftime('%b %d, %Y %H:%M')  # Updated format: "Apr 26, 2025 22:31"
    if not content:
        logging.error("HTTP send_message: Message content required")
        return jsonify({'error': 'Message content required'}), 400
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    try:
        if is_group:
            if not group_id:
                logging.error("HTTP send_message: Group ID required")
                return jsonify({'error': 'Group ID required'}), 400
            c.execute("SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, session['user_id']))
            if not c.fetchone():
                conn.close()
                logging.error("HTTP send_message: User not in group")
                return jsonify({'error': 'Not authorized'}), 403
            c.execute("INSERT INTO messages (sender_id, content, is_group, group_id, timestamp) VALUES (?, ?, ?, ?, ?)",
                      (session['user_id'], content, 1, group_id, timestamp))
            c.execute("SELECT last_insert_rowid()")
            message_id = c.fetchone()[0]
            conn.commit()
            room = f"group_{group_id}"
            c.execute("SELECT username FROM users WHERE id = ?", (session['user_id'],))
            username = c.fetchone()[0]
            logging.info(f"HTTP send_message: Broadcasting group message id={message_id}, room={room}, content={content}")
            socketio.emit('new_message', {
                'id': message_id,
                'sender_id': session['user_id'],
                'content': content,
                'timestamp': timestamp,
                'is_group': True,
                'username': username
            }, room=room)
        else:
            if not receiver_username:
                logging.error("HTTP send_message: Receiver username required")
                return jsonify({'error': 'Receiver username required'}), 400
            c.execute("SELECT id FROM users WHERE username = ?", (receiver_username,))
            receiver = c.fetchone()
            if not receiver:
                logging.error("HTTP send_message: Receiver not found")
                return jsonify({'error': 'Receiver not found'}), 404
            c.execute("SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'",
                      (session['user_id'], receiver[0]))
            if not c.fetchone():
                conn.close()
                logging.error("HTTP send_message: Not friends with receiver")
                return jsonify({'error': 'Not friends with receiver'}), 403
            c.execute("INSERT INTO messages (sender_id, receiver_id, content, is_group, timestamp) VALUES (?, ?, ?, ?, ?)",
                      (session['user_id'], receiver[0], content, 0, timestamp))
            c.execute("SELECT last_insert_rowid()")
            message_id = c.fetchone()[0]
            conn.commit()
            room = f"chat_{min(session['user_id'], receiver[0])}_{max(session['user_id'], receiver[0])}"
            c.execute("SELECT username FROM users WHERE id = ?", (session['user_id'],))
            username = c.fetchone()[0]
            logging.info(f"HTTP send_message: Broadcasting user message id={message_id}, room={room}, content={content}")
            socketio.emit('new_message', {
                'id': message_id,
                'sender_id': session['user_id'],
                'content': content,
                'timestamp': timestamp,
                'is_group': False,
                'username': username
            }, room=room)
        logging.info(f"HTTP send_message: Message saved, id={message_id}")
        return jsonify({'status': 'success', 'message_id': message_id})
    except sqlite3.Error as e:
        logging.error(f"HTTP send_message: Database error: {e}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        conn.close()

@app.route('/get_new_messages', methods=['POST'])
def get_new_messages():
    if 'user_id' not in session:
        logging.error("get_new_messages: User not authenticated")
        return jsonify({'error': 'Not logged in'}), 401
    last_message_id = request.form.get('last_message_id', type=int, default=-1)
    is_group = request.form.get('is_group') == '1'
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    try:
        if is_group:
            group_id = request.form.get('group_id')
            if not group_id:
                conn.close()
                return jsonify({'error': 'Group ID required'}), 400
            c.execute("SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, session['user_id']))
            if not c.fetchone():
                conn.close()
                logging.error("get_new_messages: User not in group")
                return jsonify({'error': 'Not authorized'}), 403
            c.execute("SELECT m.*, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.is_group = 1 AND m.group_id = ? AND m.id > ?",
                      (group_id, last_message_id))
        else:
            receiver_username = request.form.get('receiver')
            if not receiver_username:
                conn.close()
                return jsonify({'error': 'Receiver username required'}), 400
            c.execute("SELECT id FROM users WHERE username = ?", (receiver_username,))
            receiver = c.fetchone()
            if not receiver:
                logging.error(f"get_new_messages: Receiver {receiver_username} not found")
                conn.close()
                return jsonify({'error': 'Receiver not found'}), 404
            c.execute("SELECT m.*, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.is_group = 0 AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)) AND m.id > ?",
                      (session['user_id'], receiver[0], receiver[0], session['user_id'], last_message_id))
        messages = c.fetchall()
        conn.close()
        logging.info(f"get_new_messages: Fetched {len(messages)} messages after id={last_message_id}")
        return jsonify({'messages': [
            {
                'id': m[0],
                'sender_id': m[1],
                'content': m[3],
                'timestamp': m[4],
                'is_group': bool(m[5]),
                'group_id': m[6],
                'username': m[7]
            } for m in messages
        ]})
    except sqlite3.Error as e:
        logging.error(f"get_new_messages: Database error: {e}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        conn.close()

@socketio.on('connect')
def handle_connect():
    if 'user_id' in session:
        logging.info(f"WebSocket connected: user_id={session['user_id']}")
    else:
        logging.info("WebSocket connected: Anonymous user")

@socketio.on('disconnect')
def handle_disconnect():
    logging.info(f"WebSocket disconnected: user_id={session.get('user_id', 'unknown')}")

@socketio.on('join_chat')
def handle_join_chat(data):
    user_id = session.get('user_id')
    if not user_id:
        emit('error', {'message': 'User not authenticated'})
        return
    receiver = data.get('receiver')
    is_group = data.get('is_group', False)
    group_id = data.get('group_id')
    if is_group:
        if not group_id:
            emit('error', {'message': 'Group ID required'})
            return
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute("SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, user_id))
        if not c.fetchone():
            conn.close()
            emit('error', {'message': 'Not authorized'})
            return
        room = f"group_{group_id}"
        join_room(room)
        logging.info(f"User {user_id} joined group room {room}")
        conn.close()
    else:
        if not receiver:
            emit('error', {'message': 'Receiver username required'})
            return
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute('SELECT id FROM users WHERE username = ?', (receiver,))
        result = c.fetchone()
        if result:
            receiver_id = result[0]
            room = f"chat_{min(user_id, receiver_id)}_{max(user_id, receiver_id)}"
            join_room(room)
            logging.info(f"User {user_id} joined private room {room}")
        else:
            emit('error', {'message': f'Receiver {receiver} not found'})
        conn.close()

if __name__ == '__main__':
    init_db()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)