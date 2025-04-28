from app import db, login_manager
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Группа мүчөлөрү үчүн таблица
group_members = db.Table('group_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('group.id'), primary_key=True)
)

# Контакттар үчүн таблица
contacts = db.Table('contacts',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('contact_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Катнаштар
    sent_messages = db.relationship('Message', backref='sender', foreign_keys='Message.sender_id')
    
    # Контакттар
    contacts_list = db.relationship(
        'User', secondary=contacts,
        primaryjoin=(contacts.c.user_id == id),
        secondaryjoin=(contacts.c.contact_id == id),
        backref=db.backref('contacted_by', lazy='dynamic'),
        lazy='dynamic'
    )
    
    # Группалар
    groups = db.relationship('Group', secondary=group_members, backref=db.backref('members', lazy='dynamic'))
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def add_contact(self, user):
        if not self.is_contact(user):
            self.contacts_list.append(user)
            return self
    
    def remove_contact(self, user):
        if self.is_contact(user):
            self.contacts_list.remove(user)
            return self
    
    def is_contact(self, user):
        return self.contacts_list.filter(contacts.c.contact_id == user.id).count() > 0
        
    def get_last_message_with(self, user_id):
        """Получить последнее сообщение между текущим пользователем и выбранным контактом"""
        sent = Message.query.filter_by(sender_id=self.id, recipient_id=user_id).order_by(Message.created_at.desc()).first()
        received = Message.query.filter_by(sender_id=user_id, recipient_id=self.id).order_by(Message.created_at.desc()).first()
        
        if sent and received:
            return sent if sent.created_at > received.created_at else received
        return sent or received
        
    def get_last_message_in_group(self, group_id):
        """Получить последнее сообщение в группе"""
        from app.models import Message
        return Message.query.filter_by(group_id=group_id).order_by(Message.created_at.desc()).first()
    
    def count_unread_messages(self, contact_id=None):
        """Подсчет непрочитанных сообщений от конкретного пользователя или всего"""
        query = Message.query.filter_by(recipient_id=self.id, is_read=False)
        if contact_id:
            return query.filter_by(sender_id=contact_id).count()
        return query.count()
    
    def count_unread_group_messages(self, group_id=None):
        """Подсчет непрочитанных сообщений в группе или во всех группах"""
        # Получаем ID групп пользователя
        group_ids = [group.id for group in self.groups]
        
        if not group_ids:
            return 0
        
        query = Message.query.filter(
            Message.group_id.in_(group_ids),
            Message.sender_id != self.id,
            Message.is_read == False
        )
        
        if group_id:
            return query.filter_by(group_id=group_id).count()
        return query.count()

class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    messages = db.relationship('Message', backref='group')
    creator = db.relationship('User', foreign_keys=[creator_id])

    def get_last_message(self):
        """Получить последнее сообщение в группе"""
        return Message.query.filter_by(group_id=self.id).order_by(Message.created_at.desc()).first()
    
    def mark_messages_as_read(self, user_id):
        """Отметить все сообщения в группе как прочитанные для пользователя"""
        messages = Message.query.filter_by(group_id=self.id, is_read=False).all()
        for message in messages:
            if message.sender_id != user_id:
                message.is_read = True
        return len(messages)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
    
    recipient = db.relationship('User', foreign_keys=[recipient_id])
    
    def mark_as_read(self):
        """Отметить сообщение как прочитанное"""
        self.is_read = True
        return self