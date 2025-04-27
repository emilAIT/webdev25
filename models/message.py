from datetime import datetime
from . import db
import json

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message_text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_group_message = db.Column(db.Boolean, default=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    edited = db.Column(db.Boolean, default=False)
    
    # Store read status as a JSON string of user IDs who have read the message
    _read_by = db.Column(db.Text, default='[]')
    
    @property
    def read_by(self):
        if not self._read_by:
            return []
        return json.loads(self._read_by)
    
    @read_by.setter
    def read_by(self, user_ids):
        self._read_by = json.dumps(list(set(user_ids)))
    
    def is_read_by(self, user_id):
        return user_id in self.read_by
    
    def mark_as_read_by(self, user_id):
        read_users = self.read_by
        if user_id not in read_users:
            read_users.append(user_id)
            self.read_by = read_users
            return True
        return False 