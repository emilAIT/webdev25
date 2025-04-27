from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models so they can be imported directly from the models package
from .user import User
from .contact import Contact
from .message import Message
from .group import Group, GroupMember 