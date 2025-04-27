from flask import Blueprint, request, session, jsonify
from models.user import db, User, Contact, Block
import logging

# Create blueprint for contact routes with explicit URL prefix of nothing
contacts_bp = Blueprint('contacts', __name__, url_prefix='')

@contacts_bp.route('/get_contacts')
def get_contacts():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    try:
        # Получаем все контакты текущего пользователя
        contacts_query = Contact.query.filter_by(user_id=session['user_id']).all()
        contacts = []
        for contact in contacts_query:
            contact_user = contact.contact_user
            contact_data = {
                'id': contact_user.id,
                'name': contact_user.name,
                'bio': contact_user.bio if hasattr(contact_user, 'bio') else None,
                'avatar_path': contact_user.avatar_path if hasattr(contact_user, 'avatar_path') else None
            }
            contacts.append(contact_data)
        logging.debug(f"Retrieved {len(contacts)} contacts for user {session['user_id']}")
        return jsonify({
            'success': True,
            'contacts': contacts
        })
    except Exception as e:
        logging.error(f"Ошибка при получении контактов: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to retrieve contacts'}), 500

@contacts_bp.route('/add_contact', methods=['POST'])
def add_contact():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data = request.get_json()
        contact_id = data.get('contact_id')
        if not contact_id:
            return jsonify({'error': 'Contact ID is required'}), 400
        
        # Проверяем, существует ли пользователь
        contact_user = User.query.get(contact_id)
        if not contact_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Проверяем, не пытается ли пользователь добавить сам себя
        if int(contact_id) == session['user_id']:
            return jsonify({'error': 'Cannot add yourself as a contact'}), 400
        
        # Проверяем, не добавлен ли уже этот контакт
        existing_contact = Contact.query.filter_by(
            user_id=session['user_id'],
            contact_id=contact_id
        ).first()
        if existing_contact:
            # Контакт уже добавлен, возвращаем успех (идемпотентность)
            return jsonify({
                'success': True,
                'message': 'Contact already exists',
                'contact': {
                    'id': contact_user.id,
                    'name': contact_user.name,
                    'avatar_path': contact_user.avatar_path if hasattr(contact_user, 'avatar_path') else None,
                    'bio': contact_user.bio if hasattr(contact_user, 'bio') else None
                }
            })
        
        # Создаем новую запись контакта
        new_contact = Contact(
            user_id=session['user_id'],
            contact_id=contact_id
        )
        db.session.add(new_contact)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Contact added successfully',
            'contact': {
                'id': contact_user.id,
                'name': contact_user.name,
                'avatar_path': contact_user.avatar_path if hasattr(contact_user, 'avatar_path') else None,
                'bio': contact_user.bio if hasattr(contact_user, 'bio') else None
            }
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"Ошибка при добавлении контакта: {str(e)}")
        return jsonify({'error': 'Server error'}), 500

@contacts_bp.route('/remove_contact', methods=['POST'])
def remove_contact():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data = request.get_json()
        contact_id = data.get('contact_id')
        if not contact_id:
            return jsonify({'error': 'Contact ID is required'}), 400
        
        # Проверяем, существует ли пользователь
        contact_user = User.query.get(contact_id)
        if not contact_user:
            return jsonify({'error': 'User not found'}), 404
        # Удаляем контакт если он существует
        contact = Contact.query.filter_by(
            user_id=session['user_id'],
            contact_id=contact_id
        ).first()
        if contact:
            db.session.delete(contact)
            db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Contact removed successfully'
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"Ошибка при удалении контакта: {str(e)}")
        return jsonify({'error': 'Server error'}), 500

@contacts_bp.route('/check_contact', methods=['POST'])
def check_contact():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data = request.get_json()
        contact_id = data.get('contact_id')
        if not contact_id:
            return jsonify({'error': 'Contact ID is required'}), 400
        
        # Проверяем, добавлен ли пользователь уже в контакты
        existing_contact = Contact.query.filter_by(
            user_id=session['user_id'],
            contact_id=contact_id
        ).first()
        return jsonify({
            'is_contact': existing_contact is not None
        })
    except Exception as e:
        logging.error(f"Ошибка при проверке контакта: {str(e)}")
        return jsonify({'error': 'Server error'}), 500

@contacts_bp.route('/check_block_status', methods=['POST'])
def check_block_status():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Check if the current user has blocked the target user
        is_blocked_by_you = Block.query.filter_by(
            user_id=session['user_id'],
            blocked_user_id=user_id
        ).first() is not None
        
        # Check if the target user has blocked the current user
        has_blocked_you = Block.query.filter_by(
            user_id=user_id,
            blocked_user_id=session['user_id']
        ).first() is not None
        
        return jsonify({
            'success': True,
            'is_blocked_by_you': is_blocked_by_you,
            'has_blocked_you': has_blocked_you
        })
    except Exception as e:
        logging.error(f"Error checking block status: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to check block status'}), 500

@contacts_bp.route('/block_user', methods=['POST'])
def block_user():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Validate that the user exists
        user_to_block = User.query.get(user_id)
        if not user_to_block:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Check if already blocked
        existing_block = Block.query.filter_by(
            user_id=session['user_id'],
            blocked_user_id=user_id
        ).first()
        if existing_block:
            return jsonify({'success': True, 'message': 'User already blocked'})
        
        # Create new block record
        new_block = Block(user_id=session['user_id'], blocked_user_id=user_id)
        db.session.add(new_block)
        
        # Remove from contacts in both directions - user_id is the contact of current user
        contact1 = Contact.query.filter_by(
            user_id=session['user_id'],
            contact_id=user_id
        ).first()
        if contact1:
            db.session.delete(contact1)
        # current user is the contact of user_id
        contact2 = Contact.query.filter_by(
            user_id=user_id,
            contact_id=session['user_id']
        ).first()
        if contact2:
            db.session.delete(contact2)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'User blocked successfully'})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error blocking user: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to block user'}), 500

@contacts_bp.route('/unblock_user', methods=['POST'])
def unblock_user():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Find the block record
        block = Block.query.filter_by(
            user_id=session['user_id'],
            blocked_user_id=user_id
        ).first()
        if block:
            db.session.delete(block)
            db.session.commit()
            return jsonify({'success': True, 'message': 'User unblocked successfully'})
        else:
            return jsonify({'success': True, 'message': 'User was not blocked'})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error unblocking user: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to unblock user'}), 500
