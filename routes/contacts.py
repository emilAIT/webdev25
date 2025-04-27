from flask import Blueprint, request, jsonify, session
from models import db, User, Contact
from sqlalchemy import and_, or_

contacts = Blueprint('contacts', __name__)

@contacts.route('/api/contacts', methods=['GET'])
def get_contacts():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    # Query for contacts with a join to get both contact info and display names
    contacts_data = db.session.query(
        User, Contact.display_name
    ).join(
        Contact, and_(Contact.contact_id == User.id, Contact.user_id == user_id)
    ).all()
    
    contacts_list = [
        {
            "id": user.id,
            "username": user.username,
            "display_name": display_name or user.username
        }
        for user, display_name in contacts_data
    ]

    return jsonify({"success": True, "contacts": contacts_list})

@contacts.route('/api/contacts', methods=['POST'])
def add_contact():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json()
    username_or_email = data.get('usernameOrEmail')
    display_name = data.get('displayName')

    if not username_or_email:
        return jsonify({"success": False, "message": "Username or email is required"}), 400

    user_id = session['user_id']

    # Find the contact user
    contact_user = None
    if '@' in username_or_email:
        contact_user = User.query.filter_by(email=username_or_email).first()
    else:
        contact_user = User.query.filter_by(username=username_or_email).first()

    if not contact_user:
        return jsonify({"success": False, "message": "User not found"}), 404

    contact_id = contact_user.id

    if contact_id == user_id:
        return jsonify({"success": False, "message": "Cannot add yourself as a contact"}), 400

    # Check if contact already exists
    existing_contact = Contact.query.filter_by(user_id=user_id, contact_id=contact_id).first()
    if existing_contact:
        return jsonify({"success": False, "message": "Contact already exists"}), 409

    # Add new contact
    new_contact = Contact(
        user_id=user_id,
        contact_id=contact_id,
        display_name=display_name
    )
    db.session.add(new_contact)
    
    # Also add the reverse contact (make it mutual)
    reverse_contact = Contact.query.filter_by(user_id=contact_id, contact_id=user_id).first()
    if not reverse_contact:
        # Use the current user's username as the display name for the reverse contact
        current_user = User.query.get(user_id)
        reverse_contact = Contact(
            user_id=contact_id,
            contact_id=user_id,
            display_name=current_user.username  # Default to username
        )
        db.session.add(reverse_contact)
    
    db.session.commit()

    return jsonify({
        "success": True, 
        "message": "Contact added successfully",
        "contact": {
            "id": contact_user.id,
            "username": contact_user.username,
            "display_name": display_name or contact_user.username
        }
    })

@contacts.route('/api/contacts/<int:contact_id>', methods=['PUT'])
def update_contact(contact_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    data = request.get_json()
    display_name = data.get('displayName')

    # Find the contact
    contact = Contact.query.filter_by(user_id=user_id, contact_id=contact_id).first()
    if not contact:
        return jsonify({"success": False, "message": "Contact not found"}), 404

    # Update display name
    contact.display_name = display_name
    db.session.commit()

    return jsonify({"success": True, "message": "Contact updated successfully"})

@contacts.route('/api/contacts/<int:contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']

    # Find the contact
    contact = Contact.query.filter_by(user_id=user_id, contact_id=contact_id).first()
    if not contact:
        return jsonify({"success": False, "message": "Contact not found"}), 404

    # Delete the contact
    db.session.delete(contact)
    db.session.commit()

    return jsonify({"success": True, "message": "Contact deleted successfully"})

@contacts.route('/api/contacts/poll', methods=['GET'])
def poll_contacts():
    """
    Endpoint for polling contact list changes since last check
    """
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    last_poll = request.args.get('last_poll')
    
    # Get current contacts
    contacts_data = db.session.query(
        User, Contact.display_name
    ).join(
        Contact, Contact.contact_id == User.id
    ).filter(
        Contact.user_id == user_id
    ).all()
    
    current_contacts = [
        {
            "id": user.id,
            "username": user.username,
            "display_name": display_name or user.username
        }
        for user, display_name in contacts_data
    ]
    
    # Get current contact IDs for simple comparison
    current_contact_ids = [contact["id"] for contact in current_contacts]
    
    # If last_poll contains a comma-separated list of previous contact IDs,
    # we can determine additions and removals
    changes = {"added": [], "updated": [], "removed": []}
    
    if last_poll:
        try:
            # Parse the previous contact IDs
            previous_contact_ids = [int(id_str) for id_str in last_poll.split(',')]
            
            # Find removed contacts (in previous but not current)
            removed_ids = [id for id in previous_contact_ids if id not in current_contact_ids]
            changes["removed"] = removed_ids
            
            # Find added contacts (in current but not previous)
            added_contacts = [contact for contact in current_contacts if contact["id"] not in previous_contact_ids]
            changes["added"] = added_contacts
            
        except ValueError:
            # If there's an error parsing the IDs, just return the current list
            pass
    
    return jsonify({
        "success": True,
        "contacts": current_contacts,
        "changes": changes
    }) 