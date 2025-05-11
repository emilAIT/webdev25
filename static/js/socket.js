// Increase timeout and add reconnection options
let socket = io.connect(window.location.protocol + '//' + document.domain + ':' + location.port, {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000
});

let socketConnected = false;

// Установка обработчиков событий
document.addEventListener('DOMContentLoaded', () => {
    // Обработчик подключения
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        socketConnected = true;
        
        // Вызываем пользовательское событие socket-ready
        const event = new Event('socket-ready');
        document.dispatchEvent(event);
    });
    
    // Остальные обработчики...
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        socketConnected = false;
    });
    
    // Обработчик ошибки соединения
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        socketConnected = false;
    });
    
    // Обработчик статусных сообщений
    socket.on('status', (data) => {
        if (data && data.msg && data.msg.trim()) {
            // Не показывать сообщения о входе в комнату
            if (!/joined room/.test(data.msg)) {
                //displayStatusMessage(data.msg);
            }
        }
    });
    
    // Обработчик новых сообщений
    socket.on('new_message', (data) => {
        console.log('New message received:', data);
        
        // Check if this message belongs to the currently active chat
        const activeChat = document.querySelector('.chat-item.active');
        if (activeChat) {
            const chatType = activeChat.getAttribute('data-chat-type');
            const activeChatId = chatType === 'group' ? 
                activeChat.getAttribute('data-group-id') : 
                activeChat.getAttribute('data-user-id');
            
            const messageForActiveChat = 
                (chatType === 'group' && data.group_id == activeChatId) || 
                (chatType === 'direct' && 
                    ((data.sender_id == activeChatId) || (data.recipient_id == activeChatId)));
            
            if (messageForActiveChat) {
                // Get current user ID to determine if this is an incoming message
                const currentUserId = document.body.getAttribute('data-user-id');
                const isSentByMe = data.sender_id == currentUserId;
                
                // Display message in the chat window
                const messagesContainer = document.querySelector('.chat-messages');
                
                // 1. Получаем дату сообщения
                const msgDate = new Date(data.timestamp);
                const dateStr = msgDate.toLocaleDateString();

                // 2. Проверяем, есть ли уже разделитель для этой даты
                if (!messagesContainer.querySelector(`.date-label[data-date="${dateStr}"]`)) {
                    const dateLabel = document.createElement('div');
                    dateLabel.className = 'date-label';
                    dateLabel.setAttribute('data-date', dateStr);
                    dateLabel.textContent = dateStr;
                    messagesContainer.appendChild(dateLabel);
                }

                if (chatType === 'group') {
                    if (!messagesContainer.querySelector(`.message-container[data-message-id="${data.id}"]`)) {
                        const message = createGroupMessage(
                            data.content,
                            isSentByMe,
                            false,
                            isSentByMe ? '' : data.sender_name,
                            isSentByMe ? '' : data.sender_avatar,
                            data.id,
                            data.timestamp // <-- вот это!
                        );
                        messagesContainer.appendChild(message);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                } else {
                    if (!messagesContainer.querySelector(`.message-container[data-message-id="${data.id}"]`)) {
                        const message = createMessage(
                            data.content,
                            isSentByMe,
                            false,
                            data.id,
                            true,
                            data.timestamp // <-- вот это!
                        );
                        messagesContainer.appendChild(message);
                    }
                }
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                // Show notification for messages in other chats
                showNotification(`New message from ${data.sender_name}`);
                
                // Update unread indicator on the chat item
                updateChatUnreadStatus(data);
            }
        }
        // После добавления сообщения:
        updateChatItemTime(data);
    });
    
    // Обработчик ошибок
    socket.on('error', (data) => {
        console.error('Error message received:', data);
        displayErrorMessage(data.msg);
    });
});

// Modify the ensureSocketReady function to handle timeouts better
function ensureSocketReady() {
    return new Promise((resolve, reject) => {
        if (socket && socketConnected) {
            resolve(socket);
        } else if (socket && !socketConnected) {
            // If socket exists but not connected, try reconnecting
            socket.connect();
            
            // Listen for successful connection
            document.addEventListener('socket-ready', () => resolve(socket), { once: true });
            
            // Timeout after 8 seconds
            setTimeout(() => {
                if (!socketConnected) {
                    console.warn('Socket connection timed out, operating in offline mode');
                    // Resolve anyway to prevent blocking UI, but log warning
                    resolve(socket);
                }
            }, 8000);
        } else {
            reject(new Error('Socket not initialized'));
        }
    });
}

// Updated join room functions
function joinPrivateRoom(userId, friendId) {
    // Add a small delay to ensure socket initialization
    return new Promise((resolve) => setTimeout(resolve, 300))
        .then(() => ensureSocketReady())
        .then(() => {
            const roomId = `private_${Math.min(userId, friendId)}_${Math.max(userId, friendId)}`;
            console.log(`Joining private room: ${roomId}`);
            
            socket.emit('join', {room: roomId});
            return roomId;
        })
        .catch(error => {
            console.error('Cannot join room:', error);
            // Return a fallback room ID to allow offline-first behavior
            return `private_${Math.min(userId, friendId)}_${Math.max(userId, friendId)}`;
        });
}

// Similarly update joinGroupRoom with the delay
function joinGroupRoom(groupId) {
    return new Promise((resolve) => setTimeout(resolve, 300))
        .then(() => ensureSocketReady())
        .then(() => {
            const roomId = `group_${groupId}`;
            console.log(`Joining group room: ${roomId}`);
            
            socket.emit('join', {room: roomId});
            return roomId;
        })
        .catch(error => {
            console.error('Cannot join room:', error);
            return null;
        });
}

// Отправка сообщения с улучшенными логами
function sendMessage(message, roomId, recipientType, recipientId) {
    console.log('[ОТПРАВКА] Начало отправки сообщения:', { 
        message: message.length > 50 ? message.substring(0, 50) + '...' : message,
        roomId, 
        recipientType, 
        recipientId 
    });
    
    return ensureSocketReady()
        .then(() => {
            console.log('[ОТПРАВКА] Сокет готов, формируем данные сообщения');
            
            // ИСПРАВЛЕНИЕ: унифицируем тип получателя
            let actualRecipientType = recipientType;
            if (recipientType === 'direct') {
                actualRecipientType = 'user';
            }
            
            const data = {
                message: message,
                room: roomId,
                recipient_type: actualRecipientType
            };
            if (actualRecipientType === 'group') {
                data.group_id = recipientId;
                console.log('[ОТПРАВКА] Групповое сообщение в группу:', recipientId);
            } else {
                data.recipient_id = parseInt(recipientId); // Убедитесь, что ID передается как число
                console.log('[ОТПРАВКА] Личное сообщение пользователю:', recipientId);
            }
            
            console.log('[ОТПРАВКА] Отправляем сообщение через сокет');
            socket.emit('message', data);
            console.log('[ОТПРАВКА] Сообщение отправлено');
            return { success: true };
        })
        .catch(error => {
            console.error('[ОТПРАВКА] Ошибка при отправке сообщения:', error);
            return { success: false, error: error.message };
        });
}

// Функции отображения сообщений на странице
function displayMessage(data) {
    const messagesContainer = document.querySelector('.messages-container');
    const currentUserId = parseInt(document.body.dataset.userId);
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // Определяем, является ли сообщение отправленным текущим пользователем
    if (data.sender_id === currentUserId) {
        messageElement.classList.add('sent');
    } else {
        messageElement.classList.add('received');
    }
    
    // Формируем содержимое сообщения
    messageElement.innerHTML = `
        <div class="message-content">${data.content}</div>
        <div class="message-info">
            <span class="message-time">${formatTime(data.timestamp)}</span>
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    // Прокручиваем контейнер сообщений к последнему сообщению
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayStatusMessage(message) {
    // Find the correct container - use chat-messages instead of messages-container
    const messagesContainer = document.querySelector('.chat-messages');
    
    // Only proceed if the container exists
    if (messagesContainer) {
        const statusElement = document.createElement('div');
        statusElement.classList.add('status-message');
        statusElement.textContent = message;
        statusElement.style.textAlign = 'center';
        statusElement.style.padding = '5px';
        statusElement.style.color = '#666';
        statusElement.style.fontSize = '0.9em';
        
        messagesContainer.appendChild(statusElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        console.log('Status message (no display container):', message);
    }
}

function displayErrorMessage(message) {
    // Можно реализовать отображение всплывающего уведомления об ошибке
    alert('Ошибка: ' + message);
}

// Вспомогательная функция для форматирования времени
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Helper function to update unread indicators in the sidebar
function updateChatUnreadStatus(data) {
    let chatItem;
    if (data.group_id) {
        chatItem = document.querySelector(`.chat-item[data-group-id="${data.group_id}"]`);
    } else {
        // For direct messages, find the chat with the sender
        chatItem = document.querySelector(`.chat-item[data-user-id="${data.sender_id}"]`);
    }
    
    if (chatItem) {
        // Add unread indicator
        if (!chatItem.querySelector('.unread-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'unread-indicator';
            chatItem.appendChild(indicator);
        }
        
        // Update time display
        const timeElement = chatItem.querySelector('.chat-item-time');
        if (timeElement) {
            timeElement.textContent = formatTime(data.timestamp || new Date());
        }
    }
}

// Вспомогательная функция для обновления времени в chat-item
function updateChatItemTime(data) {
    let chatItem;
    if (data.group_id) {
        chatItem = document.querySelector(`.chat-item[data-group-id="${data.group_id}"]`);
    } else {
        // Для личных сообщений ищем по user-id собеседника (не себя)
        const currentUserId = document.body.getAttribute('data-user-id');
        const otherUserId = data.sender_id == currentUserId ? data.recipient_id : data.sender_id;
        chatItem = document.querySelector(`.chat-item[data-user-id="${otherUserId}"]`);
    }
    if (chatItem) {
        const timeElement = chatItem.querySelector('.chat-item-time');
        if (timeElement) {
            timeElement.textContent = formatTime(data.timestamp);
        }
    }
}

// Add this to socket.js
function markMessageAsRead(messageId) {
    return ensureSocketReady()
        .then(() => {
            socket.emit('mark_read', {message_id: messageId});
        })
        .catch(error => {
            console.error('Cannot mark message as read:', error);
        });
}

socket.on('message_read', (data) => {
    const messageElement = document.querySelector(`.message-container[data-message-id="${data.message_id}"]`);
    if (messageElement) {
        const readStatus = messageElement.querySelector('.read-status');
        if (readStatus) {
            // Remove hardcoded checkmarks and let CSS handle it
            readStatus.classList.remove('unread');
            readStatus.classList.add('read');
            
            // Create proper SVG for read status
            readStatus.innerHTML = '';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '11');
            svg.setAttribute('viewBox', '0 0 16 12');
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z');
            path.setAttribute('fill', 'currentColor');
            
            svg.appendChild(path);
            readStatus.appendChild(svg);
        }
    }
    
    updateChatReadStatus();
});