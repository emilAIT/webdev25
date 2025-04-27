import os

class Config:
    # App configuration
    SECRET_KEY = 'blahblahland_secret_key'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = 'sqlite:///chat.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Email configuration
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = 'bekbolsunysmanov07@gmail.com'  # Replace with your Gmail address
    MAIL_PASSWORD = 'Bekbolsun_07'     # Replace with your app password
    MAIL_DEFAULT_SENDER = ('BlahBlahLand', 'bekbolsunysmanov07@gmail.com')
    
    # AI API configuration
    GROQ_API_KEY = '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'