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
                    console.log('Токен сохранен:', localStorage.getItem('token'));
                    console.log('Запрос к /chat после входа');
                    const chatResponse = await fetch('/chat', {
                        headers: { 'Authorization': `Bearer ${result.access_token}` }
                    });
                    console.log('Получен ответ от /chat:', chatResponse.status);
                    if (chatResponse.ok) {
                        console.log('Доступ к /chat получен, перенаправляю');
                        window.location.href = '/chat?token=' + encodeURIComponent(result.access_token);
                    } else {
                        console.error('Не удалось получить доступ к /chat:', chatResponse.status, await chatResponse.text());
                        showFlashMessage('Не удалось войти в чат, попробуйте снова', 'danger');
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
                window.location.href = '/chat?token=' + encodeURIComponent(token);
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
                window.location.href = '/chat?token=' + encodeURIComponent(token);
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
                            window.location.href = '/my-profile?token=' + encodeURIComponent(token);
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
                window.location.href = '/my-profile?token=' + encodeURIComponent(token);
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия редактирования профиля');
                window.location.href = '/my-profile?token=' + encodeURIComponent(token);
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
        const groupInfoModal = document.getElementById('group-info-modal');
        const groupInfoTitle = document.getElementById('group-info-title');
        const groupDescription = document.getElementById('group-description');
        const groupAvatarImg = document.getElementById('group-avatar-img');
        const groupAvatarSvg = document.getElementById('group-avatar-svg');
        const groupCreator = document.getElementById('group-creator');
        const groupMembersCount = document.getElementById('group-members-count');
        const groupMembers = document.getElementById('group-members');
        const closeGroupInfoBtn = document.getElementById('close-group-info-btn');
        const addGroupMemberInput = document.getElementById('add-group-member');
        const addGroupMemberResults = document.getElementById('add-group-member-results');

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
                menuDrawer.classList.remove('active');
                createGroupModal.style.display = 'block';
            });
        }

        if (moreOptions && chatOptionsDrawer) {
            moreOptions.addEventListener('click', () => {
                console.log('Нажата иконка дополнительных опций чата');
                if (!currentChatUserId && !currentGroupId) {
                    showFlashMessage('Выберите чат или группу', 'warning');
                    return;
                }
                // Очищаем предыдущие кнопки
                chatOptionsDrawer.innerHTML = '';

                if (currentGroupId) {
                    // Меню для группы
                    const infoBtn = document.createElement('button');
                    infoBtn.textContent = 'Инфо о группе';
                    infoBtn.addEventListener('click', async () => {
                        try {
                            console.log('Запрос информации о группе:', currentGroupId);
                            const response = await fetch(`/groups/${currentGroupId}/info`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const groupInfo = await response.json();
                            console.log('Полученные данные о группе:', groupInfo);
                    
                            if (response.ok) {
                                groupInfoTitle.textContent = groupInfo.name;
                                groupDescription.textContent = groupInfo.description || 'Нет описания';
                                if (groupInfo.avatar_url) {
                                    groupAvatarImg.src = groupInfo.avatar_url;
                                    groupAvatarImg.style.display = 'block';
                                    groupAvatarSvg.style.display = 'none';
                                } else {
                                    groupAvatarImg.style.display = 'none';
                                    groupAvatarSvg.style.display = 'block';
                                }
                                groupCreator.textContent = groupInfo.creator.username;
                                groupCreator.dataset.userId = groupInfo.creator.id;
                                groupCreator.className = 'value clickable';
                                groupCreator.addEventListener('click', () => {
                                    window.location.href = `/profile/${groupInfo.creator.id}?token=${encodeURIComponent(token)}`;
                                });
                    
                                groupMembersCount.textContent = groupInfo.member_count || groupInfo.members.length;
                                groupMembers.innerHTML = '';
                                if (!groupInfo.members || groupInfo.members.length === 0) {
                                    console.log('Список участников пуст');
                                    const noMembersDiv = document.createElement('div');
                                    noMembersDiv.className = 'group-member-item';
                                    noMembersDiv.textContent = 'Нет участников';
                                    groupMembers.appendChild(noMembersDiv);
                                } else {
                                    console.log('Рендерим участников:', groupInfo.members);
                                    groupInfo.members.forEach(member => {
                                        console.log('Добавляю участника:', member.username);
                                        const memberDiv = document.createElement('div');
                                        memberDiv.className = 'group-member-item';
                                        memberDiv.dataset.userId = member.id;
                                        memberDiv.innerHTML = `
                                            <div class="group-member">
                                                <div class="avatar">
                                                    ${member.avatar_url 
                                                        ? `<img src="${member.avatar_url}" alt="${member.username}">`
                                                        : `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <rect width="24" height="24" rx="12" fill="#1E90FF"/>
                                                            <circle cx="12" cy="8" r="4" fill="white"/>
                                                            <path d="M12 14c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z" fill="white"/>
                                                        </svg>`
                                                    }
                                                </div>
                                                <span class="username">${member.username}</span>
                                            </div>
                                        `;
                                        if (groupInfo.creator.id === currentUserId && member.id !== currentUserId) {
                                            const removeBtn = document.createElement('button');
                                            removeBtn.className = 'remove-btn';
                                            removeBtn.textContent = 'Удалить';
                                            removeBtn.addEventListener('click', async (e) => {
                                                e.stopPropagation();
                                                if (confirm(`Вы уверены, что хотите удалить ${member.username} из группы?`)) {
                                                    try {
                                                        const response = await fetch(`/groups/${currentGroupId}/remove-member`, {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/x-www-form-urlencoded',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: new URLSearchParams({ user_id: member.id })
                                                        });
                                                        const result = await response.json();
                                                        if (response.ok) {
                                                            showFlashMessage('Пользователь удалён из группы', 'success');
                                                            memberDiv.remove();
                                                            groupMembersCount.textContent = parseInt(groupMembersCount.textContent) - 1;
                                                        } else {
                                                            showFlashMessage(result.detail, 'danger');
                                                        }
                                                    } catch (error) {
                                                        console.error('Ошибка удаления участника:', error);
                                                        showFlashMessage(`Не удалось удалить участника: ${error.message}`, 'danger');
                                                    }
                                                }
                                            });
                                            memberDiv.appendChild(removeBtn);
                                        }
                                        memberDiv.querySelector('.group-member').addEventListener('click', () => {
                                            window.location.href = `/profile/${member.id}?token=${encodeURIComponent(token)}`;
                                        });
                                        groupMembers.appendChild(memberDiv);
                                        console.log('Элемент добавлен в DOM:', memberDiv);
                                    });
                                    console.log('Список участников после рендеринга:', groupMembers.innerHTML);
                                }
                    
                                const adminSection = document.querySelector('.admin-only');
                                if (groupInfo.creator.id === currentUserId) {
                                    adminSection.style.display = 'flex';
                                } else {
                                    adminSection.style.display = 'none';
                                }
                    
                                groupInfoModal.style.display = 'block';
                            } else {
                                showFlashMessage(groupInfo.detail, 'danger');
                            }
                        } catch (error) {
                            console.error('Ошибка загрузки информации о группе:', error);
                            showFlashMessage(`Не удалось загрузить информацию о группе: ${error.message}`, 'danger');
                        }
                        chatOptionsDrawer.classList.remove('active');
                    });
                    chatOptionsDrawer.appendChild(infoBtn);

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
                } else {
                    // Меню для личного чата
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

            // Закрываем меню при клике вне его
            document.addEventListener('click', (e) => {
                if (!moreOptions.contains(e.target) && !chatOptionsDrawer.contains(e.target)) {
                    chatOptionsDrawer.classList.remove('active');
                }
            });
        }

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия модального окна');
                createGroupModal.style.display = 'none';
                groupNameInput.value = '';
                groupDescriptionInput.value = '';
                groupAvatarInput.value = '';
                groupMembersInput.value = '';
                groupMembersList.innerHTML = '';
                groupMembersSearchResults.innerHTML = '';
                groupMembersSearchResults.classList.remove('active');
            });
        }

        if (closeGroupInfoBtn) {
            closeGroupInfoBtn.addEventListener('click', () => {
                console.log('Нажата кнопка закрытия модального окна группы');
                groupInfoModal.style.display = 'none';
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
        if (addGroupMemberInput) {
            addGroupMemberInput.addEventListener('input', async () => {
                const query = addGroupMemberInput.value.trim();
                if (query.length < 2) {
                    addGroupMemberResults.classList.remove('active');
                    addGroupMemberResults.innerHTML = '';
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
                    addGroupMemberResults.innerHTML = '';
                    if (users.length === 0) {
                        addGroupMemberResults.innerHTML = '<div class="search-result-item">Пользователи не найдены</div>';
                    } else {
                        users.forEach(user => {
                            // Проверяем, не является ли пользователь уже участником группы
                            if (groupMembers.querySelector(`[data-user-id="${user.id}"]`)) {
                                return;
                            }
                            const item = document.createElement('div');
                            item.className = 'search-result-item';
                            item.innerHTML = `
                                <div class="avatar">${user.username[0].toUpperCase()}</div>
                                <div class="username">${user.username}</div>
                            `;
                            item.addEventListener('click', async () => {
                                try {
                                    const response = await fetch(`/groups/${currentGroupId}/add-member`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/x-www-form-urlencoded',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: new URLSearchParams({ user_id: user.id })
                                    });
                                    const result = await response.json();
                                    if (response.ok) {
                                        showFlashMessage('Пользователь добавлен в группу', 'success');
                                        // Добавляем нового участника в список
                                        const memberDiv = document.createElement('div');
                                        memberDiv.className = 'group-member-item';
                                        memberDiv.dataset.userId = user.id;
                                        memberDiv.innerHTML = `
                                            <div class="group-member">
                                                <div class="avatar">
                                                    ${user.avatar_url 
                                                        ? `<img src="${user.avatar_url}" alt="${user.username}">`
                                                        : `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <rect width="24" height="24" rx="12" fill="#1E90FF"/>
                                                            <circle cx="12" cy="8" r="4" fill="white"/>
                                                            <path d="M12 14c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z" fill="white"/>
                                                        </svg>`
                                                    }
                                                </div>
                                                <div class="username">${user.username}</div>
                                            </div>
                                            <button class="remove-btn">Удалить</button>
                                        `;
                                        memberDiv.querySelector('.group-member').addEventListener('click', () => {
                                            window.location.href = `/profile/${user.id}?token=${encodeURIComponent(token)}`;
                                        });
                                        memberDiv.querySelector('.remove-btn').addEventListener('click', async (e) => {
                                            e.stopPropagation();
                                            if (confirm(`Вы уверены, что хотите удалить ${user.username} из группы?`)) {
                                                try {
                                                    const response = await fetch(`/groups/${currentGroupId}/remove-member`, {
                                                        method: 'POST',
                                                        headers: {
                                                            'Content-Type': 'application/x-www-form-urlencoded',
                                                            'Authorization': `Bearer ${token}`
                                                        },
                                                        body: new URLSearchParams({ user_id: user.id })
                                                    });
                                                    const result = await response.json();
                                                    if (response.ok) {
                                                        showFlashMessage('Пользователь удалён из группы', 'success');
                                                        memberDiv.remove();
                                                        groupMembersCount.textContent = parseInt(groupMembersCount.textContent) - 1;
                                                    } else {
                                                        showFlashMessage(result.detail, 'danger');
                                                    }
                                                } catch (error) {
                                                    console.error('Ошибка удаления участника:', error);
                                                    showFlashMessage(`Не удалось удалить участника: ${error.message}`, 'danger');
                                                }
                                            }
                                        });
                                        groupMembers.appendChild(memberDiv);
                                        groupMembersCount.textContent = parseInt(groupMembersCount.textContent) + 1;
                                        addGroupMemberInput.value = '';
                                        addGroupMemberResults.classList.remove('active');
                                    } else {
                                        showFlashMessage(result.detail, 'danger');
                                    }
                                } catch (error) {
                                    console.error('Ошибка добавления участника:', error);
                                    showFlashMessage(`Не удалось добавить участника: ${error.message}`, 'danger');
                                }
                            });
                            addGroupMemberResults.appendChild(item);
                        });
                    }
                    addGroupMemberResults.classList.add('active');
                } catch (error) {
                    console.error('Ошибка поиска пользователей:', error);
                    showFlashMessage(`Ошибка поиска пользователей: ${error.message}`, 'danger');
                }
            });
        }

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

                ws.onopen = () => {
                    console.log('WebSocket соединение установлено');
                };

                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log('Получено сообщение:', message);
                    if (message.sender_id !== currentUserId && !message.is_read) {
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
                    if ((message.receiver_id === currentChatUserId && !message.group_id) || message.group_id === currentGroupId) {
                        displayMessage(message);
                        updateUnreadDivider();
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
                console.log('Загружены сообщения:', messages);
                chatMessages.innerHTML = '';
                lastMessageDate = null; // Сбрасываем дату последнего сообщения
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
            console.log(`Отображаю сообщение: sender_id=${message.sender_id}, currentUserId=${currentUserId}, isOwnMessage=${message.sender_id === currentUserId}`);
            
            // Получаем дату сообщения
            const messageDate = new Date(message.timestamp);
            const messageDateString = messageDate.toISOString().split('T')[0]; // Формат YYYY-MM-DD

            // Проверяем, отличается ли дата от предыдущего сообщения
            if (lastMessageDate !== messageDateString) {
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.textContent = formatDateToRussian(messageDate);
                chatMessages.appendChild(divider);
                lastMessageDate = messageDateString;
            }

            // Создаём элемент сообщения
            const div = document.createElement('div');
            const isOwnMessage = message.sender_id === currentUserId;
            div.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
            div.dataset.read = message.is_read ? 'true' : 'false';

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
            contentDiv.innerHTML = `
                <div class="username">${message.username}</div>
                <div class="content">
                    <div class="content-text">${message.content}</div>
                    <div class="timestamp">${timeString}</div>
                </div>
            `;

            if (isOwnMessage) {
                div.appendChild(contentDiv);
                div.appendChild(avatarDiv);
            } else {
                div.appendChild(avatarDiv);
                div.appendChild(contentDiv);
            }

            chatMessages.appendChild(div);
        }

        // Обработка формы чата
        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Форма чата отправлена');
                if (!currentChatUserId && !currentGroupId) {
                    showFlashMessage('Выберите чат или группу', 'warning');
                    return;
                }
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    showFlashMessage('WebSocket не подключен, обновите страницу', 'danger');
                    return;
                }
                const content = messageInput.value.trim();
                if (content) {
                    console.log('Отправляю сообщение:', content);
                    ws.send(JSON.stringify({
                        content,
                        receiver_id: currentChatUserId,
                        group_id: currentGroupId
                    }));
                    messageInput.value = '';
                    hasInteracted = true;
                    updateUnreadDivider();
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
                                <div class="avatar">${user.username[0].toUpperCase()}</div>
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
                                addChatToList(user.id, null, user.username, null, 0, false);
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
});