import os
import sys

# Add the current directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from models import db
from config import Config

# Import routes with explicit import paths
from routes.auth import auth as auth_blueprint
from routes.chat import chat as chat_blueprint
from routes.contacts import contacts as contacts_blueprint
from routes.groups import groups as groups_blueprint
from routes.ai import ai as ai_blueprint

def create_app(config_class=Config):
    # Initialize Flask app
    app = Flask(__name__, 
                static_folder='static',
                static_url_path='/static',
                template_folder='templates')
    
    # Load configuration
    app.config.from_object(config_class)
    
    # Set secret key
    app.secret_key = config_class.SECRET_KEY
    
    # Initialize extensions
    CORS(app)
    db.init_app(app)
    mail = Mail(app)
    
    # Register blueprints
    app.register_blueprint(auth_blueprint)
    app.register_blueprint(chat_blueprint)
    app.register_blueprint(contacts_blueprint)
    app.register_blueprint(groups_blueprint)
    app.register_blueprint(ai_blueprint)
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=8000, host='0.0.0.0')