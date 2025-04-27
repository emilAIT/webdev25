from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Добавляем недостающие поля, которые используются в app.py
    email_confirmed = db.Column(db.Boolean, default=False)
    confirmation_token = db.Column(db.String(100), nullable=True)
    token_expiration = db.Column(db.DateTime, nullable=True)
    
    # Добавляем поле для хранения пути к аватарке
    avatar_path = db.Column(db.String(255), nullable=True)
    
    # Новое поле для хранения информации о пользователе
    bio = db.Column(db.String(500), nullable=True)
    
    # Определение отношения для контактов
    contacts = db.relationship('Contact', 
                              foreign_keys='Contact.user_id',
                              backref=db.backref('owner', lazy='joined'),
                              lazy='dynamic',
                              cascade='all, delete-orphan')
    
    # Define relationships for blocks
    blocks_made = db.relationship('Block', 
                                 foreign_keys='Block.user_id',
                                 backref=db.backref('blocker', lazy='joined'),
                                 lazy='dynamic',
                                 cascade='all, delete-orphan')
    
    blocks_received = db.relationship('Block', 
                                     foreign_keys='Block.blocked_user_id',
                                     backref=db.backref('blocked', lazy='joined'),
                                     lazy='dynamic',
                                     cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    # Метод для получения URL аватарки или стандартного аватара
    def get_avatar(self):
        if self.avatar_path:
            return self.avatar_path
        return None  # Вернется стандартный аватар с инициалами
    
    # Метод для авторизации пользователя
    @classmethod
    def authenticate(cls, email, password):
        user = cls.query.filter_by(email=email).first()
        if user and user.check_password(password):
            return user
        return None

# Модель для хранения контактов пользователей
class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Связь с пользователем-контактом
    contact_user = db.relationship('User', foreign_keys=[contact_id], lazy='joined')
    
    # Индекс для быстрого поиска и уникальности
    __table_args__ = (db.UniqueConstraint('user_id', 'contact_id', name='_user_contact_uc'),)

# Model for storing messages between users
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_read = db.Column(db.Boolean, default=False)
    # Add fields for tracking edits
    is_edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime, nullable=True)
    
    # Define relationships
    sender = db.relationship('User', foreign_keys=[sender_id], backref=db.backref('sent_messages', lazy='dynamic'))
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref=db.backref('received_messages', lazy='dynamic'))
    
    def to_dict(self):
        """Convert message to dictionary for JSON serialization"""
        message_dict = {
            'id': self.id,
            'sender_id': self.sender_id,
            'recipient_id': self.recipient_id,
            'content': self.content,
            'timestamp': self.timestamp.isoformat(),
            'is_read': self.is_read,
        }
        
        # Safely add new fields if they exist
        try:
            if hasattr(self, 'is_edited'):
                message_dict['is_edited'] = self.is_edited
            else:
                message_dict['is_edited'] = False
                
            if hasattr(self, 'edited_at') and self.edited_at:
                message_dict['edited_at'] = self.edited_at.isoformat()
            else:
                message_dict['edited_at'] = None
        except Exception as e:
            # If any error happens with these attributes, use defaults
            message_dict['is_edited'] = False
            message_dict['edited_at'] = None
            
        return message_dict

# Model for storing blocked users
class Block(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    blocked_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Index for fast lookup and uniqueness
    __table_args__ = (db.UniqueConstraint('user_id', 'blocked_user_id', name='_user_blocked_uc'),)

# Group model for group chats
class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    avatar_path = db.Column(db.String(255), nullable=True)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationship with creator
    creator = db.relationship('User', foreign_keys=[creator_id], backref=db.backref('created_groups', lazy='dynamic'))
    
    # Method for getting the group avatar or default
    def get_avatar(self):
        if self.avatar_path:
            return self.avatar_path
        return None  # Will return a default group avatar
    
    # Helper methods for group management
    def add_member(self, user_id, role='member', invitation_status='accepted'):
        """Add a user to the group"""
        if not GroupMember.query.filter_by(group_id=self.id, user_id=user_id).first():
            member = GroupMember(group_id=self.id, user_id=user_id, 
                                role=role, invitation_status=invitation_status)
            db.session.add(member)
            return member
        return None
    
    def remove_member(self, user_id):
        """Remove a user from the group"""
        member = GroupMember.query.filter_by(group_id=self.id, user_id=user_id).first()
        if member:
            db.session.delete(member)
            return True
        return False
    
    def is_member(self, user_id):
        """Check if a user is a member of the group"""
        return GroupMember.query.filter_by(
            group_id=self.id, 
            user_id=user_id,
            invitation_status='accepted'
        ).first() is not None
    
    def is_admin(self, user_id):
        """Check if a user is an admin of the group"""
        member = GroupMember.query.filter_by(
            group_id=self.id, 
            user_id=user_id,
            invitation_status='accepted'
        ).first()
        return member and member.role == 'admin'

# Model for group membership
class GroupMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), default='member', nullable=False)  # 'admin' or 'member'
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    invitation_status = db.Column(db.String(20), default='accepted', nullable=False)  # 'invited', 'accepted', 'declined'
    
    # Relationships
    group = db.relationship('Group', backref=db.backref('members', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('group_memberships', lazy='dynamic'))
    
    # Ensure no duplicate memberships
    __table_args__ = (db.UniqueConstraint('group_id', 'user_id', name='_group_user_uc'),)

# Model for storing messages in group chats
class GroupMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime, nullable=True)
    
    # Define relationships
    group = db.relationship('Group', backref=db.backref('messages', lazy='dynamic'))
    sender = db.relationship('User', backref=db.backref('group_messages_sent', lazy='dynamic'))
    
    def to_dict(self):
        """Convert group message to dictionary for JSON serialization"""
        message_dict = {
            'id': self.id,
            'group_id': self.group_id,
            'sender_id': self.sender_id,
            'content': self.content,
            'timestamp': self.timestamp.isoformat(),
            'is_edited': self.is_edited,
            'edited_at': self.edited_at.isoformat() if self.edited_at else None
        }
        return message_dict