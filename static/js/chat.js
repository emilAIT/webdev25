document.addEventListener('DOMContentLoaded', function() {
    // DOM элементы
    const chatsList = document.getElementById('chatsList');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const newGroupBtn = document.getElementById('newGroupBtn'); // Кнопка создания группы
    const searchUserModal = document.getElementById('searchUserModal');
    const profileModal = document.getElementById('profileModal');
    const createGroupModal = document.getElementById('createGroupModal'); // Модальное окно создания группы
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
    
    // Элементы для создания группы
    const groupPhotoPreview = document.getElementById('groupPhotoPreview');
    const groupPhotoInput = document.getElementById('groupPhotoInput');
    const groupName = document.getElementById('groupName');
    const groupDescription = document.getElementById('groupDescription');
    const goToGroupStep2 = document.getElementById('goToGroupStep2');
    const backToGroupStep1 = document.getElementById('backToGroupStep1');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const groupStep1 = document.getElementById('groupStep1');
    const groupStep2 = document.getElementById('groupStep2');
    const groupMemberSearchInput = document.getElementById('groupMemberSearchInput');
    const searchGroupMembersBtn = document.getElementById('searchGroupMembersBtn');
    const selectedMembers = document.getElementById('selectedMembers');
    const groupMembersSearchResults = document.getElementById('groupMembersSearchResults');
    
    // Элементы для информации о группе
    const chatHeaderActions = document.getElementById('chatHeaderActions');
    const chatInfoBtn = document.getElementById('chatInfoBtn');
    const groupInfoModal = document.getElementById('groupInfoModal');
    const groupInfoPhoto = document.getElementById('groupInfoPhoto');
    const groupInfoName = document.getElementById('groupInfoName');
    const groupInfoDescription = document.getElementById('groupInfoDescription');
    const groupMemberCount = document.getElementById('groupMemberCount');
    const groupMembersList = document.getElementById('groupMembersList');
    
    // Контекстные меню
    const chatContextMenu = document.getElementById('chatContextMenu');
    const messageContextMenu = document.getElementById('messageContextMenu');
    const deleteChatMenuItem = document.getElementById('deleteChatMenuItem');
    const editMessageMenuItem = document.getElementById('editMessageMenuItem');
    const deleteMessageMenuItem = document.getElementById('deleteMessageMenuItem');
    const groupMemberContextMenu = document.getElementById('groupMemberContextMenu');
    const makeAdminMenuItem = document.getElementById('makeAdminMenuItem');
    const removeMemberMenuItem = document.getElementById('removeMemberMenuItem');
    
    // Текущие данные
    let currentChatId = null;
    let lastMessageTimestamp = null;
    let chats = [];
    let pollingInterval = null;
    let filteredChats = []; // Добавляем массив для отфильтрованных чатов
    let contextMenuTargetChat = null; // Чат, на котором вызвано контекстное меню
    let contextMenuTargetMessage = null; // Сообщение, на котором вызвано контекстное меню
    let selectedMembersForGroup = []; // Массив выбранных пользователей для группы
    let currentChatType = null; // тип чата 'dialog' или 'group'
    let currentGroupInfo = null; // информация о текущей группе
    let contextMenuTargetMember = null; // Участник группы, на котором вызвано контекстное меню
    
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
        
        // Добавляем обработчик для кнопки создания группы
        if (newGroupBtn) {
            newGroupBtn.addEventListener('click', showCreateGroupModal);
        }
        
        // Обработчики для модальных окон
        document.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', function() {
                searchUserModal.style.display = 'none';
                profileModal.style.display = 'none';
                createGroupModal.style.display = 'none';
                groupInfoModal.style.display = 'none';
                resetGroupCreationForm();
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
            if (event.target === createGroupModal) {
                createGroupModal.style.display = 'none';
                resetGroupCreationForm();
            }
            if (event.target === groupInfoModal) {
                groupInfoModal.style.display = 'none';
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
        
        if (makeAdminMenuItem) {
            makeAdminMenuItem.addEventListener('click', makeGroupAdmin);
        }
        
        if (removeMemberMenuItem) {
            removeMemberMenuItem.addEventListener('click', removeGroupMember);
        }
        
        // Запускаем цикл опроса сообщений (каждую секунду)
        startPolling();
        
        // Обработчики для создания группы
        if (groupPhotoPreview) {
            groupPhotoPreview.addEventListener('click', function() {
                groupPhotoInput.click();
            });
        }
        
        if (groupPhotoInput) {
            groupPhotoInput.addEventListener('change', function() {
                if (this.files && this.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        groupPhotoPreview.src = e.target.result;
                    };
                    reader.readAsDataURL(this.files[0]);
                }
            });
        }
        
        if (goToGroupStep2) {
            goToGroupStep2.addEventListener('click', function() {
                if (!groupName.value.trim()) {
                    alert('Пожалуйста, укажите название группы');
                    return;
                }
                groupStep1.classList.add('hidden');
                groupStep2.classList.remove('hidden');
            });
        }
        
        if (backToGroupStep1) {
            backToGroupStep1.addEventListener('click', function() {
                groupStep2.classList.add('hidden');
                groupStep1.classList.remove('hidden');
            });
        }
        
        // Обработчики для поиска участников группы
        if (searchGroupMembersBtn) {
            searchGroupMembersBtn.addEventListener('click', searchGroupMembers);
        }
        
        if (groupMemberSearchInput) {
            groupMemberSearchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchGroupMembers();
                }
            });
        }
        
        // Обработчик для создания группы
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', createGroup);
        }
        
        // Обработчик для кнопки информации о чате
        if (chatInfoBtn) {
            chatInfoBtn.addEventListener('click', showGroupInfo);
        }
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
                let allChats = [];
                
                if (data.success) {
                    allChats = data.chats.map(chat => ({
                        ...chat,
                        chat_type: 'dialog'
                    }));
                }
                
                fetch('/api/groups')
                    .then(response => response.json())
                    .then(groupsData => {
                        if (groupsData.success) {
                            const groupChats = groupsData.groups.map(group => ({
                                id: group.id,
                                user_name: group.name,
                                user_photo: group.photo_url || '/static/images/group-default.png',
                                latest_message: group.latest_message,
                                timestamp: group.last_activity,
                                timestamp_raw: group.last_activity_raw,
                                unread: group.unread_count > 0,
                                chat_type: 'group',
                                member_count: group.member_count,
                                description: group.description
                            }));
                            
                            allChats = [...allChats, ...groupChats];
                        }
                        
                        renderChats(allChats);
                    })
                    .catch(error => {
                        console.error('Ошибка при загрузке групп:', error);
                        renderChats(allChats);
                    });
            })
            .catch(error => {
                console.error('Ошибка при загрузке чатов:', error);
            });
    }
    
    function renderChats(newChats) {
        if (!chatsList) return;
        
        const selectedChatId = currentChatId;
        
        chats = newChats;
        
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
    
    function updateChatsUI(chatsToRender, selectedChatId) {
        if (!chatsList) return;
        
        chatsList.innerHTML = '';
        
        const sortedChats = [...chatsToRender].sort((a, b) => {
            if (!a.timestamp_raw || !b.timestamp_raw) return 0;
            return new Date(b.timestamp_raw) - new Date(a.timestamp_raw);
        });
        
        if (sortedChats.length === 0) {
            const noChatsMessage = document.createElement('li');
            noChatsMessage.classList.add('no-chats-message');
            noChatsMessage.textContent = 'Чаты не найдены';
            chatsList.appendChild(noChatsMessage);
            return;
        }
        
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
        document.querySelectorAll('.user-list li').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
        
        currentChatType = chat.chat_type || 'dialog';
        
        chatUsername.textContent = chat.user_name;
        document.getElementById('chatProfilePhoto').querySelector('img').src = 
            chat.user_photo || '/static/images/default-profile.png';
        chatStatus.textContent = '';
        
        if (currentChatType === 'group') {
            chatHeaderActions.style.display = 'flex';
            chatStatus.textContent = `${chat.member_count || 0} участников`;
        } else {
            chatHeaderActions.style.display = 'none';
        }
        
        currentChatId = chat.id;
        
        emptyChatMessage.style.display = 'none';
        messageInputArea.style.display = 'flex';
        
        loadMessages(chat.id, true);
    }
    
    function loadMessages(chatId, scrollToBottom = false) {
        fetch(`/api/chats/${chatId}/messages`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderMessages(data.messages, scrollToBottom);
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
        
        if (scrollToBottom) {
            messagesContainer.innerHTML = '';
        }
        
        if (messages.length === 0 && scrollToBottom) {
            messagesContainer.innerHTML = '<div class="chat-empty-message">Нет сообщений. Начните общение!</div>';
            return;
        }
        
        messages.forEach(msg => {
            const messageClass = msg.is_sent_by_me ? 'sent' : 'received';
            
            const existingMessage = document.getElementById(`message-${msg.id}`);
            if (existingMessage) {
                return;
            }
            
            const messageElement = document.createElement('div');
            messageElement.className = `message ${messageClass}`;
            messageElement.id = `message-${msg.id}`;
            messageElement.setAttribute('data-message-id', msg.id);
            
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
            
            messagesContainer.appendChild(messageElement);
        });
        
        if (scrollToBottom) {
            scrollToBottomMessages();
        } else if (messages.length > 0) {
            const currentScroll = messagesContainer.scrollTop;
            const maxScroll = messagesContainer.scrollHeight - messagesContainer.clientHeight;
            
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
        
        messageInput.value = '';
        
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
                renderMessages([data.message], false);
                scrollToBottomMessages();
                
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
        
        const currentChat = chats.find(chat => chat.id === currentChatId);
        if (!currentChat) return;
        
        profilePhotoLarge.src = currentChat.user_photo || '/static/images/default-profile.png';
        profileName.textContent = currentChat.user_name;
        
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
                searchUserModal.style.display = 'none';
                
                loadChats();
                
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
            });
    }
    
    function handleContextMenu(event) {
        event.preventDefault();
        
        hideContextMenus();
        
        const chatItem = findParentElementByClass(event.target, '.user-list li');
        const messageItem = findParentElementByClass(event.target, '.message');
        const memberItem = findParentElementByClass(event.target, '.group-member-item');
        
        if (chatItem) {
            const chatId = chatItem.getAttribute('data-chat-id');
            if (chatId) {
                contextMenuTargetChat = chatId;
                showChatContextMenu(event.clientX, event.clientY);
                return;
            }
        } else if (messageItem) {
            if (messageItem.classList.contains('sent')) {
                const messageId = messageItem.getAttribute('data-message-id');
                if (messageId) {
                    contextMenuTargetMessage = messageId;
                    showMessageContextMenu(event.clientX, event.clientY);
                    return;
                }
            }
        } else if (memberItem) {
            const memberId = memberItem.getAttribute('data-user-id');
            if (memberId) {
                contextMenuTargetMember = memberId;
                showGroupMemberContextMenu(event.clientX, event.clientY);
                return;
            }
        }
    }
    
    function findParentElementByClass(element, selector) {
        while (element) {
            try {
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
    
    function showChatContextMenu(x, y) {
        if (!chatContextMenu) return;
        
        chatContextMenu.style.left = `${x}px`;
        chatContextMenu.style.top = `${y}px`;
        chatContextMenu.classList.add('active');
    }
    
    function showMessageContextMenu(x, y) {
        if (!messageContextMenu) return;
        
        messageContextMenu.style.left = `${x}px`;
        messageContextMenu.style.top = `${y}px`;
        messageContextMenu.classList.add('active');
    }
    
    function showGroupMemberContextMenu(x, y) {
        if (!groupMemberContextMenu) return;
        
        groupMemberContextMenu.style.left = `${x}px`;
        groupMemberContextMenu.style.top = `${y}px`;
        groupMemberContextMenu.classList.add('active');
    }
    
    function hideContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.classList.remove('active');
        });
    }
    
    function deleteChat() {
        if (!contextMenuTargetChat) return;
        
        if (confirm('Вы уверены, что хотите удалить этот чат?')) {
            fetch(`/api/chats/${contextMenuTargetChat}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (currentChatId === parseInt(contextMenuTargetChat)) {
                        currentChatId = null;
                        messagesContainer.innerHTML = '';
                        messageInputArea.style.display = 'none';
                        emptyChatMessage.style.display = 'flex';
                        chatUsername.textContent = 'Выберите чат';
                        chatProfilePhoto.querySelector('img').src = '/static/images/default-profile.png';
                    }
                    
                    loadChats();
                    
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
        
        hideContextMenus();
    }
    
    function startEditMessage() {
        if (!contextMenuTargetMessage) return;
        
        const messageElement = document.querySelector(`.message[data-message-id="${contextMenuTargetMessage}"]`);
        if (!messageElement) return;
        
        const contentElement = messageElement.querySelector('.content');
        const currentContent = contentElement.textContent;
        
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
        
        messageElement.classList.add('editing');
        
        const editInput = editContainer.querySelector('.edit-input');
        editInput.focus();
        editInput.select();
        
        editInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveEditedMessage(contextMenuTargetMessage, editInput.value);
            }
        });
        
        hideContextMenus();
    }
    
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
                const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
                if (messageElement) {
                    const contentElement = messageElement.querySelector('.content');
                    contentElement.textContent = newContent.trim();
                    
                    if (!messageElement.querySelector('.edited-indicator')) {
                        const editedIndicator = document.createElement('span');
                        editedIndicator.className = 'edited-indicator';
                        editedIndicator.textContent = ' (ред.)';
                        contentElement.appendChild(editedIndicator);
                    }
                    
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
    
    function cancelEditMessage() {
        const messageElement = document.querySelector('.message.editing');
        if (messageElement) {
            messageElement.classList.remove('editing');
        }
    }
    
    function deleteMessage() {
        if (!contextMenuTargetMessage) return;
        
        if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
            fetch(`/api/messages/${contextMenuTargetMessage}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const messageElement = document.querySelector(`.message[data-message-id="${contextMenuTargetMessage}"]`);
                    if (messageElement) {
                        const contentElement = messageElement.querySelector('.content');
                        contentElement.textContent = 'Сообщение удалено';
                        
                        messageElement.classList.add('deleted');
                    }
                    
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
        
        hideContextMenus();
    }
    
    function showCreateGroupModal() {
        resetGroupCreationForm();
        createGroupModal.style.display = 'block';
    }
    
    function resetGroupCreationForm() {
        if (groupName) groupName.value = '';
        if (groupDescription) groupDescription.value = '';
        if (groupPhotoPreview) groupPhotoPreview.src = '/static/images/group-default.png';
        if (groupPhotoInput) groupPhotoInput.value = '';
        selectedMembersForGroup = [];
        
        if (selectedMembers) {
            selectedMembers.innerHTML = '<div class="no-members-selected">Выберите участников для добавления в группу</div>';
        }
        if (groupMembersSearchResults) {
            groupMembersSearchResults.innerHTML = '';
        }
        
        if (groupStep1 && groupStep2) {
            groupStep1.classList.remove('hidden');
            groupStep2.classList.add('hidden');
        }
    }
    
    function searchGroupMembers() {
        const query = groupMemberSearchInput.value.trim();
        if (!query) return;
        
        fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                renderGroupMemberSearchResults(data.users || []);
            })
            .catch(error => {
                console.error('Ошибка при поиске пользователей:', error);
                groupMembersSearchResults.innerHTML = '<p>Произошла ошибка при поиске</p>';
            });
    }
    
    function renderGroupMemberSearchResults(users) {
        groupMembersSearchResults.innerHTML = '';
        
        if (users.length === 0) {
            groupMembersSearchResults.innerHTML = '<p>Пользователи не найдены</p>';
            return;
        }
        
        users.forEach(user => {
            if (selectedMembersForGroup.some(member => member.id === user.id)) {
                return;
            }
            
            const userItem = document.createElement('div');
            userItem.className = 'search-result-item';
            
            userItem.innerHTML = `
                <div class="avatar">
                    <img src="${user.photo || '/static/images/default-profile.png'}" alt="Фото профиля">
                </div>
                <div class="username">${user.nickname}</div>
            `;
            
            userItem.addEventListener('click', function() {
                addMemberToGroup(user);
            });
            
            groupMembersSearchResults.appendChild(userItem);
        });
    }
    
    function addMemberToGroup(user) {
        selectedMembersForGroup.push(user);
        
        updateSelectedMembersUI();
        
        groupMemberSearchInput.value = '';
        groupMembersSearchResults.innerHTML = '';
    }
    
    function updateSelectedMembersUI() {
        selectedMembers.innerHTML = '';
        
        if (selectedMembersForGroup.length === 0) {
            selectedMembers.innerHTML = '<div class="no-members-selected">Выберите участников для добавления в группу</div>';
            return;
        }
        
        selectedMembersForGroup.forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'selected-member';
            memberItem.innerHTML = `
                <span>${member.nickname}</span>
                <span class="material-icons remove-btn" data-user-id="${member.id}">close</span>
            `;
            
            memberItem.querySelector('.remove-btn').addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                selectedMembersForGroup = selectedMembersForGroup.filter(m => m.id != userId);
                updateSelectedMembersUI();
            });
            
            selectedMembers.appendChild(memberItem);
        });
    }
    
    function createGroup() {
        if (selectedMembersForGroup.length === 0) {
            alert('Выберите хотя бы одного участника для группы');
            return;
        }
        
        const groupNameValue = groupName.value.trim();
        if (!groupNameValue) {
            alert('Название группы не может быть пустым');
            return;
        }
        
        const formData = new FormData();
        formData.append('group_name', groupNameValue);
        formData.append('description', groupDescription.value.trim());
        
        if (groupPhotoInput.files && groupPhotoInput.files[0]) {
            formData.append('group_photo', groupPhotoInput.files[0]);
        }
        
        selectedMembersForGroup.forEach(member => {
            formData.append('members[]', member.id);
        });
        
        fetch('/api/groups', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                createGroupModal.style.display = 'none';
                
                loadChats();
                
                resetGroupCreationForm();
                
                setTimeout(() => {
                    const newChatItem = document.querySelector(`[data-chat-id="${data.group.id}"]`);
                    if (newChatItem) {
                        newChatItem.click();
                    }
                }, 500);
            } else {
                alert('Ошибка при создании группы: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при создании группы:', error);
            alert('Произошла ошибка при создании группы');
        });
    }
    
    function showGroupInfo() {
        if (!currentChatId || currentChatType !== 'group') return;
        
        fetch(`/api/groups/${currentChatId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    currentGroupInfo = data.group;
                    
                    groupInfoPhoto.src = data.group.photo_url || '/static/images/group-default.png';
                    groupInfoName.textContent = data.group.name;
                    groupInfoDescription.textContent = data.group.description || 'Нет описания';
                    groupMemberCount.textContent = data.group.members.length;
                    
                    renderGroupMembers(data.group.members, data.group.current_user_role);
                    
                    groupInfoModal.style.display = 'block';
                } else {
                    alert('Ошибка при загрузке информации о группе: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при загрузке информации о группе:', error);
                alert('Произошла ошибка при загрузке информации о группе');
            });
    }
    
    function renderGroupMembers(members, currentUserRole) {
        groupMembersList.innerHTML = '';
        
        members.forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'group-member-item';
            memberItem.setAttribute('data-user-id', member.id);
            
            if (member.role === 'admin') {
                memberItem.classList.add('admin');
            }
            
            memberItem.innerHTML = `
                <div class="member-avatar">
                    <img src="${member.photo_url || '/static/images/default-profile.png'}" alt="Фото участника">
                </div>
                <div class="member-info">
                    <div class="member-name">${member.nickname}</div>
                    <div class="member-role">${member.role === 'admin' ? 'Администратор' : 'Участник'}</div>
                </div>
            `;
            
            if (currentUserRole === 'admin' && !member.is_creator) {
                memberItem.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    contextMenuTargetMember = member.id;
                    
                    if (member.role === 'admin') {
                        makeAdminMenuItem.style.display = 'none';
                    } else {
                        makeAdminMenuItem.style.display = 'flex';
                    }
                    
                    groupMemberContextMenu.style.left = `${e.clientX}px`;
                    groupMemberContextMenu.style.top = `${e.clientY}px`;
                    groupMemberContextMenu.classList.add('active');
                });
            }
            
            groupMembersList.appendChild(memberItem);
        });
    }
    
    function makeGroupAdmin() {
        if (!contextMenuTargetMember || !currentChatId) return;
        
        fetch(`/api/groups/${currentChatId}/members/${contextMenuTargetMember}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role: 'admin'
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showGroupInfo();
            } else {
                alert('Ошибка: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при изменении роли:', error);
            alert('Произошла ошибка при изменении роли участника');
        });
        
        hideContextMenus();
    }
    
    function removeGroupMember() {
        if (!contextMenuTargetMember || !currentChatId) return;
        
        if (confirm('Вы уверены, что хотите удалить этого участника из группы?')) {
            fetch(`/api/groups/${currentChatId}/members/${contextMenuTargetMember}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showGroupInfo();
                } else {
                    alert('Ошибка: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при удалении участника:', error);
                alert('Произошла ошибка при удалении участника');
            });
        }
        
        hideContextMenus();
    }
});
