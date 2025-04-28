import bcrypt
import sqlite3
from flask import Blueprint, request, jsonify, session
import base64
import secrets
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

# Конфигурация для отправки email
EMAIL_HOST = "smtp.gmail.com"  # Замените на свой SMTP сервер
EMAIL_PORT = 587
EMAIL_USER = os.environ.get("EMAIL_USER", "corpwazzup@gmail.com")  # Используйте переменную окружения
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "awtd mzll eylg rnts")  # Используйте переменную окружения

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def generate_verification_code(length=6):
    """Generate a random verification code"""
    alphabet = string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def send_verification_email(email, code):
    """Send verification code via email"""
    try:
        # Создаем объект сообщения
        message = MIMEMultipart()
        message["From"] = EMAIL_USER
        message["To"] = email
        message["Subject"] = "Код верификации для WhatsApp"
        
        # Создаем содержание письма
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
              <h1 style="color: #128C7E;">Подтверждение регистрации</h1>
              <p>Здравствуйте!</p>
              <p>Ваш код подтверждения для регистрации в WhatsApp:</p>
              <div style="background-color: #128C7E; color: white; font-size: 24px; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
                <strong>{code}</strong>
              </div>
              <p>Код действителен в течение 10 минут.</p>
              <p>Если вы не запрашивали этот код, проигнорируйте это письмо.</p>
              <p>С уважением,<br>Команда WhatsApp</p>
            </div>
          </body>
        </html>
        """
        
        # Добавляем текст и HTML-версию в письмо
        text_part = MIMEText("Ваш код подтверждения: " + code, "plain")
        html_part = MIMEText(html, "html")
        
        message.attach(text_part)
        message.attach(html_part)
        
        # Подключаемся к SMTP серверу и отправляем email
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()  # Шифруем соединение
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

@auth_bp.route('/check-nickname', methods=['POST'])
def check_nickname():
    data = request.get_json()
    
    if not data or 'nickname' not in data:
        return jsonify({"available": False, "message": "Никнейм не указан"}), 400
    
    nickname = data['nickname']
    
    conn = get_db_connection()
    existing_user = conn.execute('SELECT id FROM users WHERE nickname = ?', 
                                (nickname,)).fetchone()
    conn.close()
    
    if existing_user:
        return jsonify({"available": False, "message": "Никнейм уже занят"})
    else:
        return jsonify({"available": True, "message": "Никнейм доступен"})

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    # Проверяем формат данных - JSON или form-data
    if request.is_json:
        data = request.get_json()
        nickname = data.get('nickname')
        email = data.get('email')
        password = data.get('password')
        verification_code = data.get('verificationCode')
        profile_photo_data = None  # JSON не может содержать файлы
    else:
        nickname = request.form.get('nickname')
        email = request.form.get('email', '')
        password = request.form.get('password')
        verification_code = request.form.get('verificationCode')
        
        # Обработка фото профиля из form-data
        profile_photo_data = None
        if 'profile_photo' in request.files:
            profile_photo = request.files['profile_photo']
            if profile_photo.filename:
                profile_photo_data = profile_photo.read()
    
    # Проверка обязательных полей
    if not nickname or not password:
        return jsonify({"success": False, "message": "Необходимо заполнить все поля"}), 400
    
    # Проверка длины пароля
    if len(password) < 6:
        return jsonify({"success": False, "message": "Пароль должен содержать не менее 6 символов"}), 400
    
    # Проверка кода верификации, если указан email
    if email:
        verification = session.get('verification')
        if verification_code:
            # Полная верификация с кодом
            if not verification or verification.get('email') != email or verification.get('code') != verification_code:
                return jsonify({"success": False, "message": "Неверный код верификации"}), 400
            
            # Проверка срока действия кода
            try:
                expiry_time = datetime.fromisoformat(verification['expiry'])
                if datetime.now() > expiry_time:
                    return jsonify({"success": False, "message": "Срок действия кода истёк"}), 400
            except (KeyError, ValueError):
                return jsonify({"success": False, "message": "Ошибка проверки кода верификации"}), 400
    
    # Проверка, существует ли пользователь с таким именем или email
    conn = get_db_connection()
    if email:
        existing_user = conn.execute('SELECT id FROM users WHERE nickname = ? OR email = ?', 
                                    (nickname, email)).fetchone()
    else:
        existing_user = conn.execute('SELECT id FROM users WHERE nickname = ?', 
                                    (nickname,)).fetchone()
    
    if existing_user:
        conn.close()
        return jsonify({"success": False, "message": "Пользователь с таким именем или email уже существует"}), 409
    
    # Хэширование пароля и создание пользователя
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Добавляем пользователя
    try:
        if email:
            # Если есть email, проверяем верификацию
            is_verified = 1 if verification_code else 0
            conn.execute(
                'INSERT INTO users (nickname, email, password, profile_photo, is_verified) VALUES (?, ?, ?, ?, ?)',
                (nickname, email, hashed_password, profile_photo_data, is_verified)
            )
        else:
            # Если нет email, просто добавляем пользователя
            conn.execute(
                'INSERT INTO users (nickname, password, profile_photo) VALUES (?, ?, ?)',
                (nickname, hashed_password, profile_photo_data)
            )
        
        conn.commit()
        
        # Получение ID нового пользователя для сессии
        user_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Сохраняем данные пользователя в сессию для автоматического входа
        session['user_id'] = user_id
        session['nickname'] = nickname
        if email:
            session['email'] = email
            
        # Очищаем данные верификации
        if 'verification' in session:
            del session['verification']
        
        conn.close()
        return jsonify({"success": True, "message": "Регистрация успешна"})
    
    except Exception as e:
        conn.close()
        print(f"Error during registration: {e}")
        return jsonify({"success": False, "message": "Ошибка при регистрации пользователя"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'nickname' not in data or 'password' not in data:
        return jsonify({"success": False, "message": "Не все поля заполнены"}), 400
    
    nickname = data['nickname']
    password = data['password']
    
    conn = get_db_connection()
    user = conn.execute('SELECT id, nickname, password FROM users WHERE nickname = ?', 
                      (nickname,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({"success": False, "message": "Неверный логин или пароль"}), 401
    
    # Проверка пароля
    if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        # Сохраняем данные пользователя в сессию
        session['user_id'] = user['id']
        session['nickname'] = user['nickname']
        session['current_user_name'] = user['nickname']  # Добавляем для быстрого доступа
        
        return jsonify({
            "success": True, 
            "message": "Авторизация успешна",
            "user": {
                "id": user['id'],
                "nickname": user['nickname']
            }
        })
    else:
        return jsonify({"success": False, "message": "Неверный логин или пароль"}), 401

@auth_bp.route('/api/send-verification-code', methods=['POST'])
def send_verification_code():
    """Send verification code to email"""
    data = request.get_json()
    if not data or 'email' not in data:
        return jsonify({"success": False, "detail": "Email не указан"}), 400

    email = data['email']
    
    # Проверка формата email
    if '@' not in email or '.' not in email:
        return jsonify({"success": False, "detail": "Неверный формат email"}), 400
    
    # Проверяем, существует ли таблица users
    try:
        conn = get_db_connection()
        # Проверка существования таблицы
        conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").fetchone()
        
        # Проверяем, не зарегистрирован ли уже этот email
        try:
            existing_email = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
            if existing_email:
                conn.close()
                return jsonify({"success": False, "detail": "Email уже зарегистрирован"}), 409
        except sqlite3.OperationalError as e:
            if "no such column" in str(e):
                # Не хватает столбца email, обновим схему
                conn.close()
                from dbinit import check_and_update_schema
                check_and_update_schema()
                conn = get_db_connection()
    except sqlite3.OperationalError:
        conn.close()
        # Таблицы нет, нужно пересоздать
        from dbinit import force_create_tables
        force_create_tables()
        conn = get_db_connection()
    
    # Генерируем код верификации
    verification_code = generate_verification_code()
    expiry_time = datetime.now() + timedelta(minutes=10)
    
    # Сохраняем код и время истечения в сессии
    session['verification'] = {
        'email': email,
        'code': verification_code,
        'expiry': expiry_time.isoformat()
    }
    
    # Отладочный вывод кода верификации
    print(f"[DEBUG] Verification code for {email}: {verification_code}")
    
    # Отправляем email
    if send_verification_email(email, verification_code):
        conn.close()
        return jsonify({"success": True, "detail": "Код верификации отправлен"})
    else:
        conn.close()
        return jsonify({"success": False, "detail": "Не удалось отправить код верификации"}), 500

@auth_bp.route('/api/ping', methods=['GET'])
def ping():
    """Simple endpoint to keep user session alive"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    # Обновляем timestamp последней активности пользователя в БД
    try:
        conn = get_db_connection()
        conn.execute('UPDATE users SET last_active = ? WHERE id = ?', 
                    (datetime.now().isoformat(), session['user_id']))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error updating user activity: {e}")
    
    return jsonify({"success": True, "message": "Pong"})

@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """Log out the current user"""
    if 'user_id' in session:
        # Очищаем данные пользователя из сессии
        session.pop('user_id', None)
        session.pop('nickname', None)
        session.pop('email', None)
        session.pop('current_user_name', None)
        session.clear()  # Полная очистка сессии
        
        return jsonify({"success": True, "message": "Вы успешно вышли из аккаунта"})
    
    # Если пользователь не был авторизован
    return jsonify({"success": True, "message": "Вы не были авторизованы"})
