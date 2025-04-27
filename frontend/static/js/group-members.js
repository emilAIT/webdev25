// Логика для добавления участников в группу

console.log("group-members.js loaded");

// --- Инициализация --- 
function initAddMembersFunctionality(panelElement, groupId) {
    console.log(`[AddMembers] Initializing for Group ID: ${groupId}`);
    const addMemberButton = panelElement.querySelector('#group-info-add-member-btn');

    if (!addMemberButton) {
        console.error("[AddMembers] Add member button not found in panel.");
        return;
    }

    // Удаляем старый обработчик через клонирование
    const newButton = addMemberButton.cloneNode(true);
    addMemberButton.parentNode.replaceChild(newButton, addMemberButton);

    newButton.addEventListener('click', () => {
        console.log(`[AddMembers] Add member button clicked for group ${groupId}`);
        showAddMemberModal(groupId);
    });
}

// --- Отображение модального окна --- 
function showAddMemberModal(groupId) {
    console.log(`[AddMembers] Showing modal for group ${groupId}`);
    const modal = document.getElementById('add-member-modal');
    const searchInput = document.getElementById('add-member-user-search');
    const resultsContainer = document.getElementById('add-member-search-results');
    const selectedList = document.getElementById('add-member-selected-list');
    const confirmButton = document.getElementById('add-member-confirm-btn');
    const cancelButton = document.getElementById('add-member-cancel-btn');
    const closeModalButton = document.getElementById('close-add-member-modal');

    if (!modal || !searchInput || !resultsContainer || !selectedList || !confirmButton || !cancelButton || !closeModalButton) {
        console.error("[AddMembers] One or more modal elements not found.");
        return;
    }

    modal.setAttribute('data-group-id', groupId);

    // Очистка состояния при открытии
    searchInput.value = '';
    resultsContainer.innerHTML = '<div class="no-results">Search for users to add.</div>';
    selectedList.innerHTML = '<li class="empty-list">No users selected.</li>';
    let selectedUsersToAdd = []; // Массив для хранения выбранных пользователей {id, username, avatar_url}

    // --- Обработчики модального окна --- 

    // Поиск при вводе
    searchInput.oninput = debounce(() => {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
            resultsContainer.innerHTML = '<div class="loading-indicator">Searching...</div>'; // Индикатор загрузки
            searchUsersForAdding(query, groupId)
                .then(users => {
                    console.log("[AddMembers] Search results:", users);
                    displayAddMemberSearchResults(users, selectedUsersToAdd, resultsContainer, selectedList);
                })
                .catch(error => {
                    console.error('[AddMembers] Error searching users:', error);
                    resultsContainer.innerHTML = `<div class="error-message">Error searching users: ${error.message}</div>`;
                });
        } else {
            resultsContainer.innerHTML = '<div class="no-results">Enter at least 2 characters.</div>';
        }
    }, 300); // Добавляем debounce для поиска

    // Кнопка "Add Selected"
    confirmButton.onclick = () => {
        const userIdsToAdd = selectedUsersToAdd.map(user => user.id);
        if (userIdsToAdd.length === 0) {
            showNotification("Please select at least one user to add.", "warning");
            return;
        }
        console.log(`[AddMembers] Confirming addition of users ${userIdsToAdd} to group ${groupId}`);
        handleAddMembersConfirm(groupId, userIdsToAdd, modal);
    };

    // Кнопки закрытия/отмены
    const closeModal = () => {
        modal.style.display = 'none';
        // Очистка обработчиков не требуется, т.к. мы их переназначаем при открытии 
        // или используем клонирование кнопок.
    };
    closeModalButton.onclick = closeModal;
    cancelButton.onclick = closeModal;

    // Показываем модальное окно
    modal.style.display = 'flex';
    searchInput.focus(); // Фокус на поле поиска
}

// --- Поиск пользователей для добавления (заглушка API) --- 
async function searchUsersForAdding(query, groupId) {
    console.log(`[AddMembers] Searching potential members: query='${query}', groupId=${groupId}`);
    const url = `/api/groups/${groupId}/search-potential-members?query=${encodeURIComponent(query)}`;
    try {
        // Используем fetchAPI из api.js (предполагаем глобальную доступность)
        if (typeof fetchAPI !== 'function') {
            console.error('fetchAPI function is not defined. Make sure api.js is loaded.');
            throw new Error('API function not available');
        }
        const users = await fetchAPI(url); // GET запрос по умолчанию
        return users || [];
    } catch (error) {
        console.error("[AddMembers] API call failed:", error);
        throw error; // Пробрасываем ошибку
    }
}

// --- Отображение результатов поиска --- 
function displayAddMemberSearchResults(users, selectedUsersToAdd, resultsContainer, selectedList) {
    resultsContainer.innerHTML = ''; // Очищаем

    if (!users || users.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No potential members found matching your query.</div>';
        return;
    }

    // Фильтруем тех, кого уже выбрали в этой сессии
    const availableUsers = users.filter(user => 
        !selectedUsersToAdd.some(selected => selected.id === user.id)
    );

    if (availableUsers.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">All found users are already selected.</div>';
        return;
    }

    availableUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item'; 
        userItem.innerHTML = `
            <div class="user-avatar">
                <img src="${user.avatar_url || user.avatar || '/static/images/meow-icon.jpg'}" alt="${user.username}">
            </div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <!-- Можно добавить email или статус, если API возвращает -->
            </div>
            <div class="user-action">
                <button class="add-button small-btn">Add</button> 
            </div>
        `;

        const addButton = userItem.querySelector('.add-button');
        addButton.addEventListener('click', () => {
            addButton.disabled = true; // Блокируем кнопку после нажатия
            addButton.textContent = 'Adding...';
            selectedUsersToAdd.push(user); 
            userItem.classList.add('item-added'); // Визуально отмечаем добавленный элемент
            setTimeout(() => { userItem.remove(); }, 300); // Удаляем с небольшой задержкой
            updateSelectedUsersToAddList(selectedUsersToAdd, selectedList, resultsContainer); // Обновляем список выбранных
            
            // Перепроверяем, остались ли доступные пользователи в результатах
             const remainingItems = resultsContainer.querySelectorAll('.user-item:not(.item-added)');
             if (remainingItems.length === 0 && !resultsContainer.querySelector('.loading-indicator')) {
                 resultsContainer.innerHTML = '<div class="no-results">All found users are now selected.</div>';
             }
        });

        resultsContainer.appendChild(userItem);
    });
}

// --- Обновление списка выбранных для добавления --- 
function updateSelectedUsersToAddList(selectedUsersToAdd, selectedList, resultsContainer) {
    selectedList.innerHTML = ''; // Очищаем

    if (selectedUsersToAdd.length === 0) {
        selectedList.innerHTML = '<li class="empty-list">No users selected.</li>';
        return;
    }

    selectedUsersToAdd.forEach((user, index) => {
        const memberItem = document.createElement('li');
        memberItem.className = 'member-item'; 
        memberItem.innerHTML = `
            <div class="member-avatar">
                <img src="${user.avatar_url || user.avatar || '/static/images/meow-icon.jpg'}" alt="${user.username}">
            </div>
            <div class="member-info">
                <span class="member-name">${user.username}</span>
            </div>
            <button class="remove-member-btn icon-btn small-btn" title="Remove from selection"><i class="fas fa-trash-alt"></i></button>
        `;

        memberItem.querySelector('.remove-member-btn').addEventListener('click', () => {
            selectedUsersToAdd.splice(index, 1); // Удаляем из массива
            updateSelectedUsersToAddList(selectedUsersToAdd, selectedList, resultsContainer); // Обновляем список
            
            // Обновляем результаты поиска, чтобы вернуть пользователя туда
            const searchInput = document.getElementById('add-member-user-search');
            const currentQuery = searchInput ? searchInput.value.trim() : '';
            if (currentQuery.length >= 2) {
                const groupId = selectedList.closest('.modal').getAttribute('data-group-id');
                 searchUsersForAdding(currentQuery, groupId)
                    .then(users => displayAddMemberSearchResults(users, selectedUsersToAdd, resultsContainer, selectedList))
                    .catch(error => console.error('[AddMembers] Error refreshing search results after removal:', error));
            }
        });

        selectedList.appendChild(memberItem);
    });
}

// --- Отправка запроса на добавление (заглушка API) --- 
async function handleAddMembersConfirm(groupId, userIdsToAdd, modal) {
    console.log(`[AddMembers] Sending request to add users ${userIdsToAdd} to group ${groupId}`);
    const url = `/api/groups/${groupId}/add-members`;
    const confirmButton = document.getElementById('add-member-confirm-btn');
    const originalButtonText = confirmButton.textContent;
    confirmButton.disabled = true;
    confirmButton.textContent = 'Adding...';
    
    try {
        if (typeof fetchAPI !== 'function') {
             console.error('fetchAPI function is not defined. Make sure api.js is loaded.');
             throw new Error('API function not available');
        }
        
        const result = await fetchAPI(url, 'POST', { user_ids: userIdsToAdd });
        
        if (result && (result.success || result.message)) { 
            showNotification(result.message || 'Members added successfully!', 'success');
            modal.style.display = 'none';
            
            // Обновляем панель информации о группе
            if (window.showGroupInfoPanel) {
                 console.log("[AddMembers] Refreshing group info panel...");
                 setTimeout(() => window.showGroupInfoPanel(groupId), 300);
            } else {
                 console.error("[AddMembers] Cannot refresh panel: showGroupInfoPanel not found.");
                 if (window.loadChats) window.loadChats(); // Обновляем список чатов как запасной вариант
            }
            
        } else {
            throw new Error(result.error || 'Failed to add members. Check server logs.');
        }
    } catch (error) {
        console.error('[AddMembers] Error confirming addition:', error);
        showNotification(`Error adding members: ${error.message}`, 'error');
    } finally {
        // Восстанавливаем кнопку в любом случае
        confirmButton.disabled = false;
        confirmButton.textContent = originalButtonText;
    }
}

// --- Вспомогательная функция debounce --- 
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}; 