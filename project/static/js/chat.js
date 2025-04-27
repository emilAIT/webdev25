document.addEventListener('DOMContentLoaded', function() {
    // DOM элементы
    const chatsList = document.getElementById('chatsList');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const searchUserModal = document.getElementById('searchUserModal');
    const profileModal = document.getElementById('profileModal');
    const searchUsersBtn = document.getElementById('searchUsersBtn');
    const userSearchInput = document.getElementById('userSearchInput');
    const searchResults = document.getElementById('searchResults');
    const chatProfilePhoto = document.getElementById('chatProfilePhoto');
    const chatUsername = document.getElementById('chatUsername');
    const chatStatus = document.getElementById('chatStatus');
    const emptyChatMessage = document.getElementById('emptyChatMessage');
    const messageInputArea = document.getElementById('messageInputArea');
    const profilePhotoLarge = document.getElementById('profilePhotoLarge');
    const profileName = document.getElementById('profileName');
    const chatSearchInput = document.getElementById('chatSearchInput'); // Добавляем ссылку на поле поиска чатов
    const currentUserName = document.getElementById('currentUserName'); // Добавляем ссылку на элемент имени текущего пользователя
    
    // Контекстные меню
    const chatContextMenu = document.getElementById('chatContextMenu');
    const messageContextMenu = document.getElementById('messageContextMenu');
    const deleteChatMenuItem = document.getElementById('deleteChatMenuItem');
    const editMessageMenuItem = document.getElementById('editMessageMenuItem');
    const deleteMessageMenuItem = document.getElementById('deleteMessageMenuItem');
    
    // Текущие данные
    let currentChatId = null;
    let lastMessageTimestamp = null;
    let chats = [];
    let pollingInterval = null;
    let filteredChats = []; // Добавляем массив для отфильтрованных чатов
    let contextMenuTargetChat = null; // Чат, на котором вызвано контекстное меню
    let contextMenuTargetMessage = null; // Сообщение, на котором вызвано контекстное меню
    
    // Иницилизация
    init();
    
    function init() {
        // Устанавливаем имя пользователя по умолчанию
        if (currentUserName) {
            currentUserName.textContent = 'Пользователь';
        }
        
        // Загружаем информацию о текущем пользователе
        getCurrentUserInfo();
        
        // Загружаем список чатов
        loadChats();
        
        // Скрываем область ввода сообщений, пока не выбран чат
        messageInputArea.style.display = 'none';
        emptyChatMessage.style.display = 'flex';
        
        // Добавляем обработчик для отправки сообщений
        if (sendMessageBtn && messageInput) {
            sendMessageBtn.addEventListener('click', sendMessage);
            messageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
        
        // Добавляем обработчик для поиска чатов
        if (chatSearchInput) {
            chatSearchInput.addEventListener('input', searchChats);
        }
        
        // Обработчик для кнопки нового чата
        newChatBtn.addEventListener('click', showSearchUserModal);
        
        // Обработчики для модальных окон
        document.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', function() {
                searchUserModal.style.display = 'none';
                profileModal.style.display = 'none';
            });
        });
        
        // Обработчик клика вне модального окна
        window.addEventListener('click', function(event) {
            if (event.target === searchUserModal) {
                searchUserModal.style.display = 'none';
            }
            if (event.target === profileModal) {
                profileModal.style.display = 'none';
            }
        });
        
        // Обработчик для поиска пользователей
        searchUsersBtn.addEventListener('click', searchUsers);
        userSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchUsers();
            }
        });
        
        // Обработчик для клика на фото профиля чата
        chatProfilePhoto.addEventListener('click', showProfileModal);
        
        // Добавляем обработчики для контекстных меню
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('click', hideContextMenus);
        
        // Добавляем обработчики для пунктов контекстных меню
        if (deleteChatMenuItem) {
            deleteChatMenuItem.addEventListener('click', deleteChat);
        }
        
        if (editMessageMenuItem) {
            editMessageMenuItem.addEventListener('click', startEditMessage);
        }
        
        if (deleteMessageMenuItem) {
            deleteMessageMenuItem.addEventListener('click', deleteMessage);
        }
        
        // Запускаем цикл опроса сообщений (каждую секунду)
        startPolling();
    }
    
    function startPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        
        pollingInterval = setInterval(function() {
            if (currentChatId) {
                loadMessages(currentChatId, false);
            }
            loadChats(); // Обновление списка чатов для обновления последних сообщений
        }, 1000);
    }
    
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }
    
    function loadChats() {
        fetch('/api/chats')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderChats(data.chats);
                } else {
                    console.error('Ошибка загрузки чатов:', data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при загрузке чатов:', error);
            });
    }
    
    function renderChats(newChats) {
        if (!chatsList) return;
        
        // Сохраняем ID выбранного чата
        const selectedChatId = currentChatId;
        
        // Обновляем список чатов в памяти
        chats = newChats;
        
        // Применяем текущий поисковый фильтр, если он есть
        const searchQuery = chatSearchInput ? chatSearchInput.value.trim().toLowerCase() : '';
        if (searchQuery) {
            filteredChats = chats.filter(chat => 
                chat.user_name.toLowerCase().includes(searchQuery)
            );
            updateChatsUI(filteredChats, selectedChatId);
        } else {
            filteredChats = [...chats];
            updateChatsUI(chats, selectedChatId);
        }
    }
    
    // Новая функция для обновления UI списка чатов
    function updateChatsUI(chatsToRender, selectedChatId) {
        if (!chatsList) return;
        
        // Очищаем текущий список
        chatsList.innerHTML = '';
        
        // Сортируем чаты по времени последнего сообщения
        const sortedChats = [...chatsToRender].sort((a, b) => {
            if (!a.timestamp_raw || !b.timestamp_raw) return 0;
            return new Date(b.timestamp_raw) - new Date(a.timestamp_raw);
        });
        
        // Если нет чатов после фильтрации, показываем сообщение
        if (sortedChats.length === 0) {
            const noChatsMessage = document.createElement('li');
            noChatsMessage.classList.add('no-chats-message');
            noChatsMessage.textContent = 'Чаты не найдены';
            chatsList.appendChild(noChatsMessage);
            return;
        }
        
        // Добавляем чаты в DOM
        sortedChats.forEach(chat => {
            const chatItem = document.createElement('li');
            chatItem.setAttribute('data-chat-id', chat.id);
            
            if (chat.id === selectedChatId) {
                chatItem.classList.add('active');
            }
            
            const unreadBadge = chat.unread ? `<div class="notification">•</div>` : '';
            
            chatItem.innerHTML = `
                <div class="user-info">
                    <div class="avatar">
                        <img src="${chat.user_photo || '/static/images/default-profile.png'}" alt="Фото профиля">
                    </div>
                    <div class="user-details">
                        <div class="username">${chat.user_name}</div>
                        <div class="last-message">${chat.latest_message}</div>
                    </div>
                </div>
                <div class="message-meta">
                    <div class="timestamp">${chat.timestamp}</div>
                    ${unreadBadge}
                </div>
            `;
            
            chatItem.addEventListener('click', function() {
                onChatClick(chat);
            });
            
            chatsList.appendChild(chatItem);
        });
    }
    
    // Функция поиска чатов
    function searchChats() {
        const searchQuery = chatSearchInput.value.trim().toLowerCase();
        
        if (searchQuery) {
            filteredChats = chats.filter(chat => 
                chat.user_name.toLowerCase().includes(searchQuery)
            );
            updateChatsUI(filteredChats, currentChatId);
        } else {
            filteredChats = [...chats];
            updateChatsUI(chats, currentChatId);
        }
    }
    
    function onChatClick(chat) {
        // Обновляем активный класс
        document.querySelectorAll('.user-list li').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
        
        // Обновляем заголовок чата
        chatUsername.textContent = chat.user_name;
        document.getElementById('chatProfilePhoto').querySelector('img').src = 
            chat.user_photo || '/static/images/default-profile.png';
        chatStatus.textContent = ''; // Убираем текст статуса "В сети"
        
        // Обновляем текущий ID чата
        currentChatId = chat.id;
        
        // Скрываем сообщение пустого чата и показываем поле ввода
        emptyChatMessage.style.display = 'none';
        messageInputArea.style.display = 'flex';
        
        // Загружаем сообщения
        loadMessages(chat.id, true);
    }
    
    function loadMessages(chatId, scrollToBottom = false) {
        fetch(`/api/chats/${chatId}/messages`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderMessages(data.messages, scrollToBottom);
                    // Обновляем временную метку последнего сообщения
                    if (data.messages.length > 0) {
                        const lastMsg = data.messages[data.messages.length - 1];
                        lastMessageTimestamp = lastMsg.timestamp_raw;
                    }
                } else {
                    console.error('Ошибка загрузки сообщений:', data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при загрузке сообщений:', error);
            });
    }
    
    function renderMessages(messages, scrollToBottom = false) {
        if (!messagesContainer) return;
        
        // Если это не обновление, очищаем контейнер
        if (scrollToBottom) {
            messagesContainer.innerHTML = '';
        }
        
        if (messages.length === 0 && scrollToBottom) {
            messagesContainer.innerHTML = '<div class="chat-empty-message">Нет сообщений. Начните общение!</div>';
            return;
        }
        
        // Добавляем сообщения
        messages.forEach(msg => {
            const messageClass = msg.is_sent_by_me ? 'sent' : 'received';
            
            // Проверяем, существует ли уже это сообщение
            const existingMessage = document.getElementById(`message-${msg.id}`);
            if (existingMessage) {
                return; // Пропускаем добавление, если сообщение уже есть
            }
            
            const messageElement = document.createElement('div');
            messageElement.className = `message ${messageClass}`;
            messageElement.id = `message-${msg.id}`;
            messageElement.setAttribute('data-message-id', msg.id);
            
            // Добавляем класс deleted, если сообщение удалено
            if (msg.content === 'Сообщение удалено') {
                messageElement.classList.add('deleted');
            }
            
            let contentHTML = msg.content;
            if (msg.is_edited) {
                contentHTML += '<span class="edited-indicator"> (ред.)</span>';
            }
            
            messageElement.innerHTML = `
                <div class="content">${contentHTML}</div>
                <div class="timestamp">${msg.timestamp}</div>
                ${msg.is_sent_by_me ? 
                    `<div class="message-actions">
                        <div class="message-action edit-action" title="Редактировать">
                            <span class="material-icons">edit</span>
                        </div>
                        <div class="message-action delete-action" title="Удалить">
                            <span class="material-icons">delete</span>
                        </div>
                    </div>` : ''}
            `;
            
            // Добавляем обработчики для кнопок быстрого действия
            if (msg.is_sent_by_me) {
                messageElement.querySelector('.edit-action').addEventListener('click', function() {
                    contextMenuTargetMessage = msg.id;
                    startEditMessage();
                });
                
                messageElement.querySelector('.delete-action').addEventListener('click', function() {
                    contextMenuTargetMessage = msg.id;
                    deleteMessage();
                });
            }
            
            // Добавляем сообщение в конец контейнера
            messagesContainer.appendChild(messageElement);
        });
        
        if (scrollToBottom) {
            scrollToBottomMessages();
        } else if (messages.length > 0) {
            // Если добавлено новое сообщение, прокручиваем вниз
            const currentScroll = messagesContainer.scrollTop;
            const maxScroll = messagesContainer.scrollHeight - messagesContainer.clientHeight;
            
            // Если пользователь уже был внизу чата (с погрешностью 50px), то прокручиваем вниз
            if (maxScroll - currentScroll < 50) {
                scrollToBottomMessages();
            }
        }
    }
    
    function scrollToBottomMessages() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText || !currentChatId) return;
        
        // Очищаем поле ввода сразу, чтобы предотвратить повторную отправку
        messageInput.value = '';
        
        // Отправляем сообщение
        fetch(`/api/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: messageText
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Добавляем сообщение и прокручиваем вниз
                renderMessages([data.message], false);
                scrollToBottomMessages();
                
                // Обновляем список чатов
                loadChats();
            } else {
                console.error('Ошибка отправки сообщения:', data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при отправке сообщения:', error);
        });
    }
    
    function showSearchUserModal() {
        searchUserModal.style.display = 'block';
        userSearchInput.focus();
        searchResults.innerHTML = '';
    }
    
    function showProfileModal() {
        if (!currentChatId) return;
        
        // Находим информацию о текущем чате
        const currentChat = chats.find(chat => chat.id === currentChatId);
        if (!currentChat) return;
        
        // Заполняем модальное окно информацией о пользователе
        profilePhotoLarge.src = currentChat.user_photo || '/static/images/default-profile.png';
        profileName.textContent = currentChat.user_name;
        
        // Отображаем модальное окно
        profileModal.style.display = 'block';
    }
    
    function searchUsers() {
        const query = userSearchInput.value.trim();
        if (!query) return;
        
        fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                renderSearchResults(data.users || []);
            })
            .catch(error => {
                console.error('Ошибка при поиске пользователей:', error);
                searchResults.innerHTML = '<p>Произошла ошибка при поиске</p>';
            });
    }
    
    function renderSearchResults(users) {
        searchResults.innerHTML = '';
        
        if (users.length === 0) {
            searchResults.innerHTML = '<p>Пользователи не найдены</p>';
            return;
        }
        
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'search-result-item';
            
            userItem.innerHTML = `
                <div class="avatar">
                    <img src="${user.photo || '/static/images/default-profile.png'}" alt="Фото профиля">
                </div>
                <div class="username">${user.nickname}</div>
            `;
            
            userItem.addEventListener('click', function() {
                createChat(user.id);
            });
            
            searchResults.appendChild(userItem);
        });
    }
    
    function createChat(userId) {
        fetch('/api/chats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Закрываем модальное окно
                searchUserModal.style.display = 'none';
                
                // Обновляем список чатов
                loadChats();
                
                // Автоматически выбираем новый чат
                setTimeout(() => {
                    const newChatItem = document.querySelector(`[data-chat-id="${data.chat.id}"]`);
                    if (newChatItem) {
                        newChatItem.click();
                    }
                }, 500);
            } else {
                console.error('Ошибка создания чата:', data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при создании чата:', error);
        });
    }
    
    // Функция для получения информации о текущем пользователе
    function getCurrentUserInfo() {
        fetch('/api/users/current')
            .then(response => response.json())
            .then(data => {
                if (data.success && currentUserName) {
                    currentUserName.textContent = data.user.nickname || data.user.name || 'Пользователь';
                }
            })
            .catch(error => {
                console.error('Ошибка при получении данных пользователя:', error);
                // Если произошла ошибка, оставляем текст по умолчанию "Пользователь"
            });
    }
    
    // Функция для обработки вызова контекстного меню
    function handleContextMenu(event) {
        // Скрываем стандартное контекстное меню
        event.preventDefault();
        
        // Скрываем все активные контекстные меню
        hideContextMenus();
        
        // Проверяем, на каком элементе было вызвано контекстное меню
        const chatItem = findParentElementByClass(event.target, '.user-list li');
        const messageItem = findParentElementByClass(event.target, '.message');
        
        if (chatItem) {
            // Контекстное меню для чата
            const chatId = chatItem.getAttribute('data-chat-id');
            if (chatId) {
                contextMenuTargetChat = chatId;
                showChatContextMenu(event.clientX, event.clientY);
                return; // Важно: останавливаем обработку после показа меню
            }
        } else if (messageItem) {
            // Проверяем, является ли это нашим сообщением (мы можем редактировать только свои сообщения)
            if (messageItem.classList.contains('sent')) {
                const messageId = messageItem.getAttribute('data-message-id');
                if (messageId) {
                    contextMenuTargetMessage = messageId;
                    showMessageContextMenu(event.clientX, event.clientY);
                    return; // Важно: останавливаем обработку после показа меню
                }
            }
        }
    }
    
    // Вспомогательная функция для поиска родительского элемента по классу
    function findParentElementByClass(element, selector) {
        while (element) {
            // Используем более надежный способ проверки соответствия селектору
            try {
                // Проверяем, соответствует ли элемент селектору
                if (element.matches && element.matches(selector)) {
                    return element;
                }
            } catch (e) {
                console.error('Ошибка в проверке селектора:', e);
            }
            element = element.parentElement;
        }
        return null;
    }
    
    // Функция для отображения контекстного меню чата
    function showChatContextMenu(x, y) {
        if (!chatContextMenu) {
            console.error('Элемент контекстного меню чата не найден');
            return;
        }
        
        // Позиционируем и показываем меню
        chatContextMenu.style.left = `${x}px`;
        chatContextMenu.style.top = `${y}px`;
        chatContextMenu.classList.add('active');
        
        // Для отладки: добавляем проверку стилей
        console.log('Контекстное меню отображено:', 
            {left: chatContextMenu.style.left, 
             top: chatContextMenu.style.top, 
             display: window.getComputedStyle(chatContextMenu).display});
    }
    
    // Функция для отображения контекстного меню сообщения
    function showMessageContextMenu(x, y) {
        if (!messageContextMenu) return;
        
        messageContextMenu.style.left = `${x}px`;
        messageContextMenu.style.top = `${y}px`;
        messageContextMenu.classList.add('active');
    }
    
    // Функция для скрытия всех контекстных меню
    function hideContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.classList.remove('active');
        });
    }
    
    // Функция для удаления чата
    function deleteChat() {
        if (!contextMenuTargetChat) return;
        
        // Спрашиваем подтверждение
        if (confirm('Вы уверены, что хотите удалить этот чат?')) {
            fetch(`/api/chats/${contextMenuTargetChat}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Если это был текущий открытый чат, очищаем область сообщений
                    if (currentChatId === parseInt(contextMenuTargetChat)) {
                        currentChatId = null;
                        messagesContainer.innerHTML = '';
                        messageInputArea.style.display = 'none';
                        emptyChatMessage.style.display = 'flex';
                        chatUsername.textContent = 'Выберите чат';
                        chatProfilePhoto.querySelector('img').src = '/static/images/default-profile.png';
                    }
                    
                    // Удаляем чат из списка и перерисовываем
                    loadChats();
                    
                    // Сбрасываем целевой чат
                    contextMenuTargetChat = null;
                } else {
                    alert('Ошибка при удалении чата: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при удалении чата:', error);
                alert('Произошла ошибка при удалении чата');
            });
        }
        
        // Скрываем контекстное меню
        hideContextMenus();
    }
    
    // Функция для начала редактирования сообщения
    function startEditMessage() {
        if (!contextMenuTargetMessage) return;
        
        // Находим элемент сообщения
        const messageElement = document.querySelector(`.message[data-message-id="${contextMenuTargetMessage}"]`);
        if (!messageElement) return;
        
        // Получаем текущий текст сообщения
        const contentElement = messageElement.querySelector('.content');
        const currentContent = contentElement.textContent;
        
        // Создаем форму редактирования, если ее нет
        let editContainer = messageElement.querySelector('.edit-input-container');
        if (!editContainer) {
            editContainer = document.createElement('div');
            editContainer.className = 'edit-input-container';
            
            const editInput = document.createElement('input');
            editInput.className = 'edit-input';
            editInput.type = 'text';
            editInput.value = currentContent;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'edit-actions';
            
            const saveButton = document.createElement('button');
            saveButton.innerHTML = '<span class="material-icons">check</span>';
            saveButton.title = 'Сохранить';
            saveButton.addEventListener('click', () => saveEditedMessage(contextMenuTargetMessage, editInput.value));
            
            const cancelButton = document.createElement('button');
            cancelButton.innerHTML = '<span class="material-icons">close</span>';
            cancelButton.title = 'Отменить';
            cancelButton.addEventListener('click', cancelEditMessage);
            
            actionsDiv.appendChild(saveButton);
            actionsDiv.appendChild(cancelButton);
            
            editContainer.appendChild(editInput);
            editContainer.appendChild(actionsDiv);
            
            messageElement.appendChild(editContainer);
        }
        
        // Активируем режим редактирования
        messageElement.classList.add('editing');
        
        // Фокус на поле ввода
        const editInput = editContainer.querySelector('.edit-input');
        editInput.focus();
        editInput.select();
        
        // Добавляем обработчик нажатия Enter для сохранения
        editInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveEditedMessage(contextMenuTargetMessage, editInput.value);
            }
        });
        
        // Скрываем контекстное меню
        hideContextMenus();
    }
    
    // Функция для сохранения отредактированного сообщения
    function saveEditedMessage(messageId, newContent) {
        if (!newContent.trim()) {
            alert('Сообщение не может быть пустым');
            return;
        }
        
        fetch(`/api/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: newContent.trim()
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Находим элемент сообщения
                const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
                if (messageElement) {
                    // Обновляем содержимое сообщения
                    const contentElement = messageElement.querySelector('.content');
                    contentElement.textContent = newContent.trim();
                    
                    // Добавляем индикатор редактирования, если его еще нет
                    if (!messageElement.querySelector('.edited-indicator')) {
                        const editedIndicator = document.createElement('span');
                        editedIndicator.className = 'edited-indicator';
                        editedIndicator.textContent = ' (ред.)';
                        contentElement.appendChild(editedIndicator);
                    }
                    
                    // Выключаем режим редактирования
                    messageElement.classList.remove('editing');
                }
            } else {
                alert('Ошибка при обновлении сообщения: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при обновлении сообщения:', error);
            alert('Произошла ошибка при обновлении сообщения');
        });
    }
    
    // Функция для отмены редактирования сообщения
    function cancelEditMessage() {
        const messageElement = document.querySelector('.message.editing');
        if (messageElement) {
            messageElement.classList.remove('editing');
        }
    }
    
    // Функция для удаления сообщения
    function deleteMessage() {
        if (!contextMenuTargetMessage) return;
        
        // Спрашиваем подтверждение
        if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
            fetch(`/api/messages/${contextMenuTargetMessage}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Находим элемент сообщения
                    const messageElement = document.querySelector(`.message[data-message-id="${contextMenuTargetMessage}"]`);
                    if (messageElement) {
                        // Обновляем содержимое сообщения на "Сообщение удалено"
                        const contentElement = messageElement.querySelector('.content');
                        contentElement.textContent = 'Сообщение удалено';
                        
                        // Добавляем класс для стилизации удаленного сообщения
                        messageElement.classList.add('deleted');
                    }
                    
                    // Сбрасываем целевое сообщение
                    contextMenuTargetMessage = null;
                } else {
                    alert('Ошибка при удалении сообщения: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при удалении сообщения:', error);
                alert('Произошла ошибка при удалении сообщения');
            });
        }
        
        // Скрываем контекстное меню
        hideContextMenus();
    }
});
