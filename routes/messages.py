from flask import Blueprint, request, session, jsonify
from models.user import db, User, Message, Block, Contact
from sqlalchemy import text
import logging
import datetime

# Create blueprint for messages routes with explicit URL prefix of nothing
messages_bp = Blueprint('messages', __name__, url_prefix='')

@messages_bp.route('/get_chat_list')
def get_chat_list():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    try:
        logging.debug(f"Getting chat list for user {session['user_id']}")
        # Получаем уникальных пользователей, с которыми есть переписка
        # Подзапрос для получения id пользователей, с которыми общались
        subquery1 = db.session.query(Message.recipient_id.label('user_id')).filter(
            Message.sender_id == session['user_id']
        ).distinct()
        
        subquery2 = db.session.query(Message.sender_id.label('user_id')).filter(
            Message.recipient_id == session['user_id']
        ).distinct()
        
        # Объединяем подзапросы
        chat_user_ids = subquery1.union(subquery2).all()
        chat_user_ids = [item.user_id for item in chat_user_ids]
        
        logging.debug(f"Found {len(chat_user_ids)} chat users for user {session['user_id']}")
        
        # Получаем пользователей из списка ID
        chat_users = User.query.filter(User.id.in_(chat_user_ids)).all()
        
        # Формируем информацию о чатах
        chats = []
        for user in chat_users:
            # Получаем последнее сообщение
            last_message = Message.query.filter(
                ((Message.sender_id == session['user_id']) & (Message.recipient_id == user.id)) |
                ((Message.sender_id == user.id) & (Message.recipient_id == session['user_id']))
            ).order_by(Message.timestamp.desc()).first()
            
            # Считаем непрочитанные сообщения
            unread_count = Message.query.filter(
                (Message.sender_id == user.id) &
                (Message.recipient_id == session['user_id']) &
                (Message.is_read == False)
            ).count()
            
            # Проверяем, является ли пользователь контактом
            is_contact = Contact.query.filter_by(
                user_id=session['user_id'],
                contact_id=user.id
            ).first() is not None
            
            # Check if any blocks exist between users
            is_blocked_by_you = Block.query.filter_by(
                user_id=session['user_id'],
                blocked_user_id=user.id
            ).first() is not None
            
            has_blocked_you = Block.query.filter_by(
                user_id=user.id,
                blocked_user_id=session['user_id']
            ).first() is not None
            
            # Добавляем информацию о чате
            chat_info = {
                'user_id': user.id,
                'name': user.name,
                'avatar_path': user.avatar_path if hasattr(user, 'avatar_path') else None,
                'last_message': last_message.content if last_message else "",
                'last_timestamp': last_message.timestamp.isoformat() if last_message else None,
                'unread_count': unread_count,
                'is_contact': is_contact,
                'is_blocked_by_you': is_blocked_by_you,
                'has_blocked_you': has_blocked_you
            }
            chats.append(chat_info)
        
        # Сортируем чаты по времени последнего сообщения (новые сверху)
        chats.sort(key=lambda x: x['last_timestamp'] if x['last_timestamp'] else "", reverse=True)
        
        logging.debug(f"Returning {len(chats)} chats for user {session['user_id']}")
        return jsonify({
            'success': True,
            'chats': chats
        })
    except Exception as e:
        logging.error(f"Ошибка при получении списка чатов: {str(e)}")
        return jsonify({'success': False, 'error': f'Failed to retrieve chat list: {str(e)}'}), 500

@messages_bp.route('/send_message', methods=['POST'])
def send_message():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    try:
        data = request.get_json()
        recipient_id = data.get('recipient_id')
        content = data.get('content')
        if not recipient_id or not content:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        # Verify the recipient exists
        recipient = User.query.get(recipient_id)
        if not recipient:
            return jsonify({'success': False, 'error': 'Recipient not found'}), 404
        
        # Check if either user has blocked the other
        blocked_by_sender = Block.query.filter_by(
            user_id=session['user_id'],
            blocked_user_id=recipient_id
        ).first()
        if blocked_by_sender:
            return jsonify({'success': False, 'error': 'You cannot send messages to this user because you have blocked them'}), 403
        
        blocked_by_recipient = Block.query.filter_by(
            user_id=recipient_id,
            blocked_user_id=session['user_id']
        ).first()
        if blocked_by_recipient:
            return jsonify({'success': False, 'error': 'You cannot send messages to this user because they have blocked you'}), 403
        
        # Create new message
        new_message = Message(
            sender_id=session['user_id'],
            recipient_id=recipient_id,
            content=content,
            is_read=False
        )
        db.session.add(new_message)
        db.session.commit()
        
        # Return formatted message data
        return jsonify({
            'success': True,
            'message': new_message.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error sending message: {str(e)}")
        return jsonify({'success': False, 'error': 'Server error'}), 500

@messages_bp.route('/get_messages')
def get_messages():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'Missing user_id'}), 400
        # Get messages between users
        messages_query = Message.query.filter(
            ((Message.sender_id == session['user_id']) & (Message.recipient_id == user_id)) |
            ((Message.sender_id == user_id) & (Message.recipient_id == session['user_id']))
        ).order_by(Message.timestamp.asc())
        messages = [message.to_dict() for message in messages_query.all()]
        # Mark messages as read
        unread_messages = Message.query.filter_by(
            sender_id=user_id,
            recipient_id=session['user_id'],
            is_read=False
        ).all()
        
        for message in unread_messages:
            message.is_read = True
        db.session.commit()
        
        return jsonify({
            'success': True,
            'messages': messages
        })
    except Exception as e:
        logging.error(f"Error getting messages: {str(e)}")
        return jsonify({'success': False, 'error': 'Server error'}), 500

@messages_bp.route('/get_recent_conversations')
def get_recent_conversations():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    try:
        user_id = session['user_id']
        # Get users this user has exchanged messages with
        # This query finds all users where there are messages between them and the current user
        query = """
            SELECT u.id, u.name, u.avatar_path, u.bio, m.content as last_message, m.timestamp, 
                   (SELECT count(*) FROM message 
                    WHERE sender_id = u.id AND recipient_id = :user_id AND is_read = 0) as unread_count
            FROM user u
            JOIN (
                SELECT 
                    CASE 
                        WHEN sender_id = :user_id THEN recipient_id 
                        ELSE sender_id 
                    END as user_id, 
                    MAX(timestamp) as max_time
                FROM message
                WHERE sender_id = :user_id OR recipient_id = :user_id
                GROUP BY user_id
            ) latest ON latest.user_id = u.id
            JOIN message m ON ((m.sender_id = u.id AND m.recipient_id = :user_id) OR 
                              (m.sender_id = :user_id AND m.recipient_id = u.id)) 
                         AND m.timestamp = latest.max_time
            ORDER BY m.timestamp DESC
        """
        result = db.session.execute(text(query), {'user_id': user_id})
        conversations = []
        for row in result:
            # Format the data for the frontend
            conversations.append({
                'user_id': row.id,
                'name': row.name,
                'avatar_path': row.avatar_path,
                'bio': row.bio,
                'last_message': row.last_message,
                'timestamp': row.timestamp.isoformat() if row.timestamp else None,
                'unread_count': row.unread_count
            })
        return jsonify({
            'success': True,
            'conversations': conversations
        })
    except Exception as e:
        logging.error(f"Error getting recent conversations: {str(e)}")
        return jsonify({'success': False, 'error': 'Server error'}), 500

@messages_bp.route('/edit_message', methods=['POST'])
def edit_message():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    try:
        data = request.get_json()
        message_id = data.get('message_id')
        content = data.get('content')
        
        if not message_id or not content or not content.strip():
            return jsonify({'success': False, 'error': 'Message ID and content are required'}), 400
        
        # Find the message
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'success': False, 'error': 'Message not found'}), 404
        
        # Check if user is the sender
        if message.sender_id != session['user_id']:
            return jsonify({'success': False, 'error': 'You can only edit your own messages'}), 403
        
        # Update message
        message.content = content
        message.is_edited = True
        message.edited_at = datetime.datetime.now()
        
        db.session.commit()
        
        # Return updated message
        return jsonify({
            'success': True,
            'message': message.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error editing message: {str(e)}")
        return jsonify({'success': False, 'error': 'Server error'}), 500

@messages_bp.route('/delete_message', methods=['POST'])
def delete_message():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    try:
        data = request.get_json()
        message_id = data.get('message_id')
        if not message_id:
            return jsonify({'success': False, 'error': 'Message ID required'}), 400
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'success': False, 'error': 'Message not found'}), 404
        if message.sender_id != session['user_id']:
            return jsonify({'success': False, 'error': 'You can only delete your own messages'}), 403
        db.session.delete(message)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@messages_bp.route('/delete_chat', methods=['POST'])
def delete_chat():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    try:
        data = request.get_json()
        other_user_id = data.get('user_id')
        if not other_user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        # Удаляем все сообщения между текущим пользователем и выбранным пользователем
        num_deleted = Message.query.filter(
            ((Message.sender_id == session['user_id']) & (Message.recipient_id == other_user_id)) |
            ((Message.sender_id == other_user_id) & (Message.recipient_id == session['user_id']))
        ).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({'success': True, 'deleted': num_deleted})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
