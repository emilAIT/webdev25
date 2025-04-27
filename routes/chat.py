from flask import Blueprint, request, jsonify, session
from models import db, Message, User, Contact, Group, GroupMember
from datetime import datetime

chat = Blueprint('chat', __name__)

@chat.route('/api/messages', methods=['GET'])
def get_messages():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    user_id = session['user_id']
    contact_id = request.args.get('contact_id', type=int)
    group_id = request.args.get('group_id', type=int)
    
    if group_id:
        # Check if user is a member of the group
        is_member = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
        if not is_member:
            return jsonify({"success": False, "message": "Not a member of this group"}), 403
        
        # Get group messages
        messages = Message.query.filter_by(group_id=group_id, is_group_message=True).order_by(Message.timestamp).all()
    elif contact_id:
        # Get direct messages between users
        messages = Message.query.filter(
            ((Message.sender_id == user_id) & (Message.receiver_id == contact_id)) |
            ((Message.sender_id == contact_id) & (Message.receiver_id == user_id))
        ).filter_by(is_group_message=False).order_by(Message.timestamp).all()
    else:
        return jsonify({"success": False, "message": "Missing contact_id or group_id parameter"}), 400
    
    # Format messages
    formatted_messages = []
    for msg in messages:
        sender = User.query.get(msg.sender_id)
        
        # Check if current user has read this message
        is_read = msg.is_read_by(user_id)
        
        # Automatically mark messages from others as read if user is viewing them
        if msg.sender_id != user_id and not is_read:
            msg.mark_as_read_by(user_id)
            db.session.commit()
            is_read = True
        
        formatted_messages.append({
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_username": sender.username,
            "message": msg.message_text,
            "timestamp": msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "is_own_message": msg.sender_id == user_id,
            "edited": msg.edited,
            "is_read": is_read,
            "read_by": msg.read_by if msg.sender_id == user_id else None
        })
    
    return jsonify({"success": True, "messages": formatted_messages})

@chat.route('/api/messages', methods=['POST'])
def send_message():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    data = request.get_json()
    sender_id = session['user_id']
    message_text = data.get('message')
    receiver_id = data.get('receiver_id')
    group_id = data.get('group_id')
    add_as_contact = data.get('add_as_contact', False)
    
    if not message_text:
        return jsonify({"success": False, "message": "Message text is required"}), 400
    
    if group_id:
        # Check if user is a member of the group
        is_member = GroupMember.query.filter_by(group_id=group_id, user_id=sender_id).first()
        if not is_member:
            return jsonify({"success": False, "message": "Not a member of this group"}), 403
        
        # Create group message
        new_message = Message(
            sender_id=sender_id,
            receiver_id=sender_id,  # Placeholder for group messages
            message_text=message_text,
            is_group_message=True,
            group_id=group_id
        )
    elif receiver_id:
        # Check if the receiver exists
        receiver = User.query.get(receiver_id)
        if not receiver:
            return jsonify({"success": False, "message": "Receiver does not exist"}), 404
        
        # Check if the receiver is a contact
        contact = Contact.query.filter_by(user_id=sender_id, contact_id=receiver_id).first()
        if not contact:
            # If the add_as_contact flag is true, add the receiver as a contact before sending the message
            if add_as_contact:
                new_contact = Contact(
                    user_id=sender_id,
                    contact_id=receiver_id
                )
                db.session.add(new_contact)
                
                # Also add the sender as a contact for the receiver (mutual contacts)
                reverse_contact = Contact.query.filter_by(user_id=receiver_id, contact_id=sender_id).first()
                if not reverse_contact:
                    reverse_contact = Contact(
                        user_id=receiver_id,
                        contact_id=sender_id
                    )
                    db.session.add(reverse_contact)
            else:
                return jsonify({"success": False, "message": "Receiver is not in your contacts"}), 403
        
        # Create direct message
        new_message = Message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            message_text=message_text,
            is_group_message=False
        )
    else:
        return jsonify({"success": False, "message": "Either receiver_id or group_id is required"}), 400
    
    db.session.add(new_message)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": {
            "id": new_message.id,
            "sender_id": new_message.sender_id,
            "sender_username": session['username'],
            "message": new_message.message_text,
            "timestamp": new_message.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "is_own_message": True,
            "edited": False
        }
    })

@chat.route('/api/messages/<int:message_id>', methods=['PUT'])
def edit_message(message_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    user_id = session['user_id']
    data = request.get_json()
    new_text = data.get('message')
    
    if not new_text:
        return jsonify({"success": False, "message": "Message text is required"}), 400
    
    # Find message and check ownership
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"success": False, "message": "Message not found"}), 404
    
    if message.sender_id != user_id:
        return jsonify({"success": False, "message": "Cannot edit messages sent by others"}), 403
    
    # Update message
    message.message_text = new_text
    message.edited = True
    db.session.commit()
    
    return jsonify({"success": True, "message": "Message updated"})

@chat.route('/api/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    user_id = session['user_id']
    
    # Find message and check ownership
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"success": False, "message": "Message not found"}), 404
    
    if message.sender_id != user_id:
        return jsonify({"success": False, "message": "Cannot delete messages sent by others"}), 403
    
    # Delete message
    db.session.delete(message)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Message deleted"})

@chat.route('/api/messages/<int:message_id>/read', methods=['POST'])
def mark_message_read(message_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    user_id = session['user_id']
    
    # Find message
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"success": False, "message": "Message not found"}), 404
    
    # Can't mark your own message as read
    if message.sender_id == user_id:
        return jsonify({"success": True, "message": "Own message already read"}), 200
    
    # If it's a group message, check if user is a member
    if message.is_group_message and message.group_id:
        is_member = GroupMember.query.filter_by(group_id=message.group_id, user_id=user_id).first()
        if not is_member:
            return jsonify({"success": False, "message": "Not a member of this group"}), 403
    
    # If it's a direct message, check if user is the receiver
    if not message.is_group_message and message.receiver_id != user_id:
        return jsonify({"success": False, "message": "Not authorized to mark this message as read"}), 403
    
    # Mark message as read
    was_updated = message.mark_as_read_by(user_id)
    if was_updated:
        db.session.commit()
    
    return jsonify({"success": True, "message": "Message marked as read"})

@chat.route('/api/messages/read-status', methods=['GET'])
def get_message_read_status():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    user_id = session['user_id']
    message_ids = request.args.get('ids', '')
    
    if not message_ids:
        return jsonify({"success": False, "message": "No message IDs provided"}), 400
    
    try:
        message_id_list = [int(id_str) for id_str in message_ids.split(',')]
        
        # Get messages and check which are read by others
        result = {}
        for message_id in message_id_list:
            message = Message.query.get(message_id)
            if message and message.sender_id == user_id:
                # For own messages, show who has read them
                result[message_id] = message.read_by
            elif message:
                # For other's messages, just show if current user has read them
                result[message_id] = message.is_read_by(user_id)
        
        return jsonify({"success": True, "read_status": result})
    except ValueError:
        return jsonify({"success": False, "message": "Invalid message ID format"}), 400

@chat.route('/api/messages/poll', methods=['GET'])
def poll_messages():
    """
    Endpoint for polling new messages since a given timestamp
    """
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    user_id = session['user_id']
    contact_id = request.args.get('contact_id', type=int)
    group_id = request.args.get('group_id', type=int)
    last_timestamp = request.args.get('timestamp')
    
    if not (contact_id or group_id):
        return jsonify({"success": False, "message": "Missing contact_id or group_id parameter"}), 400
    
    if not last_timestamp:
        return jsonify({"success": False, "message": "Last timestamp is required"}), 400
    
    try:
        last_time = datetime.strptime(last_timestamp, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return jsonify({"success": False, "message": "Invalid timestamp format"}), 400
    
    # Query for new messages
    if group_id:
        # Check if user is a member of the group
        is_member = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
        if not is_member:
            return jsonify({"success": False, "message": "Not a member of this group"}), 403
        
        # Get group messages newer than the given timestamp
        messages = Message.query.filter(
            Message.group_id == group_id,
            Message.is_group_message == True,
            Message.timestamp > last_time
        ).order_by(Message.timestamp).all()
    elif contact_id:
        # Get direct messages between users newer than the given timestamp
        messages = Message.query.filter(
            ((Message.sender_id == user_id) & (Message.receiver_id == contact_id)) |
            ((Message.sender_id == contact_id) & (Message.receiver_id == user_id)),
            Message.is_group_message == False,
            Message.timestamp > last_time
        ).order_by(Message.timestamp).all()
    
    # Format messages
    formatted_messages = []
    for msg in messages:
        sender = User.query.get(msg.sender_id)
        
        # Check if current user has read this message
        is_read = msg.is_read_by(user_id)
        
        # Automatically mark messages from others as read if user is viewing them
        if msg.sender_id != user_id and not is_read:
            msg.mark_as_read_by(user_id)
            db.session.commit()
            is_read = True
        
        formatted_messages.append({
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_username": sender.username,
            "message": msg.message_text,
            "timestamp": msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "is_own_message": msg.sender_id == user_id,
            "edited": msg.edited,
            "is_read": is_read,
            "read_by": msg.read_by if msg.sender_id == user_id else None
        })
    
    return jsonify({"success": True, "messages": formatted_messages})

@chat.route('/api/messages/updates', methods=['GET'])
def poll_message_updates():
    """
    Endpoint for polling updates to existing messages (edits, deletions, read status)
    """
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    user_id = session['user_id']
    message_ids = request.args.get('ids', '')
    
    if not message_ids:
        return jsonify({"success": False, "message": "No message IDs provided"}), 400
    
    try:
        message_id_list = [int(id_str) for id_str in message_ids.split(',')]
        
        # Check for updates to the specified messages
        message_updates = {}
        deleted_messages = []
        
        for message_id in message_id_list:
            message = Message.query.get(message_id)
            if message:
                # For own messages, include read status
                if message.sender_id == user_id:
                    message_updates[message_id] = {
                        "edited": message.edited,
                        "message": message.message_text,
                        "read_by": message.read_by
                    }
                else:
                    # For messages from others, just include edit status and text
                    message_updates[message_id] = {
                        "edited": message.edited,
                        "message": message.message_text,
                        "is_read": message.is_read_by(user_id)
                    }
            else:
                # Message not found - might have been deleted
                deleted_messages.append(message_id)
        
        return jsonify({
            "success": True, 
            "updates": message_updates,
            "deleted": deleted_messages
        })
    
    except ValueError:
        return jsonify({"success": False, "message": "Invalid message ID format"}), 400 