// Функции для создания чатов и групп

// --- ДОБАВЛЕНО: Флаг для предотвращения повторной инициализации ---
let isCreateButtonHandlerInitialized = false;
// --- КОНЕЦ ДОБАВЛЕНИЯ ---

// Инициализация обработчиков создания чата и группы
function initCreateButtonHandler() {
    // --- ДОБАВЛЕНО: Проверка флага --- 
    if (isCreateButtonHandlerInitialized) {
        // console.log('[chatCreation.js] initCreateButtonHandler: Already initialized, skipping.');
        return; // Выходим, если уже инициализировано
    }
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---
    
    console.log('[chatCreation.js] initCreateButtonHandler called FOR THE FIRST TIME'); // Обновил лог
    const newChatBtn = document.querySelector('.new-chat-btn');
    const createDropdown = document.getElementById('create-dropdown');
    const newChatItem = document.getElementById('new-chat-item');
    const newGroupItem = document.getElementById('new-group-item');

    if (newChatBtn && createDropdown) {
        console.log('[chatCreation.js] Found .new-chat-btn and #create-dropdown');
        // Обработчик клика по кнопке Edit/New chat
        newChatBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            console.log('[chatCreation.js] .new-chat-btn clicked!');

            // --- Используем getComputedStyle для проверки реального отображения --- 
            const computedStyle = window.getComputedStyle(createDropdown);
            // --- Конец изменения ---

            // Переключаем видимость выпадающего меню
            // if (createDropdown.style.display === 'none' || !createDropdown.style.display) { // Старая проверка
            if (computedStyle.display === 'none') { // Новая проверка
                console.log('[chatCreation.js] Showing #create-dropdown (using getComputedStyle)');
                // Устанавливаем инлайн-стили для отображения
                createDropdown.style.display = 'block';
                // --- ДОБАВЛЕНО ЛОГИРОВАНИЕ ПОСЛЕ УСТАНОВКИ --- 
                console.log(`[chatCreation.js] Set display to: ${createDropdown.style.display}`); 
                // --- КОНЕЦ ДОБАВЛЕНИЯ ---
                createDropdown.style.visibility = 'visible';
                createDropdown.style.opacity = '1';

                // Позиционируем выпадающее меню относительно кнопки
                const buttonRect = newChatBtn.getBoundingClientRect();
                createDropdown.style.top = (buttonRect.bottom + 5) + 'px';
                createDropdown.style.left = buttonRect.left + 'px';
            } else {
                console.log('[chatCreation.js] Hiding #create-dropdown (using getComputedStyle)');
                // Скрываем через инлайн-стиль
                createDropdown.style.display = 'none'; 
                // Сбрасываем visibility/opacity
                createDropdown.style.visibility = 'hidden';
                createDropdown.style.opacity = '0';
            }
        });

        // Закрытие меню при клике вне его
        document.addEventListener('click', function(event) {
            // Проверяем, что клик был не по кнопке и не внутри меню
            if (!createDropdown.contains(event.target) && event.target !== newChatBtn) {
                // --- ДОБАВЛЕНО ЛОГИРОВАНИЕ ПЕРЕД СКРЫТИЕМ --- 
                const currentComputedStyle = window.getComputedStyle(createDropdown);
                if (currentComputedStyle.display === 'block') {
                    console.log('[chatCreation.js] Clicked outside dropdown (event target: ', event.target, '), hiding.');
                    createDropdown.style.display = 'none';
                    createDropdown.style.visibility = 'hidden';
                    createDropdown.style.opacity = '0';
                }
                // --- КОНЕЦ ДОБАВЛЕНИЯ ---
            }
        });

        // Обработчик для создания нового чата
        if (newChatItem) {
            console.log('[chatCreation.js] Found #new-chat-item, adding listener.');
            newChatItem.addEventListener('click', function() {
                console.log('[chatCreation.js] #new-chat-item clicked');
                createDropdown.style.display = 'none';
                showNewChatDialog();
            });
        } else {
            console.error('[chatCreation.js] Element #new-chat-item not found!');
        }

        // Обработчик для создания новой группы
        if (newGroupItem) {
            console.log('[chatCreation.js] Found #new-group-item, adding listener.');
            newGroupItem.addEventListener('click', function() {
                console.log('[chatCreation.js] #new-group-item clicked');
                createDropdown.style.display = 'none';
                showNewGroupDialog();
            });
        } else {
            console.error('[chatCreation.js] Element #new-group-item not found!');
        }
        
        // --- ДОБАВЛЕНО: Установка флага после успешной инициализации --- 
        isCreateButtonHandlerInitialized = true;
        console.log('[chatCreation.js] initCreateButtonHandler: Successfully initialized.');
        // --- КОНЕЦ ДОБАВЛЕНИЯ ---
        
    } else {
        // Добавлено логирование ошибок, если элементы не найдены
        if (!newChatBtn) console.error('[chatCreation.js] Element .new-chat-btn not found!');
        if (!createDropdown) console.error('[chatCreation.js] Element #create-dropdown not found!');
    }
}

// Открытие диалога создания нового чата
function showNewChatDialog() {
    console.log("Вызвана функция showNewChatDialog");

    // Скрываем экран приветствия и показываем область создания чата
    const welcomeScreen = document.querySelector('.welcome-screen');
    const conversation = document.querySelector('.conversation');

    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (conversation) {
        conversation.style.display = 'flex';

        // Обновляем заголовок чата
        const chatUserName = document.querySelector('.chat-user-name');
        if (chatUserName) {
            chatUserName.textContent = 'New Chat';
        }

        // Обновляем содержимое контейнера сообщений для отображения формы создания чата
        const messageContainer = document.querySelector('.message-container');
        if (messageContainer) {
            messageContainer.innerHTML = `
                <div class="create-chat-container">
                    <div class="back-arrow" id="create-chat-back-arrow">
                        <img src="/static/images/icons/arrow1%201.svg" alt="Назад" class="back-icon">
                    </div>
                    <div class="create-chat-header">
                        <h2>New Chat</h2>
                    </div>
                    <div class="create-chat-form">
                        <div class="form-group">
                            <input type="text" id="username-search" placeholder="Enter username" required>
                        </div>
                        <div class="search-results" id="user-search-results"></div>
                        <div class="next-btn-container">
                            <button class="search-user-btn">
                                <img src="/static/images/icons/arrow1%201.svg" alt="Поиск" class="search-arrow-icon">
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Стилизуем контейнер
            messageContainer.style.display = 'flex';
            messageContainer.style.flexDirection = 'column';
            messageContainer.style.justifyContent = 'center';
            messageContainer.style.alignItems = 'center';

            // Скрываем поле ввода сообщения, так как оно не нужно при создании чата
            const inputContainer = document.querySelector('.input-container');
            if (inputContainer) {
                inputContainer.style.display = 'none';
            }

            // Обработчик на стрелку назад
            const backArrow = messageContainer.querySelector('#create-chat-back-arrow');
            if (backArrow) {
                backArrow.addEventListener('click', function() {
                    // Скрываем область чата
                    if (conversation) conversation.style.display = 'none';
                    // Возвращаем экран приветствия
                    if (welcomeScreen) welcomeScreen.style.display = 'flex';
                    // Показываем поле ввода сообщения
                    if (inputContainer) inputContainer.style.display = 'flex';
                });
            }

            // Обработчик ввода имени пользователя и поиска
            const usernameInput = messageContainer.querySelector('#username-search');
            const searchButton = messageContainer.querySelector('.search-user-btn');

            if (usernameInput && searchButton) {
                // Автопоиск при вводе
                usernameInput.addEventListener('input', function() {
                    const query = this.value.trim();
                    if (query.length >= 2) {
                        searchUsers(query) // Предполагаем, что searchUsers доступна
                            .then(users => displayUserSearchResults(users, messageContainer))
                            .catch(error => console.error('Ошибка при поиске пользователей:', error));
                    }
                });

                // Поиск по кнопке
                searchButton.addEventListener('click', function() {
                    const query = usernameInput.value.trim();
                    if (query.length >= 2) {
                        searchUsers(query)
                            .then(users => displayUserSearchResults(users, messageContainer))
                            .catch(error => console.error('Ошибка при поиске пользователей:', error));
                    } else {
                        showNotification('Введите имя пользователя', 'error'); // Предполагаем, что showNotification доступна
                    }
                });

                // Поиск по Enter
                usernameInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        const query = this.value.trim();
                        if (query.length >= 2) {
                            searchUsers(query)
                                .then(users => displayUserSearchResults(users, messageContainer))
                                .catch(error => console.error('Ошибка при поиске пользователей:', error));
                        } else {
                            showNotification('Введите имя пользователя', 'error');
                        }
                    }
                });
            }
        }
    }
}

// Отображение результатов поиска пользователей для создания чата
function displayUserSearchResults(users, container) {
    const resultsContainer = container.querySelector('#user-search-results');
    if (!resultsContainer) return;

    if (!users || users.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
        return;
    }

    // Очищаем контейнер и заполняем результатами
    resultsContainer.innerHTML = '';

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';

        userItem.innerHTML = `
            <div class="user-avatar">
                <img src="${user.avatar_url || user.avatar || '/static/images/meow-icon.jpg'}" alt="${user.username}">
            </div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-status">${user.status || 'Статус не указан'}</div>
            </div>
        `;

        // Обработчик клика для создания чата
        userItem.addEventListener('click', async function() {
            try {
                // Создаем чат с выбранным пользователем
                const result = await createChat(user.id); // Предполагаем, что createChat доступна

                if (result && result.chat_id) {
                    // Обновляем список чатов и открываем новый чат
                    await loadChats(); // Предполагаем, что loadChats доступна

                    // Показываем поле ввода сообщения, которое было скрыто
                    const inputContainer = document.querySelector('.input-container');
                    if (inputContainer) {
                        inputContainer.style.display = 'flex';
                    }

                    // Открываем созданный чат
                    openChat(result.chat_id, 'direct'); // Предполагаем, что openChat доступна

                    showNotification('Чат создан успешно', 'success');
                } else {
                    showNotification('Не удалось создать чат: ' + (result.error || 'неизвестная ошибка'), 'error');
                }
            } catch (error) {
                console.error('Ошибка создания чата:', error);
                showNotification('Ошибка при создании чата: ' + error.message, 'error');
            }
        });

        resultsContainer.appendChild(userItem);
    });

    // Показываем результаты
    resultsContainer.style.display = 'block';
}

// Открытие диалога создания новой группы
function showNewGroupDialog() {
    console.log("Вызвана функция showNewGroupDialog");

    // Скрываем экран приветствия и показываем область создания группы
    const welcomeScreen = document.querySelector('.welcome-screen');
    const conversation = document.querySelector('.conversation');
    const conversationHeader = document.querySelector('.conversation-header'); // Получаем хедер

    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (conversation) {
        conversation.style.display = 'flex';

        // Обновляем заголовок чата (оставляем как есть, т.к. он теперь не виден)
        // const chatUserName = conversationHeader?.querySelector('.chat-user-name');
        // if (chatUserName) {
        //     chatUserName.textContent = 'Создать группу';
        // }

        // Скрываем элементы в хедере беседы
        if (conversationHeader) {
            const backButton = conversationHeader.querySelector('.back-button');
            const chatUser = conversationHeader.querySelector('.chat-user');
            if (backButton) backButton.style.display = 'none';
            if (chatUser) chatUser.style.display = 'none';
        }

        // Обновляем содержимое контейнера сообщений для отображения формы создания группы
        const messageContainer = document.querySelector('.message-container');
        if (messageContainer) {
            messageContainer.innerHTML = `
                <div class="create-group-container" id="create-group-step-1">
                    <div class="create-group-header">
                         <div class="back-arrow" id="create-group-back-arrow">
                             <img src="/static/images/icons/arrow1%201.svg" alt="Назад" class="back-icon">
                         </div>
                         <h2>Create Group</h2>
                     </div>
                    <div class="group-avatar-upload">
                        <div class="avatar-circle" id="group-avatar-circle">
                            <img src="/static/images/icons/add-image.svg" alt="Добавить фото" class="add-image-icon">
                        </div>
                    </div>
                    <div class="create-group-form">
                        <div class="form-group">
                            <input type="text" id="new-group-name" placeholder="Group name" required>
                        </div>
                        <div class="form-group">
                            <textarea id="new-group-description" placeholder="Description"></textarea>
                        </div>
                        <div class="form-group next-btn-container">
                            <button class="search-user-btn" id="create-group-next-btn">
                                <img src="/static/images/icons/arrow1%201.svg" alt="Далее" class="next-arrow-icon">
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Стилизуем контейнер
            messageContainer.style.display = 'flex';
            messageContainer.style.flexDirection = 'column';
            messageContainer.style.padding = '0'; // Убираем внутренние отступы message-container

            // Скрываем поле ввода сообщения
            const inputContainer = document.querySelector('.input-container');
            if (inputContainer) {
                inputContainer.style.display = 'none';
            }

             // Обработчик кнопки "Назад" внутри формы
             const backArrow = messageContainer.querySelector('#create-group-back-arrow');
             if (backArrow) {
                 backArrow.addEventListener('click', function() {
                     // Восстанавливаем видимость элементов хедера беседы
                    if (conversationHeader) {
                        const backButton = conversationHeader.querySelector('.back-button');
                        const chatUser = conversationHeader.querySelector('.chat-user');
                        if (backButton) backButton.style.display = 'flex'; // Восстанавливаем
                        if (chatUser) chatUser.style.display = 'flex'; // Восстанавливаем
                    }

                     // Показываем conversation (внутри будет welcomeScreen или сообщения)
                     if (conversation) conversation.style.display = 'flex';
                     // Скрываем экран приветствия, чтобы он не перекрывал чат при возврате
                     if (welcomeScreen) welcomeScreen.style.display = 'none';
                     // Показываем поле ввода сообщения
                     if (inputContainer) inputContainer.style.display = 'flex';
                 });
             }

            // Добавляем обработчик для загрузки изображения
            const avatarCircle = messageContainer.querySelector('#group-avatar-circle');
            if (avatarCircle) {
                avatarCircle.addEventListener('click', function() {
                    console.log('[showNewGroupDialog] Клик по кругу аватара.');
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/*';
                    fileInput.style.display = 'none';
                    fileInput.addEventListener('change', function(event) {
                        console.log('[showNewGroupDialog] Событие change для fileInput сработало.');
                        if (event.target.files && event.target.files[0]) {
                            const file = event.target.files[0];
                            console.log('[showNewGroupDialog] Файл получен:', file);
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                console.log('[showNewGroupDialog] FileReader onload сработал.');
                                avatarCircle.innerHTML = `<img src="${e.target.result}" alt="Фото группы" class="group-avatar-preview">`;
                                window.groupAvatarFile = file; // Используем window для временного хранения файла
                                console.log('[showNewGroupDialog] Файл аватара выбран и сохранен в window.groupAvatarFile:', window.groupAvatarFile);
                            };
                            reader.onerror = function(e) {
                                console.error('[showNewGroupDialog] Ошибка FileReader:', e);
                                showNotification('Ошибка при чтении файла аватара', 'error');
                            };
                            reader.readAsDataURL(file);
                        } else {
                            console.log('[showNewGroupDialog] Файлы не выбраны или event.target.files пуст.');
                        }
                    });
                    document.body.appendChild(fileInput);
                    fileInput.click();
                    document.body.removeChild(fileInput);
                });
            }

            // Добавляем обработчик для кнопки "Далее"
            const nextBtn = messageContainer.querySelector('#create-group-next-btn');
            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    const nameInput = document.getElementById('new-group-name');
                    const descriptionInput = document.getElementById('new-group-description');
                    const nameValue = nameInput ? nameInput.value.trim() : '';
                    const descriptionValue = descriptionInput ? descriptionInput.value.trim() : '';
                    if (!nameValue) {
                        showNotification('Пожалуйста, введите название группы', 'error');
                        if (nameInput) nameInput.focus();
                        return;
                    }
                    console.log('[showNewGroupDialog] Значение window.groupAvatarFile перед передачей:', window.groupAvatarFile);
                    const groupData = {
                        name: nameValue,
                        description: descriptionValue,
                        avatarFile: window.groupAvatarFile || null
                    };
                    showAddMembersDialogInline(groupData);
                });
            }
        }
    }
}

// Отображение диалога добавления участников группы в основной области чата
function showAddMembersDialogInline(groupData) {
    console.log("Показываем диалог добавления участников inline");
    console.log("Полученные данные группы:", JSON.stringify(groupData));

    // Проверяем, передано ли название группы
    if (!groupData.name || groupData.name.trim() === '') {
        console.error("Ошибка: название группы не передано или пустое");
        showNotification('Введите название группы', 'error');
        return;
    }

    // Обновляем содержимое контейнера сообщений
    const messageContainer = document.querySelector('.message-container');
    if (messageContainer) {
        messageContainer.innerHTML = `
            <div class="add-members-container">
                <div class="add-members-header">
                    <div class="back-arrow" id="add-members-back-arrow">
                        <img src="/static/images/icons/arrow1%201.svg" alt="Назад" class="back-icon">
                    </div>
                    <h2>Add Members</h2>
                </div>

                <div class="search-container">
                    <input type="text" id="user-search" placeholder="Search...">
                </div>
                <div class="search-results" id="search-results"></div>
                <div class="selected-members">
                    <h6>Users:</h6>
                    <ul id="selected-members-list"></ul>
                </div>
                <div class="form-actions">
                    <button class="cancel-btn" id="add-members-cancel-btn">Cancel</button>
                    <button class="create-group-btn" id="add-members-create-btn">Create</button>
                </div>
            </div>
        `;

        // Инициализация списка выбранных участников
        const selectedMembers = [];
        updateSelectedMembersListInline(selectedMembers, messageContainer);

        // Инициализация обработчика поиска пользователей
        const searchInput = messageContainer.querySelector('#user-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const query = this.value.trim();
                if (query.length >= 2) {
                    searchUsers(query)
                        .then(users => {
                            console.log("Найдены пользователи:", users);
                            displayMemberSearchResultsInline(users, selectedMembers, messageContainer);
                        })
                        .catch(error => console.error('Ошибка при поиске пользователей:', error));
                }
            });
        }

        // Обработчик кнопки "Назад"
        const backBtn = messageContainer.querySelector('#add-members-back-arrow');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                // Возвращаемся к экрану создания группы (шаг 1)
                showNewGroupDialog();
                // Восстанавливаем данные, если они были введены
                // TODO: Восстановить имя, описание и превью аватара
            });
        }

        // Обработчик кнопки "Отмена"
        const cancelBtn = messageContainer.querySelector('#add-members-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                // Возвращаемся к стандартному виду (экран приветствия или последний чат)
                const conversation = document.querySelector('.conversation');
                const welcomeScreen = document.querySelector('.welcome-screen');
                const inputContainer = document.querySelector('.input-container');
                const conversationHeader = document.querySelector('.conversation-header');

                // Восстанавливаем хедер
                if (conversationHeader) {
                    const backButton = conversationHeader.querySelector('.back-button');
                    const chatUser = conversationHeader.querySelector('.chat-user');
                    if (backButton) backButton.style.display = 'flex';
                    if (chatUser) chatUser.style.display = 'flex';
                }

                // Показываем поле ввода
                if (inputContainer) inputContainer.style.display = 'flex';

                // Показываем conversation (внутри будет welcomeScreen или сообщения)
                if (conversation) conversation.style.display = 'flex';
                // Скрываем экран приветствия, чтобы он не перекрывал чат при возврате
                if (welcomeScreen) welcomeScreen.style.display = 'none';

                // Сбрасываем временный файл аватара
                window.groupAvatarFile = null;
            });
        }

        // Обработчик создания группы
        const createGroupBtn = messageContainer.querySelector('#add-members-create-btn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', function() {
                console.log("Нажата кнопка 'Создать группу'");
                console.log("Данные группы перед созданием:", groupData);
                console.log("Выбранные участники:", selectedMembers);

                if (!groupData.name || groupData.name.trim() === '') {
                    showNotification('Пожалуйста, введите название группы', 'error');
                    return;
                }

                if (selectedMembers.length === 0) {
                    showNotification('Пожалуйста, выберите хотя бы одного участника', 'error');
                    return;
                }

                const memberIds = selectedMembers.map(member => member.id);
                console.log("Отправляем запрос на создание группы с параметрами:", {
                    name: groupData.name,
                    description: groupData.description || '',
                    memberIds: memberIds,
                    avatar: groupData.avatarFile ? groupData.avatarFile.name : null
                });

                // Если есть аватар, создаем FormData для отправки файла
                if (groupData.avatarFile) {
                    const formData = new FormData();
                    formData.append('group_name', groupData.name);
                    formData.append('description', groupData.description || '');
                    formData.append('member_ids', JSON.stringify(memberIds));
                    formData.append('avatar', groupData.avatarFile);

                    // Отправляем запрос с файлом
                    fetch('/api/groups/create-with-avatar', {
                        method: 'POST',
                        body: formData,
                        credentials: 'include' // Важно для отправки куки
                    })
                    .then(response => response.json())
                    .then(result => {
                        console.log("Ответ сервера при создании группы с аватаром:", result);
                        handleGroupCreationSuccess(result);
                    })
                    .catch(error => {
                        console.error('Ошибка при создании группы с аватаром:', error);
                        handleGroupCreationError(error);
                    });
                } else {
                    // Если аватара нет, используем обычный метод
                    createGroupSafe(groupData.name, groupData.description || '', memberIds)
                        .then(result => {
                            console.log("Ответ сервера при создании группы без аватара:", result);
                            handleGroupCreationSuccess(result);
                        })
                        .catch(error => {
                            console.error('Ошибка при создании группы без аватара:', error);
                            handleGroupCreationError(error);
                        });
                }
            });
        }
    }
}

// Обработка успешного создания группы
function handleGroupCreationSuccess(result) {
    if (result && (result.group_id || result.success)) {
        showNotification('Group created successfully', 'success');

        // Restore visibility of the conversation header
        const conversationHeader = document.querySelector('.conversation-header');
        if (conversationHeader) {
            const backButton = conversationHeader.querySelector('.back-button');
            const chatUser = conversationHeader.querySelector('.chat-user');
            if (backButton) backButton.style.display = 'flex';
            if (chatUser) chatUser.style.display = 'flex';
            
            // Удаляем "New Chat" из заголовка
            const chatUserName = conversationHeader.querySelector('.chat-user-name');
            if (chatUserName && chatUserName.textContent === 'New Chat') {
                chatUserName.textContent = '';
            }
        }

        // Показываем поле ввода сообщения
        const inputContainer = document.querySelector('.input-container');
        if (inputContainer) {
            inputContainer.style.display = 'flex';
        }

        // Группа создана успешно, открываем её, явно указав тип 'group'
        if (result.group_id) {
            console.log('Открываем созданную группу с ID:', result.group_id);
            // Используем небольшую задержку, чтобы список чатов успел обновиться
            // и затем вызываем openChat
            loadChats().then(() => {
                setTimeout(() => openChat(result.group_id, 'group'), 100); // Уменьшенная задержка
            }).catch(error => console.error('Ошибка при обновлении списка чатов перед открытием группы:', error));
        } else {
            // Просто обновляем список чатов, если ID группы не возвращен
            loadChats().catch(error => console.error('Ошибка при обновлении списка чатов:', error));
        }
         // Сбрасываем временный файл аватара
        window.groupAvatarFile = null;

    } else {
        showNotification('Не удалось создать группу: ' + (result?.error || 'неизвестная ошибка'), 'error');
    }
}

// Обработка ошибки создания группы
function handleGroupCreationError(error) {
    // Проверяем ошибку аутентификации
    if (error.message && (error.message.includes('Unauthorized') || error.message.includes('Not authenticated') || error.message.includes('401'))) {
        showNotification('Для создания группы необходимо авторизоваться снова. Перенаправление...', 'error');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    } else {
        showNotification('Ошибка при создании группы: ' + (error.message || 'неизвестная ошибка'), 'error');
    }
}

// Отображение результатов поиска пользователей для группы (встроенная версия)
function displayMemberSearchResultsInline(users, selectedMembers, container) {
    const resultsContainer = container.querySelector('#search-results');
    if (!resultsContainer) return;

    if (!users || users.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
        return;
    }

    // Очищаем контейнер и заполняем результатами
    resultsContainer.innerHTML = '';

    // Фильтруем уже выбранных пользователей
    const filteredUsers = users.filter(user =>
        !selectedMembers.some(member => member.id === user.id)
    );

    if (filteredUsers.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results"></div>';
        return;
    }

    filteredUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';

        userItem.innerHTML = `
            <div class="user-avatar">
                <img src="${user.avatar_url || user.avatar || '/static/images/meow-icon.jpg'}" alt="${user.username}">
            </div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-status">${user.status || 'Статус не указан'}</div>
            </div>
            <div class="user-action">
                <button class="add-member-btn">Add</button>
            </div>
        `;

        // Обработчик клика для добавления пользователя
        userItem.querySelector('.add-member-btn').addEventListener('click', function() {
            // Добавляем пользователя в список выбранных
            selectedMembers.push(user);
            updateSelectedMembersListInline(selectedMembers, container);

            // Удаляем пользователя из результатов поиска
            userItem.remove();

            // Очищаем поле поиска
            const searchInput = container.querySelector('#user-search');
            if (searchInput) {
                searchInput.value = '';
            }
            // Очищаем результаты поиска после добавления
            resultsContainer.innerHTML = '<div class="no-results"></div>';

            // Если все пользователи выбраны, показываем сообщение (уже не нужно, так как очищаем)
            // if (resultsContainer.children.length === 0) {
            //     resultsContainer.innerHTML = '<div class="no-results"></div>';
            // }
        });

        resultsContainer.appendChild(userItem);
    });
}

// Обновление списка выбранных участников (встроенная версия)
function updateSelectedMembersListInline(selectedMembers, container) {
    const membersListContainer = container.querySelector('#selected-members-list');
    if (!membersListContainer) return;

    // Очищаем список выбранных участников
    membersListContainer.innerHTML = '';

    // Если нет выбранных участников, показываем заглушку (пустой li)
    if (selectedMembers.length === 0) {
        membersListContainer.innerHTML = '<li class="empty-list"></li>';
        return;
    }

    // Добавляем выбранных участников
    selectedMembers.forEach(member => {
        const memberItem = document.createElement('li');
        memberItem.className = 'member-item'; // Используем класс member-item

        // Создаем HTML с аватаром, именем и кнопкой удаления
        memberItem.innerHTML = `
            <div class="member-avatar">
                <img src="${member.avatar_url || member.avatar || '/static/images/meow-icon.jpg'}" alt="${member.username}">
            </div>
            <div class="member-info">
                <span class="member-name">${member.username}</span>
            </div>
        `;

        // Обработчик удаления пользователя из выбранных
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-member-btn icon-btn'; // Добавляем классы
        removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; // Иконка мусорки

        removeBtn.addEventListener('click', function() {
            // Удаляем пользователя из списка выбранных
            const index = selectedMembers.findIndex(item => item.id === member.id);
            if (index !== -1) {
                selectedMembers.splice(index, 1);
                updateSelectedMembersListInline(selectedMembers, container);

                // Обновляем результаты поиска, если там был введен текст
                const searchInput = container.querySelector('#user-search');
                if (searchInput && searchInput.value.trim().length >= 1) {
                    searchUsers(searchInput.value.trim())
                        .then(users => displayMemberSearchResultsInline(users, selectedMembers, container))
                        .catch(error => console.error('Ошибка обновления результатов поиска:', error));
                }
            }
        });

        memberItem.appendChild(removeBtn); // Добавляем кнопку в li
        membersListContainer.appendChild(memberItem);
    });
}

// Поиск пользователей по запросу
async function searchUsers(query) {
    try {
        const response = await fetch(`api/chat/users/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Ошибка при поиске пользователей');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка при поиске пользователей:', error);
        return [];
    }
}

// Создание чата с пользователем
async function createChat(userId) {
    try {
        const response = await fetch('api/chat/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId }),
            credentials: 'include' // Важно для отправки куки
        });

        if (!response.ok) {
            // Попытка прочитать тело ошибки
            let errorText = 'Ошибка при создании чата';
            try {
                 const errorData = await response.json();
                 errorText = errorData.detail || errorData.error || errorText;
            } catch (parseError) {
                 console.error('Не удалось распарсить тело ошибки:', parseError);
            }
            throw new Error(errorText);
        }

        const data = await response.json();

        // Обновляем заголовок чата после создания
        const conversationHeader = document.querySelector('.conversation-header');
        if (conversationHeader) {
            const chatUserName = conversationHeader.querySelector('.chat-user-name');
            if (chatUserName && chatUserName.textContent === 'New Chat') {
                chatUserName.textContent = '';
            }
        }

        return data;
    } catch (error) {
        console.error('Ошибка при создании чата:', error);
        throw error;
    }
}

// Модифицированная функция создания группы с дополнительными проверками
async function createGroupSafe(name, description, memberIds) {
    console.log("Создание группы с дополнительными проверками");
    console.log("Параметры:", {
        name: name,
        description: description,
        memberIds: memberIds
    });

    // Проверка параметров
    if (!name || typeof name !== 'string' || name.trim() === '') {
        console.error("Ошибка: название группы отсутствует или пустое");
        throw new Error('Название группы обязательно');
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
        console.error("Ошибка: не выбраны участники группы");
        throw new Error('Необходимо выбрать хотя бы одного участника');
    }

    try {
        // Формируем данные запроса
        const data = {
            group_name: name,
            description: description || '',
            member_ids: memberIds
        };

        console.log("Отправка запроса создания группы:", JSON.stringify(data));

        // Отправляем запрос с использованием fetch напрямую для отладки
        const response = await fetch('/api/groups/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        console.log("Получен ответ:", {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
        });

        if (!response.ok) {
            let errorText = `Ошибка создания группы: ${response.status} ${response.statusText}`;
             try {
                 const errorData = await response.json();
                 errorText = errorData.detail || errorData.error || errorText;
            } catch (parseError) {
                 console.error('Не удалось распарсить тело ошибки:', parseError);
            }
            console.error("Текст ошибки:", errorText);
            throw new Error(errorText);
        }

        const result = await response.json();
        console.log("Результат создания группы:", result);

        // Проверяем ответ
        if (!result) {
            throw new Error('Пустой ответ от сервера');
        }

        // Функцию handleGroupCreationSuccess вызываем из showAddMembersDialogInline
        // Здесь только возвращаем результат
        return result;

    } catch (error) {
        console.error("Ошибка при создании группы:", error);
        throw error;
    }
}

// Старая функция createGroup (возможно, больше не нужна, но оставим пока)
// Если она вызывается где-то еще, нужно будет перепроверить
async function createGroup(name, description, memberIds) {
    console.warn("Вызов устаревшей функции createGroup в chatCreation.js. Используйте createGroupSafe или fetch /api/groups/create напрямую.");
    console.log("Параметры:", JSON.stringify({
        name: name,
        description: description,
        memberIds: memberIds
    }));

    try {
        const data = {
            group_name: name,
            description: description || '',
            member_ids: memberIds
        };
        console.log("Отправляем данные группы (старый метод):", JSON.stringify(data));

        // Используем fetchAPI, если она доступна глобально
        if (typeof fetchAPI === 'function') {
            const result = await fetchAPI('/api/groups/create', 'POST', data);
            console.log("Результат создания группы (старый метод):", JSON.stringify(result));
            return result;
        } else {
            console.error("Функция fetchAPI не найдена для старого метода createGroup");
            throw new Error("fetchAPI is not defined");
        }
    } catch (error) {
        console.error("Ошибка при создании группы в старой функции createGroup:", error);
        throw error;
    }
}