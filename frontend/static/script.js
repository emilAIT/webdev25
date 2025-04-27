// Пример: AJAX регистрация (без перезагрузки)
document.addEventListener('DOMContentLoaded', function () {
    const regForm = document.querySelector('form[action="/register"]');
    if (regForm) {
        regForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(regForm);
            const resp = await fetch('/register', {
                method: 'POST',
                body: formData
            });
            if (resp.redirected) {
                window.location.href = resp.url;
            } else {
                const text = await resp.text();
                alert('Ошибка регистрации: ' + text);
            }
        });
    }

    // Пример: AJAX логин
    const loginForm = document.querySelector('form[action="/login"]');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const resp = await fetch('/login', {
                method: 'POST',
                body: formData
            });
            if (resp.redirected) {
                window.location.href = resp.url;
            } else {
                const text = await resp.text();
                alert('Ошибка входа: ' + text);
            }
        });
    }

    // Пример: Поиск пользователей (на странице Users)
    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', async function () {
            const query = searchInput.value;
            const resp = await fetch('/api/users?search=' + encodeURIComponent(query));
            const users = await resp.json();
            const usersList = document.getElementById('users-list');
            usersList.innerHTML = '';
            users.forEach(user => {
                const li = document.createElement('li');
                li.textContent = user.name;
                usersList.appendChild(li);
            });
        });
    }
});

// Функционал чата
function initChat() {
    const messageForm = document.getElementById('message-form');
    const messages = document.getElementById('messages');
    const chatId = window.location.pathname.split('/').pop();

    if (messageForm && messages) {
        // Загрузка сообщений
        async function loadMessages() {
            const resp = await fetch(`/api/messages?chat_id=${chatId}`);
            const msgs = await resp.json();
            messages.innerHTML = '';
            msgs.forEach(msg => {
                const div = document.createElement('div');
                div.className = `message ${msg.is_mine ? 'sent' : 'received'}`;
                div.textContent = msg.text;
                messages.appendChild(div);
            });
            messages.scrollTop = messages.scrollHeight;
        }

        // Отправка сообщения
        messageForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(messageForm);
            formData.append('chat_id', chatId);

            await fetch('/api/messages', {
                method: 'POST',
                body: formData
            });

            messageForm.reset();
            loadMessages();
        });

        // Периодическое обновление
        loadMessages();
        setInterval(loadMessages, 3000);
    }
}

// Функционал друзей
function initFriends() {
    const friendsList = document.getElementById('friends-list');
    if (friendsList) {
        async function loadFriends() {
            const resp = await fetch('/api/friends');
            const friends = await resp.json();
            friendsList.innerHTML = '';
            friends.forEach(friend => {
                const li = document.createElement('li');
                li.innerHTML = `
                    ${friend.name}
                    <button onclick="removeFriend(${friend.id})">Удалить</button>
                `;
                friendsList.appendChild(li);
            });
        }
        loadFriends();
    }
}

// Функционал профиля
function initProfile() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const resp = await fetch('/api/profile', {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                alert('Профиль обновлен');
            } else {
                const text = await resp.text();
                alert('Ошибка: ' + text);
            }
        });
    }
}

// Инициализация всех модулей
document.addEventListener('DOMContentLoaded', function () {
    initChat();
    initFriends();
    initProfile();
    loadChats();
});

// Функция для загрузки чатов
async function loadChats() {
    const resp = await fetch('/api/chats');
    const chats = await resp.json();
    const chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '';

    // Создаем объект для хранения последних сообщений с каждым пользователем
    const lastMessages = {};

    // Сортируем сообщения по времени и находим последнее для каждого пользователя
    chats.forEach(chat => {
        if (!lastMessages[chat.user_id] || new Date(chat.created_at) > new Date(lastMessages[chat.user_id].created_at)) {
            lastMessages[chat.user_id] = chat;
        }
    });

    // Отображаем только последние сообщения
    Object.values(lastMessages).forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <a href="/chat/${chat.user_id}">
                <div class="chat-info">
                    <h3>${chat.user_name}</h3>
                    <p>${chat.text}</p>
                    <small>${new Date(chat.created_at).toLocaleString()}</small>
                </div>
            </a>
        `;
        chatsList.appendChild(div);
    });
}

// Функция удаления друга
async function removeFriend(friendId) {
    try {
        const resp = await fetch(`/api/friends/${friendId}`, {
            method: 'DELETE'
        });
        if (resp.ok) {
            // Перезагружаем список друзей после удаления
            const friendsList = document.getElementById('friends-list');
            if (friendsList) {
                const resp = await fetch('/api/friends');
                const friends = await resp.json();
                friendsList.innerHTML = '';
                friends.forEach(friend => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        ${friend.name}
                        <button onclick="removeFriend(${friend.id})">Удалить</button>
                    `;
                    friendsList.appendChild(li);
                });
            }
        } else {
            alert('Ошибка при удалении друга');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка при удалении друга');
    }
}
