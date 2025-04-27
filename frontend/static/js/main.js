// Основной файл JavaScript для MeowChat
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация основных модулей
    initApp();
});

// Инициализация приложения
function initApp() {
    // Получение ID пользователя из meta-тега
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? userIdElement.getAttribute('content') : null;
    
    if (!currentUserId) {
        console.warn('Предупреждение: ID пользователя не найден, возможно это страница входа или регистрации');
        
        // Проверяем, на какой странице мы находимся
        const path = window.location.pathname;
        if (path === '/login' || path === '/register' || path === '/') {
            console.log('Находимся на странице авторизации, инициализация чата не требуется');
            // Здесь можно инициализировать специфичные для login/register скрипты, если нужно
            // Например, если login.js не самоинициализируется
            if (typeof initLogin === 'function') initLogin();
            return;
        } else {
            console.error('Ошибка: ID пользователя не найден на странице чата');
            // Можно перенаправить на логин или показать сообщение
            // window.location.href = '/login';
        }
        return;
    }
    
    console.log('Инициализация приложения для пользователя ID:', currentUserId);
    
    // Инициализация WebSocket соединения (теперь в websocket.js)
    // Убедимся, что window.initWebSocket доступна
    if (typeof initWebSocket === 'function') {
    initWebSocket(currentUserId);
    } else {
        console.error("Функция initWebSocket не найдена! Убедитесь, что websocket.js загружен перед main.js");
        return; // Прерываем инициализацию, если WS не доступен
    }

    // Загрузка чатов
    loadChats(); // Эта функция останется здесь

    // Инициализация обработчиков событий UI
    initUIHandlers(); // Эта функция останется здесь
    
    // Инициализация обработчиков сообщений и контекстного меню
    initMessageHandlers();
}

// Инициализация обработчиков событий UI
function initUIHandlers() {
    console.log("Инициализация UI обработчиков");

    // Обработчики создания чатов и групп (теперь в chatCreation.js)
    if (typeof initCreateButtonHandler === 'function') {
        initCreateButtonHandler();
    } else {
        console.error("Функция initCreateButtonHandler не найдена!");
    }

    // Обработчик кнопки профиля (теперь в profile.js)
    if (typeof initProfileButtonHandler === 'function') {
        initProfileButtonHandler();
    } else {
        console.error("Функция initProfileButtonHandler не найдена!");
    }

    // Обновляем аватар в сайдбаре при инициализации UI
    if (typeof updateSidebarAvatar === 'function') {
        updateSidebarAvatar();
                        } else {
        console.error("Функция updateSidebarAvatar не найдена!");
    }

    // --- ДОБАВЛЕНО: Обработчик поиска чатов ---
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        console.log('[Search] Search input found. Adding listener.'); // Лог 1
        searchInput.addEventListener('input', function() {
            console.log('[Search] Input event triggered. Query:', this.value); // Лог 2
            filterChats(this.value);
        });
    } else {
        console.error("Элемент ввода поиска не найден!");
    }
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    // --- ДОБАВЛЕНО: Обработчик кнопки "Назад" в шапке чата ---
    const backButton = document.querySelector('.conversation-header .back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            const conversation = document.querySelector('.conversation');
            const welcomeScreen = document.querySelector('.welcome-screen');
            
            if (conversation) {
                conversation.style.display = 'none';
            }
            if (welcomeScreen) {
                welcomeScreen.style.display = 'flex'; // Или 'block', если нужно
            }

            // Убираем активный класс с чата в списке
            const activeChat = document.querySelector('.chat-item.active');
            if (activeChat) {
                activeChat.classList.remove('active');
            }

            // Очищаем ID чата и тип в контейнере сообщений
            const messageContainer = document.querySelector('.message-container');
            if (messageContainer) {
                messageContainer.removeAttribute('data-chat-id');
                messageContainer.removeAttribute('data-chat-type');
            }
             console.log('Нажата кнопка Назад, возвращаемся к списку/приветствию.');
        });
    } else {
        console.error('Кнопка .back-button не найдена!');
    }
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---
}

// Загрузка чатов
async function loadChats() {
    console.log('Загрузка списка чатов (main.js)');
    try {
        console.log('Отправка запроса на /api/chat/get-chats');
        // Используем fetchAPI если она определена в api.js
        const apiFunction = typeof fetchAPI === 'function' ? fetchAPI : fetch;
        const response = await apiFunction('/api/chat/get-chats');

        // Если использовали fetch, нужно проверить response.ok и вызвать .json()
        let data;
        if (typeof fetchAPI !== 'function') {
            console.log('Получен ответ (fetch):', { status: response.status, ok: response.ok, statusText: response.statusText });
            if (!response.ok) {
                throw new Error(`Ошибка загрузки чатов: ${response.status} ${response.statusText}`);
            }
            data = await response.json();
        } else {
            data = response; // fetchAPI уже возвращает json
            console.log('Получен ответ (fetchAPI):', data);
        }
        if (!data || !data.chats) {
            console.warn('Предупреждение: получен пустой список чатов или неверный формат данных');
            console.log('Структура полученных данных:', JSON.stringify(data));
        } else {
            console.log('Количество полученных чатов:', data.chats.length);
        }

        displayChats(data.chats || []); // Эта функция останется здесь
    } catch (error) {
        console.error('Ошибка при загрузке списка чатов:', error);
        // Предполагаем, что showNotification доступна глобально или импортирована из notifications.js
        if (typeof showNotification === 'function') {
             showNotification('Не удалось загрузить список чатов', 'error');
        }
        displayChats([]); // Отображаем пустой список чатов
    }
}

// Отображение списка чатов
function displayChats(chats) {
    const chatListContainer = document.querySelector('.chat-list');
    if (!chatListContainer) {
        console.error("Контейнер .chat-list не найден!");
        return;
    }
    // Сохраняем ID активного чата (если есть)
    const activeChat = chatListContainer.querySelector('.chat-item.active');
    const activeChatId = activeChat ? activeChat.getAttribute('data-chat-id') : null;
    const activeChatType = activeChat ? activeChat.getAttribute('data-chat-type') : null;
    
    // Очищаем список чатов
    chatListContainer.innerHTML = '';
    
    if (chats && chats.length > 0) {
        chats.forEach(async chat => {
            // console.log('Обработка чата:', chat.id, 'Тип:', chat.type, 'Имя:', chat.name || (chat.user ? chat.user.username : 'Неизвестно'));
            
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${(chat.id == activeChatId && chat.type == activeChatType) ? 'active' : ''}`;
            chatItem.setAttribute('data-chat-id', chat.id);
            
            const isGroup = chat.type === 'group';
            chatItem.setAttribute('data-chat-type', isGroup ? 'group' : 'direct');
            
            let avatarData = null;
            let participantCount = null;
            let userId = null;
            let chatName = 'Неизвестный чат';

            if (isGroup) {
                 avatarData = { avatar_url: chat.avatar, username: chat.name };
                 chatItem.setAttribute('data-group-avatar', chat.avatar || '');
                 if (chat.participant_count !== undefined) {
                     participantCount = chat.participant_count;
                     chatItem.setAttribute('data-participant-count', participantCount);
                 }
                 chatName = chat.name;
            } else if (chat.user) {
                 avatarData = chat.user; // Передаем весь объект user
                 chatItem.setAttribute('data-user-avatar', chat.user.avatar || '');
                 userId = chat.user.id;
                 chatItem.setAttribute('data-user-id', userId);
                 chatName = chat.user.username;
            }
            // console.log(`[displayChats] Сохранены data-атрибуты для чата ${chat.id}`);
            
            // Создаем HTML для элемента чата
            chatItem.innerHTML = `
                <div class="chat-avatar">
                    <!-- Аватар будет вставлен displayUserAvatar -->
                </div>
                <div class="chat-info">
                    <div class="chat-name">${chatName}</div>
                    <div class="chat-last-message">${truncateText(chat.last_message || 'Нет сообщений', 15)}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${chat.last_time ? formatChatTime(chat.last_time) : ''}</div>
                    <div class="chat-unread" ${(!chat.unread_count || chat.unread_count === 0) ? 'style="display: none;"' : ''}>${chat.unread_count || ''}</div>
                    </div>
            `; // Убеждаемся, что строка HTML правильно закрыта
            
            // Добавляем аватар
            const avatarContainer = chatItem.querySelector('.chat-avatar');
            let avatarPromise; // Объявляем переменную для Promise
            if (isGroup) {
                // Ждем завершения отображения аватара
                avatarPromise = displayUserAvatar(avatarContainer, { 
                    avatar_url: chat.avatar, 
                    username: chat.name 
                });
            } else if (chat.user) {
                 // Ждем завершения отображения аватара
                 avatarPromise = displayUserAvatar(avatarContainer, chat.user);
                 
            } else {
                // Если нет данных для аватара, создаем пустой Promise, который сразу разрешается
                avatarPromise = Promise.resolve();
            }
            
            // Добавляем обработчик клика с явной передачей типа чата
            chatItem.addEventListener('click', () => {
                const chatId = chatItem.getAttribute('data-chat-id');
                const chatType = chatItem.getAttribute('data-chat-type');
                openChat(chatId, chatType);
            });
            
            chatListContainer.appendChild(chatItem);

            // !!! ВАЖНО: Ждем завершения отрисовки аватара !!!
            await avatarPromise;

            // Теперь, когда аватар (и .online-indicator) точно отрисован,
            // вызываем обновление статуса для прямых чатов.
            if (!isGroup && chat.user) {
                // Передаем объект statusData, как ожидает функция
                updateUserStatusUI(chat.user.id, { 
                    is_online: chat.user.is_online, 
                    last_seen: chat.user.last_seen 
                });
            }
        });
    } else {
        // Если чатов нет, показываем заглушку
        chatListContainer.innerHTML = '<div class="no-chats">У вас пока нет чатов</div>';
    }
}

// --- Добавлена функция для обрезки текста ---
function truncateText(text, maxLength) {
    if (text && text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
}
// --- Конец добавленной функции ---

// Форматирование времени последнего сообщения в списке чатов
// Предполагаем, что luxon доступен глобально
function formatChatTime(timestamp) {
    if (typeof luxon === 'undefined') {
        console.error("Luxon not loaded! Cannot format time.");
        return timestamp;
    }
    try {
        const dt = luxon.DateTime.fromISO(timestamp, { zone: 'utc' });
        const localDt = dt.setZone('Asia/Bishkek');
        const now = luxon.DateTime.now().setZone('Asia/Bishkek');

        if (localDt.hasSame(now, 'day')) {
            return localDt.toFormat('HH:mm');
        } else if (localDt.hasSame(now.minus({ days: 1 }), 'day')) {
            return 'Yesterday';
        } else if (now.diff(localDt, 'days').days < 7) {
            return localDt.setLocale('en').toFormat('ccc');
        } else {
            return localDt.toFormat('dd.MM.yyyy');
        }
    } catch (e) {
        console.error("Error formatting chat time:", e, "Timestamp:", timestamp);
        const date = new Date(timestamp);
        return date.toLocaleDateString(); 
    }
}

// Отправка сообщения через HTTP (резервный метод)
async function sendMessageViaHttp(chatId, messageText, isGroup) {
    console.log(`Отправка сообщения через HTTP для ${isGroup ? 'группы' : 'чата'} с ID:`, chatId);
    
    try {
        const url = isGroup ? `api/groups/${chatId}/messages` : 'api/chat/send-message';
        const data = isGroup ? 
            { group_id: chatId, content: messageText } : 
            { chat_id: chatId, message: messageText };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка отправки сообщения: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка при отправке сообщения через HTTP:', error);
        throw error;
    }
}

// Инициализация обработчиков сообщений
function initMessageHandlers() {
    console.log("Инициализация обработчиков сообщений и контекстного меню");

    // Инициализация системы контекстного меню из contextMenu.js
    if (window.contextMenu && typeof window.contextMenu.init === 'function') {
        window.contextMenu.init();
        console.log("Система контекстного меню инициализирована");
    } else {
        console.error("Ошибка: window.contextMenu.init не найдена! Проверьте, что contextMenu.js загружен и экспортирует функцию init.");
    }

    // Добавляем обработчик для инициализации контекстного меню при добавлении новых сообщений
    document.addEventListener('messageAdded', function(e) {
        if (e.detail && e.detail.messageElement && window.contextMenu && typeof window.contextMenu.addToMessage === 'function') {
            window.contextMenu.addToMessage(e.detail.messageElement);
        }
    });
}

// Обработчики действий контекстного меню - используем функции из contextMenu.js
// Эти функции нужны для обратной совместимости, если где-то в коде их вызывают напрямую
function handleAnswerMessage(messageText, messageId, messageElement) {
    // Используем функцию из contextMenu.js если доступна
    if (window.contextMenu && typeof window.contextMenu.handleAnswerMessage === 'function') {
        return window.contextMenu.handleAnswerMessage(messageText, messageId, messageElement);
    }
    console.log('Ответ на сообщение:', messageId);
    showNotification('Функция ответа на сообщение пока не реализована', 'info');
}

function handleCopyMessage(messageText) {
    // Используем функцию из contextMenu.js если доступна
    if (window.contextMenu && typeof window.contextMenu.handleCopyMessage === 'function') {
        return window.contextMenu.handleCopyMessage(messageText);
    }
    console.log('Копирование сообщения:', messageText);
    
    // Используем API clipboard для копирования текста
    if (navigator.clipboard) {
        navigator.clipboard.writeText(messageText)
            .then(() => {
                showNotification('Текст скопирован в буфер обмена', 'success');
            })
            .catch(err => {
                console.error('Ошибка при копировании текста:', err);
                showNotification('Не удалось скопировать текст', 'error');
            });
    } else {
        // Запасной вариант для старых браузеров
        const textarea = document.createElement('textarea');
        textarea.value = messageText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = 0;
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showNotification('Текст скопирован в буфер обмена', 'success');
            } else {
                showNotification('Не удалось скопировать текст', 'error');
            }
        } catch (err) {
            console.error('Ошибка при копировании текста:', err);
            showNotification('Не удалось скопировать текст', 'error');
        }
        
        document.body.removeChild(textarea);
    }
}

function handleEditMessage(messageText, messageId, messageElement) {
    // Используем функцию из contextMenu.js если доступна
    if (window.contextMenu && typeof window.contextMenu.handleEditMessage === 'function') {
        return window.contextMenu.handleEditMessage(messageText, messageId, messageElement);
    }
    console.log('Редактирование сообщения:', messageId);
    showNotification('Функция редактирования сообщения пока не реализована', 'info');
}

function handleForwardMessage(messageText, messageId) {
    // Используем функцию из contextMenu.js если доступна
    if (window.contextMenu && typeof window.contextMenu.handleForwardMessage === 'function') {
        return window.contextMenu.handleForwardMessage(messageText, messageId);
    }
    console.log('Пересылка сообщения:', messageId);
    showNotification('Функция пересылки сообщения пока не реализована', 'info');
}

function handleDeleteMessage(messageId, messageElement) {
    // Используем функцию из contextMenu.js если доступна
    if (window.contextMenu && typeof window.contextMenu.handleDeleteMessage === 'function') {
        return window.contextMenu.handleDeleteMessage(messageId, messageElement);
    }
    console.log('Удаление сообщения:', messageId);
    showNotification('Функция удаления сообщения пока не реализована', 'info');
}

async function createGroup(name, description, memberIds) {
    console.log("Вызов функции createGroup в main.js");
    console.log("Параметры:", JSON.stringify({
        name: name,
        description: description,
        memberIds: memberIds
    }));
    
    try {
        // Отправляем запрос напрямую через fetchAPI
        const data = {
            group_name: name,
            description: description || '',
            member_ids: memberIds
        };
        
        console.log("Отправляем данные группы:", JSON.stringify(data));
        
        const result = await fetchAPI('/api/groups/create', 'POST', data);
        console.log("Результат создания группы:", JSON.stringify(result));
        return result;
    } catch (error) {
        console.error("Ошибка при создании группы в main.js:", error);
        throw error;
    }
}

// Функция для проверки существования чата по ID
async function checkChatExists(chatId) {
    console.log('Проверка существования чата с ID:', chatId);
    
    try {
        const response = await fetch(`/api/chat/check/${chatId}`);
        console.log('Результат проверки чата:', {
            status: response.status,
            ok: response.ok
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('Чат не найден на сервере');
                return false;
            }
            throw new Error(`Ошибка проверки чата: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Данные о чате:', data);
        return data.exists === true;
    } catch (error) {
        console.error('Ошибка при проверке существования чата:', error);
        return false;
    }
}

// Функция для добавления контекстного меню к сообщению
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

// --- ДОБАВЛЕНО: Функция фильтрации списка чатов --- 
function filterChats(query) {
    const searchTerm = query.toLowerCase().trim();
    console.log(`[Search] Filtering for term: "${searchTerm}"`); // Лог 3
    const chatListContainer = document.querySelector('.chat-list');
    if (!chatListContainer) {
        console.error('[Search] .chat-list container not found during filtering!'); // Лог 4
        return;
    }

    const chatItems = chatListContainer.querySelectorAll('.chat-item');
    console.log(`[Search] Found ${chatItems.length} chat items to filter.`); // Лог 5
    let visibleCount = 0;

    chatItems.forEach((item, index) => {
        const chatNameElement = item.querySelector('.chat-name');
        const chatName = chatNameElement ? chatNameElement.textContent.toLowerCase() : '';
        const shouldBeVisible = chatName.includes(searchTerm);
        
        // Лог для каждого элемента
        // console.log(`[Search] Item ${index}: Name="${chatName}", Term="${searchTerm}", Includes=${shouldBeVisible}`); 

        if (shouldBeVisible) {
            item.style.display = 'flex';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });

    console.log(`[Search] Filtering complete. Visible items: ${visibleCount}`); // Лог 6

    // Показываем/скрываем заглушку "Нет чатов" или "Ничего не найдено"
    const noChatsElement = chatListContainer.querySelector('.no-chats');
    if (noChatsElement) {
        if (chatItems.length === 0 && !searchTerm) { // Показываем "нет чатов" только если список пуст И поиск пуст
            noChatsElement.textContent = 'У вас пока нет чатов';
            noChatsElement.style.display = 'block';
             console.log('[Search] Displaying: No chats available.'); // Лог 7
        } else if (visibleCount === 0 && searchTerm) {
            noChatsElement.textContent = 'Ничего не найдено';
            noChatsElement.style.display = 'block';
            console.log('[Search] Displaying: Nothing found.'); // Лог 8
        } else {
            noChatsElement.style.display = 'none';
            // console.log('[Search] Hiding no-chats/nothing-found message.'); // Лог 9
        }
    }
}

// --- Emoji Picker Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const emojiButton = document.getElementById('emoji-button');
    const emojiPicker = document.getElementById('emoji-picker');
    const messageInput = document.getElementById('message-input');

    if (emojiButton && emojiPicker && messageInput) {
        // Toggle picker visibility
        emojiButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from closing picker immediately
            const isVisible = emojiPicker.style.display === 'block';
            emojiPicker.style.display = isVisible ? 'none' : 'block';
        });

        // Insert emoji into input
        emojiPicker.addEventListener('emoji-click', event => {
            const emoji = event.detail.unicode;
            const start = messageInput.selectionStart;
            const end = messageInput.selectionEnd;
            const text = messageInput.value;
            messageInput.value = text.substring(0, start) + emoji + text.substring(end);
            messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
            messageInput.focus();
        });

        // Close picker when clicking outside
        document.addEventListener('click', (event) => {
            if (emojiPicker.style.display === 'block' && 
                !emojiPicker.contains(event.target) && 
                event.target !== emojiButton && 
                !emojiButton.contains(event.target)) { // Check if click is on button icon
                emojiPicker.style.display = 'none';
            }
        });
    }
});

// --- End Emoji Picker Logic ---
