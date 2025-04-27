from flask import Blueprint, jsonify, request, session
import sqlite3
from datetime import datetime

chat_bp = Blueprint('chat', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@chat_bp.route('/api/chats', methods=['GET'])
def get_chats():
    """Получить список чатов текущего пользователя"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    user_id = session['user_id']
    
    conn = get_db_connection()
    # Получаем список диалогов пользователя с информацией о последнем сообщении
    chats = conn.execute('''
        SELECT 
            c.id,
            CASE 
                WHEN d.user1_id = ? THEN u2.nickname 
                WHEN d.user2_id = ? THEN u1.nickname
            END as user_name,
            CASE 
                WHEN d.user1_id = ? THEN u2.id 
                WHEN d.user2_id = ? THEN u1.id
            END as other_user_id,
            m.content as last_message_content,
            m.timestamp as last_message_time,
            (SELECT COUNT(*) FROM messages 
             WHERE chat_id = c.id 
             AND sender_id != ? 
             AND timestamp > (SELECT COALESCE(
                 (SELECT MAX(timestamp) FROM messages WHERE chat_id = c.id AND sender_id = ?), 
                 '1970-01-01'))
            ) as unread_count
        FROM chats c
        JOIN dialogs d ON c.id = d.chat_id
        JOIN users u1 ON d.user1_id = u1.id
        JOIN users u2 ON d.user2_id = u2.id
        LEFT JOIN (
            SELECT m1.* 
            FROM messages m1
            JOIN (
                SELECT chat_id, MAX(timestamp) as max_timestamp 
                FROM messages 
                GROUP BY chat_id
            ) m2 ON m1.chat_id = m2.chat_id AND m1.timestamp = m2.max_timestamp
        ) m ON c.id = m.chat_id
        WHERE d.user1_id = ? OR d.user2_id = ?
        ORDER BY m.timestamp DESC NULLS LAST
    ''', (user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id)).fetchall()
    
    chat_list = []
    for chat in chats:
        # Получаем фото другого пользователя
        other_user_id = chat['other_user_id']
        user_photo = conn.execute('SELECT profile_photo FROM users WHERE id = ?', (other_user_id,)).fetchone()
        
        photo_url = None
        if user_photo and user_photo['profile_photo']:
            # Если есть фото, формируем URL для его получения
            photo_url = f'/api/users/{other_user_id}/photo'
            
        # Форматируем последнее сообщение
        timestamp_str = "Нет сообщений"
        timestamp_raw = None
        latest_message = "Нет сообщений"
        
        if chat['last_message_content']:
            latest_message = chat['last_message_content']
            
            # Форматируем время сообщения
            timestamp = datetime.strptime(chat['last_message_time'], '%Y-%m-%d %H:%M:%S')
            now = datetime.now()
            diff = now - timestamp
            
            if diff.days > 0:
                if diff.days == 1:
                    timestamp_str = "Вчера"
                else:
                    timestamp_str = f"{diff.days} дн. назад"
            elif diff.seconds >= 3600:
                hours = diff.seconds // 3600
                timestamp_str = f"{hours} ч. назад"
            elif diff.seconds >= 60:
                minutes = diff.seconds // 60
                timestamp_str = f"{minutes} мин. назад"
            else:
                timestamp_str = "Сейчас"
                
            timestamp_raw = chat['last_message_time']
        
        chat_list.append({
            'id': chat['id'],
            'user_name': chat['user_name'],
            'user_photo': photo_url,
            'latest_message': latest_message,
            'timestamp': timestamp_str,
            'timestamp_raw': timestamp_raw,
            'unread': chat['unread_count'] > 0
        })
    
    conn.close()
    
    return jsonify({'success': True, 'chats': chat_list})

@chat_bp.route('/api/chats', methods=['POST'])
def create_chat():
    """Создать новый чат с пользователем"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    current_user_id = session['user_id']
    data = request.get_json()
    
    if not data or 'user_id' not in data:
        return jsonify({'success': False, 'message': 'Не указан ID пользователя'}), 400
    
    other_user_id = data['user_id']
    
    # Проверяем, что такой пользователь существует
    conn = get_db_connection()
    user = conn.execute('SELECT id FROM users WHERE id = ?', (other_user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    
    # Проверяем, существует ли уже чат между этими пользователями
    existing_chat = conn.execute('''
        SELECT c.id FROM chats c
        JOIN dialogs d ON c.id = d.chat_id
        WHERE (d.user1_id = ? AND d.user2_id = ?) OR (d.user1_id = ? AND d.user2_id = ?)
    ''', (current_user_id, other_user_id, other_user_id, current_user_id)).fetchone()
    
    if existing_chat:
        # Если чат уже существует, возвращаем его
        chat_id = existing_chat['id']
    else:
        # Создаем новый чат и диалог
        cursor = conn.cursor()
        cursor.execute('INSERT INTO chats (chat_type) VALUES (?)', ('dialog',))
        chat_id = cursor.lastrowid
        
        cursor.execute('INSERT INTO dialogs (chat_id, user1_id, user2_id) VALUES (?, ?, ?)',
                     (chat_id, current_user_id, other_user_id))
        
        conn.commit()
    
    # Получаем информацию о чате для ответа
    other_user = conn.execute('SELECT nickname, profile_photo FROM users WHERE id = ?', 
                           (other_user_id,)).fetchone()
    
    photo_url = None
    if other_user and other_user['profile_photo']:
        photo_url = f'/api/users/{other_user_id}/photo'
    
    chat_info = {
        'id': chat_id,
        'user_name': other_user['nickname'],
        'user_photo': photo_url,
        'latest_message': 'Нет сообщений',
        'timestamp': 'Сейчас',
        'unread': False
    }
    
    conn.close()
    
    return jsonify({'success': True, 'chat': chat_info})

@chat_bp.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
def get_messages(chat_id):
    """Получить сообщения для указанного чата"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    user_id = session['user_id']
    
    # Проверяем, что пользователь является участником этого чата
    conn = get_db_connection()
    is_member = conn.execute('''
        SELECT 1 FROM dialogs 
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, user_id, user_id)).fetchone()
    
    if not is_member:
        conn.close()
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    # Получаем сообщения чата
    messages = conn.execute('''
        SELECT m.id, m.content, m.sender_id, u.nickname as sender_name, m.timestamp
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.timestamp ASC
    ''', (chat_id,)).fetchall()
    
    message_list = []
    for msg in messages:
        message_list.append({
            'id': msg['id'],
            'content': msg['content'],
            'sender_id': msg['sender_id'],
            'sender_name': msg['sender_name'],
            'timestamp': datetime.strptime(msg['timestamp'], '%Y-%m-%d %H:%M:%S').strftime('%H:%M'),
            'timestamp_raw': msg['timestamp'],
            'is_sent_by_me': msg['sender_id'] == user_id
        })
    
    conn.close()
    
    return jsonify({'success': True, 'messages': message_list})

@chat_bp.route('/api/chats/<int:chat_id>/messages', methods=['POST'])
def create_message(chat_id):
    """Создать новое сообщение в чате"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    user_id = session['user_id']
    data = request.get_json()
    
    if not data or 'content' not in data:
        return jsonify({'success': False, 'message': 'Не указано содержимое сообщения'}), 400
    
    content = data['content']
    
    # Проверяем, что пользователь является участником этого чата
    conn = get_db_connection()
    is_member = conn.execute('''
        SELECT 1 FROM dialogs 
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, user_id, user_id)).fetchone()
    
    if not is_member:
        conn.close()
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    # Создаем новое сообщение
    cursor = conn.cursor()
    cursor.execute('INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
                 (chat_id, user_id, content))
    message_id = cursor.lastrowid
    conn.commit()
    
    # Получаем созданное сообщение для ответа
    message = conn.execute('''
        SELECT m.id, m.content, m.sender_id, u.nickname as sender_name, m.timestamp
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
    ''', (message_id,)).fetchone()
    
    conn.close()
    
    message_info = {
        'id': message['id'],
        'content': message['content'],
        'sender_id': message['sender_id'],
        'sender_name': message['sender_name'],
        'timestamp': datetime.strptime(message['timestamp'], '%Y-%m-%d %H:%M:%S').strftime('%H:%M'),
        'timestamp_raw': message['timestamp'],
        'is_sent_by_me': True
    }
    
    return jsonify({'success': True, 'message': message_info})

@chat_bp.route('/api/chats/<int:chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    """Удалить чат"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    user_id = session['user_id']
    
    # Проверяем, что пользователь является участником этого чата
    conn = get_db_connection()
    is_member = conn.execute('''
        SELECT 1 FROM dialogs 
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, user_id, user_id)).fetchone()
    
    if not is_member:
        conn.close()
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    
    # Удаляем чат (каскадно удаляются диалоги и сообщения благодаря ON DELETE CASCADE)
    conn.execute('DELETE FROM chats WHERE id = ?', (chat_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Чат удален'})

@chat_bp.route('/api/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    """Удалить сообщение"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    user_id = session['user_id']
    
    conn = get_db_connection()
    # Проверяем, что пользователь является автором сообщения
    message = conn.execute('''
        SELECT m.chat_id, m.sender_id FROM messages m
        WHERE m.id = ?
    ''', (message_id,)).fetchone()
    
    if not message:
        conn.close()
        return jsonify({'success': False, 'message': 'Сообщение не найдено'}), 404
    
    if message['sender_id'] != user_id:
        # Проверяем, может ли пользователь удалить сообщение (только свои сообщения)
        conn.close()
        return jsonify({'success': False, 'message': 'Вы можете удалять только свои сообщения'}), 403
    
    # Удаляем сообщение
    conn.execute('DELETE FROM messages WHERE id = ?', (message_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Сообщение удалено'})

@chat_bp.route('/api/messages/<int:message_id>', methods=['PUT'])
def update_message(message_id):
    """Обновить сообщение"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    user_id = session['user_id']
    data = request.get_json()
    
    if not data or 'content' not in data:
        return jsonify({'success': False, 'message': 'Не указано содержимое сообщения'}), 400
    
    new_content = data['content']
    
    conn = get_db_connection()
    # Проверяем, что пользователь является автором сообщения
    message = conn.execute('''
        SELECT m.chat_id, m.sender_id, m.content FROM messages m
        WHERE m.id = ?
    ''', (message_id,)).fetchone()
    
    if not message:
        conn.close()
        return jsonify({'success': False, 'message': 'Сообщение не найдено'}), 404
    
    if message['sender_id'] != user_id:
        # Проверяем, может ли пользователь обновить сообщение (только свои сообщения)
        conn.close()
        return jsonify({'success': False, 'message': 'Вы можете редактировать только свои сообщения'}), 403
    
    # Обновляем сообщение
    conn.execute('UPDATE messages SET content = ? WHERE id = ?', (new_content, message_id))
    conn.commit()
    
    # Получаем обновленное сообщение для ответа
    updated_message = conn.execute('''
        SELECT m.id, m.content, m.sender_id, u.nickname as sender_name, m.timestamp
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
    ''', (message_id,)).fetchone()
    
    conn.close()
    
    message_info = {
        'id': updated_message['id'],
        'content': updated_message['content'],
        'sender_id': updated_message['sender_id'],
        'sender_name': updated_message['sender_name'],
        'timestamp': datetime.strptime(updated_message['timestamp'], '%Y-%m-%d %H:%M:%S').strftime('%H:%M'),
        'timestamp_raw': updated_message['timestamp'],
        'is_sent_by_me': True,
        'is_edited': True
    }
    
    return jsonify({'success': True, 'message': message_info})
