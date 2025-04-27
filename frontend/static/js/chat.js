// Модуль для обработки чатов и сообщений

// Инициализация переменных и констант
const chatList = document.querySelector('.chat-list');
const messageContainer = document.querySelector('.message-container');
const messageInput = document.querySelector('.message-input');
const sendButton = document.querySelector('.send-button');
const welcomeScreen = document.querySelector('.welcome-screen');
const conversation = document.querySelector('.conversation');
const chatHeaderName = document.querySelector('.conversation-header .chat-user-name');
const chatHeaderAvatar = document.querySelector('.conversation-header .chat-avatar img');

// Хранилище чатов для кэширования
const chatStore = {
    chats: [],
    messages: {}
};

// Глобальные переменные для хранения состояния
let currentChatId = null;

// Загрузка списка чатов
async function loadChats() {
    try {
        // Показываем информацию о загрузке
        elements.chatList.innerHTML = '<div class="loading">Загрузка чатов...</div>';
        
        // Загружаем чаты с сервера
        const chats = await fetchAPI('/api/chat/list');
        
        // Сохраняем в хранилище
        chatStore.chats = chats;
        
        // Очищаем список
        elements.chatList.innerHTML = '';
        
        // Если чатов нет, показываем информацию
        if (chats.length === 0) {
            elements.chatList.innerHTML = '<div class="no-chats">Нет активных чатов</div>';
            return;
        }
        
        // Отображаем чаты
        chats.forEach(chat => {
            addChatToList(chat);
        });
        
    } catch (error) {
        console.error('Ошибка при загрузке чатов:', error);
        elements.chatList.innerHTML = '<div class="error">Ошибка при загрузке чатов</div>';
    }
}

// Добавление чата в список
function addChatToList(chat) {
    // Получаем первую букву имени отправителя для аватара
    const firstLetter = chat.sender.charAt(0).toUpperCase();
    
    // Определяем класс для непрочитанных сообщений
    const unreadClass = chat.unread_count > 0 ? 'has-unread' : '';
    
    // Форматируем время последнего сообщения
    const time = formatChatTime(chat.time);
    
    // Создаем HTML чата
    const chatHTML = `
        <div class="chat-item ${unreadClass}" data-chat-id="${chat.id}" data-user-id="${chat.user_id}">
            <div class="chat-avatar">
                <div class="avatar-letter avatar-color-default">
                    ${firstLetter}
                </div>
            </div>
            <div class="chat-info">
                <div class="chat-name">${chat.sender}</div>
                <div class="chat-last-message">${chat.message || 'Нет сообщений'}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${time}</div>
                <div class="chat-unread" ${!chat.unread_count || chat.unread_count === 0 ? 'style="display: none;"' : ''}>
                    ${chat.unread_count || ''}
                </div>
            </div>
        </div>
    `;
    
    // Добавляем чат в список
    elements.chatList.insertAdjacentHTML('beforeend', chatHTML);
}

// Форматирование времени чата
function formatChatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Если сообщение сегодня, показываем только время
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Если сообщение вчера, показываем "Вчера"
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Вчера';
    }
    
    // Иначе показываем дату
    return date.toLocaleDateString();
}

// Обновление статуса чата (например, при получении нового сообщения)
function updateChatStatus(chat) {
    // Находим элемент чата в списке
    const chatElement = document.querySelector(`.chat-item[data-chat-id="${chat.id}"]`);
    
    if (!chatElement) {
        // Если чата нет в списке, добавляем его
        addChatToList(chat);
        return;
    }
    
    // Обновляем последнее сообщение
    if (chat.message) {
        chatElement.querySelector('.chat-last-message').textContent = chat.message;
    }
    
    // Обновляем время
    if (chat.time) {
        chatElement.querySelector('.chat-time').textContent = formatChatTime(chat.time);
    }
    
    // Обновляем счетчик непрочитанных
    const unreadElement = chatElement.querySelector('.chat-unread');
    
    if (chat.unread_count && chat.unread_count > 0) {
        unreadElement.textContent = chat.unread_count;
        unreadElement.style.display = 'block';
        chatElement.classList.add('has-unread');
    } else {
        unreadElement.style.display = 'none';
        chatElement.classList.remove('has-unread');
    }
    
    // Перемещаем чат в начало списка
    elements.chatList.prepend(chatElement);
}

// Функция добавления сообщения в чат
function addMessageToChat(message) {
    // Если это сообщение для текущего открытого чата
    if (currentChatId && currentChatId == message.chat_id) {
        // Добавляем сообщение в UI
        addMessageToUI(message);
        
        // Прокручиваем к последнему сообщению
        elements.messageContainer.scrollTop = elements.messageContainer.scrollHeight;
        
        // Отправляем статус прочитано
        sendReadStatus(message.chat_id);
    } else {
        // Увеличиваем счетчик непрочитанных для этого чата
        updateUnreadCount(message.chat_id);
    }
    
    // Обновляем статус чата в списке
    updateChatInList(message);
}

// Функция обновления количества непрочитанных сообщений
function updateUnreadCount(chatId) {
    // Находим чат в хранилище
    const chatIndex = chatStore.chats.findIndex(chat => chat.id == chatId);
    
    if (chatIndex !== -1) {
        // Увеличиваем счетчик
        chatStore.chats[chatIndex].unread_count = (chatStore.chats[chatIndex].unread_count || 0) + 1;
        
        // Обновляем UI
        const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatElement) {
            const unreadElement = chatElement.querySelector('.chat-unread');
            const unreadCount = chatStore.chats[chatIndex].unread_count;
            
            unreadElement.textContent = unreadCount;
            unreadElement.style.display = 'block';
            chatElement.classList.add('has-unread');
        }
    }
}

// Функция обновления чата в списке при получении нового сообщения
function updateChatInList(message) {
    // Находим чат в хранилище или создаем новый
    let chatIndex = chatStore.chats.findIndex(chat => chat.id == message.chat_id);
    
    if (chatIndex !== -1) {
        // Обновляем данные чата
        chatStore.chats[chatIndex].message = message.content;
        chatStore.chats[chatIndex].time = message.timestamp;
        
        // Обновляем UI
        updateChatStatus(chatStore.chats[chatIndex]);
    } else {
        // Если чата нет в списке, запрашиваем обновление списка чатов
        loadChats();
    }
}

// Функция поиска пользователей для создания чата
async function searchUsersForChat() {
    const searchInput = document.getElementById('user-search');
    const query = searchInput.value.trim();
    
    if (!query) {
        document.querySelector('.search-results').innerHTML = '';
        return;
    }
    
    try {
        // Показываем информацию о загрузке
        document.querySelector('.search-results').innerHTML = '<div class="loading">Поиск пользователей...</div>';
        
        // Ищем пользователей
        const users = await searchUsers(query);
        
        // Очищаем результаты
        document.querySelector('.search-results').innerHTML = '';
        
        // Если пользователей нет, показываем информацию
        if (users.length === 0) {
            document.querySelector('.search-results').innerHTML = '<div class="no-results">Пользователи не найдены</div>';
            return;
        }
        
        // Отображаем пользователей
        users.forEach(user => {
            const userHTML = `
                <div class="user-item" data-user-id="${user.id}">
                    <div class="user-avatar">
                        <div class="avatar-letter avatar-color-default">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div class="user-info">
                        <div class="user-name">${user.name}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
            `;
            
            document.querySelector('.search-results').insertAdjacentHTML('beforeend', userHTML);
        });
        
        // Добавляем обработчики
        document.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', handleUserSelect);
        });
        
    } catch (error) {
        console.error('Ошибка при поиске пользователей:', error);
        document.querySelector('.search-results').innerHTML = '<div class="error">Ошибка при поиске пользователей</div>';
    }
}

// Обработчик выбора пользователя из поиска
async function handleUserSelect(event) {
    const userItem = event.currentTarget;
    const userId = userItem.getAttribute('data-user-id');
    
    // Создаем чат с пользователем
    try {
        const result = await createChat(userId);
        
        if (result && result.chat_id) {
            // Закрываем модальное окно
            closeSearchModal();
            
            // Обновляем список чатов
            await loadChats();
            
            // Открываем созданный чат
            const chatElement = document.querySelector(`.chat-item[data-chat-id="${result.chat_id}"]`);
            if (chatElement) {
                chatElement.click();
            }
        }
    } catch (error) {
        console.error('Ошибка при создании чата:', error);
        showNotification('Ошибка при создании чата', 3000, 'error');
    }
}

// Функция для показа индикатора печати
function showTypingIndicator(data) {
    // Проверяем, что индикатор относится к текущему чату
    if (!currentChatId || currentChatId != data.chat_id) return;
    
    // Находим или создаем элемент индикатора
    let typingElement = document.querySelector('.typing-indicator');
    
    if (!typingElement) {
        const typingHTML = `
            <div class="message message-received typing-indicator">
                <div class="message-bubble">
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        
        elements.messageContainer.insertAdjacentHTML('beforeend', typingHTML);
        typingElement = document.querySelector('.typing-indicator');
        
        // Прокручиваем к индикатору
        elements.messageContainer.scrollTop = elements.messageContainer.scrollHeight;
    }
    
    // Устанавливаем таймер для скрытия индикатора
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }, 3000);
}

// Функция обновления статуса пользователя (онлайн/оффлайн)
function updateUserStatus(data) {
    // Находим чат с этим пользователем
    const chatElement = document.querySelector(`.chat-item[data-user-id="${data.user_id}"]`);
    
    if (!chatElement) return;
    
    // Обновляем статус в зависимости от данных
    if (data.status === 'online') {
        chatElement.querySelector('.chat-name').classList.add('online');
    } else {
        chatElement.querySelector('.chat-name').classList.remove('online');
    }
    
    // Если это текущий открытый чат, обновляем заголовок
    if (currentChatId && currentChatId == chatElement.getAttribute('data-chat-id')) {
        if (data.status === 'online') {
            elements.conversationHeader.querySelector('.chat-user-name').classList.add('online');
        } else {
            elements.conversationHeader.querySelector('.chat-user-name').classList.remove('online');
        }
    }
}

// Инициализация обработчиков для контекстного меню сообщений
function initMessageContextMenu() {
    // Получаем элемент контекстного меню
    const messageContextMenu = document.getElementById('message-context-menu');
    
    // Обработчик скрытия контекстного меню при клике в любом месте документа
    document.addEventListener('click', function() {
        messageContextMenu.classList.remove('active');
    });
    
    // Предотвращаем закрытие меню при клике на само меню
    messageContextMenu.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    
    // Обработчики для пунктов меню
    messageContextMenu.querySelector('.answer-message').addEventListener('click', handleAnswerMessage);
    messageContextMenu.querySelector('.copy-message').addEventListener('click', handleCopyMessage);
    messageContextMenu.querySelector('.edit-message').addEventListener('click', handleEditMessage);
    messageContextMenu.querySelector('.forward-message').addEventListener('click', handleForwardMessage);
    messageContextMenu.querySelector('.delete-message').addEventListener('click', handleDeleteMessage);
    
    // Предотвращаем стандартное контекстное меню на всей странице
    document.addEventListener('contextmenu', function(event) {
        // Если клик произошел не на сообщении, позволяем стандартному меню отобразиться
        if (!event.target.closest('.message')) return;
        
        // Иначе отменяем стандартное контекстное меню
        event.preventDefault();
    });
}

// Функция для добавления обработчика контекстного меню к элементу сообщения
function addContextMenuToMessage(messageElement) {
    messageElement.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Сохраняем текущее сообщение
        contextMenuTarget = this;
        
        // Получаем контекстное меню
        const messageContextMenu = document.getElementById('message-context-menu');
        
        // Определяем, является ли сообщение от текущего пользователя
        const isMyMessage = this.classList.contains('my-message');
        
        // Показываем/скрываем соответствующие пункты меню
        messageContextMenu.querySelector('.edit-message').style.display = isMyMessage ? 'flex' : 'none';
        messageContextMenu.querySelector('.delete-message').style.display = isMyMessage ? 'flex' : 'none';
        
        // Позиционируем и показываем меню
        messageContextMenu.style.top = `${event.pageY}px`;
        messageContextMenu.style.left = `${event.pageX}px`;
        messageContextMenu.classList.add('active');
    });
}

// Обработка ответа на сообщение
function handleAnswerMessage() {
    if (!contextMenuTarget) return;
    
    // Получаем сообщение на которое отвечаем
    const messageId = contextMenuTarget.getAttribute('data-message-id');
    const messageText = contextMenuTarget.querySelector('.message-text').textContent.trim();
    const senderName = contextMenuTarget.querySelector('.message-sender-name') 
        ? contextMenuTarget.querySelector('.message-sender-name').textContent.trim() 
        : 'Вы';
    
    // Логика ответа на сообщение
    console.log(`Ответ на сообщение ${messageId} от ${senderName}: ${messageText}`);
    
    // Тут будет код для реализации ответа
    showNotification('Функция ответа на сообщение будет доступна скоро', 3000, 'info');
}

// Обработка копирования текста сообщения
function handleCopyMessage() {
    if (!contextMenuTarget) return;
    
    // Получаем текст сообщения
    const messageText = contextMenuTarget.querySelector('.message-text').textContent.trim();
    
    // Копируем в буфер обмена
    navigator.clipboard.writeText(messageText)
        .then(() => {
            showNotification('Текст скопирован', 2000, 'success');
        })
        .catch(err => {
            console.error('Ошибка при копировании текста:', err);
            showNotification('Не удалось скопировать текст', 3000, 'error');
        });
}

// Обработка редактирования сообщения
function handleEditMessage() {
    if (!contextMenuTarget) return;
    
    // Проверяем, что это наше сообщение
    if (!contextMenuTarget.classList.contains('my-message')) {
        showNotification('Вы можете редактировать только свои сообщения', 3000, 'warning');
        return;
    }
    
    const messageId = contextMenuTarget.getAttribute('data-message-id');
    const messageText = contextMenuTarget.querySelector('.message-text').textContent.trim();
    
    // Логика редактирования сообщения
    console.log(`Редактирование сообщения ${messageId}: ${messageText}`);
    
    // Тут будет код для реализации редактирования
    showNotification('Функция редактирования сообщения будет доступна скоро', 3000, 'info');
}

// Обработка пересылки сообщения
function handleForwardMessage() {
    if (!contextMenuTarget) return;
    
    const messageId = contextMenuTarget.getAttribute('data-message-id');
    const messageText = contextMenuTarget.querySelector('.message-text').textContent.trim();
    
    // Логика пересылки сообщения
    console.log(`Пересылка сообщения ${messageId}: ${messageText}`);
    
    // Тут будет код для реализации пересылки
    showNotification('Функция пересылки сообщения будет доступна скоро', 3000, 'info');
}

// Обработка удаления сообщения
function handleDeleteMessage() {
    if (!contextMenuTarget) return;
    
    // Проверяем, что это наше сообщение
    if (!contextMenuTarget.classList.contains('my-message')) {
        showNotification('Вы можете удалять только свои сообщения', 3000, 'warning');
        return;
    }
    
    const messageId = contextMenuTarget.getAttribute('data-message-id');
    
    // Логика удаления сообщения
    console.log(`Удаление сообщения ${messageId}`);
    
    // Тут будет код для реализации удаления
    showNotification('Функция удаления сообщения будет доступна скоро', 3000, 'info');
}

// Добавление сообщения в UI
function addMessageToUI(message) {
    // ...existing code...

    // Добавляем обработчик контекстного меню к сообщению
    const messageElements = document.querySelectorAll('.message');
    const lastMessage = messageElements[messageElements.length - 1];
    if (lastMessage) {
        addContextMenuToMessage(lastMessage);
    }
}

// Инициализация поиска пользователей
document.addEventListener('DOMContentLoaded', function() {
    // Initialize context menu system
    if (window.contextMenu && typeof window.contextMenu.init === 'function') {
        window.contextMenu.init();
        console.log('Context menu system initialized');
    } else {
        console.error('Context menu system not available. Make sure contextMenu.js is properly loaded before chat.js');
        // Try to initialize directly if the function exists in global scope
        if (typeof initContextMenuSystem === 'function') {
            initContextMenuSystem();
            console.log('Directly initialized context menu system');
            // Create the window.contextMenu object if it doesn't exist
            if (!window.contextMenu) {
                window.contextMenu = {
                    init: initContextMenuSystem,
                    addToMessage: addContextMenuToMessage,
                    close: closeContextMenu
                };
                console.log('Created window.contextMenu object');
            }
        }
    }
    
    // Обработчик поиска пользователей
    const userSearchInput = document.getElementById('user-search');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function() {
            // Используем debounce для ограничения запросов
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                searchUsersForChat();
            }, 300);
        });
    }
    
    // Инициализация группового чата
    initGroupChat();
});

// Инициализация интерфейса группового чата
function initGroupChat() {
    const addMembersBtn = document.getElementById('add-members-btn');
    const createGroupBtn = document.getElementById('create-group-btn');
    
    // Обработчик кнопки добавления участников
    if (addMembersBtn) {
        addMembersBtn.addEventListener('click', function() {
            // Скрываем окно создания группы и показываем поиск
            elements.groupModal.classList.remove('active');
            elements.searchModal.classList.add('active');
            
            // Устанавливаем режим поиска
            document.getElementById('user-search').setAttribute('data-mode', 'group');
            document.getElementById('user-search').focus();
        });
    }
    
    // Обработчик кнопки создания группы
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', async function() {
            const groupName = document.getElementById('group-name').value.trim();
            const groupDescription = document.getElementById('group-description').value.trim();
            const memberElements = document.querySelectorAll('#group-members-list .group-member-item');
            
            // Проверка имени группы
            if (!groupName) {
                showNotification('Введите название группы', 3000, 'warning');
                return;
            }
            
            // Проверка количества участников
            if (memberElements.length < 2) {
                showNotification('Добавьте минимум 2 участников', 3000, 'warning');
                return;
            }
            
            // Собираем ID участников
            const memberIds = Array.from(memberElements).map(item => {
                return item.getAttribute('data-user-id');
            });
            
            try {
                // Создаем группу
                const result = await createGroup(groupName, groupDescription, memberIds);
                
                if (result && result.group_id) {
                    // Закрываем модальное окно
                    closeGroupModal();
                    
                    // Обновляем список чатов
                    await loadChats();
                    
                    // Показываем уведомление
                    showNotification('Group created successfully', 3000, 'success');
                    
                    // Открываем созданную группу
                    const chatElement = document.querySelector(`.chat-item[data-chat-id="${result.group_id}"]`);
                    if (chatElement) {
                        chatElement.click();
                    }
                }
            } catch (error) {
                console.error('Ошибка при создании группы:', error);
                showNotification('Ошибка при создании группы', 3000, 'error');
            }
        });
    }
}