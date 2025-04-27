from flask import Blueprint, jsonify, session, send_file, request
import sqlite3
from io import BytesIO
import bcrypt

user_bp = Blueprint('user', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@user_bp.route('/api/user/info', methods=['GET'])
def get_user_info():
    """Получает информацию о текущем пользователе"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    conn = get_db_connection()
    user = conn.execute('SELECT id, nickname FROM users WHERE id = ?', 
                      (session['user_id'],)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    
    return jsonify({
        'success': True, 
        'user': {
            'id': user['id'], 
            'nickname': user['nickname'],
            'has_photo': True if get_user_photo_exists(user['id']) else False
        }
    })

@user_bp.route('/api/user/photo', methods=['GET'])
def get_user_photo():
    """Получает фото профиля пользователя"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    conn = get_db_connection()
    result = conn.execute('SELECT profile_photo FROM users WHERE id = ?', 
                        (session['user_id'],)).fetchone()
    conn.close()
    
    if not result or not result['profile_photo']:
        # Если фото нет, возвращаем стандартное изображение
        return send_file('static/images/default-profile.png', mimetype='image/png')
    
    # Возвращаем фото из базы данных
    return send_file(
        BytesIO(result['profile_photo']),
        mimetype='image/jpeg'
    )

def get_user_photo_exists(user_id):
    """Проверяет наличие фото профиля у пользователя"""
    conn = get_db_connection()
    result = conn.execute('SELECT profile_photo FROM users WHERE id = ? AND profile_photo IS NOT NULL', 
                        (user_id,)).fetchone()
    conn.close()
    return result is not None

@user_bp.route('/api/users/search', methods=['GET'])
def search_users():
    """Поиск пользователей по никнейму"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    query = request.args.get('q', '')
    if not query:
        return jsonify({'success': False, 'message': 'Не указан запрос поиска'}), 400
    
    current_user_id = session['user_id']
    
    conn = get_db_connection()
    users = conn.execute('''
        SELECT id, nickname
        FROM users
        WHERE id != ? AND nickname LIKE ?
        ORDER BY nickname
        LIMIT 20
    ''', (current_user_id, f'%{query}%')).fetchall()
    
    result = []
    for user in users:
        # Для каждого пользователя проверяем наличие фото
        has_photo = get_user_photo_exists(user['id'])
        photo_url = f'/api/users/{user["id"]}/photo' if has_photo else None
        
        result.append({
            'id': user['id'],
            'nickname': user['nickname'],
            'photo': photo_url
        })
    
    conn.close()
    
    return jsonify({'success': True, 'users': result})

@user_bp.route('/api/users/<int:user_id>/photo', methods=['GET'])
def get_specific_user_photo(user_id):
    """Получает фото профиля конкретного пользователя"""
    conn = get_db_connection()
    result = conn.execute('SELECT profile_photo FROM users WHERE id = ?', 
                        (user_id,)).fetchone()
    conn.close()
    
    if not result or not result['profile_photo']:
        # Если фото нет, возвращаем стандартное изображение
        return send_file('static/images/default-profile.png', mimetype='image/png')
    
    # Возвращаем фото из базы данных
    return send_file(
        BytesIO(result['profile_photo']),
        mimetype='image/jpeg'
    )

@user_bp.route('/api/user/update-photo', methods=['POST'])
def update_user_photo():
    """Обновляет фотографию профиля пользователя"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    if 'profile_photo' not in request.files:
        return jsonify({'success': False, 'message': 'Файл не найден'}), 400
    
    profile_photo = request.files['profile_photo']
    if not profile_photo.filename:
        return jsonify({'success': False, 'message': 'Файл не выбран'}), 400
    
    # Проверка типа файла
    if not profile_photo.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
        return jsonify({'success': False, 'message': 'Разрешены только изображения (PNG, JPG, GIF)'}), 400
    
    try:
        # Чтение и сохранение изображения
        profile_photo_data = profile_photo.read()
        
        conn = get_db_connection()
        conn.execute('UPDATE users SET profile_photo = ? WHERE id = ?', 
                    (profile_photo_data, session['user_id']))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Фото профиля обновлено'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Ошибка сохранения: {str(e)}'}), 500

@user_bp.route('/api/user/update-password', methods=['POST'])
def update_password():
    """Обновляет пароль пользователя"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    data = request.get_json()
    if not data or 'current_password' not in data or 'new_password' not in data:
        return jsonify({'success': False, 'message': 'Неверные параметры запроса'}), 400
    
    current_password = data['current_password']
    new_password = data['new_password']
    
    # Проверка длины нового пароля
    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'Пароль должен содержать не менее 6 символов'}), 400
    
    conn = get_db_connection()
    user = conn.execute('SELECT password FROM users WHERE id = ?', 
                      (session['user_id'],)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    
    # Проверяем текущий пароль
    if not bcrypt.checkpw(current_password.encode('utf-8'), user['password'].encode('utf-8')):
        conn.close()
        return jsonify({'success': False, 'message': 'Неверный текущий пароль'}), 401
    
    # Хешируем новый пароль
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Обновляем пароль
    conn.execute('UPDATE users SET password = ? WHERE id = ?', 
                (hashed_password, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Пароль успешно обновлен'})

@user_bp.route('/api/users/current', methods=['GET'])
def get_current_user():
    """Получает информацию о текущем авторизованном пользователе"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    conn = get_db_connection()
    user = conn.execute('SELECT id, nickname FROM users WHERE id = ?', 
                      (session['user_id'],)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    
    # Проверка наличия фото
    has_photo = get_user_photo_exists(user['id'])
    photo_url = f'/api/user/photo' if has_photo else None
    
    return jsonify({
        'success': True, 
        'user': {
            'id': user['id'], 
            'nickname': user['nickname'],
            'name': user['nickname'],  # Используем nickname как name для совместимости
            'photo': photo_url
        }
    })
