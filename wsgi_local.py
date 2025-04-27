import sys
import os
import logging

# Настройка логирования
logging.basicConfig(
    filename='/tmp/wsgi_error.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

try:
    logging.info("Запуск WSGI скрипта")
    
    # Путь к проекту на PythonAnywhere
    path = '/home/tymeer/chat'
    if path not in sys.path:
        sys.path.insert(0, path)  # Insert at beginning to ensure it takes precedence
    
    logging.info(f"Добавлен путь: {path}")
    logging.info(f"sys.path: {sys.path}")
    
    # Проверка существования файла app.py
    app_path = os.path.join(path, 'app.py')
    logging.info(f"Проверка файла app.py по пути: {app_path}")
    if os.path.exists(app_path):
        logging.info("Файл app.py найден")
    else:
        logging.error(f"Файл app.py НЕ найден по пути: {app_path}")
    
    # Set environment variable to indicate we're on PythonAnywhere
    os.environ['FLASK_ENV'] = 'production'
    os.environ['PYTHONANYWHERE_HOST'] = 'tymeer.pythonanywhere.com'
    
    # Импортируем Flask-приложение
    from app import app as application
    logging.info("Приложение Flask успешно импортировано")
    
except Exception as e:
    logging.error(f"Ошибка при инициализации WSGI: {str(e)}")
    import traceback
    logging.error(traceback.format_exc())
    # Создаем простое приложение для отладки
    def application(environ, start_response):
        status = '200 OK'
        output = b'WSGI error! Check logs at /tmp/wsgi_error.log'
        response_headers = [('Content-type', 'text/plain'),
                           ('Content-Length', str(len(output)))]
        start_response(status, response_headers)
        return [output]
