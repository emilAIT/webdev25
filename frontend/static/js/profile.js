// Функции для работы с профилем пользователя

// Функция для обновления аватара в сайдбаре
async function updateSidebarAvatar() {
    const sidebarAvatarContainer = document.getElementById('sidebar-profile-avatar');
    if (!sidebarAvatarContainer) return;

    try {
        const profile = await getUserProfile(); // Предполагаем, что getUserProfile доступна глобально или импортирована
        // Проверяем ключ avatar_url, который теперь возвращает API
        if (profile && profile.avatar_url) {
            sidebarAvatarContainer.innerHTML = `<img src="${profile.avatar_url}" alt="Профиль" class="user-avatar-img">`;
        } else {
            sidebarAvatarContainer.innerHTML = `<img src="/static/images/meow-icon.jpg" alt="Профиль" class="user-avatar-img">`;
        }
    } catch (error) {
        console.error('Не удалось обновить аватар в сайдбаре:', error);
        sidebarAvatarContainer.innerHTML = `<img src="/static/images/meow-icon.jpg" alt="Профиль" class="user-avatar-img">`;
    }
}

// Обновленная функция отображения профиля ВНУТРИ ЛЕВОЙ ПАНЕЛИ
function showProfileDialog() {
    console.log("Отображение профиля пользователя внутри левой панели");

    // Получаем ссылки на элементы
    const chatListContainer = document.querySelector('.chat-list-container');
    if (!chatListContainer) {
        console.error('Контейнер списка чатов (.chat-list-container) не найден!');
        return;
    }
    const panelHeader = chatListContainer.querySelector('.chat-header');
    const searchContainer = chatListContainer.querySelector('.search-container');
    const chatList = chatListContainer.querySelector('.chat-list');
    const profileView = chatListContainer.querySelector('.main-profile-view'); // Ищем профиль внутри контейнера

    if (!panelHeader || !searchContainer || !chatList || !profileView) {
        console.error('Один или несколько ключевых элементов (.chat-header, .search-container, .chat-list, .main-profile-view) не найдены внутри .chat-list-container!');
        return;
    }

    panelHeader.style.display = 'none';
    searchContainer.style.display = 'none';
    chatList.style.display = 'none';
    profileView.style.display = 'flex'; 

    // Загружаем данные профиля пользователя
    getUserProfile() // Предполагаем, что getUserProfile доступна глобально или импортирована
        .then(profile => {
            console.log("Данные профиля:", profile);

            // Обработка, если профиль не загружен
            if (!profile) {
                profile = {
                    username: 'Пользователь',
                    email: '',
                    avatar_url: '/static/images/meow-icon.jpg' // Иконка по умолчанию
                };
                showNotification('Не удалось загрузить данные профиля', 'error'); // Предполагаем, что showNotification доступна
            }

            // Находим элементы формы профиля (теперь ищем внутри profileView)
            const nameInput = profileView.querySelector('#main-profile-name');
            const emailInput = profileView.querySelector('#main-profile-email');
            const passwordInput = profileView.querySelector('#main-profile-password');
            const avatarContainer = profileView.querySelector('#main-profile-avatar');
            const changeAvatarBtn = profileView.querySelector('#main-change-avatar-btn');
            const saveButton = profileView.querySelector('#main-save-profile-btn');
            const backArrow = profileView.querySelector('#profile-back-arrow');

            // Заполняем поля формы
            if (nameInput) nameInput.value = profile.username || '';
            if (emailInput) emailInput.value = profile.email || '';
            if (passwordInput) passwordInput.value = ''; // Пароль всегда пустой при открытии

            // Отображаем аватар
            if (avatarContainer) {
                const avatarUrl = profile.avatar_url || '/static/images/meow-icon.jpg';
                avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Аватар" class="profile-avatar-image">`;
            }

            // Обработчик кнопки "Назад"
            if (backArrow) {
                // Удаляем старый обработчик, чтобы избежать дублирования
                const newBackArrow = backArrow.cloneNode(true);
                backArrow.parentNode.replaceChild(newBackArrow, backArrow);
                newBackArrow.addEventListener('click', function() {
                    // Скрываем профиль, показываем хедер, поиск и список чатов
                    profileView.style.display = 'none';
                    panelHeader.style.display = 'flex'; // Или block, если исходный display был block
                    searchContainer.style.display = 'flex'; // Или block
                    chatList.style.display = 'block'; // Или flex
                });
            }

            // Обработчик изменения аватара
            if (avatarContainer && changeAvatarBtn) {
                 // Удаляем старый обработчик
                const newChangeAvatarBtn = changeAvatarBtn.cloneNode(true);
                changeAvatarBtn.parentNode.replaceChild(newChangeAvatarBtn, changeAvatarBtn);
                newChangeAvatarBtn.addEventListener('click', function() {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/jpeg,image/png,image/gif,image/jpg';
                    fileInput.style.display = 'none';

                    fileInput.addEventListener('change', function(event) {
                        if (event.target.files && event.target.files[0]) {
                            const file = event.target.files[0];
                            if (file.size > 5 * 1024 * 1024) {
                                showNotification('Файл слишком большой (макс. 5MB)', 'error');
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                avatarContainer.innerHTML = `<img src="${e.target.result}" alt="Аватар" class="profile-avatar-image">`;
                                window.avatarFile = file; // Используем window для временного хранения файла
                                showNotification('Изображение готово к загрузке. Нажмите "Сохранить".', 'info');
                            };
                            reader.onerror = function() {
                                showNotification('Ошибка чтения файла', 'error');
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                    document.body.appendChild(fileInput);
                    fileInput.click();
                    document.body.removeChild(fileInput);
                });
            }

            // Обработчик сохранения изменений
            if (saveButton) {
                // Удаляем старый обработчик
                const newSaveButton = saveButton.cloneNode(true);
                saveButton.parentNode.replaceChild(newSaveButton, saveButton);
                newSaveButton.addEventListener('click', async function() {
                    const name = nameInput ? nameInput.value.trim() : '';
                    const email = emailInput ? emailInput.value.trim() : '';
                    const password = passwordInput ? passwordInput.value.trim() : '';

                    if (!name || !email) {
                        showNotification('Имя пользователя и email обязательны', 'error');
                        return;
                    }

                    const profileData = { username: name, email: email };
                    if (password) profileData.password = password;

                    try {
                        // Обновляем данные профиля (имя, email, пароль)
                        const profileUpdateResult = await updateUserProfile(profileData); // Предполагаем, что updateUserProfile доступна

                        if (profileUpdateResult && profileUpdateResult.success) {
                            showNotification('Данные профиля успешно обновлены', 'success');
                             // Обновляем имя пользователя в хедере панели чатов
                             const userNameSpan = chatListContainer.querySelector('.panel-header .user-name');
                             if (userNameSpan) userNameSpan.textContent = name;
                             // Обновляем аватар в сайдбаре (если функция доступна)
                             if (typeof updateSidebarAvatar === 'function') {
                                 updateSidebarAvatar();
                             }
                        } else {
                            showNotification('Не удалось обновить данные профиля: ' + (profileUpdateResult?.error || 'неизвестная ошибка'), 'error');
                        }

                        // Если выбран новый файл аватара, загружаем его
                        if (window.avatarFile) {
                            try {
                                const avatarResult = await uploadAvatar(window.avatarFile); // Предполагаем, что uploadAvatar доступна
                                if (avatarResult && avatarResult.success) {
                                    showNotification('Аватар успешно обновлен', 'success');
                                    window.avatarFile = null; // Сбрасываем файл после загрузки
                                    // Обновляем аватар в сайдбаре после успешной загрузки (если функция доступна)
                                     if (typeof updateSidebarAvatar === 'function') {
                                         updateSidebarAvatar();
                                     }
                                } else {
                                    showNotification('Не удалось обновить аватар: ' + (avatarResult?.error || 'неизвестная ошибка'), 'error');
                                }
                            } catch (avatarError) {
                                console.error('Ошибка при загрузке аватара:', avatarError);
                                showNotification('Ошибка при загрузке аватара: ' + avatarError.message, 'error');
                            }
                        }

                         // После всех обновлений скрываем профиль и показываем хедер, поиск, список чатов
                         profileView.style.display = 'none';
                         panelHeader.style.display = 'flex'; // Или block
                         searchContainer.style.display = 'flex'; // Или block
                         chatList.style.display = 'block'; // Или flex

                    } catch (error) {
                        console.error('Ошибка при обновлении профиля:', error);
                        showNotification('Ошибка при обновлении профиля: ' + error.message, 'error');
                    }
                });
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке профиля для отображения:', error);
            showNotification('Не удалось загрузить профиль: ' + error.message, 'error');
            // Даже при ошибке загрузки, пытаемся показать пустой профиль
            panelHeader.style.display = 'none'; 
            searchContainer.style.display = 'none';
            chatList.style.display = 'none';
            profileView.style.display = 'flex';
        });
}

// Инициализация обработчика кнопки профиля
function initProfileButtonHandler() {
    const profileButton = document.querySelector('.profile-button');
    if (profileButton) {
        // Удаляем старый обработчик, если он был
        const newProfileButton = profileButton.cloneNode(true);
        profileButton.parentNode.replaceChild(newProfileButton, profileButton);
        newProfileButton.addEventListener('click', function() {
            showProfileDialog(); // Вызываем функцию отображения профиля
        });
    }
} 