from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import smtplib
from email.mime.text import MIMEText
import random
import string
from datetime import datetime, timedelta
import logging

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = 'your_secret_key'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

DB_PATH = 'users.db'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Таблица пользователей
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )''')

    # Таблица сброса паролей
    c.execute('''CREATE TABLE IF NOT EXISTS reset_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL
    )''')

    # Таблица групп
    c.execute('''CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )''')

    # Таблица участников групп
    c.execute('''CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    # Таблица сообщений
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        target TEXT NOT NULL,
        mode TEXT NOT NULL,
        text TEXT NOT NULL,
        message TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT DEFAULT 'unread',
        FOREIGN KEY (sender_id) REFERENCES users(id)
    )''')

    # Таблица контактов
    c.execute('''CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        contact_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (contact_id) REFERENCES users(id),
        UNIQUE(user_id, contact_id)
    )''')

    # Проверка и добавление недостающих столбцов для таблицы messages
    c.execute("PRAGMA table_info(messages)")
    columns = [info[1] for info in c.fetchall()]
    required_columns = {
        'sender_id': 'INTEGER NOT NULL',
        'receiver_id': 'INTEGER NOT NULL',
        'target': 'TEXT NOT NULL',
        'mode': 'TEXT NOT NULL',
        'text': 'TEXT NOT NULL',
        'message': 'TEXT NOT NULL',
        'time': 'TEXT NOT NULL',
        'status': 'TEXT DEFAULT "unread"'
    }
    for col_name, col_type in required_columns.items():
        if col_name not in columns:
            c.execute(f'ALTER TABLE messages ADD COLUMN {col_name} {col_type}')
            logger.info(f"Добавлен столбец {col_name} в таблицу messages")

    conn.commit()
    conn.close()

init_db()

def send_email(to_email, code):
    smtp_server = 'smtp.gmail.com'
    smtp_port = 587
    smtp_user = 'ellabaktygulova@gmail.com'
    smtp_password = 'tmyz tpza nvsw rzcv'

    subject = 'Код для сброса пароля'
    body = f'Ваш код для сброса пароля: {code}\nКод действителен в течение 10 минут.'
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = smtp_user
    msg['To'] = to_email

    try:
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        logger.error(f"Ошибка при отправке email: {e}")
        return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat')
def chat():
    return render_template('chat.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'Все поля обязательны'}), 400

    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                  (username, email, hashed_password))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Пользователь успешно зарегистрирован'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Имя пользователя или email уже существуют'}), 400
    except Exception as e:
        logger.error(f"Ошибка при регистрации: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Имя пользователя и пароль обязательны'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT id, password FROM users WHERE username = ?', (username,))
        user = c.fetchone()
        conn.close()
        if user and check_password_hash(user[1], password):
            session['username'] = username
            session['user_id'] = user[0]
            return jsonify({'message': 'Авторизация успешна'}), 200
        return jsonify({'error': 'Неверное имя пользователя или пароль'}), 401
    except Exception as e:
        logger.error(f"Ошибка при авторизации: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/request-reset', methods=['POST'])
def request_reset():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email обязателен'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT email FROM users WHERE LOWER(email) = LOWER(?)', (email,))
        user = c.fetchone()
        if not user:
            conn.close()
            return jsonify({'error': 'Пользователь с таким email не найден'}), 404

        code = ''.join(random.choices(string.digits, k=6))
        expires_at = datetime.now() + timedelta(minutes=10)
        c.execute('INSERT INTO reset_codes (email, code, expires_at) VALUES (?, ?, ?)',
                  (email, code, expires_at))
        conn.commit()
        conn.close()

        if send_email(email, code):
            return jsonify({'message': 'Код отправлен на ваш email'}), 200
        else:
            return jsonify({'error': 'Ошибка при отправке email'}), 500
    except Exception as e:
        logger.error(f"Ошибка в /api/request-reset: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email')
    code = data.get('code')
    new_password = data.get('new_password')

    if not email or not code or not new_password:
        return jsonify({'error': 'Все поля обязательны'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT code, expires_at FROM reset_codes WHERE email = ? ORDER BY expires_at DESC LIMIT 1', (email,))
        reset_data = c.fetchone()
        if not reset_data:
            conn.close()
            return jsonify({'error': 'Код не найден'}), 400

        stored_code, expires_at = reset_data
        expires_at = datetime.strptime(expires_at, '%Y-%m-%d %H:%M:%S.%f')
        if datetime.now() > expires_at:
            conn.close()
            return jsonify({'error': 'Код истек'}), 400

        if code != stored_code:
            conn.close()
            return jsonify({'error': 'Неверный код'}), 400

        hashed_password = generate_password_hash(new_password, method='pbkdf2:sha256')
        c.execute('UPDATE users SET password = ? WHERE email = ?', (hashed_password, email))
        c.execute('DELETE FROM reset_codes WHERE email = ?', (email,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Пароль успешно изменен'}), 200
    except Exception as e:
        logger.error(f"Ошибка в /api/reset-password: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT username FROM users')
        users = [row[0] for row in c.fetchall()]
        conn.close()
        return jsonify({'users': users}), 200
    except Exception as e:
        logger.error(f"Ошибка при получении списка пользователей: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/groups', methods=['GET'])
def get_groups():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT id, name FROM groups')
        groups = [{'id': row[0], 'name': row[1]} for row in c.fetchall()]
        conn.close()
        return jsonify({'groups': groups}), 200
    except Exception as e:
        logger.error(f"Ошибка при получении списка групп: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/groups', methods=['POST'])
def create_group():
    data = request.get_json()
    logger.info(f"Получен запрос на создание группы: {data}")
    name = data.get('name')
    members = data.get('members', [])

    if not name:
        logger.error("Название группы не указано")
        return jsonify({'success': False, 'error': 'Название группы обязательно'}), 400
    
    # Проверка на наличие хотя бы одного участника больше не нужна
    # так как создатель группы автоматически становится её участником
    
    # Убедимся, что сессия существует
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/groups POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Автоматически добавляем создателя в список участников, если его там нет
        creator_username = session['username']
        if creator_username not in members:
            members.append(creator_username)
            logger.info(f"Добавлен создатель группы {creator_username} в список участников")

        # Проверка существования пользователей (игнорируем регистр)
        logger.info(f"Проверка пользователей: {members}")
        placeholders = ','.join('?' * len(members))
        query = f'SELECT id, username FROM users WHERE LOWER(username) IN ({placeholders})'
        logger.info(f"Выполняем SQL-запрос: {query} с параметрами {members}")
        c.execute(query, [m.lower() for m in members])
        valid_members = c.fetchall()
        logger.info(f"Найденные пользователи: {valid_members}")

        # Проверяем, какие пользователи не найдены
        valid_usernames = [row[1] for row in valid_members]
        invalid_members = [m for m in members if m.lower() not in [vm.lower() for vm in valid_usernames]]
        if invalid_members:
            logger.error(f"Пользователи не найдены: {invalid_members}")
            conn.close()
            return jsonify({'success': False, 'error': f'Пользователи не найдены: {", ".join(invalid_members)}'}), 400

        # Создание группы
        logger.info(f"Создание группы: {name}")
        c.execute('INSERT INTO groups (name) VALUES (?)', (name,))
        group_id = c.lastrowid
        logger.info(f"ID новой группы: {group_id}")

        # Добавление участников
        logger.info(f"Добавление участников: {valid_members}")
        for user_id, username in valid_members:
            c.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', (group_id, user_id))
            logger.info(f"Пользователь {username} (ID: {user_id}) добавлен в группу {name} (ID: {group_id})")

        conn.commit()
        conn.close()
        logger.info(f"Группа успешно создана: {name}")
        return jsonify({'success': True}), 201
    except sqlite3.IntegrityError as e:
        conn.close()
        logger.error(f"Ошибка базы данных: {e}")
        return jsonify({'success': False, 'error': 'Группа с таким названием уже существует'}), 400
    except Exception as e:
        conn.close()
        logger.error(f"Ошибка при создании группы: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    try:
        if 'username' not in session:
            logger.warning("Неавторизованный доступ к /api/user/profile")
            return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT username, email FROM users WHERE username = ?', (session['username'],))
        user = c.fetchone()
        conn.close()

        if user:
            return jsonify({
                'success': True,
                'name': user[0],
                'email': user[1]
            }), 200
        logger.warning(f"Пользователь {session['username']} не найден при получении профиля")
        return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
    except Exception as e:
        logger.error(f"Ошибка при получении профиля пользователя: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/contacts', methods=['POST'])
def add_contact():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/contacts POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    data = request.get_json()
    contact_username = data.get('contact_username')

    if not contact_username:
        logger.error("Имя контакта не указано")
        return jsonify({'success': False, 'error': 'Имя контакта обязательно'}), 400

    if contact_username == session['username']:
        logger.error("Попытка добавить себя в контакты")
        return jsonify({'success': False, 'error': 'Нельзя добавить себя в контакты'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Проверка, что контакт существует
        c.execute('SELECT id FROM users WHERE username = ?', (contact_username,))
        contact = c.fetchone()
        if not contact:
            conn.close()
            logger.error(f"Контакт не найден: {contact_username}")
            return jsonify({'success': False, 'error': f'Контакт {contact_username} не найден'}), 404

        contact_id = contact[0]

        # Проверка, что контакт еще не добавлен
        c.execute('SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?', 
                  (session['user_id'], contact_id))
        if c.fetchone():
            conn.close()
            logger.warning(f"Контакт уже добавлен: {contact_username}")
            return jsonify({'success': False, 'error': 'Контакт уже добавлен'}), 400

        # Добавление контакта
        c.execute('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)',
                  (session['user_id'], contact_id))
                  
        # Создаем обратную связь - добавляем текущего пользователя в контакты целевого пользователя
        c.execute('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)',
                  (contact_id, session['user_id']))
                  
        conn.commit()
        conn.close()
        logger.info(f"Контакт добавлен: {contact_username} для пользователя {session['username']} (двусторонняя связь)")
        return jsonify({'success': True, 'message': f'Контакт {contact_username} добавлен'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        logger.error(f"Контакт уже добавлен: {contact_username}")
        return jsonify({'success': False, 'error': 'Контакт уже добавлен'}), 400
    except Exception as e:
        conn.close()
        logger.error(f"Ошибка при добавлении контакта: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/contacts', methods=['GET'])
def get_contacts():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/contacts GET")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''SELECT u.username 
                     FROM contacts c 
                     JOIN users u ON c.contact_id = u.id 
                     WHERE c.user_id = ?''', (session['user_id'],))
        contacts = [row[0] for row in c.fetchall()]
        conn.close()
        logger.info(f"Контакты получены для {session['username']}: {contacts}")
        return jsonify({'success': True, 'contacts': contacts}), 200
    except Exception as e:
        logger.error(f"Ошибка при получении списка контактов: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/contacts/clear', methods=['POST'])
def clear_contacts():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/contacts/clear POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('DELETE FROM contacts WHERE user_id = ?', (session['user_id'],))
        conn.commit()
        conn.close()
        logger.info(f"Список контактов очищен для пользователя {session['username']}")
        return jsonify({'success': True, 'message': 'Список контактов очищен'}), 200
    except Exception as e:
        logger.error(f"Ошибка при очистке списка контактов: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/contacts/remove', methods=['POST'])
def remove_contact():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/contacts/remove POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    data = request.get_json()
    contact_username = data.get('contact_username')

    if not contact_username:
        logger.error("Имя контакта не указано")
        return jsonify({'success': False, 'error': 'Имя контакта обязательно'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Проверка, что контакт существует
        c.execute('SELECT id FROM users WHERE username = ?', (contact_username,))
        contact = c.fetchone()
        if not contact:
            conn.close()
            logger.error(f"Контакт не найден: {contact_username}")
            return jsonify({'success': False, 'error': f'Контакт {contact_username} не найден'}), 404

        contact_id = contact[0]

        # Удаление контакта
        c.execute('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?', 
                  (session['user_id'], contact_id))
        
        # Опционально: удаляем и обратную связь
        c.execute('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?', 
                  (contact_id, session['user_id']))
                  
        conn.commit()
        conn.close()
        logger.info(f"Контакт удален: {contact_username} для пользователя {session['username']}")
        return jsonify({'success': True, 'message': f'Контакт {contact_username} удален'}), 200
    except Exception as e:
        if 'conn' in locals():
            conn.close()
        logger.error(f"Ошибка при удалении контакта: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/messages', methods=['POST'])
def send_message():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/messages POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    data = request.get_json()
    logger.info(f"Полученные данные: {data}")
    if not data:
        logger.error("Отсутствует тело запроса")
        return jsonify({'success': False, 'error': 'Тело запроса отсутствует'}), 400

    target = data.get('target')
    mode = data.get('mode')
    text = data.get('text')
    time = data.get('time')

    logger.info(f"Данные для отправки: target={target}, mode={mode}, text={text}, time={time}, user_id={session.get('user_id')}")

    if not all([target, mode, text, time]):
        logger.error(f"Недостаточно данных для отправки сообщения: {data}")
        return jsonify({'success': False, 'error': 'Все поля обязательны'}), 400

    if mode not in ['contacts', 'groups']:
        logger.error(f"Недопустимый режим: {mode}")
        return jsonify({'success': False, 'error': 'Недопустимый режим'}), 400

    if not isinstance(session.get('user_id'), int):
        logger.error(f"Некорректный user_id: {session.get('user_id')}")
        return jsonify({'success': False, 'error': 'Некорректный идентификатор пользователя'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        if mode == 'contacts':
            # Проверка существования цели
            c.execute('SELECT id FROM users WHERE username = ?', (target,))
            contact = c.fetchone()
            if not contact:
                conn.close()
                logger.error(f"Контакт не найден: {target}")
                return jsonify({'success': False, 'error': f'Контакт {target} не найден'}), 404
                
            contact_id = contact[0]
            
            # Автоматически добавляем контакт в список, если его там еще нет
            c.execute('SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?', 
                      (session['user_id'], contact_id))
            if not c.fetchone():
                # Добавляем контакт в список отправителя
                c.execute('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)',
                          (session['user_id'], contact_id))
                # Добавляем обратную связь - отправителя в список контактов получателя
                c.execute('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)',
                          (contact_id, session['user_id']))
                logger.info(f"Контакт автоматически добавлен: {target} <-> {session['username']}")

            # Получаем имя текущего пользователя (отправителя)
            c.execute('SELECT username FROM users WHERE id = ?', (session['user_id'],))
            sender_username = c.fetchone()[0]
            
            logger.info(f"Попытка вставки сообщения: sender_id={session['user_id']}, receiver_id={contact_id}, target={target}")
            
            # Сохраняем сообщение для отправителя (в его диалоге с получателем)
            c.execute('''INSERT INTO messages (sender_id, receiver_id, target, mode, text, message, time, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                        (session['user_id'], contact_id, target, mode, text, text, time, 'unread'))
            
            # Сохраняем то же сообщение для получателя (в его диалоге с отправителем)
            c.execute('''INSERT INTO messages (sender_id, receiver_id, target, mode, text, message, time, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                        (session['user_id'], contact_id, sender_username, mode, text, text, time, 'unread'))
                        
            logger.info(f"Сообщение сохранено для обоих пользователей: отправитель={sender_username}, получатель={target}")
        
        else:  # mode == 'groups'
            # Проверка существования и членства в группе
            c.execute('SELECT id FROM groups WHERE name = ?', (target,))
            group = c.fetchone()
            if not group:
                conn.close()
                logger.error(f"Группа не найдена: {target}")
                return jsonify({'success': False, 'error': f'Группа {target} не найдена'}), 404
                
            # Проверка членства в группе
            c.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', 
                      (group[0], session['user_id']))
            if not c.fetchone():
                conn.close()
                logger.error(f"Пользователь не в группе: {target}")
                return jsonify({'success': False, 'error': f'Вы не являетесь членом группы {target}'}), 403
                
            # Для групповых сообщений используем один экземпляр сообщения
            logger.info(f"Попытка вставки группового сообщения: sender_id={session['user_id']}, target={target}")
            c.execute('''INSERT INTO messages (sender_id, receiver_id, target, mode, text, message, time, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                        (session['user_id'], 0, target, mode, text, text, time, 'unread'))  # 0 означает групповое сообщение
        
        conn.commit()
        logger.info(f"Сообщение успешно сохранено в базе данных")
        conn.close()
        logger.info(f"Сообщение отправлено: {text} от {session['username']} к {target} ({mode})")
        return jsonify({'success': True}), 201
        
    except Exception as e:
        if 'conn' in locals():
            conn.close()
        logger.error(f"Ошибка при отправке сообщения: {e}")
        return jsonify({'success': False, 'error': f'Ошибка сервера: {str(e)}'}), 500

@app.route('/api/messages', methods=['GET'])
def get_messages():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/messages GET")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    mode = request.args.get('mode')
    target = request.args.get('target')
    since = request.args.get('since')

    if not mode or not target:
        logger.error(f"Недостаточно параметров: mode={mode}, target={target}")
        return jsonify({'success': False, 'error': 'Режим и цель обязательны'}), 400

    if mode not in ['contacts', 'groups']:
        logger.error(f"Недопустимый режим: {mode}")
        return jsonify({'success': False, 'error': 'Недопустимый режим'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Проверка существования цели
        if mode == 'contacts':
            c.execute('SELECT id FROM users WHERE username = ?', (target,))
            contact = c.fetchone()
            if not contact:
                conn.close()
                logger.error(f"Контакт не найден: {target}")
                return jsonify({'success': False, 'error': f'Контакт {target} не найден'}), 404

            # Упрощенный запрос: показываем сообщения, где текущий пользователь видит целевой контакт
            # В нашей схеме БД это значит, что target = целевой контакт в перспективе текущего пользователя
            contact_id = contact[0]
            logger.info(f"Получение сообщений для контакта: {target} (id={contact_id})")

        elif mode == 'groups':
            c.execute('SELECT id FROM groups WHERE name = ?', (target,))
            group = c.fetchone()
            if not group:
                conn.close()
                logger.error(f"Группа не найдена: {target}")
                return jsonify({'success': False, 'error': f'Группа {target} не найдена'}), 404
            # Проверка членства в группе
            c.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', 
                      (group[0], session['user_id']))
            if not c.fetchone():
                conn.close()
                logger.error(f"Пользователь не в группе: {target}")
                return jsonify({'success': False, 'error': f'Вы не являетесь членом группы {target}'}), 403

        # Получение сообщений
        query = '''SELECT m.id, m.text, m.time, m.status, m.sender_id, u.username
                   FROM messages m
                   JOIN users u ON m.sender_id = u.id
                   WHERE m.mode = ?'''
        params = [mode]
        
        if mode == 'contacts':
            # Важное исправление: показываем только сообщения, относящиеся к чату между текущим пользователем
            # и конкретным контактом. Для этого:
            # 1. Сообщение должно быть отправлено либо текущим пользователем контакту,
            #    либо контактом текущему пользователю
            # 2. Фильтруем по полю target, которое должно содержать имя контакта
            query += ''' AND (
                        (m.sender_id = ? AND m.receiver_id = ? AND m.target = ?) OR 
                        (m.sender_id = ? AND m.receiver_id = ? AND m.target = ?)
                      )'''
            params.extend([
                session['user_id'], contact_id, target,  # Я -> Контакт
                contact_id, session['user_id'], session['username']  # Контакт -> Я
            ])
            
            logger.info(f"SQL запрос для личных сообщений: {query} с параметрами {params}")
        else:
            # Для групповых сообщений показываем все сообщения в группе
            query += ' AND m.target = ?'
            params.append(target)
            
        if since:
            query += ' AND m.time > ?'
            params.append(since)
            
        query += ' ORDER BY m.time ASC'  # Сортировка по времени

        c.execute(query, params)
        
        # Отслеживаем уже добавленные сообщения по комбинации отправителя, текста и времени
        seen_messages = set()
        messages = []
        
        for row in c.fetchall():
            msg_id, text, time, status, sender_id, sender_name = row
            # Создаем уникальный ключ для сообщения на основе отправителя, текста и времени
            msg_key = f"{sender_id}:{text}:{time}"
            
            # Если это сообщение не было добавлено ранее
            if msg_key not in seen_messages:
                seen_messages.add(msg_key)
                messages.append({
                    'text': text,
                    'time': time,
                    'status': status,
                    'isSent': sender_id == session['user_id'],
                    'sender': sender_name
                })

        # Обновление статуса сообщений на "прочитано"
        c.execute('''UPDATE messages SET status = 'read'
                     WHERE mode = ? AND target = ? AND sender_id != ? AND status = 'unread' ''',
                  (mode, target, session['user_id']))
        conn.commit()
        conn.close()

        logger.info(f"Сообщения получены для {mode}/{target}: {len(messages)} сообщений")
        return jsonify({'success': True, 'messages': messages}), 200
    except Exception as e:
        conn.close()
        logger.error(f"Ошибка при получении сообщений: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Выход выполнен успешно'}), 200

@app.route('/api/groups/clear', methods=['POST'])
def clear_groups():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/groups/clear POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Получаем список ID групп пользователя
        c.execute('''SELECT group_id FROM group_members 
                     WHERE user_id = ?''', (session['user_id'],))
        group_ids = [row[0] for row in c.fetchall()]
        
        # Удаляем пользователя из всех групп
        c.execute('DELETE FROM group_members WHERE user_id = ?', (session['user_id'],))
        
        # Удаляем группы, в которых не осталось участников
        for group_id in group_ids:
            c.execute('SELECT COUNT(*) FROM group_members WHERE group_id = ?', (group_id,))
            count = c.fetchone()[0]
            if count == 0:
                c.execute('DELETE FROM groups WHERE id = ?', (group_id,))
                logger.info(f"Группа {group_id} удалена, так как в ней не осталось участников")
        
        conn.commit()
        conn.close()
        logger.info(f"Пользователь {session['username']} покинул все группы")
        return jsonify({'success': True, 'message': 'Вы покинули все группы'}), 200
    except Exception as e:
        logger.error(f"Ошибка при очистке списка групп: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/groups/members', methods=['GET'])
def get_group_members():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/groups/members GET")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    group_name = request.args.get('group')
    if not group_name:
        logger.error("Имя группы не указано")
        return jsonify({'success': False, 'error': 'Имя группы обязательно'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Получаем ID группы
        c.execute('SELECT id FROM groups WHERE name = ?', (group_name,))
        group = c.fetchone()
        if not group:
            conn.close()
            logger.error(f"Группа не найдена: {group_name}")
            return jsonify({'success': False, 'error': f'Группа {group_name} не найдена'}), 404
            
        group_id = group[0]
        
        # Проверяем, является ли пользователь участником группы
        c.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', 
                  (group_id, session['user_id']))
        if not c.fetchone():
            conn.close()
            logger.error(f"Пользователь не в группе: {group_name}")
            return jsonify({'success': False, 'error': f'Вы не являетесь членом группы {group_name}'}), 403
            
        # Получаем список участников группы
        c.execute('''SELECT u.username 
                     FROM group_members gm 
                     JOIN users u ON gm.user_id = u.id 
                     WHERE gm.group_id = ?''', (group_id,))
        members = [row[0] for row in c.fetchall()]
        
        conn.close()
        logger.info(f"Получен список участников группы {group_name}: {members}")
        return jsonify({'success': True, 'members': members}), 200
    except Exception as e:
        if 'conn' in locals():
            conn.close()
        logger.error(f"Ошибка при получении участников группы: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/groups/rename', methods=['POST'])
def rename_group():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/groups/rename POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    data = request.get_json()
    old_name = data.get('oldName')
    new_name = data.get('newName')

    if not old_name or not new_name:
        logger.error("Не указаны старое или новое имя группы")
        return jsonify({'success': False, 'error': 'Оба имени группы обязательны'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Получаем ID группы
        c.execute('SELECT id FROM groups WHERE name = ?', (old_name,))
        group = c.fetchone()
        if not group:
            conn.close()
            logger.error(f"Группа не найдена: {old_name}")
            return jsonify({'success': False, 'error': f'Группа {old_name} не найдена'}), 404
            
        group_id = group[0]
        
        # Проверяем, является ли пользователь участником группы
        c.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', 
                  (group_id, session['user_id']))
        if not c.fetchone():
            conn.close()
            logger.error(f"Пользователь не в группе: {old_name}")
            return jsonify({'success': False, 'error': f'Вы не являетесь членом группы {old_name}'}), 403
        
        # Проверяем, не существует ли уже группа с новым именем
        c.execute('SELECT 1 FROM groups WHERE name = ? AND id != ?', (new_name, group_id))
        if c.fetchone():
            conn.close()
            logger.error(f"Группа с именем {new_name} уже существует")
            return jsonify({'success': False, 'error': f'Группа с именем {new_name} уже существует'}), 400
            
        # Переименовываем группу
        c.execute('UPDATE groups SET name = ? WHERE id = ?', (new_name, group_id))
        
        # Обновляем поле target в сообщениях
        c.execute('UPDATE messages SET target = ? WHERE target = ? AND mode = "groups"', 
                  (new_name, old_name))
        
        conn.commit()
        conn.close()
        logger.info(f"Группа {old_name} переименована в {new_name}")
        return jsonify({'success': True}), 200
    except Exception as e:
        if 'conn' in locals():
            conn.close()
        logger.error(f"Ошибка при переименовании группы: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/groups/delete', methods=['POST'])
def delete_group():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/groups/delete POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    data = request.get_json()
    group_name = data.get('name')

    if not group_name:
        logger.error("Имя группы не указано")
        return jsonify({'success': False, 'error': 'Имя группы обязательно'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Получаем ID группы
        c.execute('SELECT id FROM groups WHERE name = ?', (group_name,))
        group = c.fetchone()
        if not group:
            conn.close()
            logger.error(f"Группа не найдена: {group_name}")
            return jsonify({'success': False, 'error': f'Группа {group_name} не найдена'}), 404
            
        group_id = group[0]
        
        # Проверяем, является ли пользователь участником группы
        c.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', 
                  (group_id, session['user_id']))
        if not c.fetchone():
            conn.close()
            logger.error(f"Пользователь не в группе: {group_name}")
            return jsonify({'success': False, 'error': f'Вы не являетесь членом группы {group_name}'}), 403
            
        # Удаляем группу и связанные данные
        c.execute('DELETE FROM group_members WHERE group_id = ?', (group_id,))
        c.execute('DELETE FROM groups WHERE id = ?', (group_id,))
        c.execute('DELETE FROM messages WHERE target = ? AND mode = "groups"', (group_name,))
        
        conn.commit()
        conn.close()
        logger.info(f"Группа {group_name} удалена")
        return jsonify({'success': True}), 200
    except Exception as e:
        if 'conn' in locals():
            conn.close()
        logger.error(f"Ошибка при удалении группы: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/groups/members/add', methods=['POST'])
def add_members_to_group():
    if 'username' not in session or 'user_id' not in session:
        logger.warning("Неавторизованный доступ к /api/groups/members/add POST")
        return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401

    data = request.get_json()
    group_name = data.get('group')
    new_members = data.get('members', [])

    if not group_name:
        logger.error("Имя группы не указано")
        return jsonify({'success': False, 'error': 'Имя группы обязательно'}), 400
    
    if not new_members:
        logger.error("Не указаны новые участники")
        return jsonify({'success': False, 'error': 'Должен быть хотя бы один новый участник'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Получаем ID группы
        c.execute('SELECT id FROM groups WHERE name = ?', (group_name,))
        group = c.fetchone()
        if not group:
            conn.close()
            logger.error(f"Группа не найдена: {group_name}")
            return jsonify({'success': False, 'error': f'Группа {group_name} не найдена'}), 404
            
        group_id = group[0]
        
        # Проверяем, является ли пользователь участником группы
        c.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', 
                  (group_id, session['user_id']))
        if not c.fetchone():
            conn.close()
            logger.error(f"Пользователь не в группе: {group_name}")
            return jsonify({'success': False, 'error': f'Вы не являетесь членом группы {group_name}'}), 403
        
        # Получаем ID новых участников
        placeholders = ','.join('?' * len(new_members))
        query = f'SELECT id, username FROM users WHERE LOWER(username) IN ({placeholders})'
        c.execute(query, [m.lower() for m in new_members])
        valid_members = c.fetchall()
        
        # Проверяем, какие пользователи не найдены
        valid_usernames = [row[1] for row in valid_members]
        invalid_members = [m for m in new_members if m.lower() not in [vm.lower() for vm in valid_usernames]]
        if invalid_members:
            logger.error(f"Пользователи не найдены: {invalid_members}")
            conn.close()
            return jsonify({'success': False, 'error': f'Пользователи не найдены: {", ".join(invalid_members)}'}), 400
        
        # Добавляем новых участников
        added_count = 0
        for user_id, username in valid_members:
            # Проверяем, не является ли пользователь уже участником группы
            c.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', 
                      (group_id, user_id))
            if not c.fetchone():
                c.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', 
                          (group_id, user_id))
                added_count += 1
                logger.info(f"Пользователь {username} добавлен в группу {group_name}")
        
        conn.commit()
        conn.close()
        
        if added_count > 0:
            logger.info(f"Добавлено {added_count} новых участников в группу {group_name}")
            return jsonify({'success': True, 'added_count': added_count}), 200
        else:
            logger.info(f"Новые участники не были добавлены в группу {group_name} (уже являются участниками)")
            return jsonify({'success': True, 'added_count': 0, 'message': 'Все указанные пользователи уже являются участниками группы'}), 200
    except Exception as e:
        if 'conn' in locals():
            conn.close()
        logger.error(f"Ошибка при добавлении участников в группу: {e}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/messages/deleteForAll', methods=['POST'])
def delete_message_for_all():
    if 'username' not in session or 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Не авторизован'})

    data = request.get_json()
    if not data or 'mode' not in data or 'target' not in data or 'time' not in data or 'text' not in data:
        return jsonify({'success': False, 'error': 'Неверные параметры запроса'})

    mode = data['mode']
    target = data['target']
    time = data['time']
    text = data['text']
    
    sender_username = session['username']
    
    conn = sqlite3.connect(DB_PATH)
    
    try:
        # Для личных сообщений
        if mode == 'contacts':
            # Удаляем сообщение из базы данных
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM messages WHERE (sender_username = ? AND receiver_username = ? AND message_time = ? AND message_text = ?) OR (sender_username = ? AND receiver_username = ? AND message_time = ? AND message_text = ?)",
                (sender_username, target, time, text, target, sender_username, time, text)
            )
            conn.commit()
            cursor.close()
            
            return jsonify({'success': True, 'message': 'Сообщение удалено у всех'})
        
        # Для групповых сообщений
        elif mode == 'groups':
            # Находим ID группы
            cursor = conn.cursor()
            cursor.execute("SELECT group_id FROM groups WHERE name = ?", (target,))
            group_data = cursor.fetchone()
            
            if not group_data:
                cursor.close()
                return jsonify({'success': False, 'error': 'Группа не найдена'})
            
            group_id = group_data[0]
            
            # Удаляем сообщение из группового чата
            cursor.execute(
                "DELETE FROM group_messages WHERE group_id = ? AND sender_username = ? AND message_time = ? AND message_text = ?",
                (group_id, sender_username, time, text)
            )
            conn.commit()
            cursor.close()
            
            return jsonify({'success': True, 'message': 'Сообщение удалено из группы'})
        
        else:
            return jsonify({'success': False, 'error': 'Недопустимый режим'})
            
    except Exception as e:
        # В случае ошибки откатываем изменения
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)})
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)