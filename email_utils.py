import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import secrets
import datetime
from flask import url_for
import re
import os
import uuid
import logging

# Gmail SMTP Settings
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "erlan310706@gmail.com"  # Your Gmail address
SENDER_PASSWORD = "srtf zqdd qkzb diaz"  # Your app password
USE_SSL = False  # For Gmail with port 587, we use TLS, not SSL

def generate_confirmation_token():
    """Генерирует уникальный токен для подтверждения email"""
    return str(uuid.uuid4())

def send_confirmation_email(user_email, token):
    """Отправка письма с подтверждением на email пользователя"""
    
    # Настройка логирования для отладки
    logging.info(f"Попытка отправки email на адрес: {user_email}")
    
    # Настройка сообщения
    message = MIMEMultipart("alternative")
    message["Subject"] = "Подтверждение регистрации"
    message["From"] = SENDER_EMAIL
    message["To"] = user_email
    
    # Определяем, находимся ли мы на PythonAnywhere
    is_pythonanywhere = 'PYTHONANYWHERE_DOMAIN' in os.environ or 'PYTHONANYWHERE_HOST' in os.environ
    
    # Создаем ссылку для подтверждения с правильным префиксом blueprint
    if is_pythonanywhere:
        # На PythonAnywhere используем абсолютную ссылку
        base_url = "https://tymeer.pythonanywhere.com"
        confirmation_url = f"{base_url}/confirm-email/{token}"
    else:
        # Локально используем url_for с правильным префиксом blueprint
        try:
            confirmation_url = url_for('auth.confirm_email', token=token, _external=True)
        except Exception as e:
            logging.error(f"Ошибка создания URL: {str(e)}")
            # Fallback к ручному формированию URL
            confirmation_url = f"http://localhost:5000/confirm-email/{token}"
    
    # Формируем тело письма
    text = f"""
    Здравствуйте!
    
    Для подтверждения вашего email пройдите по следующей ссылке:
    {confirmation_url}
    
    Если вы не регистрировались на нашем сайте, проигнорируйте это сообщение.
    
    С уважением,
    Команда сайта
    """
    
    html = f"""
    <html>
    <body>
        <p>Здравствуйте!</p>
        <p>Для подтверждения вашего email нажмите на следующую ссылку:</p>
        <p><a href="{confirmation_url}">Подтвердить email</a></p>
        <p>Если вы не регистрировались на нашем сайте, проигнорируйте это сообщение.</p>
        <p>С уважением,<br>Команда сайта</p>
    </body>
    </html>
    """
    
    # Добавляем текстовую и HTML-версии в сообщение
    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    message.attach(part1)
    message.attach(part2)
    
    try:
        logging.info(f"Подключение к SMTP-серверу: {SMTP_SERVER}:{SMTP_PORT}")
        
        # Используем правильный способ подключения в зависимости от настроек
        if USE_SSL:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
        
        logging.info("Аутентификация на SMTP-сервере")
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        
        logging.info("Отправка сообщения")
        server.sendmail(SENDER_EMAIL, user_email, message.as_string())
        server.quit()
        
        logging.info("Email успешно отправлен")
        return True
    except Exception as e:
        logging.error(f"Ошибка отправки email: {str(e)}")
        # Более подробное логирование для диагностики
        if "authentication failed" in str(e).lower():
            logging.error("Ошибка аутентификации: проверьте логин и пароль")
        elif "timed out" in str(e).lower():
            logging.error("Превышено время ожидания: проверьте настройки сервера и сетевое подключение")
        
        return False

def send_reset_password_email(user_email, token):
    """Отправка письма с ссылкой на сброс пароля"""
    
    # Улучшенное логирование
    logging.info(f"===== ОТПРАВКА EMAIL ДЛЯ СБРОСА ПАРОЛЯ =====")
    logging.info(f"Получатель: {user_email}")
    logging.info(f"SMTP сервер: {SMTP_SERVER}:{SMTP_PORT}")
    
    # Настройка сообщения
    message = MIMEMultipart("alternative")
    message["Subject"] = "Сброс пароля для вашего аккаунта"
    message["From"] = SENDER_EMAIL
    message["To"] = user_email
    
    # Определяем, находимся ли мы на PythonAnywhere
    is_pythonanywhere = 'PYTHONANYWHERE_DOMAIN' in os.environ or 'PYTHONANYWHERE_HOST' in os.environ
    logging.info(f"На PythonAnywhere: {is_pythonanywhere}")
    
    # Создаем ссылку для сброса пароля с правильным префиксом blueprint
    if is_pythonanywhere:
        base_url = "https://tymeer.pythonanywhere.com"
        reset_url = f"{base_url}/reset-password/{token}"
    else:
        try:
            reset_url = url_for('auth.reset_password', token=token, _external=True)
        except Exception as e:
            logging.error(f"Ошибка создания URL: {str(e)}")
            # Fallback к ручному формированию URL
            reset_url = f"http://localhost:5000/reset-password/{token}"
    
    logging.info(f"URL для сброса: {reset_url}")
    
    # Формируем тело письма
    text = f"""
    Здравствуйте!
    
    Вы получили это письмо, потому что был запрошен сброс пароля для вашего аккаунта.
    
    Для сброса пароля перейдите по ссылке: {reset_url}
    
    Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.
    
    С уважением,
    Команда сайта
    """
    
    html = f"""
    <html>
    <body>
        <p>Здравствуйте!</p>
        <p>Вы получили это письмо, потому что был запрошен сброс пароля для вашего аккаунта.</p>
        <p>Для сброса пароля нажмите на следующую ссылку:</p>
        <p><a href="{reset_url}">Сбросить пароль</a></p>
        <p>Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.</p>
        <p>С уважением,<br>Команда сайта</p>
    </body>
    </html>
    """
    
    # Добавляем текстовую и HTML-версии в сообщение
    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    message.attach(part1)
    message.attach(part2)
    
    try:
        logging.info("Попытка подключения к SMTP-серверу...")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.set_debuglevel(1)  # Включаем подробное логирование SMTP
        server.ehlo()
        server.starttls()
        server.ehlo()
        
        logging.info("Аутентификация на SMTP-сервере...")
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        
        logging.info(f"Отправка сообщения на {user_email}...")
        server.sendmail(SENDER_EMAIL, user_email, message.as_string())
        server.quit()
        
        logging.info("Email успешно отправлен!")
        return True
    except Exception as e:
        logging.error(f"ОШИБКА при отправке email: {str(e)}")
        logging.error(f"Тип исключения: {type(e).__name__}")
        logging.error(f"Детали исключения: {repr(e)}")
        
        # Попробуем альтернативный метод отправки
        try:
            logging.info("Пробуем альтернативный метод отправки через SSL...")
            server_ssl = smtplib.SMTP_SSL(SMTP_SERVER, 465)
            server_ssl.login(SENDER_EMAIL, SENDER_PASSWORD)
            server_ssl.sendmail(SENDER_EMAIL, user_email, message.as_string())
            server_ssl.quit()
            
            logging.info("Email успешно отправлен через SSL!")
            return True
        except Exception as e2:
            logging.error(f"ОШИБКА при отправке через SSL: {str(e2)}")
            
        return False

def is_email_valid(email):
    """Простая проверка формата email"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None
