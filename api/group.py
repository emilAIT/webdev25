from flask import Blueprint, jsonify, request, session, send_file
import sqlite3
from datetime import datetime
from io import BytesIO
import os

group_bp = Blueprint('group', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def column_exists(conn, table, column):
    """Check if a column exists in a table"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    return any(col['name'] == column for col in columns)

@group_bp.route('/api/groups', methods=['POST'])
def create_group():
    """Создать новую группу"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    data = request.form
    
    if 'group_name' not in data or not data['group_name'].strip():
        return jsonify({'success': False, 'message': 'Название группы обязательно'}), 400
    
    creator_id = session['user_id']
    group_name = data['group_name'].strip()
    description = data.get('description', '')
    
    # Получаем список пользователей для добавления в группу
    member_ids = request.form.getlist('members[]')
    
    # Проверяем наличие хотя бы одного участника
    if not member_ids:
        return jsonify({'success': False, 'message': 'Необходимо добавить хотя бы одного участника'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Проверяем наличие столбца profile_photo
    has_profile_photo = column_exists(conn, 'group_chats', 'profile_photo')
    
    # Сохраняем фото группы, если есть и если столбец существует
    group_photo = None
    if has_profile_photo and 'group_photo' in request.files:
        photo_file = request.files['group_photo']
        if photo_file.filename:
            group_photo = photo_file.read()
    
    try:
        # Создаем запись в таблице chats
        cursor.execute(
            'INSERT INTO chats (chat_name, chat_type) VALUES (?, ?)',
            (group_name, 'group')
        )
        chat_id = cursor.lastrowid
        
        # Создаем запись в таблице group_chats
        if has_profile_photo:
            cursor.execute(
                'INSERT INTO group_chats (chat_id, admin_id, description, profile_photo) VALUES (?, ?, ?, ?)',
                (chat_id, creator_id, description, group_photo)
            )
        else:
            cursor.execute(
                'INSERT INTO group_chats (chat_id, admin_id, description) VALUES (?, ?, ?)',
                (chat_id, creator_id, description)
            )
            
        group_chat_id = cursor.lastrowid
        
        # Добавляем создателя группы в участники
        cursor.execute(
            'INSERT INTO group_members (group_chat_id, user_id, role) VALUES (?, ?, ?)',
            (group_chat_id, creator_id, 'admin')
        )
        
        # Добавляем выбранных участников
        for member_id in member_ids:
            try:
                member_id = int(member_id)
                # Проверяем, существует ли пользователь
                user_exists = conn.execute('SELECT 1 FROM users WHERE id = ?', (member_id,)).fetchone()
                if user_exists:
                    cursor.execute(
                        'INSERT INTO group_members (group_chat_id, user_id, role) VALUES (?, ?, ?)',
                        (group_chat_id, member_id, 'member')
                    )
            except (ValueError, sqlite3.Error) as e:
                print(f"Ошибка при добавлении участника {member_id}: {e}")
        
        # Добавляем приветственное сообщение в группе
        cursor.execute(
            'INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
            (chat_id, creator_id, f"Группа '{group_name}' создана")
        )
        
        conn.commit()
        
        result = {
            'success': True,
            'group': {
                'id': chat_id,
                'name': group_name,
                'description': description
            }
        }
        
    except Exception as e:
        conn.rollback()
        result = {'success': False, 'message': f'Ошибка при создании группы: {str(e)}'}
    
    conn.close()
    return jsonify(result)

@group_bp.route('/api/groups', methods=['GET'])
def get_user_groups():
    """Получить список групп, в которых состоит пользователь"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    current_user_id = session['user_id']
    
    conn = get_db_connection()
    
    # Получаем группы, в которых состоит пользователь
    groups = conn.execute('''
        SELECT c.id, c.chat_name, gc.id as group_chat_id, 
               gc.description,
               (SELECT COUNT(*) FROM group_members WHERE group_chat_id = gc.id) as member_count,
               (SELECT MAX(timestamp) FROM messages WHERE chat_id = c.id) as last_activity,
               (SELECT content FROM messages WHERE chat_id = c.id ORDER BY timestamp DESC LIMIT 1) as latest_message
        FROM chats c
        JOIN group_chats gc ON c.id = gc.chat_id
        JOIN group_members gm ON gc.id = gm.group_chat_id
        WHERE gm.user_id = ?
        ORDER BY last_activity DESC NULLS LAST
    ''', (current_user_id,)).fetchall()
    
    group_list = []
    for group in groups:
        # Форматируем время последней активности
        timestamp_str = "Нет сообщений"
        timestamp_raw = None
        
        if group['last_activity']:
            timestamp = datetime.strptime(group['last_activity'], '%Y-%m-%d %H:%M:%S')
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
                
            timestamp_raw = group['last_activity']
        
        # Проверяем, есть ли фото у группы
        has_photo = conn.execute('''
            SELECT 1 FROM group_chats
            WHERE id = ? AND profile_photo IS NOT NULL
        ''', (group['group_chat_id'],)).fetchone() is not None
        
        photo_url = f'/api/groups/{group["id"]}/photo' if has_photo else None
        
        group_list.append({
            'id': group['id'],
            'name': group['chat_name'],
            'description': group['description'],
            'member_count': group['member_count'],
            'last_activity': timestamp_str,
            'last_activity_raw': timestamp_raw,
            'latest_message': group['latest_message'] or 'Нет сообщений',
            'unread_count': 0,  # Можно добавить подсчет непрочитанных сообщений позже
            'photo_url': photo_url
        })
    
    conn.close()
    
    return jsonify({
        'success': True,
        'groups': group_list
    })

@group_bp.route('/api/group/<int:group_id>/photo', methods=['GET'])
def get_group_photo(group_id):
    """Получить фото профиля группы"""
    conn = get_db_connection()
    
    # Проверяем наличие столбца profile_photo
    has_profile_photo = column_exists(conn, 'group_chats', 'profile_photo')
    
    if has_profile_photo:
        # Получаем фото группы
        result = conn.execute('''
            SELECT profile_photo 
            FROM group_chats
            WHERE chat_id = ?
        ''', (group_id,)).fetchone()
        
        if result and result['profile_photo']:
            conn.close()
            # Возвращаем фото из базы данных
            return send_file(
                BytesIO(result['profile_photo']),
                mimetype='image/jpeg'
            )
    
    conn.close()
    # Если фото нет или столбец не существует, возвращаем стандартное изображение
    return send_file('static/images/group-default.png', mimetype='image/png')

@group_bp.route('/api/groups/<int:group_id>/members/<int:user_id>/role', methods=['PUT'])
def update_member_role(group_id, user_id):
    """Изменить роль пользователя в группе (сделать админом или понизить)"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    current_user_id = session['user_id']
    data = request.get_json()
    
    if not data or 'role' not in data:
        return jsonify({'success': False, 'message': 'Не указана новая роль'}), 400
    
    new_role = data['role']
    if new_role not in ['admin', 'member']:
        return jsonify({'success': False, 'message': 'Недопустимая роль. Допустимые значения: admin, member'}), 400
    
    conn = get_db_connection()
    
    # Проверяем, существует ли группа
    group = conn.execute('''
        SELECT gc.id, gc.chat_id, gc.admin_id, c.chat_name 
        FROM group_chats gc
        JOIN chats c ON gc.chat_id = c.id
        WHERE gc.chat_id = ?
    ''', (group_id,)).fetchone()
    
    if not group:
        conn.close()
        return jsonify({'success': False, 'message': 'Группа не найдена'}), 404
    
    # Только администраторы могут менять роли
    is_admin = conn.execute('''
        SELECT 1 FROM group_members
        WHERE group_chat_id = ? AND user_id = ? AND role = 'admin'
    ''', (group['id'], current_user_id)).fetchone()
    
    if not is_admin:
        conn.close()
        return jsonify({'success': False, 'message': 'Только администраторы могут менять роли участников'}), 403
    
    # Проверяем, является ли пользователь участником группы
    member = conn.execute('''
        SELECT role FROM group_members
        WHERE group_chat_id = ? AND user_id = ?
    ''', (group['id'], user_id)).fetchone()
    
    if not member:
        conn.close()
        return jsonify({'success': False, 'message': 'Пользователь не является участником группы'}), 404
    
    # Если роль не меняется, то возвращаем успех без изменений
    if member['role'] == new_role:
        conn.close()
        return jsonify({'success': True, 'message': 'Роль пользователя не изменилась'})
    
    # Получаем имя пользователя для сообщения
    user_info = conn.execute('SELECT nickname FROM users WHERE id = ?', (user_id,)).fetchone()
    user_nickname = user_info['nickname'] if user_info else "Пользователь"
    
    try:
        # Обновляем роль пользователя
        conn.execute(
            'UPDATE group_members SET role = ? WHERE group_chat_id = ? AND user_id = ?',
            (new_role, group['id'], user_id)
        )
        
        # Добавляем системное сообщение о изменении роли
        if new_role == 'admin':
            message_text = f"{user_nickname} назначен администратором"
        else:
            message_text = f"{user_nickname} больше не администратор"
            
        conn.execute(
            'INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
            (group_id, current_user_id, message_text)
        )
        
        conn.commit()
        
        result = {
            'success': True,
            'message': f'Роль пользователя изменена на {new_role}'
        }
        
    except Exception as e:
        conn.rollback()
        result = {'success': False, 'message': f'Ошибка при обновлении роли: {str(e)}'}
    
    conn.close()
    return jsonify(result)

@group_bp.route('/api/groups/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
def remove_member(group_id, user_id):
    """Удалить пользователя из группы"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    current_user_id = session['user_id']
    
    # Проверяем, являемся ли мы сами этим пользователем (выход из группы)
    is_self = user_id == current_user_id
    
    conn = get_db_connection()
    
    # Проверяем, существует ли группа
    group = conn.execute('''
        SELECT gc.id, gc.chat_id, gc.admin_id
        FROM group_chats gc
        WHERE gc.chat_id = ?
    ''', (group_id,)).fetchone()
    
    if not group:
        conn.close()
        return jsonify({'success': False, 'message': 'Группа не найдена'}), 404
    
    # Если это не выход из группы, проверяем права администратора
    if not is_self:
        is_admin = conn.execute('''
            SELECT 1 FROM group_members
            WHERE group_chat_id = ? AND user_id = ? AND role = 'admin'
        ''', (group['id'], current_user_id)).fetchone()
        
        if not is_admin:
            conn.close()
            return jsonify({'success': False, 'message': 'Только администраторы могут удалять участников'}), 403
    
    # Проверяем, является ли пользователь участником группы
    is_member = conn.execute('''
        SELECT 1 FROM group_members
        WHERE group_chat_id = ? AND user_id = ?
    ''', (group['id'], user_id)).fetchone()
    
    if not is_member:
        conn.close()
        return jsonify({'success': False, 'message': 'Пользователь не является участником группы'}), 404
    
    # Получаем имя пользователя для сообщения
    user_info = conn.execute('SELECT nickname FROM users WHERE id = ?', (user_id,)).fetchone()
    user_nickname = user_info['nickname'] if user_info else "Пользователь"
    
    try:
        # Удаляем пользователя из группы
        conn.execute('DELETE FROM group_members WHERE group_chat_id = ? AND user_id = ?',
                   (group['id'], user_id))
        
        # Добавляем системное сообщение об удалении участника
        if is_self:
            message_text = f"{user_nickname} покинул группу"
        else:
            message_text = f"{user_nickname} был исключен из группы"
            
        conn.execute(
            'INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
            (group_id, current_user_id, message_text)
        )
        
        conn.commit()
        
        result = {
            'success': True,
            'message': 'Участник удален из группы'
        }
        
    except Exception as e:
        conn.rollback()
        result = {'success': False, 'message': f'Ошибка при удалении участника: {str(e)}'}
    
    conn.close()
    return jsonify(result)

@group_bp.route('/api/groups/<int:group_id>', methods=['GET'])
def get_group_info(group_id):
    """Получить информацию о группе и ее участниках"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    current_user_id = session['user_id']
    
    conn = get_db_connection()
    
    # Получаем информацию о группе
    group = conn.execute('''
        SELECT gc.id, gc.chat_id, gc.admin_id, c.chat_name, gc.description 
        FROM group_chats gc
        JOIN chats c ON gc.chat_id = c.id
        WHERE gc.chat_id = ?
    ''', (group_id,)).fetchone()
    
    if not group:
        conn.close()
        return jsonify({'success': False, 'message': 'Группа не найдена'}), 404
    
    # Проверяем, является ли пользователь участником группы
    user_role = conn.execute('''
        SELECT role FROM group_members
        WHERE group_chat_id = ? AND user_id = ?
    ''', (group['id'], current_user_id)).fetchone()
    
    if not user_role:
        conn.close()
        return jsonify({'success': False, 'message': 'У вас нет доступа к этой группе'}), 403
    
    # Получаем информацию о всех участниках группы
    members = conn.execute('''
        SELECT u.id, u.nickname, gm.role, gm.joined_at
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_chat_id = ?
        ORDER BY CASE WHEN gm.role = 'admin' THEN 0 ELSE 1 END, gm.joined_at ASC
    ''', (group['id'],)).fetchall()
    
    member_list = []
    for member in members:
        # Проверяем, есть ли фото у пользователя
        has_photo = conn.execute('''
            SELECT 1 FROM users
            WHERE id = ? AND profile_photo IS NOT NULL
        ''', (member['id'],)).fetchone() is not None
        
        member_list.append({
            'id': member['id'],
            'nickname': member['nickname'],
            'role': member['role'],
            'joined_at': member['joined_at'],
            'photo_url': f'/api/users/{member["id"]}/photo' if has_photo else None,
            'is_creator': member['id'] == group['admin_id']
        })
    
    # Проверяем, есть ли фото у группы
    has_photo = conn.execute('''
        SELECT 1 FROM group_chats
        WHERE id = ? AND profile_photo IS NOT NULL
    ''', (group['id'],)).fetchone() is not None
    
    result = {
        'success': True,
        'group': {
            'id': group['chat_id'],
            'name': group['chat_name'],
            'description': group['description'],
            'admin_id': group['admin_id'],
            'members': member_list,
            'member_count': len(member_list),
            'current_user_role': user_role['role'],
            'photo_url': f'/api/group/{group["chat_id"]}/photo' if has_photo else None
        }
    }
    
    conn.close()
    return jsonify(result)

@group_bp.route('/api/groups/<int:group_id>', methods=['PUT'])
def update_group_info(group_id):
    """Обновить информацию о группе (название, описание)"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    current_user_id = session['user_id']
    data = request.form
    
    conn = get_db_connection()
    
    # Проверяем, существует ли группа
    group = conn.execute('''
        SELECT gc.id, gc.chat_id, gc.admin_id
        FROM group_chats gc
        WHERE gc.chat_id = ?
    ''', (group_id,)).fetchone()
    
    if not group:
        conn.close()
        return jsonify({'success': False, 'message': 'Группа не найдена'}), 404
    
    # Проверяем права пользователя
    is_admin = conn.execute('''
        SELECT 1 FROM group_members
        WHERE group_chat_id = ? AND user_id = ? AND role = 'admin'
    ''', (group['id'], current_user_id)).fetchone()
    
    if not is_admin:
        conn.close()
        return jsonify({'success': False, 'message': 'Только администраторы могут обновлять информацию о группе'}), 403
    
    try:
        # Обновляем название группы, если оно предоставлено
        if 'group_name' in data and data['group_name'].strip():
            conn.execute(
                'UPDATE chats SET chat_name = ? WHERE id = ?',
                (data['group_name'].strip(), group_id)
            )
        
        # Обновляем описание, если оно предоставлено
        if 'description' in data:
            conn.execute(
                'UPDATE group_chats SET description = ? WHERE chat_id = ?',
                (data['description'], group_id)
            )
        
        # Обновляем фото группы, если оно предоставлено
        if 'group_photo' in request.files:
            photo_file = request.files['group_photo']
            if photo_file.filename:
                group_photo = photo_file.read()
                conn.execute(
                    'UPDATE group_chats SET profile_photo = ? WHERE chat_id = ?',
                    (group_photo, group_id)
                )
        
        conn.commit()
        
        result = {
            'success': True,
            'message': 'Информация о группе обновлена'
        }
        
    except Exception as e:
        conn.rollback()
        result = {'success': False, 'message': f'Ошибка при обновлении информации: {str(e)}'}
    
    conn.close()
    return jsonify(result)
