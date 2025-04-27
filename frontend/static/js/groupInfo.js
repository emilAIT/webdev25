// Функции для работы с панелью информации о группе

// --- Функция для отображения панели информации о группе ---
async function showGroupInfoPanel(groupId) {
    console.log(`Запрос информации для группы ${groupId}`);

    const groupInfoPanel = document.querySelector('.group-info-panel');
    console.log('Найден элемент groupInfoPanel:', groupInfoPanel);
    const conversationPanel = document.querySelector('.conversation');
    const welcomeScreen = document.querySelector('.welcome-screen');

    if (!groupInfoPanel) {
        console.error('Критическая ошибка: элемент .group-info-panel НЕ НАЙДЕН!');
        return;
    }
    if (!conversationPanel) {
        console.error('Элемент .conversation не найден');
    }

    // Сохраняем ID текущей группы для обработчиков
    groupInfoPanel.setAttribute('data-current-group-id', groupId);

    // Сбрасываем режим редактирования при каждом открытии
    groupInfoPanel.classList.remove('editing');
    try {
        const viewModeContainer = groupInfoPanel.querySelector('#group-info-view-mode');
        const editModeContainer = groupInfoPanel.querySelector('#group-info-edit-mode');
        const membersListContainer = groupInfoPanel.querySelector('.group-info-members');
        if (viewModeContainer) viewModeContainer.style.display = 'flex'; // Показать по умолчанию
        if (membersListContainer) membersListContainer.style.display = 'block'; // Показать по умолчанию
        if (editModeContainer) editModeContainer.style.display = 'none'; // Скрыть по умолчанию
    } catch (uiError) {
        console.error("Ошибка при сбросе UI режима редактирования:", uiError);
    }

    try {
        console.log('Пытаюсь показать groupInfoPanel...');
        groupInfoPanel.style.display = 'flex'; // Показываем панель
        console.log('Стиль display для groupInfoPanel установлен в flex');
        if (conversationPanel) conversationPanel.style.display = 'none';
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        console.log('Скрыты conversationPanel и welcomeScreen (если найдены)');
    } catch (displayError) {
        console.error("Ошибка при попытке отобразить панель:", displayError);
        return;
    }

    try {
        // Загрузка и отображение данных
        const groupDetails = await fetchAPI(`/api/groups/${groupId}/details`); // Предполагаем, что fetchAPI доступна
        if (!groupDetails) throw new Error('Не удалось получить детали группы');
        console.log('Получены детали группы:', groupDetails);

        populateGroupInfoPanel(groupInfoPanel, groupDetails);
        setupGroupInfoPanelHandlers(groupInfoPanel, groupDetails);

        // Инициализируем функциональность добавления участников
        if (typeof initAddMembersFunctionality === 'function') { // Проверяем, загружен ли скрипт group-members.js
             initAddMembersFunctionality(groupInfoPanel, groupDetails.id);
         } else {
             console.error('Function initAddMembersFunctionality not found. group-members.js might not be loaded.');
         }

    } catch (error) {
        console.error('Ошибка при загрузке или отображении информации о группе:', error);
        showNotification('Не удалось загрузить информацию о группе', 'error'); // Предполагаем, что showNotification доступна
        // Попытка вернуть пользователя обратно
        try {
             groupInfoPanel.style.display = 'none';
             if (conversationPanel) conversationPanel.style.display = 'flex';
        } catch(hideError) {
             console.error("Ошибка при скрытии панели после ошибки загрузки:", hideError);
        }
    }
}

// --- Вспомогательная функция для заполнения панели данными ---
function populateGroupInfoPanel(panelElement, groupDetails) {
    const panelAvatarImg = panelElement.querySelector('.group-info-avatar img');
    const panelGroupName = panelElement.querySelector('#group-info-name');
    const panelMemberCount = panelElement.querySelector('#group-info-member-count');
    const panelDescription = panelElement.querySelector('#group-info-desc');
    const panelMembersList = panelElement.querySelector('#group-info-members-list');

    // --- Заполнение полей ---
    if (panelAvatarImg) {
        panelAvatarImg.src = groupDetails.avatar || '/static/images/group-meow-avatar.png';
        panelAvatarImg.alt = groupDetails.name;
    }
    if (panelGroupName) panelGroupName.textContent = groupDetails.name;
    if (panelMemberCount) panelMemberCount.textContent = `${groupDetails.participant_count || 0} members`;
    if (panelDescription) panelDescription.textContent = groupDetails.description || '';

    // --- Заполнение списка участников ---
    if (panelMembersList) {
        panelMembersList.innerHTML = ''; // Очищаем список
        if (groupDetails.members && groupDetails.members.length > 0) {
            groupDetails.members.forEach(member => {
                const memberItem = document.createElement('li');
                memberItem.className = 'member-item';
                memberItem.setAttribute('data-user-id', member.id);
                let statusText = 'last seen recently';
                if (member.is_online) statusText = 'online';
                else if (member.last_seen) {
                    try {
                        // Предполагаем, что luxon доступен глобально
                        const dt = luxon.DateTime.fromISO(member.last_seen, { zone: 'utc' });
                        const localDt = dt.setZone('Asia/Bishkek');
                        const now = luxon.DateTime.now().setZone('Asia/Bishkek');
                        statusText = 'last seen ';
                        if (localDt.hasSame(now, 'day')) statusText += `at ${localDt.toFormat('HH:mm')}`;
                        else if (localDt.hasSame(now.minus({ days: 1 }), 'day')) statusText += 'yesterday';
                        else statusText += `on ${localDt.toFormat('dd.MM.yy')}`;
                    } catch (e) { console.error("Ошибка форматирования времени:", e); }
                }
                memberItem.innerHTML = `
                    <div class="member-avatar">
                        <img src="${member.avatar || '/static/images/meow-icon.jpg'}" alt="${member.username}" class="user-avatar-img">
                        ${member.is_online ? '<span class="online-indicator" style="display: block;"></span>' : ''}
                    </div>
                    <div class="member-info">
                        <span class="member-name">${member.username}</span>
                        <span class="member-status ${member.is_online ? 'online' : ''}">${statusText}</span>
                    </div>
                `;
                panelMembersList.appendChild(memberItem);
            });
        } else {
            panelMembersList.innerHTML = '<li class="no-results">Участников нет</li>';
        }
    }
}

// --- Функция для установки обработчиков на кнопки панели ---
function setupGroupInfoPanelHandlers(panelElement, groupDetails) {
    const viewModeContainer = panelElement.querySelector('#group-info-view-mode');
    const editModeContainer = panelElement.querySelector('#group-info-edit-mode');
    const membersListContainer = panelElement.querySelector('.group-info-members');

    const backButton = panelElement.querySelector('#group-info-back-btn');
    const editButton = panelElement.querySelector('#group-info-edit-btn'); // Карандаш в хедере
    const headerCancelButton = panelElement.querySelector('#group-info-cancel-btn'); // Крестик в хедере
    const editCancelButton = editModeContainer?.querySelector('#group-edit-cancel-btn'); // Кнопка Cancel в форме
    const saveButton = editModeContainer?.querySelector('#group-edit-save-btn'); // Кнопка Save в форме
    const avatarInput = editModeContainer?.querySelector('#edit-group-avatar-input');
    const avatarDisplayImg = editModeContainer?.querySelector('#edit-group-avatar-circle img');
    const avatarCircle = editModeContainer?.querySelector('#edit-group-avatar-circle');

    // --- Кнопка Назад (в хедере панели) ---
    if (backButton) {
        // Удаляем старый обработчик
        const newBackButton = backButton.cloneNode(true);
        backButton.parentNode.replaceChild(newBackButton, backButton);
        newBackButton.onclick = () => {
            panelElement.style.display = 'none';
            const conversationPanel = document.querySelector('.conversation');
            if (conversationPanel) conversationPanel.style.display = 'flex';
            panelElement.classList.remove('editing'); // Сбрасываем редактирование
            // Показываем режим просмотра и список участников по умолчанию при возврате
            if(viewModeContainer) viewModeContainer.style.display = 'flex';
            if(membersListContainer) membersListContainer.style.display = 'block';
            if(editModeContainer) editModeContainer.style.display = 'none';
        };
    }

    // --- Кнопка Редактировать (карандаш) ---
    if (editButton) {
        // Удаляем старый обработчик
        const newEditButton = editButton.cloneNode(true);
        editButton.parentNode.replaceChild(newEditButton, editButton);
        newEditButton.onclick = () => {
            panelElement.classList.add('editing');
            // Заполняем поля в форме редактирования текущими значениями
            const nameInput = editModeContainer?.querySelector('#edit-group-name');
            const descInput = editModeContainer?.querySelector('#edit-group-description');
            if (nameInput) nameInput.value = groupDetails.name;
            if (descInput) descInput.value = groupDetails.description || '';
            if (avatarDisplayImg) {
                avatarDisplayImg.src = groupDetails.avatar || '/static/images/group-meow-avatar.png';
            }
             if(avatarInput) avatarInput.value = ''; // Сбрасываем файл
             window.groupAvatarFile = null; // Используем window для временного хранения
            // Показываем форму редактирования, скрываем остальное
             if(viewModeContainer) viewModeContainer.style.display = 'none';
             if(membersListContainer) membersListContainer.style.display = 'none';
             if(editModeContainer) editModeContainer.style.display = 'flex';
        };
    }

    // --- Кнопка Отмена (крестик в хедере И кнопка Cancel в форме) ---
    const cancelAction = () => {
        panelElement.classList.remove('editing');
         if(avatarInput) avatarInput.value = ''; // Сбрасываем файл
         window.groupAvatarFile = null;
         // Показываем режим просмотра и список участников, скрываем форму
         if(viewModeContainer) viewModeContainer.style.display = 'flex';
         if(membersListContainer) membersListContainer.style.display = 'block';
         if(editModeContainer) editModeContainer.style.display = 'none';
         // Восстанавливаем оригинальный аватар в просмотрщике формы (на случай если меняли)
         if (avatarDisplayImg) {
             avatarDisplayImg.src = groupDetails.avatar || '/static/images/group-meow-avatar.png';
         }
    };
    if (headerCancelButton) {
        const newHeaderCancelButton = headerCancelButton.cloneNode(true);
        headerCancelButton.parentNode.replaceChild(newHeaderCancelButton, headerCancelButton);
        newHeaderCancelButton.onclick = cancelAction;
    }
    if (editCancelButton) {
        const newEditCancelButton = editCancelButton.cloneNode(true);
        editCancelButton.parentNode.replaceChild(newEditCancelButton, editCancelButton);
        newEditCancelButton.onclick = cancelAction;
    }

    // --- Кнопка Сохранить ---
    if (saveButton) {
        const newSaveButton = saveButton.cloneNode(true);
        saveButton.parentNode.replaceChild(newSaveButton, saveButton);
        newSaveButton.onclick = () => {
            handleUpdateGroupInfo(panelElement, editModeContainer, groupDetails.id);
        };
    }

    // --- Обработчик выбора файла аватара ---
    if (avatarInput && avatarDisplayImg && avatarCircle) {
        const clickableElement = avatarCircle.nextElementSibling?.tagName === 'LABEL' ? avatarCircle.nextElementSibling : avatarCircle;

        // Удаляем СТАРЫЕ обработчики клика перед добавлением
        const newClickableElement = clickableElement.cloneNode(true);
        clickableElement.parentNode.replaceChild(newClickableElement, clickableElement);
        newClickableElement.addEventListener('click', () => {
            console.log('[AvatarEdit v3] Клик по области аватара/лейбла.');
            avatarInput.value = ''; // Сбрасываем значение перед кликом
            avatarInput.click();
        });
        console.log('[AvatarEdit v3] Обработчик клика добавлен.');

        // Обработчик изменения самого input file
        const newAvatarInput = avatarInput.cloneNode(true);
        avatarInput.parentNode.replaceChild(newAvatarInput, avatarInput);

        newAvatarInput.addEventListener('change', (event) => {
            console.log('[AvatarEdit v3] Событие change сработало.');
            if (event.target.files && event.target.files[0]) {
                const file = event.target.files[0];
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('Файл слишком большой (макс. 5MB)', 'error');
                    newAvatarInput.value = '';
                    window.groupAvatarFile = null;
                    return;
                }
                window.groupAvatarFile = file;
                console.log('[AvatarEdit v3] Файл сохранен в window:', window.groupAvatarFile?.name);
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewImg = panelElement.querySelector('#edit-group-avatar-circle img');
                    if (previewImg) previewImg.src = e.target.result;
                    console.log('[AvatarEdit v3] Превью обновлено.');
                };
                reader.onerror = () => {
                    showNotification('Ошибка чтения файла', 'error');
                    window.groupAvatarFile = null;
                };
                reader.readAsDataURL(file);
            } else {
                console.log('[AvatarEdit v3] Файлы не выбраны.');
                window.groupAvatarFile = null;
            }
        });
        console.log('[AvatarEdit v3] Обработчик change добавлен.');

         // Сбрасываем файл при инициализации обработчиков
         newAvatarInput.value = '';
         window.groupAvatarFile = null;
    }
}

// --- Функция для обработки сохранения изменений группы ---
async function handleUpdateGroupInfo(panelElement, editContainer, groupId) {
    const nameInput = editContainer.querySelector('#edit-group-name');
    const descInput = editContainer.querySelector('#edit-group-description');

    const newName = nameInput ? nameInput.value.trim() : null;
    const newDesc = descInput ? descInput.value.trim() : null;
    const newAvatarFile = window.groupAvatarFile; // Берем файл из window

    console.log('Попытка сохранить изменения для группы:', { groupId, newName, newDesc, newAvatarFile });

    const formData = new FormData();
    let hasChanges = false;

    // Получаем оригинальные данные
    let originalGroupData = {};
    try {
        const currentDetails = await fetchAPI(`/api/groups/${groupId}/details`);
        if (!currentDetails) throw new Error("Не удалось получить детали группы перед сохранением");
        originalGroupData.name = currentDetails.name;
        originalGroupData.description = currentDetails.description;
    } catch (e) {
        console.error("Не удалось получить актуальные данные группы перед сохранением", e);
        showNotification("Ошибка проверки данных перед сохранением", "error");
        return;
    }

    if (newName !== null && newName !== originalGroupData.name) {
        formData.append('group_name', newName);
        hasChanges = true;
    }
    if (newDesc !== null && newDesc !== originalGroupData.description && !(newDesc === '' && !originalGroupData.description)) {
        formData.append('description', newDesc);
        hasChanges = true;
    }
    if (newAvatarFile) {
        formData.append('avatar', newAvatarFile);
        hasChanges = true;
    }

    if (!hasChanges) {
        showNotification('Нет изменений для сохранения', 'info');
        panelElement.classList.remove('editing'); // Выходим из режима редактирования
        const viewModeContainer = panelElement.querySelector('#group-info-view-mode');
        const membersListContainer = panelElement.querySelector('.group-info-members');
        if(viewModeContainer) viewModeContainer.style.display = 'flex';
        if(membersListContainer) membersListContainer.style.display = 'block';
        if(editContainer) editContainer.style.display = 'none';
        window.groupAvatarFile = null;
        return;
    }

    try {
         const response = await fetch(`/api/groups/${groupId}/update`, {
            method: 'PUT',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(errorData.detail || `Ошибка ${response.status}`);
        }

        const updatedGroupDetails = await response.json();
        console.log('Группа успешно обновлена:', updatedGroupDetails);

        showNotification('Информация о группе обновлена', 'success');
        panelElement.classList.remove('editing');
        window.groupAvatarFile = null;

        // Обновляем данные в панели просмотра
        populateGroupInfoPanel(panelElement, updatedGroupDetails);
        // Показываем панель просмотра и список участников, скрываем форму
        const viewModeContainer = panelElement.querySelector('#group-info-view-mode');
        const membersListContainer = panelElement.querySelector('.group-info-members');
        if(viewModeContainer) viewModeContainer.style.display = 'flex';
        if(membersListContainer) membersListContainer.style.display = 'block';
        if(editContainer) editContainer.style.display = 'none';

        // Важно: переустанавливаем обработчики с новыми groupDetails
        setupGroupInfoPanelHandlers(panelElement, updatedGroupDetails);

        // Обновляем UI в других местах
        updateChatItem(updatedGroupDetails);
        updateChatHeaderIfCurrent(updatedGroupDetails);

    } catch (error) {
        console.error('Ошибка при обновлении группы:', error);
        showNotification(`Не удалось обновить группу: ${error.message}`, 'error');
    }
}

// --- Вспомогательная функция для обновления элемента чата в списке ---
function updateChatItem(groupDetails) {
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${groupDetails.id}"][data-chat-type="group"]`);
    if (!chatItem) return;

    const chatName = chatItem.querySelector('.chat-name');
    const chatAvatarContainer = chatItem.querySelector('.chat-avatar');

    if (chatName) chatName.textContent = groupDetails.name;
    if (chatAvatarContainer) {
        // Переиспользуем displayUserAvatar (предполагаем, что она будет доступна глобально или импортирована)
         displayUserAvatar(chatAvatarContainer, {
            avatar_url: groupDetails.avatar,
            username: groupDetails.name
        });
    }
    console.log(`Обновлен элемент чата ${groupDetails.id} в списке`);
}

// --- Вспомогательная функция для обновления хедера чата, если он открыт ---
function updateChatHeaderIfCurrent(groupDetails) {
     const conversationPanel = document.querySelector('.conversation');
     const messageContainer = conversationPanel?.querySelector('.message-container');
     if (messageContainer && messageContainer.getAttribute('data-chat-id') == groupDetails.id && messageContainer.getAttribute('data-chat-type') === 'group') {
         const headerAvatarImg = conversationPanel.querySelector('.conversation-header .chat-avatar img');
         const headerNameElement = conversationPanel.querySelector('.conversation-header .chat-user-name');
         const headerStatusElement = conversationPanel.querySelector('.conversation-header .user-status-header');

         if(headerAvatarImg) headerAvatarImg.src = groupDetails.avatar || '/static/images/group-meow-avatar.png';
         if(headerNameElement) headerNameElement.textContent = groupDetails.name;
         if(headerStatusElement) headerStatusElement.textContent = `${groupDetails.participant_count || 0} members`;
         console.log(`Обновлен заголовок открытого чата ${groupDetails.id}`);
     }
} 