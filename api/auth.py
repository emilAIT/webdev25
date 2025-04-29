import bcrypt
import sqlite3
from flask import Blueprint, request, jsonify, session
import base64

auth_bp = Blueprint('auth', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

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
    nickname = request.form.get('nickname')
    password = request.form.get('password')
    
    # Проверка полей
    if not nickname or not password:
        return jsonify({"success": False, "message": "Необходимо заполнить все поля"}), 400
    
    if len(password) < 6:
        return jsonify({"success": False, "message": "Пароль должен содержать не менее 6 символов"}), 400
    
    # Проверка, существует ли пользователь с таким именем
    conn = get_db_connection()
    existing_user = conn.execute('SELECT id FROM users WHERE nickname = ?', 
                                (nickname,)).fetchone()
    
    if existing_user:
        conn.close()
        return jsonify({"success": False, "message": "Пользователь с таким именем уже существует"}), 409
    
    # Обработка фото профиля
    profile_photo_data = None
    if 'profile_photo' in request.files:
        profile_photo = request.files['profile_photo']
        if profile_photo.filename:
            # Считываем данные изображения и конвертируем в бинарный формат для сохранения в БД
            profile_photo_data = profile_photo.read()
    
    # Хэширование пароля и создание пользователя
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    conn.execute(
        'INSERT INTO users (nickname, password, profile_photo) VALUES (?, ?, ?)',
        (nickname, hashed_password, profile_photo_data)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Регистрация успешна"})

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
