from app import app, db
from app.models import User

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Создаем администратора, если его нет
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(username='admin', email='admin@example.com', is_admin=True)
            admin.set_password('admin')
            db.session.add(admin)
            db.session.commit()
            print('Admin user created: username=admin, password=admin')
            
    app.run(debug=True, host='0.0.0.0')