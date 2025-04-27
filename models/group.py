from . import db

class Group(db.Model):
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    messages = db.relationship('Message', backref='group', lazy='dynamic')
    members = db.relationship('GroupMember', backref='group', lazy='dynamic')

class GroupMember(db.Model):
    __tablename__ = 'group_members'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    
    # Define a unique constraint for group_id and user_id
    __table_args__ = (db.UniqueConstraint('group_id', 'user_id'),) 