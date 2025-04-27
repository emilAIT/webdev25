from flask import Blueprint, request, session, jsonify, current_app
from models.user import db, User
import os
from werkzeug.utils import secure_filename
import logging

# Create blueprint for user routes
user_bp = Blueprint('user', __name__)

# Allowed file extensions for avatars
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Function to check if file extension is allowed
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@user_bp.route('/get_current_user_info')
def get_current_user_info():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Запрашиваем актуальную информацию из базы данных
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        # Проверяем наличие атрибута avatar_path безопасным способом
        avatar_path = None
        try:
            if hasattr(user, 'avatar_path') and user.avatar_path:
                avatar_path = user.avatar_path
        except Exception as avatar_error:
            logging.warning(f"Ошибка при получении avatar_path: {str(avatar_error)}")
        # Возвращаем актуальную информацию о пользователе
        return jsonify({
            'user_id': user.id,
            'user_name': user.name,
            'email': user.email,
            'avatar_path': avatar_path,
            'bio': user.bio if hasattr(user, 'bio') else None
        })
    except Exception as e:
        logging.error(f"Ошибка в get_current_user_info: {str(e)}")
        return jsonify({'error': 'Server error'}), 500

@user_bp.route('/search_users', methods=['GET'])
def search_users():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    query = request.args.get('query', '').strip()
    if not query or len(query) < 2:
        return jsonify({'users': []})
    try:
        # Поиск пользователей по имени (частичное совпадение)
        # Исключаем текущего пользователя из результатов
        users = User.query.filter(
            User.name.ilike(f'%{query}%'),
            User.id != session['user_id']
        ).limit(10).all()
        
        results = []
        for user in users:
            results.append({
                'id': user.id,
                'name': user.name,
                'avatar_path': user.avatar_path if hasattr(user, 'avatar_path') else None,
                'bio': user.bio if hasattr(user, 'bio') else None
            })
        return jsonify({'users': results})
    except Exception as e:
        logging.error(f"Ошибка при поиске пользователей: {str(e)}")
        return jsonify({'error': 'Server error'}), 500

@user_bp.route('/get_user_info')
def get_user_info():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'id': user.id,
            'name': user.name,
            'avatar_path': user.avatar_path if hasattr(user, 'avatar_path') else None,
            'bio': user.bio if hasattr(user, 'bio') else None
        })
    except Exception as e:
        logging.error(f"Ошибка при получении информации о пользователе: {str(e)}")
        return jsonify({'error': 'Server error'}), 500

@user_bp.route('/upload_avatar', methods=['POST'])
def upload_avatar():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    try:
        # Проверяем, есть ли файл в запросе
        if 'avatar' not in request.files:
            return jsonify({'success': False, 'error': 'No file part'})
        
        file = request.files['avatar']
        
        # Если пользователь не выбрал файл
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'})
        
        # Если файл есть и имеет допустимое расширение
        if file and allowed_file(file.filename):
            # Безопасно сохраняем имя файла
            filename = secure_filename(file.filename)
            # Добавляем user_id к имени файла для уникальности
            filename = f"user_{session['user_id']}_{filename}"
            
            # Создаем папку, если её нет
            try:
                if not os.path.exists(current_app.config['UPLOAD_FOLDER']):
                    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
                    logging.info(f"Создана папка для аватаров: {current_app.config['UPLOAD_FOLDER']}")
            except Exception as mkdir_error:
                logging.error(f"Ошибка при создании папки для аватаров: {str(mkdir_error)}")
                return jsonify({'success': False, 'error': 'Upload directory error'})
            
            # Путь для сохранения
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            # Сохраняем файл
            try:
                file.save(filepath)
                logging.info(f"Файл сохранен: {filepath}")
            except Exception as save_error:
                logging.error(f"Ошибка при сохранении файла: {str(save_error)}")
                return jsonify({'success': False, 'error': 'File save error'})
            
            # Получаем пользователя и обновляем путь к аватарке
            user = User.query.get(session['user_id'])
            if user:
                try:
                    # Проверяем, есть ли атрибут avatar_path
                    if not hasattr(user, 'avatar_path'):
                        logging.warning('Колонка avatar_path отсутствует в модели User')
                        return jsonify({'success': False, 'error': 'Schema error'})
                    
                    # Относительный путь для URL
                    relative_path = os.path.join('static', 'avatars', filename).replace('\\', '/')
                    user.avatar_path = relative_path
                    db.session.commit()
                    logging.info(f"Обновлен avatar_path для пользователя {user.id}: {relative_path}")
                    return jsonify({
                        'success': True,
                        'avatar_path': relative_path,
                        'message': 'Avatar uploaded successfully'
                    })
                except Exception as db_error:
                    db.session.rollback()
                    logging.error(f"Ошибка при обновлении в БД: {str(db_error)}")
                    return jsonify({'success': False, 'error': 'Database error'})
            return jsonify({'success': False, 'error': 'User not found'})
        return jsonify({'success': False, 'error': 'File type not allowed'})
    except Exception as e:
        logging.error(f"Неожиданная ошибка в upload_avatar: {str(e)}")
        return jsonify({'success': False, 'error': 'Server error'})

@user_bp.route('/update_profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    try:
        # Получаем данные из формы
        name = request.form.get('name', '').strip()
        bio = request.form.get('bio', '').strip()
        
        # Проверяем корректность данных
        if not name:
            return jsonify({'success': False, 'error': 'Имя не может быть пустым'}), 400
        
        # Получаем пользователя из БД
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
        
        # Обновляем данные
        user.name = name
        user.bio = bio
        
        # Сохраняем в БД
        try:
            db.session.commit()
            # Обновляем данные в сессии
            session['user_name'] = user.name
            
            return jsonify({
                'success': True,
                'user_name': user.name,
                'bio': user.bio or 'Нет информации',
                'avatar_path': user.avatar_path  # Make sure to include the avatar path
            })
        except Exception as db_error:
            db.session.rollback()
            logging.error(f"Ошибка при обновлении профиля в БД: {str(db_error)}")
            return jsonify({'success': False, 'error': 'Ошибка базы данных'}), 500
    except Exception as e:
        logging.error(f"Неожиданная ошибка в update_profile: {str(e)}")
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500
