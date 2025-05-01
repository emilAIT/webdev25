from flask import Flask, jsonify, render_template, redirect, url_for, flash, session, request, send_file
from dbinit import init_db
import bcrypt
import os
from api.auth import auth_bp
from api.user import user_bp, get_user_photo
from api.chat import chat_bp
from api.group import group_bp
from io import BytesIO

# Инициализация БД
init_db()

# Создаем Flask приложение
app = Flask(__name__)
app.secret_key = os.urandom(24)  # Для работы с сессиями

# Регистрируем блюпринты
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(group_bp)  # Добавляем блюпринт для групповых чатов

@app.route('/ping')
def index():
    return jsonify({"message": "pong"})

@app.route('/')
def home():
    # Проверяем, авторизован ли пользователь
    if 'user_id' in session:
        return redirect(url_for('chat'))
    return render_template('index.html')

@app.route('/profile')
def profile():
    # Проверяем, авторизован ли пользователь
    if 'user_id' not in session:
        return redirect(url_for('home'))
    return render_template('profile.html')

@app.route('/chat')
def chat():
    # Проверяем, авторизован ли пользователь
    if 'user_id' not in session:
        return redirect(url_for('home'))
    
    # Передаем имя пользователя в шаблон
    username = session.get('nickname', 'Пользователь')
    return render_template('main.html', username=username)

@app.route('/main')
def main_route():
    # Перенаправляем на /chat для совместимости
    return redirect(url_for('chat'))

@app.route('/get_user_photo')
def get_user_photo_route():
    """Маршрут для получения фото профиля пользователя в шаблонах"""
    if 'user_id' not in session:
        return redirect(url_for('home'))
    return redirect('/api/user/photo')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('nickname', None)
    return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
