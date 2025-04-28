from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from app import app, db
from app.models import User, Group, Message
from datetime import datetime, timedelta
import os
from werkzeug.utils import secure_filename

# Профильди өзгөртүү үчүн директорияны аныктап алуу
UPLOAD_FOLDER = 'static/profile_pics'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['ALLOWED_EXTENSIONS'] = ALLOWED_EXTENSIONS

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))

    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        if User.query.filter_by(username=username).first():
            flash('Мындай колдонуучу аты бар', 'danger')
            return render_template('register.html')

        if User.query.filter_by(email=email).first():
            flash('Мындай email бар', 'danger')
            return render_template('register.html')

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        flash('Сиз ийгиликтүү катталдыңыз!', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = User.query.filter_by(username=username).first()

        if not user or not user.check_password(password):
            flash('Колдонуучу аты же пароль туура эмес', 'danger')
            return render_template('login.html')

        login_user(user)
        return redirect(url_for('chat'))

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/chat')
@login_required
def chat():
    contacts = current_user.contacts_list.all()
    groups = current_user.groups
    for contact in contacts:
        contact.last_message = contact.get_last_message_with(current_user.id)
    for group in groups:
        group.last_message = group.get_last_message()
    return render_template('chat.html', contacts=contacts, groups=groups)

@app.route('/new_contact', methods=['GET', 'POST'])
@login_required
def new_contact():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        first_name = request.form.get('first_name', '').strip()
        last_name = request.form.get('last_name', '').strip()

        # Проверяем правильность ввода
        if not email and not (first_name or last_name):
            flash('Сураныч, колдонуучунун email же аты-жөнүн киргизиңиз', 'danger')
            return render_template('new_contact.html')

        # Ищем пользователя по email (приоритетный поиск)
        user = None
        if email:
            user = User.query.filter_by(email=email).first()
        
        # Если по email не найден, ищем по имени и фамилии
        if not user and (first_name or last_name):
            query = User.query
            
            if first_name:
                query = query.filter(User.first_name.ilike(f"%{first_name}%"))
            
            if last_name:
                query = query.filter(User.last_name.ilike(f"%{last_name}%"))
            
            # Получаем результаты поиска
            users = query.all()
            
            # Если найдено несколько пользователей, отображаем список выбора
            if len(users) > 1:
                return render_template('select_contact.html', users=users)
            elif len(users) == 1:
                user = users[0]

        # Если пользователь не найден
        if not user:
            flash('Мындай колдонуучу табылган жок. Башка маалыматтарды киргизип көрүңүз.', 'danger')
            return render_template('new_contact.html')

        # Проверяем, является ли пользователь уже контактом
        if current_user.id == user.id:
            flash('Сиз өзүңүздү контакт катары кошо албайсыз', 'warning')
            return redirect(url_for('chat'))

        if current_user.is_contact(user):
            flash('Бул колдонуучу сиздин контакттарыңызда бар', 'warning')
            return redirect(url_for('chat'))

        # Добавляем контакт
        current_user.add_contact(user)
        db.session.commit()

        flash(f'{user.username} контакт катары ийгиликтүү кошулду!', 'success')
        return redirect(url_for('chat'))

    return render_template('new_contact.html')

@app.route('/select_contact/<int:user_id>', methods=['POST'])
@login_required
def select_contact(user_id):
    user = User.query.get_or_404(user_id)
    
    # Проверяем, является ли пользователь уже контактом
    if current_user.id == user.id:
        flash('Сиз өзүңүздү контакт катары кошо албайсыз', 'warning')
        return redirect(url_for('chat'))
        
    if current_user.is_contact(user):
        flash('Бул колдонуучу сиздин контакттарыңызда бар', 'warning')
        return redirect(url_for('chat'))
    
    # Добавляем контакт
    current_user.add_contact(user)
    db.session.commit()
    
    flash(f'{user.username} контакт катары ийгиликтүү кошулду!', 'success')
    return redirect(url_for('chat'))

@app.route('/new_group', methods=['GET', 'POST'])
@login_required
def new_group():
    if request.method == 'POST':
        name = request.form.get('name')

        if not name:
            flash('Группанын аты бош боло албайт', 'danger')
            return redirect(url_for('new_group'))

        group = Group(name=name, creator_id=current_user.id)
        group.members.append(current_user)
        db.session.add(group)
        db.session.commit()

        flash('Жаңы группа түзүлдү!', 'success')
        return redirect(url_for('add_contacts_to_group', group_id=group.id))

    return render_template('new_group.html')

@app.route('/add_contacts_to_group/<int:group_id>', methods=['GET', 'POST'])
@login_required
def add_contacts_to_group(group_id):
    group = Group.query.get_or_404(group_id)
    if request.method == 'POST':
        selected_contacts = request.form.getlist('contacts')
        for contact_id in selected_contacts:
            contact = User.query.get(contact_id)
            if contact and contact not in group.members:
                group.members.append(contact)
        db.session.commit()
        flash('Контакттар группага ийгиликтүү кошулду!', 'success')
        return redirect(url_for('chat'))

    # Изменяем формат представления участников группы
    group_members = []
    for member in group.members:
        if member != current_user:
            display_name = member.username
            if not display_name and (member.first_name or member.last_name):
                display_name = f"{member.first_name or ''} {member.last_name or ''}".strip()
            elif not display_name:
                display_name = member.email
            group_members.append(display_name)

    contacts = current_user.contacts_list.all()
    return render_template('add_contacts_to_group.html', group=group, contacts=contacts, group_members=group_members)

@app.route('/new_subgroup', methods=['GET', 'POST'])
@login_required
def new_subgroup():
    if request.method == 'POST':
        name = request.form.get('name')
        parent_group_id = request.form.get('parent_group')

        if not name:
            flash('Подгруппанын аты бош боло албайт', 'danger')
            return redirect(url_for('new_subgroup'))

        group = Group(name=name, creator_id=current_user.id)
        group.members.append(current_user)
        db.session.add(group)
        db.session.commit()

        flash('Жаңы подгруппа түзүлдү!', 'success')
        return redirect(url_for('group_info', group_id=group.id))

    groups = current_user.groups
    return render_template('new_subgroup.html', groups=groups)

@app.route('/group/<int:group_id>', methods=['GET', 'POST'])
@login_required
def group_info(group_id):
    group = Group.query.get_or_404(group_id)
    members = group.members.all()

    if request.method == 'POST':
        new_name = request.form.get('group_name')
        if new_name and new_name != group.name:
            group.name = new_name
            db.session.commit()
            flash('Группанын аты ийгиликтүү өзгөртүлдү!', 'success')
            return redirect(url_for('group_info', group_id=group.id))

    return render_template('group_info.html', group=group, members=members)

@app.route('/api/send_message', methods=['POST'])
@login_required
def send_message():
    data = request.json
    content = data.get('content')
    recipient_id = data.get('recipient_id')
    group_id = data.get('group_id')

    if not content:
        return jsonify({'error': 'Билдирүү бош боло албайт'}), 400

    message = Message(content=content, sender_id=current_user.id)
    message.created_at = datetime.utcnow() + timedelta(hours=6)  # Set time to UTC+6

    if recipient_id:
        message.recipient_id = recipient_id
    elif group_id:
        message.group_id = group_id
    else:
        return jsonify({'error': 'Алуучу же группа көрсөтүлүшү керек'}), 400

    db.session.add(message)
    db.session.commit()

    return jsonify({'message': 'Билдирүү жөнөтүлдү', 'message_id': message.id}), 200

@app.route('/api/get_messages', methods=['GET'])
@login_required
def get_messages():
    contact_id = request.args.get('contact_id')
    group_id = request.args.get('group_id')

    if contact_id:
        sent_messages = Message.query.filter_by(sender_id=current_user.id, recipient_id=contact_id).all()
        received_messages = Message.query.filter_by(sender_id=contact_id, recipient_id=current_user.id).all()
        
        # Отмечаем полученные сообщения как прочитанные
        unread_count = 0
        for msg in received_messages:
            if not msg.is_read:
                msg.is_read = True
                unread_count += 1
        
        messages = sent_messages + received_messages
        messages.sort(key=lambda x: x.created_at)
        
    elif group_id:
        messages = Message.query.filter_by(group_id=group_id).order_by(Message.created_at).all()
        
        # Отмечаем все сообщения группы как прочитанные, кроме сообщений текущего пользователя
        unread_count = 0
        for msg in messages:
            if msg.sender_id != current_user.id and not msg.is_read:
                msg.is_read = True
                unread_count += 1
    else:
        return jsonify({'error': 'Контакт же группа ID көрсөтүлүшү керек'}), 400
    
    # Сохраняем изменения, только если были непрочитанные сообщения
    if unread_count > 0:
        db.session.commit()

    # Преобразуем в JSON и отправляем
    messages_json = []
    for msg in messages:
        messages_json.append({
            'id': msg.id,
            'content': msg.content,
            'sender_id': msg.sender_id,
            'sender_name': User.query.get(msg.sender_id).username,
            'is_mine': msg.sender_id == current_user.id,
            'created_at': (msg.created_at - timedelta(hours=6)).strftime('%Y-%m-%d %H:%M:%S'),
            'is_read': msg.is_read
        })

    return jsonify({'messages': messages_json}), 200

@app.route('/api/mark_as_read', methods=['POST'])
@login_required
def mark_as_read():
    # Получаем параметры из JSON или из URL
    data = request.json or {}
    message_id = data.get('message_id')
    contact_id = data.get('contact_id') or request.args.get('contact_id')
    group_id = data.get('group_id') or request.args.get('group_id')
    
    # Если указан ID сообщения - отмечаем конкретное сообщение
    if message_id:
        message = Message.query.get(message_id)
        if message and message.recipient_id == current_user.id:
            message.is_read = True
            db.session.commit()
            return jsonify({'success': True, 'marked': 1}), 200
    
    # Если указан ID контакта - отмечаем все сообщения от этого контакта
    elif contact_id:
        messages = Message.query.filter_by(
            sender_id=contact_id, 
            recipient_id=current_user.id, 
            is_read=False
        ).all()
        
        for message in messages:
            message.is_read = True
        
        db.session.commit()
        return jsonify({'success': True, 'marked': len(messages)}), 200
    
    # Если указан ID группы - отмечаем все сообщения в группе
    elif group_id:
        group = Group.query.get(group_id)
        if group and current_user in group.members:
            count = group.mark_messages_as_read(current_user.id)
            db.session.commit()
            return jsonify({'success': True, 'marked': count}), 200
    
    return jsonify({'error': 'Необходимо указать ID сообщения, контакта или группы'}), 400

@app.route('/api/mark_all_as_read', methods=['POST'])
@login_required
def mark_all_as_read():
    data = request.json
    contact_id = data.get('contact_id')
    group_id = data.get('group_id')
    
    if contact_id:
        messages = Message.query.filter_by(sender_id=contact_id, recipient_id=current_user.id, is_read=False).all()
        for message in messages:
            message.is_read = True
        db.session.commit()
        return jsonify({'success': True, 'count': len(messages)}), 200
    
    elif group_id:
        group = Group.query.get(group_id)
        if group and current_user in group.members:
            count = group.mark_messages_as_read(current_user.id)
            db.session.commit()
            return jsonify({'success': True, 'count': count}), 200
    
    return jsonify({'error': 'Необходимо указать ID контакта или группы'}), 400

@app.route('/api/unread_counts', methods=['GET'])
@login_required
def get_unread_counts():
    # Получаем непрочитанные сообщения для каждого контакта
    contacts = current_user.contacts_list.all()
    contacts_unread = {}
    
    for contact in contacts:
        count = current_user.count_unread_messages(contact.id)
        if count > 0:
            contacts_unread[str(contact.id)] = count
    
    # Получаем непрочитанные сообщения для каждой группы
    groups = current_user.groups
    groups_unread = {}
    
    for group in groups:
        count = current_user.count_unread_group_messages(group.id)
        if count > 0:
            groups_unread[str(group.id)] = count
    
    # Общее количество непрочитанных сообщений
    total_unread = current_user.count_unread_messages() + current_user.count_unread_group_messages()
    
    return jsonify({
        'total': total_unread,
        'contacts': contacts_unread,
        'groups': groups_unread
    }), 200

@app.route('/api/create_group', methods=['POST'])
def create_group():
    data = request.get_json()
    name = data.get('name')
    group = Group(name=name, creator_id=current_user.id)
    group.members.append(current_user)
    db.session.add(group)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/create_contact', methods=['POST'])
@login_required
def create_contact():
    data = request.get_json()
    email = data.get('email', '').strip()
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    username = data.get('username', '').strip()
    
    # Проверяем правильность ввода
    if not email and not username and not (first_name or last_name):
        return jsonify({'error': 'Колдонуучу маалыматтары берилген жок'}), 400
    
    # Ищем пользователя по разным параметрам
    user = None
    
    if email:
        user = User.query.filter_by(email=email).first()
    
    if not user and username:
        user = User.query.filter_by(username=username).first()
    
    if not user and (first_name or last_name):
        query = User.query
        
        if first_name:
            query = query.filter(User.first_name.ilike(f"%{first_name}%"))
        
        if last_name:
            query = query.filter(User.last_name.ilike(f"%{last_name}%"))
        
        user = query.first()
    
    if not user:
        return jsonify({'error': 'Колдонуучу табылган жок'}), 404
    
    # Проверяем, является ли пользователь уже контактом
    if current_user.id == user.id:
        return jsonify({'error': 'Сиз өзүңүздү контакт катары кошо албайсыз'}), 400
        
    if current_user.is_contact(user):
        return jsonify({'error': 'Бул колдонуучу сиздин контакттарыңызда бар'}), 400
    
    # Добавляем контакт
    current_user.add_contact(user)
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'message': f'{user.username} контакт катары ийгиликтүү кошулду!',
        'user_id': user.id,
        'username': user.username
    }), 200

@app.route('/api/leave_group', methods=['POST'])
def leave_group():
    group_id = request.args.get('group_id')
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Группа табылган жок'}), 404

    # Remove the user from the group
    group.members.remove(current_user)
    db.session.commit()

    # Remove the group if it has no members left
    if not group.members:
        Message.query.filter_by(group_id=group.id).delete()
        db.session.delete(group)
        db.session.commit()

    return jsonify({'success': True})

@app.route('/contact/<int:contact_id>', methods=['GET', 'POST'])
@login_required
def contact_info(contact_id):
    # Контактты базадан алабыз
    contact = User.query.get_or_404(contact_id)

    # Текшерүү - бул контакт колдонуучунун контактыбы
    contact_exists = False
    for user_contact in current_user.contacts_list:
        if user_contact.id == contact.id:
            contact_exists = True
            break

    if not contact_exists:
        flash('Бул сиздин контактыңыз эмес', 'danger')
        return redirect(url_for('chat'))

    if request.method == 'POST':
        new_name = request.form.get('contact_name')
        if new_name and new_name != contact.username:
            contact.username = new_name
            db.session.commit()
            flash('Контакттын аты ийгиликтүү өзгөртүлдү!', 'success')
            return redirect(url_for('contact_info', contact_id=contact.id))

    return render_template('contact_info.html', contact=contact)

@app.route('/api/delete_contact', methods=['POST'])
@login_required
def delete_contact():
    contact_id = request.args.get('contact_id')
    contact = User.query.get(contact_id)
    if not contact:
        return jsonify({'error': 'Контакт табылган жок'}), 404

    # Текшерүү - бул контакт колдонуучунун контактыбы
    contact_exists = False
    for user_contact in current_user.contacts_list:
        if user_contact.id == contact.id:
            contact_exists = True
            break

    if not contact_exists:
        return jsonify({'error': 'Бул сиздин контактыңыз эмес'}), 400

    current_user.contacts_list.remove(contact)
    db.session.commit()

    return jsonify({'success': True})

@app.route('/api/delete_group', methods=['DELETE'])
def delete_group_api():
    group_id = request.args.get('group_id')
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Группа табылган жок'}), 404

    Message.query.filter_by(group_id=group.id).delete()
    db.session.delete(group)
    db.session.commit()

    return jsonify({'success': True})

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('Файл жүктөө кабыл албайт', 'danger')
            return redirect(url_for('profile'))
        file = request.files['file']
        if file.filename == '':
            flash('Файл тандалган эмес', 'danger')
            return redirect(url_for('profile'))
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            current_user.profile_pic = filename
            db.session.commit()
            flash('Профильди ийгиликтүү өзгөртүлдү!', 'success')
            return redirect(url_for('profile'))

    return render_template('profile.html')

@app.route('/api/group_members', methods=['GET'])
@login_required
def get_group_members():
    group_id = request.args.get('group_id')
    
    if not group_id:
        return jsonify({'error': 'Не указан ID группы'}), 400
    
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Группа не найдена'}), 404
    
    # Проверяем, является ли пользователь участником группы
    if current_user not in group.members.all():
        return jsonify({'error': 'Вы не являетесь участником этой группы'}), 403
    
    members = []
    for member in group.members:
        members.append({
            'id': member.id,
            'username': member.username,
            'email': member.email,
            'first_name': member.first_name,
            'last_name': member.last_name
        })
    
    return jsonify({
        'success': True,
        'creator_id': group.creator_id,
        'members': members
    }), 200

@app.route('/api/update_group', methods=['POST'])
@login_required
def update_group():
    data = request.json
    group_id = data.get('group_id')
    name = data.get('name')
    
    if not group_id or not name:
        return jsonify({'error': 'Не указан ID группы или новое название'}), 400
    
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Группа не найдена'}), 404
    
    # Только создатель может изменять название группы
    if group.creator_id != current_user.id:
        return jsonify({'error': 'Только создатель группы может изменять название'}), 403
    
    group.name = name
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Название группы успешно обновлено'
    }), 200
