import sqlite3
from flask import Blueprint, request, jsonify, session, send_file
from io import BytesIO
import os
from datetime import datetime

chat_bp = Blueprint('chat', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@chat_bp.route('/api/chats', methods=['GET'])
def get_user_chats():
    """Get list of all chats for the current user"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Получение личных диалогов пользователя
    dialogs = conn.execute('''
        SELECT c.id as chat_id, c.chat_name, c.chat_type, c.created_at,
               u.id as user_id, u.nickname,
               (SELECT content FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM chats c
        JOIN dialogs d ON c.id = d.chat_id
        JOIN users u ON (d.user1_id = u.id OR d.user2_id = u.id) AND u.id != ?
        WHERE d.user1_id = ? OR d.user2_id = ?
        ORDER BY last_message_time DESC NULLS LAST
    ''', (current_user_id, current_user_id, current_user_id)).fetchall()
    
    # Получение групповых чатов пользователя
    groups = conn.execute('''
        SELECT c.id as chat_id, c.chat_name, c.chat_type, c.created_at,
               gc.id as group_id, gc.description,
               (SELECT content FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM chats c
        JOIN group_chats gc ON c.id = gc.chat_id
        JOIN group_members gm ON gc.id = gm.group_chat_id
        WHERE gm.user_id = ? AND gm.status = 'active'
        ORDER BY last_message_time DESC NULLS LAST
    ''', (current_user_id,)).fetchall()
    
    # Преобразуем результаты в удобный формат
    chats_list = []
    
    for dialog in dialogs:
        chats_list.append({
            "id": dialog['chat_id'],
            "name": dialog['chat_name'] or dialog['nickname'],
            "type": "dialog",
            "participant_id": dialog['user_id'],
            "participant_name": dialog['nickname'],
            "last_message": dialog['last_message'],
            "last_message_time": dialog['last_message_time'],
            "created_at": dialog['created_at']
        })
    
    for group in groups:
        chats_list.append({
            "id": group['chat_id'],
            "name": group['chat_name'],
            "type": "group",
            "group_id": group['group_id'],
            "description": group['description'],
            "last_message": group['last_message'],
            "last_message_time": group['last_message_time'],
            "created_at": group['created_at']
        })
    
    # Сортируем чаты по времени последнего сообщения
    chats_list.sort(
        key=lambda x: x['last_message_time'] if x['last_message_time'] else x['created_at'], 
        reverse=True
    )
    
    conn.close()
    return jsonify({
        "success": True,
        "chats": chats_list
    })

@chat_bp.route('/api/chat/create_dialog', methods=['POST'])
def create_dialog():
    """Create a new dialog between two users"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    data = request.get_json()
    if not data or 'user_id' not in data:
        return jsonify({"success": False, "message": "Не указан ID пользователя"}), 400
    
    current_user_id = session.get('user_id')
    other_user_id = data['user_id']
    
    # Проверяем, что такой пользователь существует
    conn = get_db_connection()
    user = conn.execute('SELECT id, nickname FROM users WHERE id = ?', (other_user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({"success": False, "message": "Пользователь не найден"}), 404
    
    # Проверяем, что диалог с этим пользователем еще не создан
    existing_dialog = conn.execute('''
        SELECT d.id, d.chat_id FROM dialogs d
        WHERE (d.user1_id = ? AND d.user2_id = ?) OR (d.user1_id = ? AND d.user2_id = ?)
    ''', (current_user_id, other_user_id, other_user_id, current_user_id)).fetchone()
    
    if existing_dialog:
        # Диалог уже существует, возвращаем его ID
        chat_id = existing_dialog['chat_id']
        conn.close()
        return jsonify({
            "success": True, 
            "message": "Диалог уже существует", 
            "chat_id": chat_id
        })
    
    try:
        # Создаем новую запись в таблице chats
        conn.execute('INSERT INTO chats (chat_name, chat_type) VALUES (?, ?)', 
                    (None, 'dialog'))
        chat_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Создаем новый диалог
        conn.execute('''
            INSERT INTO dialogs (chat_id, user1_id, user2_id) 
            VALUES (?, ?, ?)
        ''', (chat_id, current_user_id, other_user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Диалог успешно создан",
            "chat_id": chat_id,
            "user": {
                "id": user['id'],
                "nickname": user['nickname']
            }
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при создании диалога: {str(e)}"}), 500

@chat_bp.route('/api/chat/create_group', methods=['POST'])
def create_group():
    """Create a new group chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    # Проверяем, пришли ли данные в JSON или form-data
    if request.is_json:
        data = request.get_json()
        chat_name = data.get('chat_name')
        description = data.get('description', '')
        member_ids = data.get('member_ids', [])
    else:
        chat_name = request.form.get('chat_name')
        description = request.form.get('description', '')
        member_ids = request.form.getlist('member_ids')
    
    if not chat_name:
        return jsonify({"success": False, "message": "Не указано название группы"}), 400
    
    current_user_id = session.get('user_id')
    
    # Проверяем, существуют ли указанные пользователи
    conn = get_db_connection()
    for member_id in member_ids:
        user = conn.execute('SELECT id FROM users WHERE id = ?', (member_id,)).fetchone()
        if not user:
            conn.close()
            return jsonify({"success": False, "message": f"Пользователь с ID {member_id} не найден"}), 404
    
    # Добавляем текущего пользователя в список участников, если его там нет
    if str(current_user_id) not in [str(m) for m in member_ids]:
        member_ids.append(current_user_id)
    
    group_photo_data = None
    if 'group_photo' in request.files:
        group_photo = request.files['group_photo']
        if group_photo.filename:
            group_photo_data = group_photo.read()
    
    try:
        # Создаем новую запись в таблице chats
        conn.execute('INSERT INTO chats (chat_name, chat_type) VALUES (?, ?)', 
                    (chat_name, 'group'))
        chat_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Создаем новую группу
        conn.execute('''
            INSERT INTO group_chats (chat_id, creator_id, description, group_photo) 
            VALUES (?, ?, ?, ?)
        ''', (chat_id, current_user_id, description, group_photo_data))
        group_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Добавляем текущего пользователя как админа
        conn.execute('''
            INSERT INTO group_admins (group_chat_id, user_id, admin_level)
            VALUES (?, ?, ?)
        ''', (group_id, current_user_id, 2))  # 2 - суперадмин/создатель
        
        # Добавляем всех участников
        for member_id in member_ids:
            conn.execute('''
                INSERT INTO group_members (group_chat_id, user_id, invited_by, status)
                VALUES (?, ?, ?, ?)
            ''', (group_id, member_id, current_user_id, 'active'))
        
        conn.commit()
        
        # Создаем системное сообщение о создании группы
        conn.execute('''
            INSERT INTO messages (chat_id, sender_id, content)
            VALUES (?, ?, ?)
        ''', (chat_id, current_user_id, f"Группа '{chat_name}' создана"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Группа успешно создана",
            "chat_id": chat_id,
            "group_id": group_id
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при создании группы: {str(e)}"}), 500

@chat_bp.route('/api/chat/group_photo/<int:group_id>', methods=['GET'])
def get_group_photo(group_id):
    """Get group chat photo"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Проверяем, является ли пользователь участником этой группы
    member = conn.execute('''
        SELECT gm.id FROM group_members gm
        JOIN group_chats gc ON gm.group_chat_id = gc.id
        WHERE gc.id = ? AND gm.user_id = ? AND gm.status = 'active'
    ''', (group_id, current_user_id)).fetchone()
    
    if not member:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к группе"}), 403
    
    # Получаем фото группы
    photo_data = conn.execute('''
        SELECT group_photo FROM group_chats WHERE id = ?
    ''', (group_id,)).fetchone()
    
    conn.close()
    
    if not photo_data or not photo_data['group_photo']:
        # Возвращаем дефолтное изображение для группы
        default_photo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                        'static', 'images', 'default_group.png')
        return send_file(default_photo_path, mimetype='image/png')
    
    return send_file(
        BytesIO(photo_data['group_photo']),
        mimetype='image/jpeg',
        as_attachment=False
    )

@chat_bp.route('/api/chat/<int:chat_id>/messages', methods=['GET'])
def get_chat_messages(chat_id):
    """Get messages for a specific chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    # Получаем параметры запроса
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    after_id = request.args.get('after_id', None, type=int)  # ID сообщения, после которого нужны новые
    
    conn = get_db_connection()
    
    # Проверяем, имеет ли пользователь доступ к чату
    access = False
    
    # Проверяем, является ли это личным диалогом пользователя
    dialog = conn.execute('''
        SELECT id FROM dialogs
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        # Проверяем, является ли пользователь участником группового чата
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к чату"}), 403
    
    # Строим базовую часть запроса
    base_query = '''
        SELECT m.id, m.content, m.sender_id, u.nickname as sender_name,
               m.timestamp, m.is_edited, m.edited_at, 
               m.reply_to, m.media_type, m.forwarded_from,
               (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id) as read_count
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
    '''
    
    params = [chat_id]
    
    # Модификация запроса в зависимости от параметров
    if after_id:
        # Получаем только новые сообщения после определенного ID
        base_query += ' AND m.id > ?'
        params.append(after_id)
        
        # Сортируем по времени (новейшие сверху)
        base_query += ' ORDER BY m.timestamp DESC'
    else:
        # Стандартный запрос с пагинацией
        base_query += ' ORDER BY m.timestamp DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
    
    # Выполняем запрос
    messages = conn.execute(base_query, params).fetchall()
    
    # Преобразуем результаты в удобный формат
    messages_list = []
    for message in messages:
        # Получаем информацию о сообщении, на которое был ответ
        reply_info = None
        if message['reply_to']:
            reply = conn.execute('''
                SELECT m.content, m.sender_id, u.nickname as sender_name
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
            ''', (message['reply_to'],)).fetchone()
            
            if reply:
                reply_info = {
                    "id": message['reply_to'],
                    "content": reply['content'],
                    "sender_id": reply['sender_id'],
                    "sender_name": reply['sender_name']
                }
        
        # Получаем информацию о пересланном сообщении
        forwarded_info = None
        if message['forwarded_from']:
            forwarded = conn.execute('''
                SELECT m.content, m.sender_id, u.nickname as sender_name
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
            ''', (message['forwarded_from'],)).fetchone()
            
            if forwarded:
                forwarded_info = {
                    "id": message['forwarded_from'],
                    "content": forwarded['content'],
                    "sender_id": forwarded['sender_id'],
                    "sender_name": forwarded['sender_name']
                }
        
        messages_list.append({
            "id": message['id'],
            "content": message['content'],
            "sender_id": message['sender_id'],
            "sender_name": message['sender_name'],
            "timestamp": message['timestamp'],
            "is_edited": bool(message['is_edited']),
            "edited_at": message['edited_at'],
            "media_type": message['media_type'],
            "has_media": message['media_type'] is not None,
            "read_count": message['read_count'],
            "reply_to": reply_info,
            "forwarded_from": forwarded_info,
            "is_own": message['sender_id'] == current_user_id
        })
    
    # Отмечаем сообщения как прочитанные (только если это не запрос новых сообщений)
    if not after_id:
        for message in messages:
            # Не отмечаем собственные сообщения
            if message['sender_id'] != current_user_id:
                conn.execute('''
                    INSERT OR IGNORE INTO message_reads (message_id, user_id)
                    VALUES (?, ?)
                ''', (message['id'], current_user_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "messages": messages_list,
        "total": len(messages_list),
        "has_more": len(messages_list) == limit and not after_id  # has_more имеет смысл только при пагинации
    })

@chat_bp.route('/api/chat/media/<int:message_id>', methods=['GET'])
def get_message_media(message_id):
    """Get media content from a specific message"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Получаем информацию о сообщении и проверяем доступ
    message_info = conn.execute('''
        SELECT m.media_content, m.media_type, m.chat_id
        FROM messages m
        WHERE m.id = ?
    ''', (message_id,)).fetchone()
    
    if not message_info or not message_info['media_content']:
        conn.close()
        return jsonify({"success": False, "message": "Медиафайл не найден"}), 404
    
    # Проверяем доступ к чату
    chat_id = message_info['chat_id']
    
    # Проверяем доступ - такой же код, как в get_chat_messages
    access = False
    dialog = conn.execute('''
        SELECT id FROM dialogs WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc 
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к файлу"}), 403
    
    # Определяем тип файла для правильного MIME-типа
    media_type = message_info['media_type']
    mime_type = 'application/octet-stream'  # По умолчанию
    
    if media_type == 'image':
        mime_type = 'image/jpeg'
    elif media_type == 'video':
        mime_type = 'video/mp4'
    elif media_type == 'audio':
        mime_type = 'audio/mpeg'
    
    conn.close()
    
    # Возвращаем медиафайл
    return send_file(
        BytesIO(message_info['media_content']),
        mimetype=mime_type,
        as_attachment=False
    )

@chat_bp.route('/api/chat/<int:chat_id>/send_message', methods=['POST'])
def send_message(chat_id):
    """Send a new message to a chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    # Проверяем, имеет ли пользователь доступ к чату
    conn = get_db_connection()
    access = False
    
    # Проверяем, является ли это личным диалогом пользователя
    dialog = conn.execute('''
        SELECT id FROM dialogs
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        # Проверяем, является ли пользователь участником группового чата
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к чату"}), 403
    
    # Получаем данные сообщения
    content = ''
    if request.is_json:
        data = request.get_json()
        content = data.get('content', '')
        reply_to = data.get('reply_to')
        forwarded_from = data.get('forwarded_from')
    else:
        content = request.form.get('content', '')
        reply_to = request.form.get('reply_to')
        forwarded_from = request.form.get('forwarded_from')
    
    # Обработка медиафайла, если есть
    media_content = None
    media_type = None
    
    if 'media' in request.files:
        media_file = request.files['media']
        if media_file.filename:
            media_content = media_file.read()
            # Определяем тип медиа по расширению файла
            ext = os.path.splitext(media_file.filename)[1].lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif']:
                media_type = 'image'
            elif ext in ['.mp4', '.avi', '.mov']:
                media_type = 'video'
            elif ext in ['.mp3', '.wav', '.ogg']:
                media_type = 'audio'
            else:
                media_type = 'file'
    
    # Проверка на пустое сообщение
    if not content and not media_content:
        conn.close()
        return jsonify({"success": False, "message": "Сообщение не может быть пустым"}), 400
    
    try:
        # Создаем новое сообщение
        conn.execute('''
            INSERT INTO messages (
                chat_id, sender_id, content, 
                media_content, media_type, 
                reply_to, forwarded_from
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            chat_id, current_user_id, content, 
            media_content, media_type, 
            reply_to, forwarded_from
        ))
        
        message_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Получаем информацию о созданном сообщении
        message = conn.execute('''
            SELECT m.id, m.content, m.sender_id, u.nickname as sender_name,
                m.timestamp, m.media_type
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        ''', (message_id,)).fetchone()
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": {
                "id": message['id'],
                "content": message['content'],
                "sender_id": message['sender_id'],
                "sender_name": message['sender_name'],
                "timestamp": message['timestamp'],
                "media_type": message['media_type'],
                "has_media": message['media_type'] is not None,
                "is_own": True
            }
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при отправке сообщения: {str(e)}"}), 500

@chat_bp.route('/api/chat/group_info/<int:group_id>', methods=['GET'])
def get_group_info(group_id):
    """Get detailed information about a group"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Проверяем, является ли пользователь участником этой группы
    member = conn.execute('''
        SELECT gm.id FROM group_members gm
        WHERE gm.group_chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
    ''', (group_id, current_user_id)).fetchone()
    
    if not member:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к группе"}), 403
    
    # Получаем информацию о группе
    group_info = conn.execute('''
        SELECT gc.id, c.chat_name as name, gc.description, gc.creator_id,
               u.nickname as creator_name, c.created_at
        FROM group_chats gc
        JOIN chats c ON gc.chat_id = c.id
        JOIN users u ON gc.creator_id = u.id
        WHERE gc.id = ?
    ''', (group_id,)).fetchone()
    
    if not group_info:
        conn.close()
        return jsonify({"success": False, "message": "Группа не найдена"}), 404
    
    # Проверяем, является ли текущий пользователь администратором
    admin_check = conn.execute('''
        SELECT admin_level FROM group_admins
        WHERE group_chat_id = ? AND user_id = ?
    ''', (group_id, current_user_id)).fetchone()
    
    is_admin = admin_check is not None and admin_check['admin_level'] > 0
    is_creator = admin_check is not None and admin_check['admin_level'] == 2
    
    # Получаем список участников группы
    members = conn.execute('''
        SELECT gm.user_id, u.nickname, 
               COALESCE(ga.admin_level, 0) as admin_level,
               gm.joined_at
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        LEFT JOIN group_admins ga ON gm.group_chat_id = ga.group_chat_id AND gm.user_id = ga.user_id
        WHERE gm.group_chat_id = ? AND gm.status = 'active'
        ORDER BY admin_level DESC, nickname ASC
    ''', (group_id,)).fetchall()
    
    members_list = []
    for member in members:
        members_list.append({
            "user_id": member['user_id'],
            "nickname": member['nickname'],
            "admin_level": member['admin_level'],
            "joined_at": member['joined_at']
        })
    
    conn.close()
    
    return jsonify({
        "success": True,
        "group_info": {
            "id": group_info['id'],
            "name": group_info['name'],
            "description": group_info['description'],
            "creator_id": group_info['creator_id'],
            "creator_name": group_info['creator_name'],
            "created_at": group_info['created_at']
        },
        "members": members_list,
        "current_user_id": current_user_id,
        "is_admin": is_admin,
        "is_creator": is_creator
    })

@chat_bp.route('/api/chat/update_group/<int:group_id>', methods=['POST'])
def update_group(group_id):
    """Update group information"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Проверяем, имеет ли пользователь права администратора
    admin_check = conn.execute('''
        SELECT admin_level FROM group_admins
        WHERE group_chat_id = ? AND user_id = ? AND admin_level > 0
    ''', (group_id, current_user_id)).fetchone()
    
    if not admin_check:
        conn.close()
        return jsonify({"success": False, "message": "Недостаточно прав для изменения группы"}), 403
    
    # Получаем данные для обновления
    name = request.form.get('name')
    description = request.form.get('description', '')
    
    if not name:
        conn.close()
        return jsonify({"success": False, "message": "Название группы не может быть пустым"}), 400
    
    try:
        # Получаем ID чата для этой группы
        chat_id = conn.execute('SELECT chat_id FROM group_chats WHERE id = ?', 
                              (group_id,)).fetchone()['chat_id']
        
        # Обновляем название в таблице chats
        conn.execute('UPDATE chats SET chat_name = ? WHERE id = ?', 
                    (name, chat_id))
        
        # Обновляем описание в таблице group_chats
        conn.execute('UPDATE group_chats SET description = ? WHERE id = ?', 
                    (description, group_id))
        
        # Обновляем фото группы, если оно предоставлено
        if 'group_photo' in request.files:
            group_photo = request.files['group_photo']
            if group_photo.filename:
                group_photo_data = group_photo.read()
                conn.execute('UPDATE group_chats SET group_photo = ? WHERE id = ?', 
                            (group_photo_data, group_id))
        
        conn.commit()
        
        # Создаем системное сообщение об обновлении группы
        conn.execute('''
            INSERT INTO messages (chat_id, sender_id, content)
            VALUES (?, ?, ?)
        ''', (chat_id, current_user_id, f"Информация о группе обновлена"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Группа успешно обновлена"
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при обновлении группы: {str(e)}"}), 500

@chat_bp.route('/api/chat/leave_group/<int:group_id>', methods=['POST'])
def leave_group(group_id):
    """Leave the group"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Проверяем, является ли пользователь участником этой группы
    member = conn.execute('''
        SELECT gm.id FROM group_members gm
        WHERE gm.group_chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
    ''', (group_id, current_user_id)).fetchone()
    
    if not member:
        conn.close()
        return jsonify({"success": False, "message": "Вы не являетесь участником этой группы"}), 403
    
    # Проверяем, является ли пользователь создателем группы
    creator_check = conn.execute('''
        SELECT id FROM group_chats
        WHERE id = ? AND creator_id = ?
    ''', (group_id, current_user_id)).fetchone()
    
    if creator_check:
        conn.close()
        return jsonify({
            "success": False, 
            "message": "Вы являетесь создателем группы и не можете покинуть её. Удалите группу или передайте права администратора."
        }), 400
    
    try:
        # Получаем ID чата для этой группы
        chat_id = conn.execute('SELECT chat_id FROM group_chats WHERE id = ?', 
                              (group_id,)).fetchone()['chat_id']
        
        # Меняем статус участника на 'left'
        conn.execute('''
            UPDATE group_members SET status = 'left'
            WHERE group_chat_id = ? AND user_id = ?
        ''', (group_id, current_user_id))
        
        # Удаляем права администратора, если они были
        conn.execute('''
            DELETE FROM group_admins
            WHERE group_chat_id = ? AND user_id = ?
        ''', (group_id, current_user_id))
        
        # Создаем системное сообщение об уходе из группы
        user_info = conn.execute('SELECT nickname FROM users WHERE id = ?', 
                                (current_user_id,)).fetchone()
        
        conn.execute('''
            INSERT INTO messages (chat_id, sender_id, content)
            VALUES (?, ?, ?)
        ''', (chat_id, current_user_id, f"{user_info['nickname']} покинул(а) группу"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Вы успешно покинули группу"
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при выходе из группы: {str(e)}"}), 500

@chat_bp.route('/api/chat/delete_group/<int:group_id>', methods=['POST'])
def delete_group(group_id):
    """Delete the group - only for creator"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Проверяем, является ли пользователь создателем группы
    creator_check = conn.execute('''
        SELECT id FROM group_chats
        WHERE id = ? AND creator_id = ?
    ''', (group_id, current_user_id)).fetchone()
    
    if not creator_check:
        conn.close()
        return jsonify({"success": False, "message": "Только создатель группы может удалить её"}), 403
    
    try:
        # Получаем ID чата для этой группы
        chat_id = conn.execute('SELECT chat_id FROM group_chats WHERE id = ?', 
                              (group_id,)).fetchone()['chat_id']
        
        # Меняем статус всех участников на 'removed'
        conn.execute('''
            UPDATE group_members SET status = 'removed'
            WHERE group_chat_id = ?
        ''', (group_id,))
        
        # Помечаем чат как удаленный
        conn.execute('UPDATE chats SET is_deleted = 1 WHERE id = ?', (chat_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Группа успешно удалена"
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при удалении группы: {str(e)}"}), 500

@chat_bp.route('/api/chat/remove_member/<int:group_id>', methods=['POST'])
def remove_member(group_id):
    """Remove a member from the group - only for admins"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    data = request.get_json()
    if not data or 'user_id' not in data:
        return jsonify({"success": False, "message": "Не указан ID участника"}), 400
    
    current_user_id = session.get('user_id')
    user_id_to_remove = data['user_id']
    
    conn = get_db_connection()
    
    # Проверяем, имеет ли пользователь права администратора
    admin_check = conn.execute('''
        SELECT admin_level FROM group_admins
        WHERE group_chat_id = ? AND user_id = ? AND admin_level > 0
    ''', (group_id, current_user_id)).fetchone()
    
    if not admin_check:
        conn.close()
        return jsonify({"success": False, "message": "Недостаточно прав для удаления участников"}), 403
    
    # Проверяем, существует ли участник в группе
    member_check = conn.execute('''
        SELECT gm.id, ga.admin_level FROM group_members gm
        LEFT JOIN group_admins ga ON gm.group_chat_id = ga.group_chat_id AND gm.user_id = ga.user_id
        WHERE gm.group_chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
    ''', (group_id, user_id_to_remove)).fetchone()
    
    if not member_check:
        conn.close()
        return jsonify({"success": False, "message": "Участник не найден или уже удален из группы"}), 404
    
    # Проверяем, не пытается ли администратор удалить создателя группы
    target_admin_level = member_check['admin_level'] or 0
    if target_admin_level == 2:  # 2 - уровень создателя группы
        conn.close()
        return jsonify({"success": False, "message": "Невозможно удалить создателя группы"}), 403
    
    # Обычный администратор не может удалить другого администратора
    if target_admin_level == 1 and admin_check['admin_level'] < 2:
        conn.close()
        return jsonify({"success": False, "message": "Нельзя удалить другого администратора"}), 403
    
    try:
        # Получаем ID чата и информацию об участнике
        chat_id = conn.execute('SELECT chat_id FROM group_chats WHERE id = ?', 
                              (group_id,)).fetchone()['chat_id']
        
        user_info = conn.execute('SELECT nickname FROM users WHERE id = ?', 
                                (user_id_to_remove,)).fetchone()
        
        # Меняем статус участника на 'removed'
        conn.execute('''
            UPDATE group_members SET status = 'removed'
            WHERE group_chat_id = ? AND user_id = ?
        ''', (group_id, user_id_to_remove))
        
        # Удаляем права администратора, если они были
        conn.execute('''
            DELETE FROM group_admins
            WHERE group_chat_id = ? AND user_id = ?
        ''', (group_id, user_id_to_remove))
        
        # Создаем системное сообщение об удалении участника
        admin_info = conn.execute('SELECT nickname FROM users WHERE id = ?', 
                                (current_user_id,)).fetchone()
        
        conn.execute('''
            INSERT INTO messages (chat_id, sender_id, content)
            VALUES (?, ?, ?)
        ''', (chat_id, current_user_id, f"{user_info['nickname']} был(а) удален(а) из группы пользователем {admin_info['nickname']}"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Участник успешно удален из группы"
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при удалении участника: {str(e)}"}), 500

@chat_bp.route('/api/chat/toggle_admin/<int:group_id>', methods=['POST'])
def toggle_admin(group_id):
    """Toggle admin status of a group member - only for group creator"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    data = request.get_json()
    if not data or 'user_id' not in data or 'make_admin' not in data:
        return jsonify({"success": False, "message": "Не указаны необходимые данные"}), 400
    
    current_user_id = session.get('user_id')
    target_user_id = data['user_id']
    make_admin = data['make_admin']
    
    conn = get_db_connection()
    
    # Проверяем, является ли пользователь создателем группы
    creator_check = conn.execute('''
        SELECT ga.admin_level FROM group_admins ga
        WHERE ga.group_chat_id = ? AND ga.user_id = ? AND ga.admin_level = 2
    ''', (group_id, current_user_id)).fetchone()
    
    # Админ уровня 2 (создатель) может изменять права администратора
    if not creator_check:
        conn.close()
        return jsonify({"success": False, "message": "Только создатель группы может изменять права администратора"}), 403
    
    # Нельзя изменить свой статус (создатель не может перестать быть создателем)
    if target_user_id == current_user_id:
        conn.close()
        return jsonify({"success": False, "message": "Нельзя изменить свой статус администратора"}), 400
    
    # Проверяем, существует ли участник в группе
    member_check = conn.execute('''
        SELECT id FROM group_members
        WHERE group_chat_id = ? AND user_id = ? AND status = 'active'
    ''', (group_id, target_user_id)).fetchone()
    
    if not member_check:
        conn.close()
        return jsonify({"success": False, "message": "Участник не найден или не находится в группе"}), 404
    
    try:
        # Получаем ID чата для этой группы
        chat_id = conn.execute('SELECT chat_id FROM group_chats WHERE id = ?', 
                              (group_id,)).fetchone()['chat_id']
        
        user_info = conn.execute('SELECT nickname FROM users WHERE id = ?', 
                                (target_user_id,)).fetchone()
        
        if make_admin:
            # Добавляем пользователя как администратора (уровень 1 - обычный администратор)
            conn.execute('''
                INSERT OR REPLACE INTO group_admins (group_chat_id, user_id, admin_level)
                VALUES (?, ?, 1)
            ''', (group_id, target_user_id))
            
            # Создаем системное сообщение о назначении администратора
            conn.execute('''
                INSERT INTO messages (chat_id, sender_id, content)
                VALUES (?, ?, ?)
            ''', (chat_id, current_user_id, f"{user_info['nickname']} назначен(а) администратором группы"))
        else:
            # Удаляем права администратора
            conn.execute('''
                DELETE FROM group_admins
                WHERE group_chat_id = ? AND user_id = ?
            ''', (group_id, target_user_id))
            
            # Создаем системное сообщение о снятии с должности администратора
            conn.execute('''
                INSERT INTO messages (chat_id, sender_id, content)
                VALUES (?, ?, ?)
            ''', (chat_id, current_user_id, f"{user_info['nickname']} больше не является администратором группы"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": f"Статус администратора успешно {'предоставлен' if make_admin else 'удален'}"
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при изменении статуса администратора: {str(e)}"}), 500

@chat_bp.route('/api/chat/search_contacts', methods=['GET'])
def search_contacts():
    """Search for contacts to add to a group"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    query = request.args.get('query', '').strip().lower()
    
    conn = get_db_connection()
    
    # Получаем контакты пользователя (из диалогов)
    sql = '''
        SELECT DISTINCT u.id, u.nickname
        FROM users u
        JOIN dialogs d ON (d.user1_id = u.id OR d.user2_id = u.id)
        WHERE 
            (d.user1_id = ? OR d.user2_id = ?) AND 
            u.id != ?
    '''
    params = [current_user_id, current_user_id, current_user_id]
    
    # Добавляем условие поиска, если запрос не пустой
    if query:
        sql += ' AND LOWER(u.nickname) LIKE ?'
        params.append(f'%{query}%')
    
    contacts = conn.execute(sql, params).fetchall()
    
    contacts_list = []
    for contact in contacts:
        contacts_list.append({
            "id": contact['id'],
            "nickname": contact['nickname']
        })
    
    conn.close()
    
    return jsonify({
        "success": True,
        "contacts": contacts_list
    })

@chat_bp.route('/api/chat/add_members/<int:group_id>', methods=['POST'])
def add_members(group_id):
    """Add new members to a group - only for admins"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    data = request.get_json()
    if not data or 'user_ids' not in data:
        return jsonify({"success": False, "message": "Не указаны ID пользователей"}), 400
    
    current_user_id = session.get('user_id')
    user_ids = data['user_ids']
    
    if not user_ids:
        return jsonify({"success": False, "message": "Список пользователей пуст"}), 400
    
    conn = get_db_connection()
    
    # Проверяем, имеет ли пользователь права администратора
    admin_check = conn.execute('''
        SELECT admin_level FROM group_admins
        WHERE group_chat_id = ? AND user_id = ? AND admin_level > 0
    ''', (group_id, current_user_id)).fetchone()
    
    if not admin_check:
        conn.close()
        return jsonify({"success": False, "message": "Недостаточно прав для добавления участников"}), 403
    
    try:
        # Получаем ID чата для этой группы
        chat_id = conn.execute('SELECT chat_id FROM group_chats WHERE id = ?', 
                              (group_id,)).fetchone()['chat_id']
        
        # Добавляем новых участников
        added_users = []
        for user_id in user_ids:
            # Проверяем, существует ли такой пользователь
            user_check = conn.execute('SELECT id, nickname FROM users WHERE id = ?', 
                                    (user_id,)).fetchone()
            
            if not user_check:
                continue  # Пропускаем несуществующих пользователей
            
            # Проверяем, не является ли пользователь уже участником группы
            member_check = conn.execute('''
                SELECT id FROM group_members 
                WHERE group_chat_id = ? AND user_id = ? AND status = 'active'
            ''', (group_id, user_id)).fetchone()
            
            if member_check:
                continue  # Пользователь уже в группе
                
            # Проверяем, был ли пользователь ранее в группе и просто вышел или был удален
            prev_member = conn.execute('''
                SELECT id, status FROM group_members 
                WHERE group_chat_id = ? AND user_id = ?
            ''', (group_id, user_id)).fetchone()
            
            if prev_member:
                # Если пользователь ранее был в группе, меняем его статус на active
                conn.execute('''
                    UPDATE group_members SET status = 'active', invited_by = ?
                    WHERE group_chat_id = ? AND user_id = ?
                ''', (current_user_id, group_id, user_id))
            else:
                # Добавляем нового участника
                conn.execute('''
                    INSERT INTO group_members (group_chat_id, user_id, invited_by, status)
                    VALUES (?, ?, ?, 'active')
                ''', (group_id, user_id, current_user_id))
            
            added_users.append({
                "id": user_id,
                "nickname": user_check['nickname']
            })
        
        # Создаем системное сообщение о добавлении новых участников
        if added_users:
            added_names = ", ".join([user["nickname"] for user in added_users])
            
            conn.execute('''
                INSERT INTO messages (chat_id, sender_id, content)
                VALUES (?, ?, ?)
            ''', (chat_id, current_user_id, f"В группу добавлены новые участники: {added_names}"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Участники успешно добавлены",
            "added_users": added_users
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при добавлении участников: {str(e)}"}), 500

@chat_bp.route('/api/chat/<int:chat_id>/media', methods=['GET'])
def get_chat_media(chat_id):
    """Get media (photos, videos) from a specific chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    media_type = request.args.get('type', 'image')  # По умолчанию получаем изображения
    
    current_user_id = session.get('user_id')
    
    # Проверяем доступ к чату (такой же код, как в get_chat_messages)
    conn = get_db_connection()
    access = False
    
    # Проверяем, является ли это личным диалогом пользователя
    dialog = conn.execute('''
        SELECT id FROM dialogs
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        # Проверяем, является ли пользователь участником группового чата
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к чату"}), 403
    
    # Получаем медиафайлы из сообщений
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        media_messages = conn.execute('''
            SELECT m.id, m.sender_id, u.nickname as sender_name, m.timestamp
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ? AND m.media_type = ?
            ORDER BY m.timestamp DESC
            LIMIT ? OFFSET ?
        ''', (chat_id, media_type, limit, offset)).fetchall()
        
        result = []
        for message in media_messages:
            result.append({
                "id": message['id'],
                "sender_id": message['sender_id'],
                "sender_name": message['sender_name'],
                "timestamp": message['timestamp'],
                "url": f"/api/chat/media/{message['id']}"
            })
        
        conn.close()
        return jsonify({
            "success": True,
            "media": result,
            "total": len(result),
            "has_more": len(result) == limit
        })
        
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при получении медиафайлов: {str(e)}"}), 500

@chat_bp.route('/api/chat/<int:chat_id>/files', methods=['GET'])
def get_chat_files(chat_id):
    """Get files from a specific chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    # Проверяем доступ к чату (такой же код, как в get_chat_messages)
    conn = get_db_connection()
    access = False
    
    # Проверяем, является ли это личным диалогом пользователя
    dialog = conn.execute('''
        SELECT id FROM dialogs
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        # Проверяем, является ли пользователь участником группового чата
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к чату"}), 403
    
    # Получаем файлы из сообщений
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        file_messages = conn.execute('''
            SELECT m.id, m.sender_id, u.nickname as sender_name, m.timestamp, m.content as file_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ? AND m.media_type = 'file'
            ORDER BY m.timestamp DESC
            LIMIT ? OFFSET ?
        ''', (chat_id, limit, offset)).fetchall()
        
        result = []
        for message in file_messages:
            # Получаем размер файла (в реальном проекте может потребоваться адаптация)
            # Здесь предполагается, что у вас есть способ получить размер файла
            file_size = "Неизвестно"  # В реальном проекте вы бы получали реальный размер
            
            result.append({
                "id": message['id'],
                "sender_id": message['sender_id'],
                "sender_name": message['sender_name'],
                "timestamp": message['timestamp'],
                "name": message['file_name'],
                "size": file_size,
                "url": f"/api/chat/media/{message['id']}"
            })
        
        conn.close()
        return jsonify({
            "success": True,
            "files": result,
            "total": len(result),
            "has_more": len(result) == limit
        })
        
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при получении файлов: {str(e)}"}), 500

@chat_bp.route('/api/chat/<int:chat_id>/links', methods=['GET'])
def get_chat_links(chat_id):
    """Get links from a specific chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    # Проверяем доступ к чату (такой же код, как в get_chat_messages)
    conn = get_db_connection()
    access = False
    
    # Проверяем, является ли это личным диалогом пользователя
    dialog = conn.execute('''
        SELECT id FROM dialogs
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        # Проверяем, является ли пользователь участником группового чата
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к чату"}), 403
    
    # Получаем ссылки из сообщений
    try:
        limit = request.args.get('limit', 50, type=int)  # Увеличиваем лимит до 50
        offset = request.args.get('offset', 0, type=int)
        
        # Получаем все сообщения из чата
        messages = conn.execute('''
            SELECT m.id, m.sender_id, u.nickname as sender_name, m.timestamp, m.content
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.timestamp DESC
            LIMIT ? OFFSET ?
        ''', (chat_id, limit, offset)).fetchall()
        
        result = []
        import re
        # Улучшенный шаблон регулярного выражения для поиска ссылок
        url_pattern = re.compile(r'(https?://[^\s<>"\']+|www\.[^\s<>"\']+)')
        
        for message in messages:
            if not message['content']:
                continue
                
            # Ищем все ссылки в тексте сообщения
            urls = url_pattern.findall(message['content'])
            
            for url in urls:
                # Обрабатываем ссылки, начинающиеся с 'www.'
                if url.startswith('www.'):
                    url = 'http://' + url
                
                # Получаем название сайта из URL
                try:
                    from urllib.parse import urlparse
                    parsed_url = urlparse(url)
                    domain = parsed_url.netloc
                    if domain.startswith('www.'):
                        domain = domain[4:]
                    
                    # Для более информативного заголовка - добавляем часть пути
                    path = parsed_url.path
                    if path and path != '/' and len(path) > 1:
                        parts = path.strip('/').split('/')
                        if len(parts[0]) < 30:  # Если первая часть пути не слишком длинная
                            title = f"{domain} / {parts[0]}"
                        else:
                            title = domain
                    else:
                        title = domain
                except:
                    title = url[:50] + '...' if len(url) > 50 else url
                
                # Извлекаем контекст - текст сообщения вокруг ссылки (до 50 символов)
                message_text = message['content']
                start_pos = message_text.find(url)
                if start_pos >= 0:
                    context_start = max(0, start_pos - 25)
                    context_end = min(len(message_text), start_pos + len(url) + 25)
                    context = message_text[context_start:context_end]
                    if context_start > 0:
                        context = '...' + context
                    if context_end < len(message_text):
                        context += '...'
                else:
                    context = message_text[:100] + '...' if len(message_text) > 100 else message_text
                
                result.append({
                    "id": message['id'],
                    "sender_id": message['sender_id'],
                    "sender_name": message['sender_name'],
                    "timestamp": message['timestamp'],
                    "url": url,
                    "title": title,
                    "context": context
                })
        
        conn.close()
        return jsonify({
            "success": True,
            "links": result,
            "total": len(result),
            "has_more": len(result) == limit
        })
        
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при получении ссылок: {str(e)}"}), 500
