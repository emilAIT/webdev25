import unittest
import json
from serv import app

class ChatAppTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    def test_register_and_login(self):
        # Регистрация
        response = self.client.post('/register', json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'testpass'
        })
        self.assertIn(response.status_code, [201, 400])  # Может быть 400 если пользователь уже есть

        # Логин
        response = self.client.post('/login', json={
            'email': 'test@example.com',
            'password': 'testpass'
        })
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('user_id', data)
        self.user_id = data['user_id']

    def test_add_and_remove_friend(self):
        # Добавим друга самому себе (тестовая операция)
        self.test_register_and_login()
        response = self.client.post('/friends_add', json={
            'user_id': self.user_id,
            'friend_id': self.user_id
        })
        self.assertEqual(response.status_code, 200)

        # Удалим этого "друга"
        response = self.client.post('/friends_remove', json={
            'user_id': self.user_id,
            'friend_id': self.user_id
        })
        self.assertEqual(response.status_code, 200)

    def test_create_group_and_send_message(self):
        self.test_register_and_login()

        # Создание группы
        response = self.client.post('/groups_create', json={
            'name': 'Test Group',
            'creator_id': self.user_id
        })
        self.assertEqual(response.status_code, 200)
        group_id = json.loads(response.data)['group_id']

        # Отправка сообщения в группу
        response = self.client.post('/messages_send', json={
            'sender_id': self.user_id,
            'group_id': group_id,
            'content': 'Hello group!'
        })
        self.assertEqual(response.status_code, 200)

        # Получение сообщений
        response = self.client.get(f'/messages/{group_id}')
        self.assertEqual(response.status_code, 200)
        messages = json.loads(response.data)
        self.assertTrue(len(messages) > 0)
        self.assertEqual(messages[-1]['content'], 'Hello group!')

if __name__ == '__main__':
    unittest.main()
