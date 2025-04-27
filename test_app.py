import unittest
from app import app, db
from models.user import User

class FlaskTestCase(unittest.TestCase):
    # Настройка перед каждым тестом
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/test.db'
        self.app = app.test_client()
        with app.app_context():
            db.create_all()
            # Создаем тестового пользователя
            test_user = User(name='Test User', email='test@example.com')
            test_user.set_password('password123')
            db.session.add(test_user)
            db.session.commit()
    
    # Очистка после каждого теста
    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()
    
    # Тест главной страницы (редирект на логин)
    def test_index(self):
        response = self.app.get('/', follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Login', response.data)
    
    # Тест страницы логина
    def test_login_page(self):
        response = self.app.get('/login')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Login', response.data)
    
    # Тест входа в систему
    def test_login_functionality(self):
        response = self.app.post('/login', 
                                data=dict(email='test@example.com', password='password123'),
                                follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'main', response.data)

if __name__ == '__main__':
    unittest.main()
