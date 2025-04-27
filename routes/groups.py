from flask import Blueprint, request, jsonify, session
from models import db, User, Group, GroupMember, Contact
from sqlalchemy import and_, or_

groups = Blueprint('groups', __name__)

@groups.route('/api/groups', methods=['GET'])
def get_groups():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    # Get all groups the user is a member of
    user_groups = db.session.query(
        Group, GroupMember.is_admin
    ).join(
        GroupMember, GroupMember.group_id == Group.id
    ).filter(
        GroupMember.user_id == user_id
    ).all()
    
    groups_list = [
        {
            "id": group.id,
            "name": group.name,
            "is_admin": is_admin,
            "created_by": group.created_by
        }
        for group, is_admin in user_groups
    ]

    return jsonify({"success": True, "groups": groups_list})

@groups.route('/api/groups', methods=['POST'])
def create_group():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json()
    group_name = data.get('name')
    member_ids = data.get('members', [])  # List of user IDs to add to the group
    
    if not group_name:
        return jsonify({"success": False, "message": "Group name is required"}), 400
    
    user_id = session['user_id']
    
    # Create new group
    new_group = Group(
        name=group_name,
        created_by=user_id
    )
    db.session.add(new_group)
    db.session.flush()  # To get the group ID
    
    # Add the creator as admin
    creator_member = GroupMember(
        group_id=new_group.id,
        user_id=user_id,
        is_admin=True
    )
    db.session.add(creator_member)
    
    # Add other members
    for member_id in member_ids:
        if member_id != user_id:  # Skip if it's the creator (already added)
            # Check if the member exists as a user
            if User.query.get(member_id):
                member = GroupMember(
                    group_id=new_group.id,
                    user_id=member_id,
                    is_admin=False
                )
                db.session.add(member)
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Group created successfully",
        "group": {
            "id": new_group.id,
            "name": new_group.name,
            "is_admin": True,
            "created_by": user_id
        }
    })

@groups.route('/api/groups/<int:group_id>', methods=['GET'])
def get_group_details(group_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    # Check if user is a member of the group
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not membership:
        return jsonify({"success": False, "message": "Group not found or you're not a member"}), 404
    
    group = Group.query.get(group_id)
    if not group:
        return jsonify({"success": False, "message": "Group not found"}), 404
    
    # Get all members of the group
    members_data = db.session.query(
        User, GroupMember.is_admin
    ).join(
        GroupMember, GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group_id
    ).all()
    
    members = [
        {
            "id": user.id,
            "username": user.username,
            "is_admin": is_admin
        }
        for user, is_admin in members_data
    ]
    
    return jsonify({
        "success": True,
        "group": {
            "id": group.id,
            "name": group.name,
            "created_by": group.created_by,
            "is_admin": membership.is_admin,
            "members": members
        }
    })

@groups.route('/api/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    # Check if user is an admin of the group
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, is_admin=True).first()
    if not membership:
        return jsonify({"success": False, "message": "Not authorized to update this group"}), 403
    
    data = request.get_json()
    new_name = data.get('name')
    members_to_remove = data.get('remove_members', [])
    
    group = Group.query.get(group_id)
    if not group:
        return jsonify({"success": False, "message": "Group not found"}), 404
    
    # Update group name if provided
    if new_name:
        group.name = new_name
    
    # Remove members if specified
    for member_id in members_to_remove:
        # Don't allow removing oneself or the creator
        if member_id != user_id and member_id != group.created_by:
            member = GroupMember.query.filter_by(group_id=group_id, user_id=member_id).first()
            if member:
                db.session.delete(member)
    
    db.session.commit()
    
    return jsonify({"success": True, "message": "Group updated successfully"})

@groups.route('/api/groups/<int:group_id>/members', methods=['POST'])
def add_group_members(group_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    # Check if user is an admin of the group
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, is_admin=True).first()
    if not membership:
        return jsonify({"success": False, "message": "Not authorized to add members to this group"}), 403
    
    data = request.get_json()
    member_ids = data.get('members', [])
    
    if not member_ids:
        return jsonify({"success": False, "message": "No members specified"}), 400
    
    # Add new members
    added_members = []
    for member_id in member_ids:
        # Check if user exists and is not already a member
        user = User.query.get(member_id)
        if user and not GroupMember.query.filter_by(group_id=group_id, user_id=member_id).first():
            new_member = GroupMember(
                group_id=group_id,
                user_id=member_id,
                is_admin=False
            )
            db.session.add(new_member)
            added_members.append({
                "id": user.id,
                "username": user.username,
                "is_admin": False
            })
    
    db.session.commit()
    
    return jsonify({
        "success": True, 
        "message": f"Added {len(added_members)} members",
        "added_members": added_members
    })

@groups.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    # Check if user is the creator or an admin
    group = Group.query.get(group_id)
    if not group:
        return jsonify({"success": False, "message": "Group not found"}), 404
    
    if group.created_by != user_id:
        admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, is_admin=True).first()
        if not admin_check:
            return jsonify({"success": False, "message": "Not authorized to delete this group"}), 403
    
    # Delete all memberships first
    GroupMember.query.filter_by(group_id=group_id).delete()
    
    # Then delete the group
    db.session.delete(group)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Group deleted successfully"})

@groups.route('/api/groups/<int:group_id>/leave', methods=['POST'])
def leave_group(group_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    
    # Check if user is a member
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not membership:
        return jsonify({"success": False, "message": "Not a member of this group"}), 404
    
    # Check if user is the creator
    group = Group.query.get(group_id)
    if group and group.created_by == user_id:
        return jsonify({"success": False, "message": "Group creator cannot leave the group"}), 400
    
    # Remove membership
    db.session.delete(membership)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Left the group successfully"})

@groups.route('/api/groups/poll', methods=['GET'])
def poll_groups():
    """
    Endpoint for polling group list and membership changes
    """
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    user_id = session['user_id']
    last_poll = request.args.get('last_poll')
    
    # Get current groups
    user_groups = db.session.query(
        Group, GroupMember.is_admin
    ).join(
        GroupMember, GroupMember.group_id == Group.id
    ).filter(
        GroupMember.user_id == user_id
    ).all()
    
    current_groups = [
        {
            "id": group.id,
            "name": group.name,
            "is_admin": is_admin,
            "created_by": group.created_by
        }
        for group, is_admin in user_groups
    ]
    
    # Get current group IDs for simple comparison
    current_group_ids = [group["id"] for group in current_groups]
    
    # If last_poll contains a comma-separated list of previous group IDs,
    # we can determine additions and removals
    changes = {"added": [], "updated": [], "removed": []}
    
    if last_poll:
        try:
            # Parse the previous group IDs
            previous_group_ids = [int(id_str) for id_str in last_poll.split(',')]
            
            # Find removed groups (in previous but not current)
            removed_ids = [id for id in previous_group_ids if id not in current_group_ids]
            changes["removed"] = removed_ids
            
            # Find added groups (in current but not previous)
            added_groups = [group for group in current_groups if group["id"] not in previous_group_ids]
            changes["added"] = added_groups
            
        except ValueError:
            # If there's an error parsing the IDs, just return the current list
            pass
    
    return jsonify({
        "success": True,
        "groups": current_groups,
        "changes": changes
    }) 