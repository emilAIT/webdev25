console.log('script.js загружен');

// Глобальная функция для отображения flash-сообщений
function showFlashMessage(message, type) {
    console.log(`Показываю flash-сообщение: ${message} (${type})`);
    const flashMessages = document.getElementById('flash-messages');
    if (flashMessages) {
        const div = document.createElement('div');
        div.className = `flash-${type}`;
        div.textContent = message;
        flashMessages.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    } else {
        console.warn('Контейнер flash-сообщений не найден, сообщение не отображено:', message);
    }
}

// Вспомогательная функция для форматирования даты на русском
function formatDateToRussian(date) {
    const months = [
        'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
        'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    return `${day} ${month}`;
}

// === Move these functions to global scope ===
async function loadRecentChats() {
    const token = localStorage.getItem('token');
    const chatList = document.getElementById('chat-list');
    console.log('Загружаю недавние чаты');
    try {
        const response = await fetch('/messages/recent', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Не удалось загрузить недавние чаты: ${response.status} (${errorText})`);
        }
        const recentChats = await response.json();
        console.log('Недавние чаты:', recentChats);
        chatList.innerHTML = '';
        if (recentChats.length === 0) {
            chatList.innerHTML = '<div class="group-item">Нет недавних чатов</div>';
        } else {
            recentChats.forEach(chat => {
                addChatToList(chat.user_id, chat.group_id, chat.username, chat.avatar_url, chat.unread_count, chat.is_group);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки недавних чатов:', error);
        showFlashMessage(`Не удалось загрузить недавние чаты: ${error.message}`, 'danger');
    }
}

async function addChatToList(userId, groupId, username, avatarUrl, unreadCount, isGroup) {
    const id = isGroup ? groupId : userId;
    const chatList = document.getElementById('chat-list');
    const existingChat = document.querySelector(`.group-item[data-id="${id}"][data-is-group="${isGroup}"]`);
    if (!existingChat) {
        const chatItem = document.createElement('div');
        chatItem.className = 'group-item';
        chatItem.dataset.id = id;
        chatItem.dataset.isGroup = isGroup;
        // Добавляем аватарку
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'group-avatar';
        if (avatarUrl) {
            const avatarImg = document.createElement('img');
            avatarImg.src = avatarUrl;
            avatarImg.alt = username;
            avatarDiv.appendChild(avatarImg);
        } else {
            avatarDiv.innerHTML = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="12" fill="#1E90FF"/>
                    <circle cx="12" cy="8" r="4" fill="white"/>
                    <path d="M12 14c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z" fill="white"/>
                </svg>
            `;
        }
        chatItem.appendChild(avatarDiv);
        // Добавляем информацию о чате
        const infoDiv = document.createElement('div');
        infoDiv.className = 'group-info';
        infoDiv.innerHTML = `
            <span class="group-name">${username}</span>
            ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
        `;
        chatItem.appendChild(infoDiv);
        chatItem.addEventListener('click', async () => {
            // These variables are only in initChat, so you may need to update this if you want to use them globally
            // For now, just reload messages
            document.getElementById('chat-title').textContent = username;
            loadMessages(userId, groupId);
            document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
            chatItem.classList.add('active');
            updateUnreadCount(id, isGroup, 0);
        });
        chatList.appendChild(chatItem);
    } else {
        updateUnreadCount(id, isGroup, unreadCount);
    }
}

function updateUnreadCount(id, isGroup, unreadCount) {
    const chatItem = document.querySelector(`.group-item[data-id="${id}"][data-is-group="${isGroup}"]`);
    if (chatItem) {
        const existingCounter = chatItem.querySelector('.unread-count');
        if (unreadCount > 0) {
            if (existingCounter) {
                existingCounter.textContent = unreadCount;
            } else {
                const counter = document.createElement('span');
                counter.className = 'unread-count';
                counter.textContent = unreadCount;
                chatItem.querySelector('.group-info').appendChild(counter);
            }
        } else if (existingCounter) {
            existingCounter.remove();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Событие DOMContentLoaded сработало');
    const token = localStorage.getItem('token');
    console.log('Проверка токена:', token);

    // Проверка доступа к /chat
    if (window.location.pathname === '/chat') {
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Запрос к /chat с токеном:', token);
            const response = await fetch('/chat?token=' + encodeURIComponent(token), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Не удалось получить доступ к /chat:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Доступ к /chat подтвержден');
            initChat();
        } catch (error) {
            console.error('Ошибка проверки доступа к /chat:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Проверка доступа к /my-profile
    if (window.location.pathname === '/my-profile') {
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Запрос к /my-profile с токеном:', token);
            const response = await fetch('/my-profile?token=' + encodeURIComponent(token), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Не удалось получить доступ к /my-profile:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Доступ к /my-profile подтвержден');
            loadProfile();
        } catch (error) {
            console.error('Ошибка проверки доступа к /my-profile:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Проверка доступа к /profile/{user_id}
    if (window.location.pathname.startsWith('/profile/')) {
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Запрос к /profile с токеном:', token);
            const response = await fetch(window.location.pathname + '?token=' + encodeURIComponent(token), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Не удалось получить доступ к /profile:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Доступ к /profile подтвержден');
            loadUserProfile();
        } catch (error) {
            console.error('Ошибка проверки доступа к /profile:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Проверка доступа к /edit-profile
    if (window.location.pathname === '/edit-profile') {
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        try {
            console.log('Запрос к /edit-profile с токеном:', token);
            const response = await fetch('/edit-profile?token=' + encodeURIComponent(token), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error('Не удалось получить доступ к /edit-profile:', response.status, await response.text());
                localStorage.removeItem('token');
                window.location.href = '/';
                return;
            }
            console.log('Доступ к /edit-profile подтвержден');
            loadEditProfile();
        } catch (error) {
            console.error('Ошибка проверки доступа к /edit-profile:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // Обработка формы входа
    const signinForm = document.getElementById('signin-form');
    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Форма входа отправлена');
            const formData = new FormData(signinForm);
            try {
                console.log('Отправляю запрос на /token');
                const response = await fetch('/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData)
                });
                console.log('Получен ответ от /token:', response.status);
                const result = await response.json();
                console.log('Результат входа:', result);
                if (response.ok) {
                    localStorage.setItem('token', result.access_token);
                    // Fetch user info to check if admin
                    const userInfo = await fetch('/users/me', {
                        headers: { 'Authorization': `Bearer ${result.access_token}` }
                    });
                    const user = await userInfo.json();
                    if (user.is_admin) {
                        window.location.href = '/admin?token=' + encodeURIComponent(result.access_token);
                    } else {
                        window.location.href = '/chat?token=' + encodeURIComponent(result.access_token);
                    }
                } else {
                    console.error('Ошибка входа:', result.detail);
                    showFlashMessage(result.detail, 'danger');
                }
            } catch (error) {
                console.error('Ошибка входа:', error);
                showFlashMessage('Не удалось войти, попробуйте снова', 'danger');
            }
        });
    }

    // Обработка формы регистрации
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.removeEventListener('submit', handleSignupSubmit);
        signupForm.addEventListener('submit', handleSignupSubmit);
    }

    async function handleSignupSubmit(e) {
        e.preventDefault();
        console.log('Форма регистрации отправлена');
        const formData = new FormData(signupForm);
        const data = Object.fromEntries(formData);
        if (data.password !== data.confirm_password) {
            showFlashMessage('Пароли не совпадают', 'danger');
            return;
        }
        try {
            console.log('Отправляю запрос на /signup PRIME с данными:', data);
            const response = await fetch('/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            console.log('Получен ответ от /signup:', response.status);
            const result = await response.json();
            console.log('Результат регистрации:', result);
            if (response.ok) {
                showFlashMessage('Регистрация успешна! Перенаправляю на вход...', 'success');
                console.log('Планирую перенаправление на / через 2000 мс');
                setTimeout(() => {
                    console.log('Выполняю перенаправление на /');
                    window.location.assign('/');
                }, 2000);
            } else {
                showFlashMessage(result.detail, 'danger');
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            showFlashMessage(`Не удалось зарегистрироваться: ${error.message}`, 'danger');
        }
    }

    // Обработка формы "Забыли пароль"
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Форма "Забыли пароль" отправлена');
            const formData = new FormData(forgotPasswordForm);
            try {
                console.log('Отправляю запрос на /forgot-password');
                const response = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData)
                });
                console.log('Получен ответ от /forgot-password:', response.status);
                const result = await response.json();
                console.log('Результат:', result);
                if (response.ok) {
                    showFlashMessage('Ссылка для сброса пароля отправлена на ваш email', 'success');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 3000);
                } else {
                    showFlashMessage(result.detail, 'danger');
                }
            } catch (error) {
                console.error('Ошибка запроса сброса пароля:', error);
                showFlashMessage('Не удалось отправить запрос, попробуйте снова', 'danger');
            }
        });
    }

    // Обработка формы сброса пароля
    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Форма сброса пароля отправлена');
            const formData = new FormData(resetPasswordForm);
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (!token) {
                showFlashMessage('Токен отсутствует, запросите новую ссылку', 'danger');
                return;
            }
            formData.append('token', token);
            const data = Object.fromEntries(formData);
            if (data.new_password !== data.confirm_password) {
                showFlashMessage('Пароли не совпадают', 'danger');
                return;
            }
            try {
                console.log('Отправляю запрос на /reset-password');
                const response = await fetch('/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData)
                });
                console.log('Получен ответ от /reset-password:', response.status);
                const result = await response.json();
                if (response.ok) {
                    showFlashMessage('Пароль успешно сброшен! Перенаправляю на вход...', 'success');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } else {
                    showFlashMessage(result.detail, 'danger');
                }
            } catch (error) {
                console.error('Ошибка сброса пароля:', error);
                showFlashMessage('Не удалось сбросить пароль, попробуйте снова', 'danger');
            }
        });
    }

    // Загрузка профиля текущего пользователя
    function loadProfile() {
        console.log('Загружаю профиль');
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        fetch('/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Не удалось загрузить данные пользователя: ${response.status}`);
            }
            return response.json();
        })
        .then(user => {
            console.log('Данные пользователя:', user);
            document.getElementById('profile-username').textContent = user.username || 'Не указано';
            document.getElementById('profile-username-display').textContent = '@' + (user.username || 'Не указано');
            document.getElementById('profile-mobile').textContent = user.mobile || 'Не указано';
            if (user.date_of_birth) {
                const dob = new Date(user.date_of_birth);
                const age = Math.floor((new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25));
                document.getElementById('profile-dob').textContent = `${user.date_of_birth} (${age} лет)`;
            } else {
                document.getElementById('profile-dob').textContent = 'Не указано';
            }
            if (user.avatar_url) {
                const avatarImg = document.getElementById('avatar-img');
                avatarImg.src = user.avatar_url;
                avatarImg.style.display = 'block';
                document.getElementById('avatar-svg').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки профиля:', error);
            showFlashMessage(`Не удалось загрузить профиль: ${error.message}`, 'danger');
            localStorage.removeItem('token');
            window.location.href = '/';
        });

        const closeBtn = document.getElementById('close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия профиля');
                window.history.back();
            });
        }

        const editBtn = document.getElementById('edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                console.log('Нажата кнопка редактирования профиля');
                window.location.href = '/edit-profile?token=' + encodeURIComponent(token);
            });
        }
    }

    // Загрузка профиля другого пользователя
    function loadUserProfile() {
        console.log('Загружаю профиль пользователя');
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
        const userId = window.location.pathname.split('/')[2]; // Извлекаем user_id из URL
        fetch(`/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Не удалось загрузить данные пользователя: ${response.status}`);
            }
            return response.json();
        })
        .then(user => {
            console.log('Данные пользователя:', user);
            document.getElementById('profile-username').textContent = user.username || 'Не указано';
            document.getElementById('profile-username-display').textContent = '@' + (user.username || 'Не указано');
            document.getElementById('profile-mobile').textContent = user.mobile || 'Не указано';
            if (user.date_of_birth) {
                const dob = new Date(user.date_of_birth);
                const age = Math.floor((new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25));
                document.getElementById('profile-dob').textContent = `${user.date_of_birth} (${age} лет)`;
            } else {
                document.getElementById('profile-dob').textContent = 'Не указано';
            }
            if (user.avatar_url) {
                const avatarImg = document.getElementById('avatar-img');
                avatarImg.src = user.avatar_url;
                avatarImg.style.display = 'block';
                document.getElementById('avatar-svg').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки профиля:', error);
            showFlashMessage(`Не удалось загрузить профиль: ${error.message}`, 'danger');
            localStorage.removeItem('token');
            window.location.href = '/';
        });

        const closeBtn = document.getElementById('close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия профиля');
                window.history.back();
            });
        }
    }

    // Загрузка страницы редактирования профиля
    function loadEditProfile() {
        console.log('Загружаю редактирование профиля');
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Токен отсутствует, перенаправляю на /');
            window.location.href = '/';
            return;
        }
    
        fetch('/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Не удалось загрузить данные пользователя: ${response.status}`);
            }
            return response.json();
        })
        .then(user => {
            console.log('Данные пользователя:', user);
            document.getElementById('username').value = user.username || '';
            document.getElementById('mobile').value = user.mobile || '';
            document.getElementById('date_of_birth').value = user.date_of_birth || '';
            if (user.avatar_url) {
                const avatarImg = document.getElementById('avatar-img');
                avatarImg.src = user.avatar_url;
                avatarImg.style.display = 'block';
                document.getElementById('avatar-svg').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки данных профиля:', error);
            showFlashMessage(`Не удалось загрузить данные профиля: ${error.message}`, 'danger');
            localStorage.removeItem('token');
            window.location.href = '/';
        });
    
        const avatarUpload = document.getElementById('avatar-upload');
        const changeAvatarBtn = document.getElementById('change-avatar-btn');
        const avatarImg = document.getElementById('avatar-img');
        const avatarSvg = document.getElementById('avatar-svg');
    
        if (changeAvatarBtn && avatarUpload) {
            changeAvatarBtn.addEventListener('click', () => {
                avatarUpload.click();
            });
    
            avatarUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        avatarImg.src = event.target.result;
                        avatarImg.style.display = 'block';
                        avatarSvg.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    
        const editProfileForm = document.getElementById('edit-profile-form');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Форма редактирования профиля отправлена');
    
                const formData = new FormData(editProfileForm);
                const dateOfBirth = formData.get('date_of_birth');
    
                // Преобразуем дату из ДД.ММ.ГГГГ в YYYY-MM-DD, если она введена в таком формате
                if (dateOfBirth && /^\d{2}\.\d{2}\.\d{4}$/.test(dateOfBirth)) {
                    console.log(`Преобразую дату из ${dateOfBirth}`);
                    const [day, month, year] = dateOfBirth.split('.');
                    const transformedDate = `${year}-${month}-${day}`;
                    formData.set('date_of_birth', transformedDate);
                    console.log(`Дата преобразована в ${transformedDate}`);
                }
    
                if (avatarUpload.files[0]) {
                    formData.append('avatar', avatarUpload.files[0]);
                }
    
                try {
                    console.log('Отправляю PUT-запрос на /users/me');
                    const response = await fetch('/users/me', {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    console.log('Получен ответ от PUT /users/me:', response.status);
                    const result = await response.json();
                    if (response.ok) {
                        showFlashMessage('Профиль успешно обновлен', 'success');
                        setTimeout(() => {
                            window.history.back();
                        }, 2000);
                    } else {
                        console.error('Ошибка обновления:', result.detail);
                        showFlashMessage(result.detail, 'danger');
                    }
                } catch (error) {
                    console.error('Ошибка обновления:', error);
                    showFlashMessage(`Не удалось обновить профиль: ${error.message}`, 'danger');
                }
            });
        }
    
        const backBtn = document.getElementById('back-btn');
        const closeBtn = document.getElementById('close-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log('Нажата кнопка возврата к профилю');
                window.history.back();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия редактирования профиля');
                window.history.back();
            });
        }
    }

    // Инициализация чата
    function initChat() {
        console.log('Инициализация чата');
        let currentChatUserId = null;
        let currentGroupId = null;
        let currentUserId = null;
        let ws = null;
        let hasMarkedAsRead = false;
        let hasInteracted = false;
        let lastMessageDate = null; // Для отслеживания последней даты сообщения

        let selectedFiles = [];
        const chatForm = document.getElementById('chat-form');
        const messageInput = document.getElementById('message-input');
        const chatMessages = document.getElementById('chat-messages');
        const chatList = document.getElementById('chat-list');
        const searchInput = document.getElementById('search-user-input');
        const searchResults = document.getElementById('search-results');
        const logoutBtn = document.getElementById('logout-btn');
        const profileBtn = document.getElementById('profile-btn');
        const createGroupBtn = document.getElementById('create-group-btn');
        const menuIcon = document.querySelector('.menu-icon');
        const menuDrawer = document.querySelector('.menu-drawer');
        const moreOptions = document.querySelector('.more-options');
        const chatOptionsDrawer = document.querySelector('.chat-options-drawer');
        const createGroupModal = document.getElementById('create-group-modal');
        const createGroupForm = document.getElementById('create-group-form');
        const groupNameInput = document.getElementById('group-name');
        const groupDescriptionInput = document.getElementById('group-description');
        const groupAvatarInput = document.getElementById('group-avatar');
        const groupMembersInput = document.getElementById('group-members');
        const groupMembersList = document.getElementById('group-members-list');
        const groupMembersSearchResults = document.getElementById('group-members-search-results');
        const closeModalBtn = document.getElementById('close-modal-btn');

        
        const photoVideoUpload = document.getElementById('photo-video-upload');
        const fileUpload = document.getElementById('file-upload');
        const attachmentBtn = document.getElementById('attachment-btn');
        const attachmentMenu = document.getElementById('attachment-menu');
        const previewContainer = document.getElementById('preview-container');
        const previewImages = document.getElementById('preview-images');
        const clearPreviewBtn = document.getElementById('clear-preview-btn');
        
        console.log('photoVideoUpload:', photoVideoUpload);
        console.log('previewContainer:', previewContainer);
        console.log('previewImages:', previewImages);
        
        // Кнопка для открытия панели emoji
        const emojiBtn = document.getElementById('emoji-btn');
        const emojiPanel = document.getElementById('emoji-panel');

        if (chatList) {
            chatList.addEventListener('click', (e) => {
                const chatItem = e.target.closest('.group-item');
                if (chatItem) {
                    const isGroup = chatItem.dataset.isGroup === 'true';
                    currentGroupId = isGroup ? parseInt(chatItem.dataset.id) : null;
                    currentChatUserId = isGroup ? null : parseInt(chatItem.dataset.id);
                    console.log('Выбран чат, currentGroupId:', currentGroupId, 'currentChatUserId:', currentChatUserId);
                }
            });
        }

        if (!photoVideoUpload || !fileUpload || !previewContainer || !previewImages) {
            console.error('Один из элементов для загрузки файлов не найден:', {
                photoVideoUpload, fileUpload, previewContainer, previewImages
            });
            showFlashMessage('Ошибка интерфейса: элементы для загрузки файлов не найдены', 'danger');
            return;
        }
    
        photoVideoUpload.addEventListener('change', (e) => {
            console.log('Выбраны файлы для фото/видео:', e.target.files);
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                selectedFiles = [...selectedFiles, ...files];
                console.log('Обновлённый selectedFiles:', selectedFiles);
                updatePreview();
            } else {
                console.log('Файлы не выбраны');
            }
            photoVideoUpload.value = ''; // Очищаем input
            attachmentMenu.classList.remove('active');
        });
    
        fileUpload.addEventListener('change', (e) => {
            console.log('Выбран файл:', e.target.files);
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                selectedFiles = [...selectedFiles, ...files];
                console.log('Обновлённый selectedFiles:', selectedFiles);
                updatePreview();
            } else {
                console.log('Файлы не выбраны');
            }
            fileUpload.value = ''; // Очищаем input
            attachmentMenu.classList.remove('active');
        });

        if (attachmentBtn && attachmentMenu) {
            attachmentBtn.addEventListener('click', () => {
                console.log('Нажата кнопка скрепки');
                attachmentMenu.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!attachmentBtn.contains(e.target) && !attachmentMenu.contains(e.target)) {
                    attachmentMenu.classList.remove('active');
                }
            });
        } else {
            console.error('Кнопка скрепки или меню не найдены');
        }

        if (emojiBtn && emojiPanel) {
            // Открытие/закрытие панели эмодзи при клике на кнопку
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем закрытие панели из-за клика
                console.log('Нажата кнопка смайлика');
                emojiPanel.classList.toggle('active');
            });

            // Закрытие панели при клике вне её или кнопки
            document.addEventListener('click', (e) => {
                if (!emojiBtn.contains(e.target) && !emojiPanel.contains(e.target)) {
                    console.log('Клик вне панели эмодзи, закрываю');
                    emojiPanel.classList.remove('active');
                }
            });

            // Переключение категорий эмодзи
            const emojiTabs = emojiPanel.querySelectorAll('.emoji-tab');
            const emojiCategories = emojiPanel.querySelectorAll('.emoji-category');

            emojiTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.stopPropagation(); // Предотвращаем закрытие панели
                    e.preventDefault(); // Предотвращаем возможную отправку формы
                    // Удаляем класс active у всех вкладок и категорий
                    emojiTabs.forEach(t => t.classList.remove('active'));
                    emojiCategories.forEach(c => c.classList.remove('active'));

                    // Добавляем класс active к текущей вкладке и категории
                    const category = tab.getAttribute('data-category');
                    tab.classList.add('active');
                    document.getElementById(category).classList.add('active');
                });
            });

            // Обработчик выбора эмодзи
            emojiPanel.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем закрытие панели
                e.preventDefault(); // Предотвращаем возможную отправку формы
                const emoji = e.target.closest('.emoji');
                if (emoji) {
                    const emojiChar = emoji.dataset.emoji;
                    console.log('Выбран эмодзи:', emojiChar);
                    messageInput.value += emojiChar; // Добавляем эмодзи в поле ввода
                    messageInput.focus(); // Сохраняем фокус на поле ввода
                    // Панель НЕ закрывается, чтобы можно было выбрать несколько эмодзи
                }
            });
        } else {
            console.error('Кнопка смайлика или панель эмодзи не найдены');
        }

        // Обработчик отправки формы
        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Форма отправлена, currentChatUserId:', currentChatUserId, 'currentGroupId:', currentGroupId);
                if (!currentChatUserId && !currentGroupId) {
                    showFlashMessage('Выберите чат или группу', 'warning');
                    return;
                }
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    showFlashMessage('WebSocket не подключен, обновите страницу', 'danger');
                    return;
                }
            
                const content = messageInput.value.trim();
                let fileDataList = [];
            
                if (selectedFiles.length > 0) {
                    console.log('Загружаю файлы:', selectedFiles);
                    try {
                        for (const file of selectedFiles) {
                            console.log('Загружаю файл:', file.name);
                            const fileData = await uploadAndSendFile(file);
                            fileDataList.push(fileData);
                            console.log('Файл загружен:', fileData);
                        }
                    } catch (error) {
                        console.error('Ошибка загрузки файлов:', error);
                        showFlashMessage('Не удалось загрузить файлы', 'danger');
                        return;
                    }
                }
            
                if (content || fileDataList.length > 0) {
                    const messageData = {
                        content: content || null,
                        receiver_id: currentChatUserId,
                        group_id: currentGroupId,
                        files: fileDataList.length > 0 ? fileDataList : null
                    };
                    console.log('Отправляю сообщение:', messageData);
                    ws.send(JSON.stringify(messageData));
                    messageInput.value = '';
                    selectedFiles = [];
                    updatePreview();
                    hasInteracted = true;
                    updateUnreadDivider();
                } else {
                    console.log('Сообщение пустое и нет файлов, игнорирую отправку');
                    showFlashMessage('Введите сообщение или выберите файлы', 'warning');
                }
            });
        }

        if (clearPreviewBtn) {
            clearPreviewBtn.addEventListener('click', () => {
                console.log('Нажата кнопка очистки предварительного просмотра');
                selectedFiles = [];
                updatePreview();
            });
        } else {
            console.error('Кнопка clear-preview-btn не найдена');
        }

        function updatePreview() {
            console.log('Вызвана updatePreview, selectedFiles:', selectedFiles);
            previewImages.innerHTML = '';
            if (selectedFiles.length === 0) {
                previewContainer.style.display = 'none';
                console.log('selectedFiles пуст, скрываю previewContainer');
                return;
            }
        
            let loadedFiles = 0;
            selectedFiles.forEach((file, index) => {
                console.log(`Обрабатываю файл ${index}:`, file.name, file.type);
                const reader = new FileReader();
                reader.onload = (e) => {
                    console.log('FileReader onload для файла:', file.name);
                    const mediaDiv = document.createElement('div');
                    mediaDiv.className = 'preview-image';
        
                    if (file.type.startsWith('image/')) {
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        img.alt = 'Preview';
                        mediaDiv.appendChild(img);
                        console.log('Добавлено изображение:', file.name);
                    } else if (file.type.startsWith('video/')) {
                        const video = document.createElement('video');
                        video.src = e.target.result;
                        video.controls = true;
                        video.alt = 'Preview';
                        mediaDiv.appendChild(video);
                        console.log('Добавлено видео:', file.name);
                    } else {
                        const placeholder = document.createElement('div');
                        placeholder.textContent = file.name;
                        placeholder.style.padding = '10px';
                        placeholder.style.background = '#ccc';
                        placeholder.style.borderRadius = '4px';
                        mediaDiv.appendChild(placeholder);
                        console.log('Добавлен placeholder для файла:', file.name);
                    }
        
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'remove-preview-btn';
                    removeBtn.textContent = '✖';
                    removeBtn.addEventListener('click', () => {
                        console.log(`Удаляю файл ${index}:`, file.name);
                        selectedFiles.splice(index, 1);
                        updatePreview();
                    });
                    mediaDiv.appendChild(removeBtn);
        
                    previewImages.appendChild(mediaDiv);
                    loadedFiles++;
                    console.log(`Файл ${index} добавлен, loadedFiles: ${loadedFiles}/${selectedFiles.length}`);
        
                    if (loadedFiles === selectedFiles.length) {
                        previewContainer.style.display = 'flex';
                        console.log('Все файлы обработаны, previewContainer показан');
                    }
                };
                reader.onerror = (error) => {
                    console.error('Ошибка чтения файла:', file.name, error);
                    showFlashMessage(`Ошибка чтения файла ${file.name}`, 'danger');
                };
                reader.readAsDataURL(file);
            });
        }

        async function uploadAndSendFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                console.log('Отправляю файл на сервер:', file.name);
                const response = await fetch('/upload-file', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    console.log('Файл успешно загружен:', result);
                    return { file_url: result.file_url, file_type: result.file_type };
                } else {
                    console.error('Ошибка сервера:', result.detail);
                    showFlashMessage(result.detail, 'danger');
                    throw new Error(result.detail);
                }
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                showFlashMessage(`Не удалось загрузить файл: ${error.message}`, 'danger');
                throw error;
            }
        }


        document.addEventListener('click', (e) => {
            const mediaLink = e.target.closest('.media-link');
            if (mediaLink) {
                e.preventDefault(); // Отменяем стандартное поведение ссылки
                const mediaUrl = mediaLink.dataset.mediaUrl;
                const mediaType = mediaLink.dataset.mediaType;
                const mediaModal = document.getElementById('media-modal');
                const mediaModalContent = document.getElementById('media-modal-content');
        
                if (mediaType === 'image') {
                    mediaModalContent.innerHTML = `<img src="${mediaUrl}" alt="Full Image" class="modal-media">`;
                } else if (mediaType === 'video') {
                    mediaModalContent.innerHTML = `
                        <video controls class="modal-media">
                            <source src="${mediaUrl}" type="video/mp4">
                            Ваш браузер не поддерживает видео.
                        </video>`;
                }
        
                mediaModal.style.display = 'flex';
            }
        });
    
        // Обработчик для закрытия модального окна
        const closeMediaModalBtn = document.getElementById('close-media-modal-btn');
        const mediaModal = document.getElementById('media-modal');
        if (closeMediaModalBtn) {
            closeMediaModalBtn.addEventListener('click', () => {
                mediaModal.style.display = 'none';
                document.getElementById('media-modal-content').innerHTML = ''; // Очищаем содержимое
            });
        }
    
        // Закрытие модального окна при клике вне контента
        mediaModal.addEventListener('click', (e) => {
            if (e.target === mediaModal) {
                mediaModal.style.display = 'none';
                document.getElementById('media-modal-content').innerHTML = ''; // Очищаем содержимое
            }
        });

        if (menuIcon && menuDrawer) {
            menuIcon.addEventListener('click', () => {
                console.log('Нажата иконка меню');
                menuDrawer.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (!menuIcon.contains(e.target) && !menuDrawer.contains(e.target)) {
                    menuDrawer.classList.remove('active');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Нажата кнопка выхода');
                localStorage.removeItem('token');
                window.location.href = '/';
            });
        }

        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                console.log('Нажата кнопка профиля');
                menuDrawer.classList.remove('active');
                window.location.href = '/my-profile?token=' + encodeURIComponent(token);
            });
        }

        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => {
                console.log('Нажата кнопка создания группы');
                createGroupModal.classList.add('active'); // Добавляем класс active для показа
            });
        }

        if (moreOptions && chatOptionsDrawer) {
            moreOptions.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Нажата иконка дополнительных опций чата');
                if (!currentChatUserId && !currentGroupId) {
                    showFlashMessage('Выберите чат или группу', 'warning');
                    return;
                }
                chatOptionsDrawer.innerHTML = '';
    
                if (currentGroupId) {
                    
                    const clearBtn = document.createElement('button');
                    clearBtn.textContent = 'Очистить чат';
                    clearBtn.addEventListener('click', async () => {
                        try {
                            const response = await fetch(`/messages/group/${currentGroupId}/clear`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const result = await response.json();
                            if (response.ok) {
                                showFlashMessage('Чат очищен', 'success');
                                loadMessages(null, currentGroupId);
                            } else {
                                showFlashMessage(result.detail, 'danger');
                            }
                        } catch (error) {
                            console.error('Ошибка очистки чата:', error);
                            showFlashMessage(`Не удалось очистить чат: ${error.message}`, 'danger');
                        }
                        chatOptionsDrawer.classList.remove('active');
                    });
                    chatOptionsDrawer.appendChild(clearBtn);
    
                    const leaveBtn = document.createElement('button');
                    leaveBtn.textContent = 'Выйти из группы';
                    leaveBtn.className = 'danger';
                    leaveBtn.addEventListener('click', async () => {
                        try {
                            const response = await fetch(`/groups/${currentGroupId}/leave`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const result = await response.json();
                            if (response.ok) {
                                showFlashMessage('Вы вышли из группы', 'success');
                                currentGroupId = null;
                                document.getElementById('chat-title').textContent = 'Чат';
                                chatMessages.innerHTML = '';
                                loadRecentChats();
                            } else {
                                showFlashMessage(result.detail, 'danger');
                            }
                        } catch (error) {
                            console.error('Ошибка выхода из группы:', error);
                            showFlashMessage(`Не удалось выйти из группы: ${error.message}`, 'danger');
                        }
                        chatOptionsDrawer.classList.remove('active');
                    });
                    chatOptionsDrawer.appendChild(leaveBtn);

                    const infoBtn = document.createElement('button');
                    infoBtn.textContent = 'Информация о группе';
                    infoBtn.addEventListener('click', () => {
                        showGroupInfo(currentGroupId);
                        chatOptionsDrawer.classList.remove('active');
                    });
                    chatOptionsDrawer.appendChild(infoBtn);
                } else {
                    const infoBtn = document.createElement('button');
                    infoBtn.textContent = 'Инфо о пользователе';
                    infoBtn.addEventListener('click', () => {
                        window.location.href = `/profile/${currentChatUserId}?token=${encodeURIComponent(token)}`;
                        chatOptionsDrawer.classList.remove('active');
                    });
                    chatOptionsDrawer.appendChild(infoBtn);
    
                    const clearBtn = document.createElement('button');
                    clearBtn.textContent = 'Очистить чат';
                    clearBtn.addEventListener('click', async () => {
                        try {
                            const response = await fetch(`/messages/${currentChatUserId}/clear`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const result = await response.json();
                            if (response.ok) {
                                showFlashMessage('Чат очищен', 'success');
                                loadMessages(currentChatUserId, null);
                            } else {
                                showFlashMessage(result.detail, 'danger');
                            }
                        } catch (error) {
                            console.error('Ошибка очистки чата:', error);
                            showFlashMessage(`Не удалось очистить чат: ${error.message}`, 'danger');
                        }
                        chatOptionsDrawer.classList.remove('active');
                    });
                    chatOptionsDrawer.appendChild(clearBtn);
    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Удалить чат';
                    deleteBtn.className = 'danger';
                    deleteBtn.addEventListener('click', async () => {
                        try {
                            const response = await fetch(`/messages/${currentChatUserId}/delete`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const result = await response.json();
                            if (response.ok) {
                                showFlashMessage('Чат удалён', 'success');
                                currentChatUserId = null;
                                document.getElementById('chat-title').textContent = 'Чат';
                                chatMessages.innerHTML = '';
                                loadRecentChats();
                            } else {
                                showFlashMessage(result.detail, 'danger');
                            }
                        } catch (error) {
                            console.error('Ошибка удаления чата:', error);
                            showFlashMessage(`Не удалось удалить чат: ${error.message}`, 'danger');
                        }
                        chatOptionsDrawer.classList.remove('active');
                    });
                    chatOptionsDrawer.appendChild(deleteBtn);
                }
    
                chatOptionsDrawer.classList.toggle('active');
            });
    
            document.addEventListener('click', (e) => {
                if (!moreOptions.contains(e.target) && !chatOptionsDrawer.contains(e.target)) {
                    chatOptionsDrawer.classList.remove('active');
                }
            });
        }


        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия модального окна');
                createGroupModal.classList.remove('active'); // Убираем класс active для скрытия
                // Очистка полей формы
                document.getElementById('group-name').value = '';
                document.getElementById('group-description').value = '';
                document.getElementById('group-avatar').value = '';
                document.getElementById('group-members').value = '';
                document.getElementById('group-members-list').innerHTML = '';
                document.getElementById('group-members-search-results').innerHTML = '';
                document.getElementById('group-members-search-results').classList.remove('active');
            });
        }

        if (createGroupForm) {
            createGroupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Форма создания группы отправлена');
                const groupName = groupNameInput.value.trim();
                const groupDescription = groupDescriptionInput.value.trim();
                const groupAvatar = groupAvatarInput.files[0];
                const memberIds = Array.from(groupMembersList.children).map(item => parseInt(item.dataset.userId));
                if (!groupName || groupName.length < 3) {
                    showFlashMessage('Название группы должно содержать минимум 3 символа', 'danger');
                    return;
                }
                if (memberIds.length === 0) {
                    showFlashMessage('Выберите хотя бы одного участника', 'danger');
                    return;
                }
                const formData = new FormData();
                formData.append('name', groupName);
                formData.append('description', groupDescription);
                formData.append('member_ids', JSON.stringify(memberIds));
                if (groupAvatar) {
                    formData.append('avatar', groupAvatar);
                }
                try {
                    const response = await fetch('/groups', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    const result = await response.json();
                    if (response.ok) {
                        showFlashMessage('Группа успешно создана', 'success');
                        createGroupModal.style.display = 'none';
                        groupNameInput.value = '';
                        groupDescriptionInput.value = '';
                        groupAvatarInput.value = '';
                        groupMembersInput.value = '';
                        groupMembersList.innerHTML = '';
                        groupMembersSearchResults.innerHTML = '';
                        groupMembersSearchResults.classList.remove('active');
                        await loadRecentChats();
                        // Автоматически открываем созданную группу
                        const newGroupId = result.group_id;
                        currentChatUserId = null;
                        currentGroupId = newGroupId;
                        document.getElementById('chat-title').textContent = groupName;
                        loadMessages(null, newGroupId);
                        document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                        const chatItem = document.querySelector(`.group-item[data-id="${newGroupId}"][data-is-group="true"]`);
                        if (chatItem) chatItem.classList.add('active');
                    } else {
                        showFlashMessage(result.detail, 'danger');
                    }
                } catch (error) {
                    console.error('Ошибка создания группы:', error);
                    showFlashMessage(`Не удалось создать группу: ${error.message}`, 'danger');
                }
            });
        }

        // Поиск пользователей для добавления в группу (при создании группы)
        if (groupMembersInput) {
            groupMembersInput.addEventListener('input', async () => {
                const query = groupMembersInput.value.trim();
                if (query.length < 2) {
                    groupMembersSearchResults.classList.remove('active');
                    groupMembersSearchResults.innerHTML = '';
                    return;
                }
                try {
                    console.log('Поиск участников для группы:', query);
                    const response = await fetch(`/users/search?query=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Поиск не удался: ${response.status} (${errorText})`);
                    }
                    const users = await response.json();
                    console.log('Найденные пользователи для группы:', users);
                    groupMembersSearchResults.innerHTML = '';
                    if (users.length === 0) {
                        groupMembersSearchResults.innerHTML = '<div class="search-result-item">Пользователи не найдены</div>';
                    } else {
                        users.forEach(user => {
                            const item = document.createElement('div');
                            item.className = 'search-result-item';
                            item.innerHTML = `
                                <div class="avatar">${user.username[0].toUpperCase()}</div>
                                <div class="username">${user.username}</div>
                            `;
                            item.addEventListener('click', () => {
                                if (!groupMembersList.querySelector(`[data-user-id="${user.id}"]`)) {
                                    const memberItem = document.createElement('div');
                                    memberItem.className = 'group-member-item';
                                    memberItem.dataset.userId = user.id;
                                    memberItem.textContent = user.username;
                                    memberItem.addEventListener('click', () => memberItem.remove());
                                    groupMembersList.appendChild(memberItem);
                                }
                                groupMembersInput.value = '';
                                groupMembersSearchResults.classList.remove('active');
                            });
                            groupMembersSearchResults.appendChild(item);
                        });
                    }
                    groupMembersSearchResults.classList.add('active');
                } catch (error) {
                    console.error('Ошибка поиска участников для группы:', error);
                    showFlashMessage(`Ошибка поиска участников: ${error.message}`, 'danger');
                }
            });
        }

        // Поиск пользователей для добавления в существующую группу (для администратора)
        

        // Загрузка недавних чатов
        async function loadRecentChats() {
            console.log('Загружаю недавние чаты');
            try {
                const response = await fetch('/messages/recent', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Не удалось загрузить недавние чаты: ${response.status} (${errorText})`);
                }
                const recentChats = await response.json();
                console.log('Недавние чаты:', recentChats);
                chatList.innerHTML = '';
                if (recentChats.length === 0) {
                    chatList.innerHTML = '<div class="group-item">Нет недавних чатов</div>';
                } else {
                    recentChats.forEach(chat => {
                        addChatToList(chat.user_id, chat.group_id, chat.username, chat.avatar_url, chat.unread_count, chat.is_group);
                    });
                }
            } catch (error) {
                console.error('Ошибка загрузки недавних чатов:', error);
                showFlashMessage(`Не удалось загрузить недавние чаты: ${error.message}`, 'danger');
            }
        }

        // Добавление пользователя или группы в список чатов
        async function addChatToList(userId, groupId, username, avatarUrl, unreadCount, isGroup) {
            const id = isGroup ? groupId : userId;
            const existingChat = document.querySelector(`.group-item[data-id="${id}"][data-is-group="${isGroup}"]`);
            if (!existingChat) {
                const chatItem = document.createElement('div');
                chatItem.className = 'group-item';
                chatItem.dataset.id = id;
                chatItem.dataset.isGroup = isGroup;

                // Добавляем аватарку
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'group-avatar';
                if (avatarUrl) {
                    const avatarImg = document.createElement('img');
                    avatarImg.src = avatarUrl;
                    avatarImg.alt = username;
                    avatarDiv.appendChild(avatarImg);
                } else {
                    avatarDiv.innerHTML = `
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="24" height="24" rx="12" fill="#1E90FF"/>
                            <circle cx="12" cy="8" r="4" fill="white"/>
                            <path d="M12 14c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z" fill="white"/>
                        </svg>
                    `;
                }
                chatItem.appendChild(avatarDiv);

                // Добавляем информацию о чате
                const infoDiv = document.createElement('div');
                infoDiv.className = 'group-info';
                infoDiv.innerHTML = `
                    <span class="group-name">${username}</span>
                    ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
                `;
                chatItem.appendChild(infoDiv);
                chatItem.addEventListener('click', async () => {
                    if (currentChatUserId || currentGroupId) {
                        await markMessagesAsRead(currentChatUserId, currentGroupId);
                    }
                    const existingDivider = document.querySelector('.unread-divider');
                    if (existingDivider) {
                        existingDivider.remove();
                    }
                    currentChatUserId = isGroup ? null : userId;
                    currentGroupId = isGroup ? groupId : null;
                    console.log('Выбрана группа:', { currentGroupId, username });
                    document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                    chatItem.classList.add('active');
                    document.getElementById('chat-title').textContent = username;
                    hasMarkedAsRead = false;
                    hasInteracted = false;
                    loadMessages(userId, groupId);
                    updateUnreadCount(id, isGroup, 0);
                });
                chatList.appendChild(chatItem);
            } else {
                updateUnreadCount(id, isGroup, unreadCount);
            }
        }

        // Обновление счётчика непрочитанных сообщений
        function updateUnreadCount(id, isGroup, unreadCount) {
            const chatItem = document.querySelector(`.group-item[data-id="${id}"][data-is-group="${isGroup}"]`);
            if (chatItem) {
                const existingCounter = chatItem.querySelector('.unread-count');
                if (unreadCount > 0) {
                    if (existingCounter) {
                        existingCounter.textContent = unreadCount;
                    } else {
                        const counter = document.createElement('span');
                        counter.className = 'unread-count';
                        counter.textContent = unreadCount;
                        chatItem.querySelector('.group-info').appendChild(counter);
                    }
                } else if (existingCounter) {
                    existingCounter.remove();
                }
            }
        }

        // Пометка сообщений как прочитанных
        async function markMessagesAsRead(userId, groupId) {
            if (hasMarkedAsRead) return Promise.resolve();
            try {
                const url = groupId ? `/messages/group/${groupId}/mark-read` : `/messages/${userId}/mark-read`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Не удалось пометить сообщения как прочитанные: ${response.status} (${errorText})`);
                }
                console.log('Сообщения помечены как прочитанные');
                hasMarkedAsRead = true;
                await loadMessages(userId, groupId);
            } catch (error) {
                console.error('Ошибка при пометке сообщений как прочитанных:', error);
                throw error;
            }
        }

        // Обновление разделителя непрочитанных сообщений
        function updateUnreadDivider() {
            const messages = document.querySelectorAll('.chat-message');
            const existingDivider = document.querySelector('.unread-divider');
            let firstUnreadMessage = null;
            let foundUnread = false;
        
            messages.forEach(message => {
                const isOwnMessage = message.classList.contains('own-message');
                const isRead = message.dataset.read === 'true';
                if (!isOwnMessage && !isRead && !foundUnread) {
                    firstUnreadMessage = message;
                    foundUnread = true;
                }
            });
        
            if (foundUnread && !existingDivider) {
                const divider = document.createElement('div');
                divider.className = 'unread-divider';
                divider.textContent = 'Непрочитанные сообщения';
                chatMessages.insertBefore(divider, firstUnreadMessage);
            } else if (!foundUnread && existingDivider) {
                existingDivider.remove();
            }
        
            if (firstUnreadMessage && !hasMarkedAsRead && hasInteracted) {
                const divider = document.querySelector('.unread-divider');
                const dividerRect = divider ? divider.getBoundingClientRect() : null;
                const messageRect = firstUnreadMessage.getBoundingClientRect();
                const chatRect = chatMessages.getBoundingClientRect();
                if (
                    (divider && dividerRect.top >= chatRect.top && dividerRect.bottom <= chatRect.bottom) ||
                    (messageRect.top >= chatRect.top && messageRect.bottom <= chatRect.bottom)
                ) {
                    markMessagesAsRead(currentChatUserId, currentGroupId);
                }
            }
        }

        // Инициализация WebSocket
        async function initWebSocket() {
            console.log('Инициализация WebSocket');
            const token = localStorage.getItem('token');
            if (!token) {
                showFlashMessage('Токен не найден, пожалуйста, войдите снова', 'danger');
                window.location.href = '/';
                return;
            }

            try {
                const response = await fetch('/users/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`Не удалось загрузить данные пользователя: ${response.status}`);
                }
                const user = await response.json();
                currentUserId = user.id;
                ws = new WebSocket(`ws://${window.location.host}/ws/${user.id}`);
                // ws = new WebSocket(`ws://192.168.0.100:8000/ws/${userId}`);

                ws.onopen = () => {
                    console.log('WebSocket соединение установлено');
                };

                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log('Получено WebSocket-сообщение:', message);
                
                    // Проверяем наличие action и определяем тип сообщения
                    const isEditAction = message.action === 'edit';
                    const isDeleteAction = message.action === 'delete';
                    const isNewMessage = !message.action || message.action === 'create';
                
                    // Дополнительно логируем значения условий для отладки
                    console.log('Условия:', { isNewMessage, isEditAction, isDeleteAction });
                
                    // Обновляем счётчик непрочитанных сообщений только для новых сообщений
                    if (isNewMessage && message.sender_id !== currentUserId && !message.is_read) {
                        const senderId = message.sender_id;
                        const groupId = message.group_id;
                        if (groupId) {
                            if (groupId !== currentGroupId) {
                                const chatItem = document.querySelector(`.group-item[data-id="${groupId}"][data-is-group="true"]`);
                                let currentCount = 0;
                                if (chatItem) {
                                    const counter = chatItem.querySelector('.unread-count');
                                    currentCount = counter ? parseInt(counter.textContent) : 0;
                                }
                                updateUnreadCount(groupId, true, currentCount + 1);
                            }
                            addChatToList(null, groupId, message.username, message.avatar_url, 0, true);
                        } else {
                            if (senderId !== currentChatUserId) {
                                const chatItem = document.querySelector(`.group-item[data-id="${senderId}"][data-is-group="false"]`);
                                let currentCount = 0;
                                if (chatItem) {
                                    const counter = chatItem.querySelector('.unread-count');
                                    currentCount = counter ? parseInt(counter.textContent) : 0;
                                }
                                updateUnreadCount(senderId, false, currentCount + 1);
                            }
                            addChatToList(senderId, null, message.username, message.avatar_url, 0, false);
                        }
                    }
                
                    // Обрабатываем сообщение только если оно относится к текущему чату
                    if ((message.receiver_id === currentChatUserId && !message.group_id) || message.group_id === currentGroupId) {
                        if (isEditAction) {
                            console.log('Обработка действия edit для сообщения:', message);
                            const messageDiv = document.querySelector(`.chat-message[data-message-id="${message.message_id}"]`);
                            if (messageDiv) {
                                const contentText = messageDiv.querySelector('.content-text');
                                if (contentText) {
                                    if (message.content) {
                                        contentText.textContent = message.content;
                                        contentText.style.display = 'block';
                                        console.log(`Сообщение с ID ${message.message_id} обновлено: ${message.content}`);
                                    } else {
                                        contentText.style.display = 'none';
                                        console.log(`Сообщение с ID ${message.message_id} обновлено: текст удалён`);
                                    }
                                } else {
                                    console.warn(`Не найден .content-text для сообщения с ID ${message.message_id}`);
                                }
                            } else {
                                console.warn(`Сообщение с ID ${message.message_id} не найдено в DOM`);
                            }
                        } else if (isDeleteAction) {
                            console.log('Обработка действия delete для сообщения:', message);
                            const messageDiv = document.querySelector(`.chat-message[data-message-id="${message.message_id}"]`);
                            if (messageDiv) {
                                messageDiv.remove();
                                console.log(`Сообщение с ID ${message.message_id} удалено`);
                            } else {
                                console.warn(`Сообщение с ID ${message.message_id} не найдено в DOM`);
                            }
                        } else if (isNewMessage) {
                            // Проверяем, не существует ли уже сообщение с таким ID
                            const existingMessage = document.querySelector(`.chat-message[data-message-id="${message.id}"]`);
                            if (existingMessage) {
                                console.log(`Сообщение с ID ${message.id} уже отображено, обновляем его вместо добавления нового`);
                                const contentText = existingMessage.querySelector('.content-text');
                                if (contentText && message.content) {
                                    contentText.textContent = message.content;
                                }
                            } else {
                                console.log('Отображаем новое сообщение:', message);
                                displayMessage(message);
                                updateUnreadDivider();
                            }
                        } else {
                            console.warn('Неизвестное действие:', message.action);
                        }
                    } else {
                        console.log('Сообщение не относится к текущему чату:', { receiver_id: message.receiver_id, group_id: message.group_id });
                    }
                };

                ws.onclose = () => {
                    console.log('WebSocket соединение закрыто');
                    showFlashMessage('WebSocket отключен, обновите страницу', 'warning');
                };

                ws.onerror = (error) => {
                    console.error('Ошибка WebSocket:', error);
                    showFlashMessage('Ошибка WebSocket, попробуйте снова', 'danger');
                };
            } catch (error) {
                console.error('Ошибка инициализации WebSocket:', error);
                showFlashMessage(`Не удалось инициализировать чат: ${error.message}`, 'danger');
            }
        }

        // Загрузка сообщений
        async function loadMessages(userId, groupId) {
            console.log('Загружаю сообщения для:', { userId, groupId });
            try {
                const url = groupId ? `/messages/group/${groupId}` : `/messages/${userId}`;
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Не удалось загрузить сообщения: ${response.status} (${errorText})`);
                }
                const messages = await response.json();
                console.log('Загружены сообщения:', messages); // Логируем загруженные сообщения
                chatMessages.innerHTML = '';
                lastMessageDate = null;
                messages.forEach(displayMessage);
                const firstUnreadMessage = chatMessages.querySelector('.chat-message:not(.own-message):not([data-read="true"])');
                if (firstUnreadMessage) {
                    firstUnreadMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                updateUnreadDivider();
            } catch (error) {
                console.error('Ошибка загрузки сообщений:', error);
                showFlashMessage(`Не удалось загрузить сообщения: ${error.message}`, 'danger');
            }
        }

        // Отображение сообщения
        function displayMessage(message) {
            if (message.action === 'edit' || message.action === 'delete') {
                console.warn('displayMessage вызвана для сообщения с action:', message.action, '— игнорируем');
                return;
            }
        
            console.log(`Отображаю сообщение: sender_id=${message.sender_id}, currentUserId=${currentUserId}, isOwnMessage=${message.sender_id === currentUserId}`);
        
            const messageDate = new Date(message.timestamp);
            const messageDateString = messageDate.toISOString().split('T')[0];
        
            if (lastMessageDate !== messageDateString) {
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.textContent = formatDateToRussian(messageDate);
                chatMessages.appendChild(divider);
                lastMessageDate = messageDateString;
            }
        
            const div = document.createElement('div');
            const isOwnMessage = message.sender_id === currentUserId;
            div.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
            div.dataset.read = message.is_read ? 'true' : 'false';
            div.dataset.messageId = message.id;
        
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            if (message.avatar_url) {
                const avatarImg = document.createElement('img');
                avatarImg.src = message.avatar_url;
                avatarImg.alt = message.username;
                avatarDiv.appendChild(avatarImg);
            } else {
                avatarDiv.innerHTML = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="12" fill="#1E90FF"/>
                        <circle cx="12" cy="8" r="4" fill="white"/>
                        <path d="M12 14c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z" fill="white"/>
                    </svg>
                `;
            }
        
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content-wrapper';
            const date = new Date(message.timestamp);
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
            let mediaContent = '';
            if (message.files && message.files.length > 0) {
                const mediaItems = message.files.filter(file => file.file_type === 'image' || file.file_type === 'video').length;
                let mediaClass = '';
                if (mediaItems === 1) {
                    mediaClass = 'single-image';
                } else if (mediaItems === 2) {
                    mediaClass = 'two-images';
                } else if (mediaItems >= 3) {
                    mediaClass = 'multiple-images';
                }
        
                mediaContent = `<div class="media-content ${mediaClass}">`;
                message.files.forEach(file => {
                    if (file.file_type === 'image') {
                        mediaContent += `
                            <a class="media-link" data-media-url="${file.file_url}" data-media-type="image">
                                <img src="${file.file_url}" alt="Image" class="preview-image-sent">
                            </a>`;
                    } else if (file.file_type === 'video') {
                        mediaContent += `
                            <a class="media-link" data-media-url="${file.file_url}" data-media-type="video">
                                <video class="preview-video-sent">
                                    <source src="${file.file_url}" type="video/mp4">
                                    Ваш браузер не поддерживает видео.
                                </video>
                            </a>`;
                    } else if (file.file_type === 'file') {
                        const fileName = file.file_url.split('/').pop();
                        mediaContent += `
                            <a href="${file.file_url}" class="file-link" download>
                                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                                    <path d="M12 12v9m0 0l-4-4m4 4l4-4m-9-5V5a2 2 0 012-2h4a2 2 0 012 2v6" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${fileName}
                            </a>`;
                    }
                });
                mediaContent += '</div>';
            }
        
            contentDiv.innerHTML = `
                <div class="username">${message.username}</div>
                <div class="content">
                    ${message.content ? `<div class="content-text">${message.content}</div>` : '<div class="content-text" style="display: none;"></div>'}
                    ${mediaContent}
                    <div class="timestamp">${timeString}</div>
                </div>
            `;

            // Добавляем контекстное меню для всех сообщений, если есть текст ИЛИ медиафайлы
            if (message.content || (message.files && message.files.length > 0)) {
                div.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    // Закрываем все открытые меню
                    document.querySelectorAll('.message-options').forEach(menu => menu.remove());

                    const optionsMenu = document.createElement('div');
                    optionsMenu.className = 'message-options';
                    // Только для своих сообщений показываем Edit
                    if (isOwnMessage) {
                        optionsMenu.innerHTML += `
                            <button class="edit-message-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 20h9" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Edit
                            </button>
                        `;
                    }
                    // Delete и Translate доступны для всех
                    optionsMenu.innerHTML += `
                        <button class="delete-message-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                <path d="M10 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                <path d="M14 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Delete
                        </button>
                        <button class="translate-message-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2v20M2 12h20" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Translate
                        </button>
                    `;

                    // Позиционируем меню
                    const messageRect = div.getBoundingClientRect();
                    optionsMenu.style.top = `${messageRect.bottom + window.scrollY}px`;
                    optionsMenu.style.left = `${messageRect.right - 150 + window.scrollX}px`;

                    document.body.appendChild(optionsMenu);

                    // Обработчик для кнопки редактирования (только для своих сообщений)
                    if (isOwnMessage) {
                        optionsMenu.querySelector('.edit-message-btn').addEventListener('click', () => {
                            const contentText = div.querySelector('.content-text');
                            const originalContent = contentText.textContent || '';
                            contentText.style.display = 'block';
                            contentText.innerHTML = `<input type="text" class="edit-message-input" value="${originalContent}" placeholder="Введите текст (опционально)" />`;
                            const input = contentText.querySelector('.edit-message-input');
                            input.focus();

                            input.addEventListener('blur', async () => {
                                const newContent = input.value.trim();
                                try {
                                    const response = await fetch(`/messages/${message.id}/edit`, {
                                        method: 'PUT',
                                        headers: {
                                            'Content-Type': 'application/x-www-form-urlencoded',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: new URLSearchParams({ content: newContent || null })
                                    });
                                    const result = await response.json();
                                    if (response.ok) {
                                        if (newContent) {
                                            contentText.textContent = newContent;
                                            contentText.style.display = 'block';
                                        } else {
                                            contentText.style.display = 'none';
                                        }
                                        ws.send(JSON.stringify({
                                            action: 'edit',
                                            message_id: message.id,
                                            content: newContent || null,
                                            receiver_id: currentChatUserId,
                                            group_id: currentGroupId
                                        }));
                                    } else {
                                        showFlashMessage(result.detail, 'danger');
                                        if (originalContent) {
                                            contentText.textContent = originalContent;
                                            contentText.style.display = 'block';
                                        } else {
                                            contentText.style.display = 'none';
                                        }
                                    }
                                } catch (error) {
                                    console.error('Ошибка редактирования сообщения:', error);
                                    showFlashMessage(`Не удалось отредактировать сообщение: ${error.message}`, 'danger');
                                    if (originalContent) {
                                        contentText.textContent = originalContent;
                                        contentText.style.display = 'block';
                                    } else {
                                        contentText.style.display = 'none';
                                    }
                                }
                                optionsMenu.remove();
                            });

                            input.addEventListener('keypress', async (e) => {
                                if (e.key === 'Enter') {
                                    input.blur();
                                }
                            });
                        });
                    }

                    // Обработчик для кнопки удаления
                    optionsMenu.querySelector('.delete-message-btn').addEventListener('click', async () => {
                        if (isOwnMessage) {
                            // Удаляем для всех (бэкенд)
                            try {
                                const response = await fetch(`/messages/${message.id}`, {
                                    method: 'DELETE',
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                const result = await response.json();
                                if (response.ok) {
                                    div.remove();
                                    ws.send(JSON.stringify({
                                        action: 'delete',
                                        message_id: message.id,
                                        receiver_id: currentChatUserId,
                                        group_id: currentGroupId
                                    }));
                                } else {
                                    showFlashMessage(result.detail, 'danger');
                                }
                            } catch (error) {
                                console.error('Ошибка удаления сообщения:', error);
                                showFlashMessage(`Не удалось удалить сообщение: ${error.message}`, 'danger');
                            }
                        } else {
                            // Удаляем только для себя (только из DOM)
                            div.remove();
                        }
                        optionsMenu.remove();
                    });

                    // Обработчик для кнопки перевода
                    optionsMenu.querySelector('.translate-message-btn').addEventListener('click', async () => {
                        const contentText = div.querySelector('.content-text');
                        const originalContent = contentText.textContent || '';
                        let translationDiv = div.querySelector('.translation-text');
                        if (translationDiv) translationDiv.remove();
                        translationDiv = document.createElement('div');
                        translationDiv.className = 'translation-text';
                        translationDiv.style.marginTop = '8px';
                        translationDiv.style.fontStyle = 'italic';
                        translationDiv.style.color = '#ffd700';
                        translationDiv.textContent = 'Translating...';
                        contentText.parentNode.appendChild(translationDiv);
                        try {
                            const isRussian = /[\u0400-\u04FF]/.test(originalContent);
                            const sourceLang = isRussian ? 'ru' : 'en';
                            const targetLang = isRussian ? 'en' : 'ru';
                            const response = await fetch('/translate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    q: originalContent,
                                    source: sourceLang,
                                    target: targetLang
                                })
                            });
                            const data = await response.json();
                            if (data && data.data && data.data.translations && data.data.translations[0]) {
                                translationDiv.textContent = data.data.translations[0].translatedText;
                            } else {
                                translationDiv.textContent = 'Translation failed.';
                            }
                        } catch (error) {
                            translationDiv.textContent = 'Translation failed.';
                        }
                        optionsMenu.remove();
                    });
                });

                // Закрываем меню при клике вне его
                document.addEventListener('click', (e) => {
                    const optionsMenu = document.querySelector('.message-options');
                    if (optionsMenu && !div.contains(e.target) && !optionsMenu.contains(e.target)) {
                        optionsMenu.remove();
                    }
                }, { once: true });
            }

            if (isOwnMessage) {
                div.appendChild(contentDiv);
                div.appendChild(avatarDiv);
            } else {
                div.appendChild(avatarDiv);
                div.appendChild(contentDiv);
            }

            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        function updatePreview() {
            console.log('Вызвана updatePreview, selectedFiles:', selectedFiles);
            previewImages.innerHTML = '';
            if (selectedFiles.length === 0) {
                previewContainer.style.display = 'none';
                console.log('selectedFiles пуст, скрываю previewContainer');
                return;
            }
        
            let loadedFiles = 0;
            selectedFiles.forEach((file, index) => {
                console.log(`Обрабатываю файл ${index}:`, file.name, file.type);
                const reader = new FileReader();
                reader.onload = (e) => {
                    console.log('FileReader onload для файла:', file.name);
                    const mediaDiv = document.createElement('div');
                    mediaDiv.className = 'preview-image';
        
                    if (file.type.startsWith('image/')) {
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        img.alt = 'Preview';
                        mediaDiv.appendChild(img);
                        console.log('Добавлено изображение:', file.name);
                    } else if (file.type.startsWith('video/')) {
                        const video = document.createElement('video');
                        video.src = e.target.result;
                        video.controls = true;
                        video.alt = 'Preview';
                        mediaDiv.appendChild(video);
                        console.log('Добавлено видео:', file.name);
                    } else {
                        // Для файлов (PDF, TXT и т.д.) создаём контейнер с иконкой и именем файла
                        const filePreview = document.createElement('div');
                        filePreview.className = 'file-preview';
                        filePreview.innerHTML = `
                            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" class="file-icon">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M12 18v-6M9 15h6" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span class="file-name">${file.name}</span>
                        `;
                        mediaDiv.appendChild(filePreview);
                        console.log('Добавлен preview для файла:', file.name);
                    }
        
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'remove-preview-btn';
                    removeBtn.textContent = '✖';
                    removeBtn.addEventListener('click', () => {
                        console.log(`Удаляю файл ${index}:`, file.name);
                        selectedFiles.splice(index, 1);
                        updatePreview();
                    });
                    mediaDiv.appendChild(removeBtn);
        
                    previewImages.appendChild(mediaDiv);
                    loadedFiles++;
                    console.log(`Файл ${index} добавлен, loadedFiles: ${loadedFiles}/${selectedFiles.length}`);
        
                    if (loadedFiles === selectedFiles.length) {
                        previewContainer.style.display = 'flex';
                        console.log('Все файлы обработаны, previewContainer показан');
                    }
                };
                reader.onerror = (error) => {
                    console.error('Ошибка чтения файла:', file.name, error);
                    showFlashMessage(`Ошибка чтения файла ${file.name}`, 'danger');
                };
                // Для не-медиа файлов FileReader не нужен, но мы оставим его для единообразия
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    reader.readAsDataURL(file);
                } else {
                    reader.onload(); // Вызываем onload вручную для не-медиа файлов
                }
            });
        }

        // Поиск пользователей для начала чата
        if (searchInput) {
            searchInput.addEventListener('input', async () => {
                console.log('Изменен ввод поиска:', searchInput.value);
                const query = searchInput.value.trim();
                if (query.length < 2) {
                    searchResults.classList.remove('active');
                    searchResults.innerHTML = '';
                    return;
                }
                try {
                    console.log('Отправляю запрос на /users/search с запросом:', query);
                    const response = await fetch(`/users/search?query=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Поиск не удался: ${response.status} (${errorText})`);
                    }
                    const users = await response.json();
                    console.log('Результаты поиска:', users);
                    searchResults.innerHTML = '';
                    if (users.length === 0) {
                        searchResults.innerHTML = '<div class="search-result-item">Пользователи не найдены</div>';
                    } else {
                        users.forEach(user => {
                            const item = document.createElement('div');
                            item.className = 'search-result-item';
                            item.innerHTML = `
                                <div class="avatar">
                                    ${user.avatar_url ? `<img src='${user.avatar_url}' alt='${user.username}'>` : user.username[0].toUpperCase()}
                                </div>
                                <div class="username">${user.username}</div>
                            `;
                            item.addEventListener('click', () => {
                                console.log('Выбран результат поиска:', user);
                                currentChatUserId = user.id;
                                currentGroupId = null;
                                document.getElementById('chat-title').textContent = user.username;
                                loadMessages(user.id, null);
                                searchResults.classList.remove('active');
                                searchInput.value = '';
                                addChatToList(user.id, null, user.username, user.avatar_url, 0, false);
                                document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                                const chatItem = document.querySelector(`.group-item[data-id="${user.id}"][data-is-group="false"]`);
                                if (chatItem) chatItem.classList.add('active');
                            });
                            searchResults.appendChild(item);
                        });
                    }
                    searchResults.classList.add('active');
                } catch (error) {
                    console.error('Ошибка поиска:', error);
                    showFlashMessage(`Ошибка поиска пользователей: ${error.message}`, 'danger');
                }
            });
        }

        chatMessages.addEventListener('scroll', () => {
            if (currentChatUserId || currentGroupId) {
                hasInteracted = true;
                updateUnreadDivider();
            }
        });

        chatMessages.addEventListener('click', () => {
            if (currentChatUserId || currentGroupId) {
                hasInteracted = true;
                updateUnreadDivider();
            }
        });

        console.log('Вызываю initWebSocket');
        initWebSocket();
        loadRecentChats();
    }


    // Отображение информации о группе
    async function showGroupInfo(groupId) {
        console.log('Показываю информацию о группе:', groupId);
        const modal = document.getElementById('group-info-modal');
        const title = document.getElementById('group-info-title');
        const description = document.getElementById('group-info-description');
        const owner = document.getElementById('group-info-owner');
        const membersList = document.getElementById('group-info-members');
        const avatarImg = document.getElementById('group-info-avatar');
        const avatarPlaceholder = document.getElementById('group-info-avatar-placeholder');
        const addMembersSection = document.querySelector('.group-info-add-members');
        const searchInput = document.getElementById('group-info-search-input');
        const searchResults = document.getElementById('group-info-search-results');
        const token = localStorage.getItem('token');
    
        try {
            // Получаем информацию о группе
            const groupResponse = await fetch(`/groups/${groupId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const group = await groupResponse.json();
            if (!groupResponse.ok) {
                throw new Error(`Не удалось загрузить информацию о группе: ${groupResponse.status} (${group.detail})`);
            }
            console.log('Инфо о группе:', group);
    
            // Получаем текущего пользователя
            const userResponse = await fetch('/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const currentUser = await userResponse.json();
            if (!userResponse.ok) {
                throw new Error(`Не удалось загрузить данные пользователя: ${userResponse.status} (${currentUser.detail})`);
            }
            console.log('Текущий пользователь:', currentUser);
    
            // Извлекаем данные о создателе
            const creatorId = group.creator ? group.creator.id : null;
            const creatorUsername = group.creator ? group.creator.username : 'Неизвестно';
            
            console.log('ID текущего пользователя:', currentUser.id);
            console.log('ID создателя группы:', creatorId);
            const isOwner = Number(currentUser.id) === Number(creatorId);
            const isAdmin = group.members.find(m => m.id === currentUser.id)?.is_admin || false;
            console.log('Является ли пользователь владельцем?', isOwner);
            console.log('Является ли пользователь администратором?', isAdmin);

            const editGroupBtn = document.getElementById('edit-group-btn');
            if (editGroupBtn) {
                console.log('Устанавливаю видимость кнопки редактирования:', (isOwner || isAdmin) ? 'block' : 'none');
                editGroupBtn.style.display = (isOwner || isAdmin) ? 'block' : 'none';
                editGroupBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    showEditGroupModal(groupId);
                });
            } else {
                console.error('Кнопка edit-group-btn не найдена');
            }
    
            // Показываем секцию добавления участников для владельца или администратора
            if (addMembersSection) {
                console.log('Устанавливаю видимость секции добавления участников:', (isOwner || isAdmin) ? 'block' : 'none');
                addMembersSection.style.display = (isOwner || isAdmin) ? 'block' : 'none';
            } else {
                console.error('Элемент .group-info-add-members не найден');
            }
    
            // Заполняем информацию о группе
            title.textContent = group.name;
            description.textContent = group.description || 'Описание отсутствует';
            console.log('Имя владельца группы:', creatorUsername);
            owner.textContent = creatorUsername || 'Неизвестно';
            if (group.avatar_url) {
                avatarImg.src = group.avatar_url;
                avatarImg.style.display = 'block';
                avatarPlaceholder.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarPlaceholder.style.display = 'block';
            }
    
            // Загружаем участников группы
            membersList.innerHTML = '';
            group.members.forEach(member => {
                const li = document.createElement('li');
                li.className = 'group-member-item';
                li.dataset.memberId = member.id;
    
                // Определяем роль участника
                let role = 'Участник';
                if (member.id === creatorId) {
                    role = 'Владелец';
                    li.classList.add('owner');
                } else if (member.is_admin) {
                    role = 'Администратор';
                    li.classList.add('admin');
                } else {
                    li.classList.add('member');
                }
    
                // Создаем HTML для отображения ника и роли
                li.innerHTML = `
                    <div class="member-info">
                        <span class="member-username">${member.username}</span>
                        <span class="member-role">${role}</span>
                    </div>
                `;
    
                // Добавляем контекстное меню для владельца или администратора
                if ((isOwner || isAdmin) && member.id !== currentUser.id) {
                    li.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        // Закрываем все открытые меню
                        document.querySelectorAll('.member-options').forEach(menu => menu.remove());
    
                        const optionsMenu = document.createElement('div');
                        optionsMenu.className = 'member-options';
    
                        // Кнопка "Удалить" (администраторы не могут удалять владельца или других админов)
                        if (isOwner || (!member.is_admin && member.id !== creatorId)) {
                            const removeBtn = document.createElement('button');
                            removeBtn.className = 'remove-member-btn';
                            removeBtn.innerHTML = `
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 6h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M10 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M14 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                                Удалить
                            `;
                            removeBtn.addEventListener('click', async () => {
                                try {
                                    const response = await fetch(`/groups/${groupId}/remove-member`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/x-www-form-urlencoded',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: new URLSearchParams({ user_id: member.id })
                                    });
                                    const result = await response.json();
                                    if (response.ok) {
                                        showFlashMessage('Участник удалён', 'success');
                                        showGroupInfo(groupId);
                                    } else {
                                        showFlashMessage(result.detail, 'danger');
                                    }
                                } catch (error) {
                                    console.error('Ошибка удаления участника:', error);
                                    showFlashMessage(`Не удалось удалить участника: ${error.message}`, 'danger');
                                }
                                optionsMenu.remove();
                            });
                            optionsMenu.appendChild(removeBtn);
                        }
    
                        // Кнопка "Назначить админом" или "Снизить должность" (администраторы не могут менять статус владельца)
                        if (member.id !== creatorId) {
                            const adminBtn = document.createElement('button');
                            adminBtn.className = member.is_admin ? 'remove-admin-btn' : 'set-admin-btn';
                            adminBtn.innerHTML = member.is_admin ? `
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM7 13l10 0" fill="#fff"/>
                                </svg>
                                Снизить должность
                            ` : `
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" fill="#fff"/>
                                </svg>
                                Назначить админом
                            `;
                            adminBtn.addEventListener('click', async () => {
                                try {
                                    const endpoint = member.is_admin ? `/groups/${groupId}/remove-admin` : `/groups/${groupId}/set-admin`;
                                    const response = await fetch(endpoint, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/x-www-form-urlencoded'
                                        },
                                        body: new URLSearchParams({ user_id: member.id })
                                    });
                                    const result = await response.json();
                                    if (response.ok) {
                                        showFlashMessage(member.is_admin ? 'Статус администратора снят' : 'Пользователь назначен администратором', 'success');
                                        showGroupInfo(groupId);
                                    } else {
                                        showFlashMessage(result.detail, 'danger');
                                    }
                                } catch (error) {
                                    console.error(`Ошибка ${member.is_admin ? 'снятия статуса администратора' : 'назначения администратора'}:`, error);
                                    showFlashMessage(`Не удалось ${member.is_admin ? 'снять статус администратора' : 'назначить администратора'}: ${error.message}`, 'danger');
                                }
                                optionsMenu.remove();
                            });
                            optionsMenu.appendChild(adminBtn);
                        }
    
                        // Позиционируем меню
                        const liRect = li.getBoundingClientRect();
                        optionsMenu.style.top = `${liRect.bottom + window.scrollY}px`;
                        optionsMenu.style.left = `${liRect.left + window.scrollX}px`;
    
                        document.body.appendChild(optionsMenu);
    
                        // Закрываем меню при клике вне его
                        document.addEventListener('click', function closeMenu(event) {
                            if (!optionsMenu.contains(event.target)) {
                                optionsMenu.remove();
                                document.removeEventListener('click', closeMenu);
                            }
                        });
                    });
                }
    
                membersList.appendChild(li);
            });
    
            modal.style.display = 'flex';
    
            // Поиск пользователей для добавления в группу (для владельца или администратора)
            if ((isOwner || isAdmin) && searchInput) {
                searchInput.addEventListener('input', async () => {
                    const query = searchInput.value.trim();
                    if (query.length < 2) {
                        searchResults.classList.remove('active');
                        searchResults.innerHTML = '';
                        return;
                    }
                    try {
                        console.log('Поиск пользователей для добавления в группу:', query);
                        const response = await fetch(`/users/search?query=${encodeURIComponent(query)}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Поиск не удался: ${response.status} (${errorText})`);
                        }
                        const users = await response.json();
                        console.log('Найденные пользователи:', users);
                        searchResults.innerHTML = '';
                        if (users.length === 0) {
                            searchResults.innerHTML = '<div class="search-result-item">Пользователи не найдены</div>';
                        } else {
                            users.forEach(user => {
                                if (!group.members.some(member => member.id === user.id)) {
                                    const item = document.createElement('div');
                                    item.className = 'search-result-item';
                                    item.innerHTML = `
                                        <div class="avatar">${user.username[0].toUpperCase()}</div>
                                        <div class="username">${user.username}</div>
                                    `;
                                    item.addEventListener('click', async () => {
                                        try {
                                            const response = await fetch(`/groups/${groupId}/add-member`, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/x-www-form-urlencoded',
                                                    'Authorization': `Bearer ${token}`
                                                },
                                                body: new URLSearchParams({ user_id: user.id })
                                            });
                                            const result = await response.json();
                                            if (response.ok) {
                                                showFlashMessage('Участник добавлен', 'success');
                                                searchInput.value = '';
                                                searchResults.classList.remove('active');
                                                showGroupInfo(groupId);
                                            } else {
                                                showFlashMessage(result.detail, 'danger');
                                            }
                                        } catch (error) {
                                            console.error('Ошибка добавления участника:', error);
                                            showFlashMessage(`Не удалось добавить участника: ${error.message}`, 'danger');
                                        }
                                    });
                                    searchResults.appendChild(item);
                                }
                            });
                        }
                        searchResults.classList.add('active');
                    } catch (error) {
                        console.error('Ошибка поиска пользователей:', error);
                        showFlashMessage(`Ошибка поиска: ${error.message}`, 'danger');
                    }
                });
            }
        } catch (error) {
            console.error('Ошибка загрузки информации о группе:', error);
            showFlashMessage(`Не удалось загрузить информацию о группе: ${error.message}`, 'danger');
        }
    }
    async function showEditGroupModal(groupId) {
        console.log('Показываю модальное окно редактирования группы:', groupId);
        const modal = document.getElementById('edit-group-modal');
        const form = document.getElementById('edit-group-form');
        const nameInput = document.getElementById('edit-group-name');
        const descriptionInput = document.getElementById('edit-group-description');
        const avatarInput = document.getElementById('edit-group-avatar');
        const closeBtn = document.getElementById('close-edit-modal-btn');
        const token = localStorage.getItem('token');
    
        try {
            // Загружаем текущие данные группы
            const response = await fetch(`/groups/${groupId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const group = await response.json();
            if (!response.ok) {
                throw new Error(`Не удалось загрузить данные группы: ${response.status} (${group.detail})`);
            }
            console.log('Данные группы:', group);
    
            // Заполняем форму текущими данными
            nameInput.value = group.name;
            descriptionInput.value = group.description || '';
    
            // Показываем модальное окно
            modal.classList.add('active');
    
            // Обработчик отправки формы
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Форма редактирования группы отправлена');
                const name = nameInput.value.trim();
                const description = descriptionInput.value.trim();
                const avatar = avatarInput.files[0];
    
                if (!name || name.length < 3) {
                    showFlashMessage('Название группы должно содержать минимум 3 символа', 'danger');
                    return;
                }
    
                const formData = new FormData();
                formData.append('name', name);
                formData.append('description', description);
                if (avatar) {
                    formData.append('avatar', avatar);
                }
    
                try {
                    const response = await fetch(`/groups/${groupId}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    const result = await response.json();
                    if (response.ok) {
                        showFlashMessage('Группа успешно обновлена', 'success');
                        modal.classList.remove('active');
                        // Обновляем информацию о группе
                        showGroupInfo(groupId);
                        // Обновляем название группы в чате
                        document.getElementById('chat-title').textContent = name;
                        // Обновляем список чатов
                        await loadRecentChats();
                        // Обновляем информацию в списке чатов
                        const chatItem = document.querySelector(`.group-item[data-id="${groupId}"][data-is-group="true"]`);
                        if (chatItem) {
                            const groupNameSpan = chatItem.querySelector('.group-name');
                            if (groupNameSpan) {
                                groupNameSpan.textContent = name;
                            }
                            // Обновляем аватар, если он был изменен
                            if (formData.get('group-avatar')) {
                                const avatarDiv = chatItem.querySelector('.group-avatar');
                                if (avatarDiv) {
                                    const avatarImg = avatarDiv.querySelector('img');
                                    if (avatarImg) {
                                        avatarImg.src = URL.createObjectURL(formData.get('group-avatar'));
                                    }
                                }
                            }
                        }
                    } else {
                        showFlashMessage(result.detail, 'danger');
                    }
                } catch (error) {
                    console.error('Ошибка обновления группы:', error);
                    showFlashMessage(`Не удалось обновить группу: ${error.message}`, 'danger');
                }
            }, { once: true });
    
            // Обработчик закрытия модального окна
            closeBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия модального окна редактирования');
                modal.classList.remove('active');
                // Очистка полей формы
                nameInput.value = '';
                descriptionInput.value = '';
                avatarInput.value = '';
            }, { once: true });
        } catch (error) {
            console.error('Ошибка загрузки данных группы:', error);
            showFlashMessage(`Не удалось открыть редактирование группы: ${error.message}`, 'danger');
        }
    }

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            window.location.href = '/settings?token=' + encodeURIComponent(localStorage.getItem('token'));
        });
    }

    // Load user info
    fetch('/users/me', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(user => {
        document.getElementById('settings-username').textContent = user.username || '';
        document.getElementById('settings-phone').textContent = user.mobile || '';
        document.getElementById('settings-handle').textContent = '@' + (user.username || '');
        if (user.avatar_url) {
            document.getElementById('settings-avatar').src = user.avatar_url;
        }
    });

    document.getElementById('my-account-btn').onclick = function() {
        window.location.href = '/my-profile?token=' + encodeURIComponent(token);
    };
    document.getElementById('change-password-btn').onclick = function() {
        window.location.href = '/change-password?token=' + encodeURIComponent(token);
    };
    document.getElementById('logout-btn').onclick = function() {
        localStorage.removeItem('token');
        window.location.href = '/';
    };
    document.getElementById('close-friends-btn').onclick = function() {
        // If you have a close friends page, use this:
        // window.location.href = '/close-friends?token=' + encodeURIComponent(token);
        alert('Close Friends page coming soon!');
    };
    document.querySelector('.close-btn').onclick = function() {
        window.location.href = '/chat?token=' + encodeURIComponent(localStorage.getItem('token'));
    }
});