from app import app, db
from app.models import User, Group, Message, contacts, group_members

def recreate_database():
    with app.app_context():
        # Удаляем все таблицы
        db.drop_all()
        
        # Создаем таблицы заново
        db.create_all()
        
        print("База данных успешно пересоздана!")

if __name__ == '__main__':
    recreate_database()
