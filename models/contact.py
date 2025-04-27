from . import db

class Contact(db.Model):
    __tablename__ = 'contacts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    display_name = db.Column(db.String(64))
    
    # Define a unique constraint for user_id and contact_id
    __table_args__ = (db.UniqueConstraint('user_id', 'contact_id'),) 