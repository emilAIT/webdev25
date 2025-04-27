// Модуль для работы с WebSocket
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 секунды

// Глобальное хранилище статусов пользователей
// { userId: { isOnline: boolean, lastSeen: string | null } }
window.userStatuses = {};

// Порог времени (в минутах), после которого пользователь считается оффлайн
const OFFLINE_THRESHOLD_MINUTES = 5;

/**
 * Проверяет, активен ли пользователь (онлайн или был недавно).
 * @param {number} userId ID пользователя.
 * @returns {boolean} True, если пользователь активен.
 */
function isUserActive(userId) {
    const status = window.userStatuses[userId];
    if (!status) {
        return false; // Нет информации о статусе
    }

    if (status.isOnline) {
        return true; // Пользователь точно онлайн
    }

    if (status.lastSeen) {
        try {
            const lastSeenDate = new Date(status.lastSeen);
            const now = new Date();
            const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
            return diffMinutes < OFFLINE_THRESHOLD_MINUTES;
        } catch (e) {
            console.error(`Error parsing lastSeen date for user ${userId}:`, status.lastSeen, e);
            return false; // Ошибка парсинга даты
        }
    }

    return false; // Нет lastSeen и не онлайн
}

/**
 * Обновляет UI для отображения статуса пользователя (класс .online на аватаре).
 * Находит элементы с атрибутом data-user-id="userId"
 * и добавляет/удаляет класс "online" к элементу .chat-avatar.
 * @param {number} userId ID пользователя.
 * @param {object} statusData Данные статуса { is_online: boolean, last_seen?: string | null }.
 */
function updateAvatarOnlineStatus(userId, statusData) {
    console.log(`Updating AVATAR status UI for user ${userId}:`, statusData);
    const currentStatus = window.userStatuses[userId] || { isOnline: false, lastSeen: null };

    // Обновляем хранилище
    if (statusData.hasOwnProperty('is_online')) {
        currentStatus.isOnline = statusData.is_online;
        if (statusData.is_online) {
            currentStatus.lastSeen = new Date().toISOString();
        } else if (statusData.hasOwnProperty('last_seen')) {
            currentStatus.lastSeen = statusData.last_seen;
        } else {
            currentStatus.lastSeen = currentStatus.lastSeen || null;
        }
    } else if (statusData.hasOwnProperty('last_seen')) {
        currentStatus.lastSeen = statusData.last_seen;
    }

    window.userStatuses[userId] = currentStatus;

    // Обновляем DOM
    const userElements = document.querySelectorAll(`[data-user-id="${userId}"]`);
    const shouldBeOnline = isUserActive(userId);

    userElements.forEach(element => {
        const avatarElement = element.querySelector('.chat-avatar');
        if (avatarElement) {
            if (shouldBeOnline) {
                avatarElement.classList.add('online');
                console.log(`Added 'online' class to AVATAR for user ${userId}`, avatarElement);
            } else {
                avatarElement.classList.remove('online');
                console.log(`Removed 'online' class from AVATAR for user ${userId}`, avatarElement);
            }
        } else {
            // Maybe the status should be shown elsewhere if no avatar (e.g., chat header?)
            // console.warn(`Could not find '.chat-avatar' inside element for user ${userId}`, element);
        }
    });
}

/**
 * Инициализирует статусы пользователей из данных, полученных от API.
 * @param {object} initialStatuses Объект вида { userId: { last_seen: string } }.
 */
window.initializeUserStatuses = function(initialStatuses) {
    console.log('Initializing user statuses:', initialStatuses);
    if (!initialStatuses) return;

    Object.keys(initialStatuses).forEach(userIdStr => {
        const userId = parseInt(userIdStr);
        const statusData = initialStatuses[userIdStr];
        if (userId && statusData && statusData.last_seen) {
             // Используем переименованную функцию
             updateAvatarOnlineStatus(userId, { is_online: false, last_seen: statusData.last_seen });
        }
    });
    console.log('User statuses initialized:', window.userStatuses);
}

// Инициализация WebSocket соединения
function initWebSocket(userId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${userId}`;
    
    // Close existing socket if it exists
    if (socket) {
        socket.close();
    }
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = function(e) {
        console.log('WebSocket соединение установлено');
        reconnectAttempts = 0;
        // showNotification('Подключено к серверу', 'success');
        
        // Make socket globally available for other scripts
        window.chatSocket = socket;
    };
    
    socket.onmessage = function(event) {
        console.log('Получено сообщение от сервера:', event.data);
        const data = JSON.parse(event.data);
        handleSocketMessage(data);
    };
    
    socket.onclose = function(event) {
        console.log(`WebSocket соединение закрыто, код: ${event.code}`);
        if (!event.wasClean) {
            handleSocketDisconnect();
        }
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket ошибка:', error);
    };
}

// Отправка личного сообщения через WebSocket
function sendDirectMessage(chatId, content) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        showNotification('Нет соединения с сервером', 'error');
        return false;
    }
    
    // Формат сообщения соответствует ожиданиям бэкенда
    const message = {
        type: 'direct_message',
        chat_id: parseInt(chatId),
        content: content,
        timestamp: new Date().toISOString()
    };
    
    console.log('Отправка личного сообщения через WebSocket:', message);
    socket.send(JSON.stringify(message));
    return true;
}

// Отправка группового сообщения через WebSocket
function sendGroupMessage(groupId, content) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        showNotification('Нет соединения с сервером', 'error');
        return false;
    }
    
    // Формат сообщения соответствует ожиданиям бэкенда
    const message = {
        type: 'group_message',
        group_id: parseInt(groupId),
        content: content,
        timestamp: new Date().toISOString()
    };
    
    console.log('Отправка группового сообщения через WebSocket:', message);
    socket.send(JSON.stringify(message));
    return true;
}

// Отправка сообщения через WebSocket (универсальный метод)
function sendChatMessage(chatId, content, isGroup) {
    if (isGroup) {
        return sendGroupMessage(chatId, content);
    } else {
        return sendDirectMessage(chatId, content);
    }
}

// Отправка статуса "прочитано" для сообщений
function sendReadReceipt(chatId, isGroup) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('WebSocket не подключен, невозможно отправить уведомление о прочтении');
        return false;
    }
    
    const readReceipt = {
        type: 'read_messages',
        chat_id: isGroup ? null : parseInt(chatId),
        group_id: isGroup ? parseInt(chatId) : null,
        timestamp: new Date().toISOString()
    };
    
    console.log('Отправка уведомления о прочтении:', readReceipt);
    socket.send(JSON.stringify(readReceipt));
    return true;
}

// Обработка полученного сообщения
function handleSocketMessage(data) {
    console.log('Обработка сообщения от WebSocket (восстановлено):', data);

    switch (data.type) {
        case 'direct_message':
            handleIncomingDirectMessage(data);
            break;
        case 'group_message':
            handleIncomingGroupMessage(data);
            break;
        case 'read_receipt':
            handleReadReceipt(data);
            break;
        case 'user_online':
            console.log(`[WebSocket] User online: ${data.user_id}`);
            // Вызываем функцию из chatDisplay.js (предполагаем, что она доступна)
            if (typeof updateUserStatusUI === 'function') {
                 updateUserStatusUI(data.user_id, { is_online: true });
            } else {
                console.error('Функция updateUserStatusUI НЕ найдена!');
            }
            break;
        case 'user_offline':
            console.log(`[WebSocket] User offline: ${data.user_id}, last seen: ${data.last_seen}`);
            // Вызываем функцию из chatDisplay.js (предполагаем, что она доступна)
             if (typeof updateUserStatusUI === 'function') {
                 updateUserStatusUI(data.user_id, { is_online: false, last_seen: data.last_seen });
            } else {
                console.error('Функция updateUserStatusUI НЕ найдена!');
            }
            break;
        case 'user_status': 
            console.log(`[WebSocket] User status update received: User ${data.user_id}, is_online=${data.is_online}, last_seen=${data.last_seen}`);
            // Вызываем функцию из chatDisplay.js для обновления UI
            if (typeof updateUserStatusUI === 'function') {
                 updateUserStatusUI(data.user_id, { 
                     is_online: data.is_online, 
                     last_seen: data.last_seen 
                 });
            } else {
                console.error('Функция updateUserStatusUI НЕ найдена при обработке user_status!');
            }
            break;
        case 'message_edited':
            handleMessageEdited(data);
            break;
        case 'message_deleted':
            handleMessageDeleted(data);
            break;
        case 'chat_cleared':
            handleChatCleared(data);
            break;
        case 'chat_deleted':
            handleChatDeleted(data);
            break;
        case 'group_cleared':
            handleGroupCleared(data);
            break;
        case 'user_left_group':
            handleUserLeftGroup(data);
            break;
        default:
            console.log('Получено неизвестное сообщение:', data);
    }
}

// Обработка отключения сокета
function handleSocketDisconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        showNotification(`Переподключение... (попытка ${reconnectAttempts})`, 'warning');
        
        setTimeout(() => {
            const userIdElement = document.querySelector('meta[name="user-id"]');
            const userId = userIdElement ? userIdElement.getAttribute('content') : null;
            
            if (userId) {
                initWebSocket(userId);
            }
        }, RECONNECT_DELAY);
    } else {
        showNotification('Не удалось подключиться к серверу. Обновите страницу.', 'error');
    }
}

// Проверка состояния WebSocket соединения
function isWebSocketConnected() {
    // Проверяем глобальный объект window.chatSocket
    if (!window.chatSocket) {
        console.log('WebSocket соединение отсутствует (window.chatSocket не определен)');
        return false;
    }
    
    // Проверяем состояние соединения
    if (window.chatSocket.readyState !== WebSocket.OPEN) {
        console.log(`WebSocket соединение не открыто (состояние: ${window.chatSocket.readyState})`);
        return false;
    }
    
    console.log('WebSocket соединение активно и готово к использованию');
    return true;
}

// --- Перенесенные функции из main.js --- 

// Обработка входящего личного сообщения
function handleIncomingDirectMessage(data) {
    console.log('Обработка входящего личного сообщения (websocket.js):', data);
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    if (!currentUserId) {
        console.error('Не удалось определить ID текущего пользователя для обработки сообщения');
        return;
    }
    const chatId = data.chat_id;
    const isFromCurrentUser = data.sender.id === currentUserId;
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer ? messageContainer.getAttribute('data-chat-id') : null;
    const currentChatType = messageContainer ? messageContainer.getAttribute('data-chat-type') : null;

    if (currentChatId == chatId && currentChatType === 'direct') {
        appendMessageToChat(data, false);
        if (!isFromCurrentUser) {
            sendReadReceipt(chatId, false); // Отправляем подтверждение о прочтении
        }
    } else {
        if (!isFromCurrentUser) {
            const senderName = data.sender.username;
            const messagePreview = data.content.length > 30 ? data.content.substring(0, 30) + '...' : data.content;
            // Предполагаем, что showNotification доступна глобально или импортирована
            if (typeof showNotification === 'function') {
                showNotification(`${senderName}: ${messagePreview}`, 'info');
            } else {
                console.warn("showNotification не найдена, уведомление не показано");
            }
        }
    }
    
    // Вместо полной перезагрузки чатов, обновляем только информацию о последнем сообщении
    updateLastMessageInChatList(chatId, 'direct', data.content, data.timestamp);
}

// Обработка входящего группового сообщения
function handleIncomingGroupMessage(data) {
    console.log('Обработка входящего группового сообщения (websocket.js):', data);
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    if (!currentUserId) {
        console.error('Не удалось определить ID текущего пользователя для обработки сообщения');
        return;
    }
    const groupId = data.group_id;
    const isFromCurrentUser = data.sender.id === currentUserId;
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer ? messageContainer.getAttribute('data-chat-id') : null;
    const currentChatType = messageContainer ? messageContainer.getAttribute('data-chat-type') : null;

    if (currentChatId == groupId && currentChatType === 'group') {
        appendMessageToChat(data, true);
        if (!isFromCurrentUser) {
            sendReadReceipt(groupId, true);
        }
    } else {
        if (!isFromCurrentUser) {
            const senderName = data.sender.username;
            const messagePreview = data.content.length > 30 ? data.content.substring(0, 30) + '...' : data.content;
            if (typeof showNotification === 'function') {
                showNotification(`${senderName}: ${messagePreview}`, 'info');
            } else {
                console.warn("showNotification не найдена, уведомление не показано");
            }
        }
    }
    
    // Вместо полной перезагрузки чатов, обновляем только информацию о последнем сообщении
    updateLastMessageInChatList(groupId, 'group', data.content, data.timestamp);
}

// Обработка уведомлений о прочтении сообщений
function handleReadReceipt(data) {
    console.log('[handleReadReceipt (websocket.js)] Получено:', JSON.stringify(data));
    const chatId = data.chat_id || data.group_id;
    const isGroup = !!data.group_id;
    const readerId = data.reader_id;
    if (!chatId || !readerId) {
        console.error('[handleReadReceipt] Ошибка: отсутствует ID чата или читателя');
        return;
    }
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    console.log(`[handleReadReceipt] currentUserId: ${currentUserId}, readerId: ${readerId}, chatId: ${chatId}, isGroup: ${isGroup}`);

    if (!currentUserId) {
        console.error('[handleReadReceipt] Не удалось определить ID текущего пользователя');
        return;
    }

    // 1. Обновляем UI списка чатов (сбрасываем счетчик), если сообщение прочитал ТЕКУЩИЙ пользователь
    if (readerId === currentUserId) {
        console.log(`[handleReadReceipt] Условие readerId === currentUserId ВЫПОЛНЕНО. Вызов updateUnreadCountInChatList для чата ${chatId}`);
        updateUnreadCountInChatList(chatId, isGroup);
    } else {
        console.log(`[handleReadReceipt] Условие readerId === currentUserId НЕ ВЫПОЛНЕНО.`);
    }

    // 2. Обновляем галочки у СВОИХ сообщений в ОТКРЫТОМ чате, если их прочитал ДРУГОЙ пользователь
    if (currentUserId !== readerId) {
        console.log(`[handleReadReceipt] Условие currentUserId !== readerId ВЫПОЛНЕНО. Попытка обновить галочки для чата ${chatId}`);
        const messageContainer = document.querySelector('.message-container');
        if (messageContainer &&
            messageContainer.getAttribute('data-chat-id') == chatId &&
            messageContainer.getAttribute('data-chat-type') === (isGroup ? 'group' : 'direct')) {
            
            // --- ДОБАВЛЕНО: Обновляем галочки только в личных чатах --- 
            if (!isGroup) { 
                const myMessages = document.querySelectorAll('.message.my-message');
                console.log(`[handleReadReceipt] Найдено ${myMessages.length} моих сообщений в открытом ЛИЧНОМ чате для обновления галочек.`);
                myMessages.forEach(message => {
                    const timeElement = message.querySelector('.message-time'); // Keep for logging?
                    const statusElement = message.querySelector('.read-status');
                    if (statusElement && statusElement.classList.contains('unread')) { // Проверяем statusElement
                        statusElement.classList.remove('unread');
                        statusElement.classList.add('read'); // Добавляем класс 'read' к statusElement
                        statusElement.innerHTML = '<i class="fas fa-check-double"></i>'; // Двойная галочка
                        console.log('[handleReadReceipt] Обновлен статус на прочитано для сообщения:', message.getAttribute('data-message-id'));
                    }
                });
            } else {
                console.log(`[handleReadReceipt] Это групповой чат (isGroup=true), галочки не обновляем на двойные.`);
            }
            // --- КОНЕЦ ИЗМЕНЕНИЯ --- 

        } else {
            console.log(`[handleReadReceipt] Чат ${chatId} не открыт, галочки не обновляем.`);
        }
    } else {
         console.log(`[handleReadReceipt] Условие currentUserId !== readerId НЕ ВЫПОЛНЕНО.`);
    }
}

// Обработка изменений статуса пользователя
function handleUserStatusChange(data) {
    console.log('Получено изменение статуса пользователя (websocket.js):', data);
    const userId = data.user_id;
    const isOnline = data.is_online;
    const lastSeen = data.last_seen;

    // Обновляем статус в списке чатов
    const chatItems = document.querySelectorAll(`.chat-item[data-user-id="${userId}"]`);
    chatItems.forEach(chatItem => {
        const onlineIndicator = chatItem.querySelector('.online-indicator');
        if (onlineIndicator) {
            onlineIndicator.style.display = isOnline ? 'block' : 'none';
        }
        if (isOnline) {
             chatItem.classList.add('online');
         } else {
             chatItem.classList.remove('online');
         }
    });

    // Обновляем статус в заголовке открытого чата, если это он
    const conversationHeader = document.querySelector('.conversation-header');
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer?.getAttribute('data-chat-id');
    const currentChatType = messageContainer?.getAttribute('data-chat-type');
    const chatUserContainer = conversationHeader?.querySelector('.chat-user');
    const selectedChat = document.querySelector(`.chat-item.active[data-user-id="${userId}"]`);

    // Проверяем, что открыт личный чат с этим пользователем
    if (selectedChat && currentChatType === 'direct' && selectedChat.getAttribute('data-chat-id') === currentChatId) {
        const userStatusHeader = chatUserContainer?.querySelector('.user-status-header');
        if (userStatusHeader) {
             if (isOnline) {
                 userStatusHeader.textContent = 'online';
             } else if (lastSeen) {
                 try {
                     // Предполагаем luxon доступен
                     const dt = luxon.DateTime.fromISO(lastSeen, { zone: 'utc' });
                     const localDt = dt.setZone('Asia/Bishkek');
                     const now = luxon.DateTime.now().setZone('Asia/Bishkek');
                     let statusText = 'last seen ';
                     if (localDt.hasSame(now, 'day')) {
                         statusText += `at ${localDt.toFormat('HH:mm')}`;
                     } else if (localDt.hasSame(now.minus({ days: 1 }), 'day')) {
                         statusText += 'yesterday';
                     } else if (now.diff(localDt, 'days').days < 7) {
                          statusText += `on ${localDt.toFormat('ccc')}`;
                     } else {
                         statusText += `on ${localDt.toFormat('dd.MM.yyyy')}`;
                     }
                     userStatusHeader.textContent = statusText;
                 } catch (luxonError) {
                     console.error("Ошибка форматирования времени Luxon в status change:", luxonError);
                     userStatusHeader.textContent = 'last seen recently';
                 }
             } else {
                  userStatusHeader.textContent = 'last seen long time ago';
             }
        }
    }
}

// Обработка уведомления об изменении сообщения
function handleMessageEdited(data) {
    console.log('Handling edited message notification:', data);
    
    const messageId = data.message_id;
    const chatId = data.chat_id || data.group_id;
    const isGroup = !!data.group_id;
    const newContent = data.content;
    
    // Find the correct message in the DOM if it's in the currently open chat
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer?.getAttribute('data-chat-id');
    const currentChatType = messageContainer?.getAttribute('data-chat-type');
    
    if (messageContainer && 
        currentChatId == chatId && 
        currentChatType === (isGroup ? 'group' : 'direct')) {
        
        // Find the message element by ID
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        
        if (messageElement) {
            console.log('Found message to update:', messageElement);
            
            // Mark message as edited
            messageElement.setAttribute('data-edited', 'true');
            
            // Update content based on type
            if (newContent.startsWith('/static/media/chat_files/')) {
                // For media content
                console.warn('Editing media messages is not fully supported. The link might have changed.');
                // We might need a more complex handling here if media files can be edited
            } else {
                // For text content
                const messageTextElement = messageElement.querySelector('.message-text');
                if (messageTextElement) {
                    messageTextElement.textContent = newContent;
                    
                    // Add edited indicator if not already present
                    let timeElement = messageElement.querySelector('.message-time');
                    if (timeElement) {
                        let editedIndicator = timeElement.querySelector('.edited-indicator');
                        if (!editedIndicator) {
                            editedIndicator = document.createElement('span');
                            editedIndicator.className = 'edited-indicator';
                            editedIndicator.textContent = '(edited)';
                            timeElement.appendChild(editedIndicator);
                        }
                    }
                }
            }
        }
    }
    
    // Update chat list to show latest message
    updateLastMessageInChatList(chatId, isGroup ? 'group' : 'direct', newContent, data.timestamp || new Date().toISOString());
}

// Обработка уведомления об удалении сообщения
function handleMessageDeleted(data) {
    console.log('Handling deleted message notification:', data);
    
    const messageId = data.message_id;
    const chatId = data.chat_id || data.group_id;
    const isGroup = !!data.group_id;
    
    // Find the correct message in the DOM if it's in the currently open chat
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer?.getAttribute('data-chat-id');
    const currentChatType = messageContainer?.getAttribute('data-chat-type');
    
    if (messageContainer && 
        currentChatId == chatId && 
        currentChatType === (isGroup ? 'group' : 'direct')) {
        
        // Find the message element by ID
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        
        if (messageElement) {
            console.log('Found message to delete:', messageElement);
            
            // Add a fadeout effect before removing
            messageElement.style.transition = 'opacity 0.5s ease';
            messageElement.style.opacity = '0';
            
            // Remove after animation completes
            setTimeout(() => {
                messageElement.remove();
            }, 500);
        }
    }
    
    // For deleted messages, we need to update the last message text in the chat list
    // but we don't have the new last message content, so fallback to loadChats
    // in a future update, this could be optimized with an API to get just the last message
    if (typeof loadChats === 'function') {
        loadChats();
    }
}

// Обработка уведомления об очистке чата
function handleChatCleared(data) {
    console.log('Handling chat cleared notification:', data);
    
    const chatId = data.chat_id;
    const clearedBy = data.cleared_by;
    
    // Get current user ID
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    
    // Check if this chat is currently open
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer?.getAttribute('data-chat-id');
    const currentChatType = messageContainer?.getAttribute('data-chat-type');
    
    if (messageContainer && currentChatId == chatId && currentChatType === 'direct') {
        // If this is the currently open chat, clear all messages
        messageContainer.innerHTML = '<div class="no-messages">Chat history cleared</div>';
        
        // Show notification only if cleared by another user
        if (clearedBy !== currentUserId) {
            showNotification('Chat history was cleared by the other person', 'info');
        }
    }
    
    // Update chat list to reflect changes
    if (typeof loadChats === 'function') {
        loadChats();
    }
}

// Обработка уведомления об удалении чата
function handleChatDeleted(data) {
    console.log('Handling chat deleted notification:', data);
    
    const chatId = data.chat_id;
    const deletedBy = data.deleted_by;
    
    // Get current user ID
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    
    // Check if this chat is currently open
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer?.getAttribute('data-chat-id');
    const currentChatType = messageContainer?.getAttribute('data-chat-type');
    
    if (messageContainer && currentChatId == chatId && currentChatType === 'direct') {
        // If this is the currently open chat, show welcome screen
        const welcomeScreen = document.querySelector('.welcome-screen');
        const conversation = document.querySelector('.conversation');
        
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
        if (conversation) conversation.style.display = 'none';
        
        // Show notification if deleted by another user
        if (deletedBy !== currentUserId) {
            showNotification('This chat was deleted by the other person', 'info');
        }
    }
    
    // Update chat list
    if (typeof loadChats === 'function') {
        loadChats();
    }
}

// Обработка уведомления об очистке группового чата
function handleGroupCleared(data) {
    console.log('Handling group cleared notification:', data);
    
    const groupId = data.group_id;
    const clearedBy = data.cleared_by;
    
    // Get current user ID
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    
    // Check if this group chat is currently open
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer?.getAttribute('data-chat-id');
    const currentChatType = messageContainer?.getAttribute('data-chat-type');
    
    if (messageContainer && currentChatId == groupId && currentChatType === 'group') {
        // Clear all messages in the group chat
        messageContainer.innerHTML = '<div class="no-messages">Group chat history cleared</div>';
        
        // Show notification only if cleared by another user
        if (clearedBy !== currentUserId) {
            showNotification('Group chat history was cleared', 'info');
        }
    }
    
    // Update chat list to reflect changes
    if (typeof loadChats === 'function') {
        loadChats();
    }
}

// Обработка уведомления о выходе пользователя из группы
function handleUserLeftGroup(data) {
    console.log('Handling user left group notification:', data);
    
    const groupId = data.group_id;
    const userId = data.user_id;
    const username = data.username;
    
    // Get current user ID
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    
    // Check if this is the current user (though they shouldn't receive this if they left)
    if (userId === currentUserId) {
        return;
    }
    
    // Check if this group chat is currently open
    const messageContainer = document.querySelector('.message-container');
    const currentChatId = messageContainer?.getAttribute('data-chat-id');
    const currentChatType = messageContainer?.getAttribute('data-chat-type');
    
    if (messageContainer && currentChatId == groupId && currentChatType === 'group') {
        // Add a system message showing that the user left
        const systemMessageElement = document.createElement('div');
        systemMessageElement.className = 'system-message';
        systemMessageElement.textContent = `${username} left the group`;
        messageContainer.appendChild(systemMessageElement);
        
        // If group info panel is open, update member list
        if (typeof loadGroupMembers === 'function') {
            loadGroupMembers(groupId);
        }
    }
    
    // Show notification
    showNotification(`${username} left the group`, 'info');
    
    // Update chat list
    if (typeof loadChats === 'function') {
        loadChats();
    }
}

// Добавление сообщения в чат
function appendMessageToChat(message, isGroup) {
    console.log('Добавление нового сообщения в чат:', message);
    const messageContainer = document.querySelector('.message-container');
    if (!messageContainer) {
        console.error('Контейнер сообщений не найден');
        return;
    }

    // Замена временного сообщения на реальное, если такое есть
    let tempMessage = null;
    if (message.temp_id) {
        tempMessage = messageContainer.querySelector(`[data-temp-id="${message.temp_id}"]`);
    }
    
    // Проверяем, существует ли уже сообщение с таким ID (независимо от временного ID)
    const existingMessage = messageContainer.querySelector(`[data-message-id="${message.id}"]`);
    
    if (existingMessage) {
        console.log('Сообщение уже существует, не добавляем его повторно');
        return;
    }
    
    if (tempMessage) {
        console.log('Найдено временное сообщение, заменяем его на реальное');
        tempMessage.remove();
    }

    // Определяем ID текущего пользователя
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    if (!currentUserId) {
        console.error('ID пользователя не найден для отображения сообщения');
        return;
    }

    const senderName = message.sender ? message.sender.username : 'Unknown';
    const senderId = message.sender ? message.sender.id : null;
    const avatarUrl = message.sender ? (message.sender.avatar_url || message.sender.avatar || '/static/images/meow-icon.jpg') : '/static/images/meow-icon.jpg';
    
    const timestamp = message.timestamp || new Date().toISOString();
    const formattedTime = formatMessageTime(timestamp);

    const isCurrentUser = (senderId === currentUserId);
    
    // Получаем последнее сообщение для определения консекутивности
    const allMessages = messageContainer.querySelectorAll('.message:not(.date-separator)');
    const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
    const lastSenderId = lastMessage ? lastMessage.getAttribute('data-sender-id') : null;

    const isConsecutive = (lastSenderId == senderId);

    // Создаем элемент сообщения
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isCurrentUser ? 'my-message' : 'other-message'}`;
    if (isConsecutive) {
        messageElement.classList.add('consecutive-message');
    }
    messageElement.setAttribute('data-message-id', message.id);
    messageElement.setAttribute('data-sender-id', senderId);
    messageElement.setAttribute('data-timestamp', timestamp);

    // Add forwarded attribute if this is a forwarded message
    if (message.forwarded) {
        messageElement.setAttribute('data-forwarded', 'true');
        if (message.original_sender) {
            messageElement.setAttribute('data-original-sender-id', message.original_sender.id);
        }
    }

    // Определяем, показывать ли информацию об отправителе
    const showSenderInfo = isGroup && !isCurrentUser && !isConsecutive;

    // Обрабатываем информацию об ответе, если есть
    const isReply = !!message.reply_info;
    let replyHTML = '';
    
    if (isReply) {
        const replySender = message.reply_info.sender_name || 'Unknown';
        const replyText = message.reply_info.content_snippet || 'Original message';
        replyHTML = `
            <div class="reply-container">
                <span class="reply-sender">${replySender}</span>
                <span class="reply-text">${replyText}</span>
            </div>
        `;
    }

    // Add forwarded info HTML if this is a forwarded message
    let forwardedHTML = '';
    if (message.forwarded && message.original_sender) {
        forwardedHTML = `
            <div class="forwarded-info">
                <i class="fas fa-share"></i> Forwarded from <span class="forwarded-sender">${message.original_sender.username}</span>
            </div>
        `;
    }

    // --- ЛОГИКА ОТОБРАЖЕНИЯ ФАЙЛОВ --- 
    let messageContentHTML = '';
    const fileUrlPrefix = '/static/media/chat_files/';
    if (typeof message.content === 'string' && message.content.startsWith(fileUrlPrefix)) {
        // Это сообщение с файлом
        const fileUrl = message.content;
        const filename = fileUrl.substring(fileUrl.indexOf('_', fileUrlPrefix.length) + 1);
        const extension = filename.split('.').pop().toLowerCase();

        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const videoExtensions = ['mp4', 'webm', 'ogg', 'mov']; // Добавили mov

        if (imageExtensions.includes(extension)) {
            // Показываем изображение
            messageContentHTML = `
                <img src="${fileUrl}" alt="${filename}" class="message-image">
            `;
        } else if (videoExtensions.includes(extension)) {
            // Показываем видео
            messageContentHTML = `
                <video controls class="message-video" preload="metadata">
                    <source src="${fileUrl}">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            // Показываем ссылку на другие файлы
            let fileIconClass = 'fa-file';
            if (['pdf'].includes(extension)) {
                fileIconClass = 'fa-file-pdf';
            } else if (['doc', 'docx'].includes(extension)) {
                fileIconClass = 'fa-file-word';
            } else if (['zip', 'rar', '7z'].includes(extension)) {
                fileIconClass = 'fa-file-archive';
            }
            
            messageContentHTML = `
                <a href="${fileUrl}" target="_blank" download="${filename}" class="file-message-link">
                    <i class="fas ${fileIconClass} file-icon"></i>
                    <span class="file-name">${filename}</span>
                </a>
            `;
        }
    } else {
        // Это обычное текстовое сообщение
        messageContentHTML = `<div class="message-text">${message.content}</div>`;
    }
    // --- КОНЕЦ ЛОГИКИ ФАЙЛОВ ---

    // --- ПРИМЕНЕНИЕ ЦВЕТА К ИМЕНИ --- 
    let senderNameStyle = '';
    if (isGroup && !isCurrentUser) { // Только для чужих сообщений в группе
        const color = getUserColor(senderId);
        senderNameStyle = `style="color: ${color};"`;
    }
    // --- КОНЕЦ ПРИМЕНЕНИЯ ЦВЕТА ---

    // Создаем HTML для сообщения
    let messageHTML = '';
    
    if (showSenderInfo) {
        messageHTML += `<div class="message-sender-info"><div class="message-avatar"><img src="${avatarUrl}" alt="${senderName}" class="user-avatar-img"></div></div>`;
    }
    
    // Основная часть сообщения с пузырём
    messageHTML += `
        <div class="message-bubble">
            ${showSenderInfo ? `<div class="message-sender-name" ${senderNameStyle}>${senderName}</div>` : ''}
            ${forwardedHTML}
            ${replyHTML}
            ${messageContentHTML}
            <div class="message-time">
                ${formattedTime}
                ${isCurrentUser ? '<span class="read-status unread"><i class="fas fa-check"></i></span>' : ''}
            </div>
        </div>
        <div class="message-menu-trigger"><i class="fas fa-ellipsis-v"></i></div>
    `;
    
    messageElement.innerHTML = messageHTML;
    
    // Добавляем элемент сообщения в контейнер
    messageContainer.appendChild(messageElement);
    
    // Добавляем контекстное меню к сообщению
    if (window.contextMenu && typeof window.contextMenu.addToMessage === 'function') {
        window.contextMenu.addToMessage(messageElement);
    }
    
    // Прокручиваем контейнер к новому сообщению, если пользователь находится внизу контейнера
    // или если это сообщение от текущего пользователя
    const shouldScroll = (messageContainer.scrollTop + messageContainer.clientHeight >= messageContainer.scrollHeight - 100) || isCurrentUser;
    
    if (shouldScroll) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    } else {
        // Показываем кнопку "Новые сообщения" если пользователь не прокрутил вниз
        const newMessageBtn = document.querySelector('.new-messages-button');
        if (newMessageBtn) {
            newMessageBtn.style.display = 'flex';
            
            // Обновляем счетчик новых сообщений
            const counter = newMessageBtn.querySelector('.new-messages-count');
            if (counter) {
                const currentCount = parseInt(counter.textContent) || 0;
                counter.textContent = currentCount + 1;
            }
        }
    }
    
    // Создаем и диспатчим событие о добавлении нового сообщения
    const event = new CustomEvent('messageAdded', { 
        detail: { 
            messageElement: messageElement,
            messageData: message
        } 
    });
    document.dispatchEvent(event);
    
    // Если это сообщение ДРУГОГО пользователя, и чат открыт, отмечаем его как прочитанное
    // Отправляем статус прочтения на сервер
    if (!isCurrentUser) {
        const openChatId = messageContainer.getAttribute('data-chat-id');
        const openChatType = messageContainer.getAttribute('data-chat-type');
        const openChatIsGroup = openChatType === 'group';
        
        if ((openChatIsGroup && isGroup && openChatId == message.group_id) ||
            (!openChatIsGroup && !isGroup && openChatId == message.chat_id)) {
            // Чат открыт, отправляем статус прочтения для этого сообщения
            sendReadReceipt(isGroup ? message.group_id : message.chat_id, isGroup);
        }
    }
    
    return messageElement;
}

// Обновление счетчика непрочитанных сообщений в списке чатов
function updateUnreadCountInChatList(chatId, isGroup) {
    console.log(`[updateUnreadCountInChatList (ws)] Попытка обновить счетчик для chatId: ${chatId}, isGroup: ${isGroup}`);
    const chatSelector = isGroup
        ? `.chat-item[data-chat-id="${chatId}"][data-chat-type="group"]`
        : `.chat-item[data-chat-id="${chatId}"][data-chat-type="direct"]`;
    console.log(`[updateUnreadCountInChatList (ws)] Используемый селектор: ${chatSelector}`);

    const chatItem = document.querySelector(chatSelector);
    if (chatItem) {
        console.log(`[updateUnreadCountInChatList (ws)] Найден chatItem для чата ${chatId}`);
        const unreadBadge = chatItem.querySelector('.chat-unread');
        if (unreadBadge) {
            console.log(`[updateUnreadCountInChatList (ws)] Найден unreadBadge для чата ${chatId}. Скрываем и обнуляем.`);
            unreadBadge.style.display = 'none';
            unreadBadge.textContent = '0';
            chatItem.classList.remove('has-unread');
        } else {
             console.log(`[updateUnreadCountInChatList (ws)] НЕ найден unreadBadge для чата ${chatId}.`);
        }
    } else {
         console.log(`[updateUnreadCountInChatList (ws)] НЕ найден chatItem для чата ${chatId} по селектору: ${chatSelector}`);
     }
}

// Функция для отправки статуса прочтения при открытии чата (может быть вызвана из chatDisplay.js)
// Оставляем здесь, т.к. она напрямую использует WebSocket
function sendReadStatusOnChatOpen(chatId, isGroup) {
    console.log('Отправка статуса прочтения при открытии чата (ws):', chatId, 'isGroup:', isGroup);
    if (isWebSocketConnected()) {
        const readStatus = {
            type: 'read_messages',
            chat_id: isGroup ? null : parseInt(chatId),
            group_id: isGroup ? parseInt(chatId) : null,
            timestamp: new Date().toISOString()
        };
        socket.send(JSON.stringify(readStatus));
        console.log('Отправлено уведомление о прочтении через WebSocket');
        return true;
    } else {
        console.warn('WebSocket не подключен, используем HTTP для отправки статуса прочтения');
        // Запасной вариант - отправка через HTTP (реализована в api.js или где-то еще?)
        const url = isGroup
            ? `api/groups/${chatId}/read`
            : `api/chat/${chatId}/read`;
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
             credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Ошибка при отправке статуса прочтения через HTTP');
            }
            console.log('Статус прочтения успешно отправлен через HTTP');
            return response.json();
        })
        .catch(error => {
            console.error('Ошибка при отправке статуса прочтения через HTTP:', error);
        });
        return false;
    }
}

// Функция для обновления только последнего сообщения в списке чатов без полной перезагрузки
function updateLastMessageInChatList(chatId, chatType, content, timestamp) {
    console.log(`[updateLastMessageInChatList] Обновление последнего сообщения для ${chatType} ${chatId}`);
    
    // Находим элемент чата в списке
    const chatSelector = `.chat-item[data-chat-id="${chatId}"][data-chat-type="${chatType}"]`;
    const chatItem = document.querySelector(chatSelector);
    
    if (chatItem) {
        // Обновляем текст последнего сообщения
        const lastMessageElement = chatItem.querySelector('.chat-last-message');
        if (lastMessageElement) {
            // Проверяем, является ли контент медиа-файлом
            if (content && content.startsWith('/static/media/chat_files/')) {
                const fileName = content.split('/').pop();
                const fileExtension = fileName.split('.').pop().toLowerCase();
                
                // Определяем тип медиа по расширению
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
                const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
                const audioExtensions = ['mp3', 'wav', 'ogg', 'aac'];
                
                if (imageExtensions.includes(fileExtension)) {
                    lastMessageElement.textContent = '🖼 Image';
                } else if (videoExtensions.includes(fileExtension)) {
                    lastMessageElement.textContent = '🎬 Video';
                } else if (audioExtensions.includes(fileExtension)) {
                    lastMessageElement.textContent = '🎵 Audio';
                } else {
                    lastMessageElement.textContent = '📎 File';
                }
            } else {
                // Обычное текстовое сообщение
                const preview = content.length > 30 ? content.substring(0, 30) + '...' : content;
                lastMessageElement.textContent = preview;
            }
        }
        
        // Обновляем время последнего сообщения
        const timeElement = chatItem.querySelector('.chat-time');
        if (timeElement && typeof formatChatTime === 'function') {
            timeElement.textContent = formatChatTime(timestamp);
        }
        
        // Перемещаем чат в начало списка (если это не активный чат)
        if (!chatItem.classList.contains('active')) {
            const chatList = chatItem.parentNode;
            if (chatList) {
                chatList.removeChild(chatItem);
                chatList.insertBefore(chatItem, chatList.firstChild);
            }
        }
        
        // Увеличиваем счетчик непрочитанных сообщений (только если это чужое сообщение)
        const userIdElement = document.querySelector('meta[name="user-id"]');
        const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
        
        // Проверяем, открыт ли этот чат сейчас
        const messageContainer = document.querySelector('.message-container');
        const isCurrentChat = messageContainer && 
                            messageContainer.getAttribute('data-chat-id') == chatId && 
                            messageContainer.getAttribute('data-chat-type') === chatType;
        
        if (!isCurrentChat) {
            const unreadBadge = chatItem.querySelector('.chat-unread');
            if (unreadBadge) {
                const currentCount = parseInt(unreadBadge.textContent) || 0;
                unreadBadge.textContent = currentCount + 1;
                unreadBadge.style.display = 'flex';
                chatItem.classList.add('has-unread');
            }
        }
    } else {
        console.log(`[updateLastMessageInChatList] Чат не найден в списке: ${chatType} ${chatId}. Возможно, требуется полная перезагрузка.`);
        // Если чат не найден, в крайнем случае делаем полную перезагрузку
        if (typeof loadChats === 'function') {
            loadChats();
        }
    }
}

// --- Конец перенесенных функций --- 

// Экспортируем функции для использования в других модулях
window.initWebSocket = initWebSocket;
window.sendDirectMessage = sendDirectMessage;
window.sendGroupMessage = sendGroupMessage;
window.sendChatMessage = sendChatMessage;
window.sendReadReceipt = sendReadReceipt;
window.isWebSocketConnected = isWebSocketConnected;
// Добавляем экспорты для функций, которые могут понадобиться в других модулях (хотя лучше избегать)
window.sendReadStatusOnChatOpen = sendReadStatusOnChatOpen;
// Функции обработки сообщений теперь локальные, их экспорт не нужен

// --- Export appendMessageToChat function to make it available for other modules --- 
window.appendMessageToChat = appendMessageToChat;