import { setupMessageHandlers, setupReplyUI, hideReplyUI, getReplyingToMessage, handleMessageClick, clearMessageSelection } from './messageHandlers.js';
import { initializeSocket, joinConversation } from './socket.js';
import { showProfile } from './profile.js'; // Импортируем showProfile

let currentConversationId = null;
let currentUserId = null;
let conversations = [];

export {
    currentConversationId,
    currentUserId,
    conversations,
    loadConversations,
    loadConversation,
    createMessageElement,
    updateMessageReadStatus // Export the new function
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    console.log('Token found in localStorage:', token ? 'Yes' : 'No');

    // Объявляем все секции один раз в начале
    const welcomeSection = document.getElementById('welcome');
    const signinSection = document.getElementById('signin');
    const signupSection = document.getElementById('signup');
    const chatSection = document.getElementById('chat');
    const profileSection = document.getElementById('profile');

    // Welcome screen button handlers
    const welcomeSigninBtn = document.getElementById('welcome-signin-btn');
    const welcomeSignupBtn = document.getElementById('welcome-signup-btn');

    if (welcomeSigninBtn) {
        welcomeSigninBtn.addEventListener('click', () => {
            welcomeSection.classList.add('hidden');
            signinSection.classList.remove('hidden');
        });
    }

    if (welcomeSignupBtn) {
        welcomeSignupBtn.addEventListener('click', () => {
            welcomeSection.classList.add('hidden');
            signupSection.classList.remove('hidden');
        });
    }

    if (!token) {
        // Show welcome screen, hide others
        welcomeSection.classList.remove('hidden');
        signinSection.classList.add('hidden');
        signupSection.classList.add('hidden');
        chatSection.classList.add('hidden');
        console.log('No token found, showing welcome page');
        return;
    }

    try {
        console.log('Validating token...');
        const userResponse = await fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!userResponse.ok) {
            console.error('Token validation failed:', userResponse.status, userResponse.statusText);
            localStorage.removeItem('token');
            welcomeSection.classList.remove('hidden');
            signinSection.classList.add('hidden');
            signupSection.classList.add('hidden');
            chatSection.classList.add('hidden');
            Toastify({
                text: "Сессия истекла. Пожалуйста, войдите снова.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#F44336" },
            }).showToast();
            return;
        }

        const userData = await userResponse.json();
        currentUserId = userData.id;
        console.log('Current user:', userData);

        welcomeSection.classList.add('hidden');
        signinSection.classList.add('hidden');
        signupSection.classList.add('hidden');
        chatSection.classList.remove('hidden');

        if (typeof initializeSocket === 'function') {
            initializeSocket();
        }

        await loadConversations();
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        localStorage.removeItem('token');
        welcomeSection.classList.remove('hidden');
        signinSection.classList.add('hidden');
        signupSection.classList.add('hidden');
        chatSection.classList.add('hidden');
        Toastify({
            text: "Сессия истекла. Пожалуйста, войдите снова.",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            style: { background: "#F44336" },
        }).showToast();
        return;
    }

    const searchInput = document.getElementById('chat-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filteredConversations = conversations.filter(conv =>
            (conv.name || 'Chat').toLowerCase().includes(query)
        );
        renderChatList(filteredConversations);
        if (filteredConversations.length === 0 && query.length >= 3) {
            console.log("Чаты по запросу не найдены");
        }
    });

    // New Conversation Modal
    const newConversationModal = document.getElementById('new-conversation-modal');
    const newConversationBtn = document.getElementById('new-conversation-btn');
    const menuModal = document.getElementById('menu-modal');
    const menuBtn = document.getElementById('menu-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Закрытие модальных окон при клике вне их
    document.addEventListener('click', (e) => {
        if (
            newConversationModal &&
            !newConversationModal.classList.contains('hidden') &&
            !newConversationModal.contains(e.target) &&
            e.target !== newConversationBtn
        ) {
            newConversationModal.classList.add('hidden');
        }

        if (
            menuModal &&
            !menuModal.classList.contains('hidden') &&
            !menuModal.contains(e.target) &&
            e.target !== menuBtn
        ) {
            menuModal.classList.add('hidden');
        }
    });

    if (newConversationBtn && newConversationModal) {
        newConversationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            newConversationModal.classList.remove('hidden');
        });
    }

    if (menuBtn && menuModal) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Кнопка меню нажата, переключение menu-modal. Текущее состояние:', menuModal.classList.contains('hidden'));
            menuModal.classList.toggle('hidden');
            console.log('Новое состояние:', menuModal.classList.contains('hidden'));
        });
    }

    // Обработчик для кнопки Log out
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            chatSection.classList.add('hidden');
            welcomeSection.classList.remove('hidden');
            menuModal.classList.add('hidden'); // Закрываем модальное окно
            Toastify({
                text: "Вы успешно вышли.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#4CAF50" },
            }).showToast();
        });
    }

    // Обработчик для кнопки Profile
    const myProfileBtn = document.getElementById('my-profile-btn');
    if (myProfileBtn && menuModal) {
        myProfileBtn.addEventListener('click', () => {
            menuModal.classList.add('hidden');
            chatSection.classList.add('hidden');
            profileSection.classList.remove('hidden');

            if (typeof showProfile === 'function') {
                console.log('Вызов showProfile с userId:', currentUserId);
                showProfile(currentUserId);
            } else {
                console.warn('Функция showProfile не найдена. Убедитесь, что profile.js загружен и определяет эту функцию.');
            }
        });
    }

    // Обработчик клика на conversation-header для отображения профиля собеседника
    const conversationHeader = document.getElementById('conversation-header');
    if (conversationHeader) {
        console.log('Заголовок беседы найден, добавляем обработчик клика');
        conversationHeader.addEventListener('click', async () => {
            console.log('Клик по заголовку беседы, currentConversationId:', currentConversationId);

            if (!currentConversationId) {
                console.log('Беседа не выбрана');
                Toastify({
                    text: "Беседа не выбрана.",
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    style: { background: "#F44336" },
                }).showToast();
                return;
            }

            const conversation = conversations.find(conv => conv.id === currentConversationId);
            if (!conversation) {
                console.log('Беседа не найдена в списке conversations:', conversations);
                Toastify({
                    text: "Беседа не найдена.",
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    style: { background: "#F44336" },
                }).showToast();
                return;
            }

            console.log('Найдена беседа:', conversation);

            // Определяем, является ли это личным чатом (ровно 2 участника)
            let otherParticipantId = null;
            const participants = conversation.participants || [];
            console.log('Участники беседы:', participants);
            console.log('Текущий пользователь ID:', currentUserId);

            // Получаем имя текущего пользователя (например, 'isma2')
            let currentUsername = null;
            try {
                const userResponse = await fetch('/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const userData = await userResponse.json();
                currentUsername = userData.username;
                console.log('Текущий пользователь:', currentUsername);
            } catch (error) {
                console.error('Ошибка получения имени текущего пользователя:', error);
                return;
            }

            // Проверяем, является ли это личным чатом (2 участника)
            if (participants.length === 2) {
                const otherParticipantUsername = participants.find(username => username !== currentUsername);
                console.log('Имя другого участника:', otherParticipantUsername);

                // Запрашиваем ID другого участника по имени
                try {
                    const response = await fetch(`/auth/user/${otherParticipantUsername}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        throw new Error('Не удалось получить ID пользователя');
                    }
                    const userData = await response.json();
                    otherParticipantId = userData.id;
                    console.log('ID другого участника:', otherParticipantId);
                } catch (error) {
                    console.error('Ошибка получения ID другого участника:', error);
                    Toastify({
                        text: "Не удалось загрузить профиль пользователя.",
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        style: { background: "#F44336" },
                    }).showToast();
                    return;
                }
            }

            if (!otherParticipantId) {
                console.log('Не удалось определить другого участника, возможно, это групповой чат');
                Toastify({
                    text: "Пока нельзя отобразить профиль для групповых чатов.",
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    style: { background: "#F44336" },
                }).showToast();
                return;
            }

            console.log('Скрываем секцию чата и показываем секцию профиля');
            chatSection.classList.add('hidden');
            profileSection.classList.remove('hidden');

            if (typeof showProfile === 'function') {
                console.log('Загрузка профиля для пользователя:', otherParticipantId);
                showProfile(otherParticipantId);
            } else {
                console.warn('Функция showProfile не найдена. Убедитесь, что profile.js загружен и определяет эту функцию.');
                Toastify({
                    text: "Функция загрузки профиля не найдена.",
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    style: { background: "#F44336" },
                }).showToast();
            }
        });
    } else {
        console.error('Заголовок беседы не найден в DOM');
    }

    // New Chat Modal
    const newChatModal = document.getElementById('new-chat-modal');
    const newChatBtn = document.getElementById('new-chat-btn');
    const newChatCancel = document.getElementById('new-chat-cancel');
    const newChatCreate = document.getElementById('new-chat-create');
    const newChatUsernameInput = document.getElementById('new-chat-username');
    const userSuggestions = document.getElementById('user-suggestions');
    const replyContainer = document.getElementById('reply-container');
    const cancelReplyBtn = document.getElementById('cancel-reply');
    let selectedUserId = null;

    if (newChatBtn && newChatModal) {
        newChatBtn.addEventListener('click', () => {
            newConversationModal.classList.add('hidden');
            newChatModal.classList.remove('hidden');
            if (newChatUsernameInput) {
                newChatUsernameInput.value = '';
            }
            if (userSuggestions) {
                userSuggestions.innerHTML = '';
            }
            selectedUserId = null;
        });
    }

    if (newChatCancel) {
        newChatCancel.addEventListener('click', () => {
            newChatModal.classList.add('hidden');
        });
    }

    let searchTimeout;
    newChatUsernameInput.addEventListener('input', async () => {
        clearTimeout(searchTimeout);
        const query = newChatUsernameInput.value.trim();
        userSuggestions.innerHTML = '<div class="p-2 text-gray-500">Поиск...</div>';
        searchTimeout = setTimeout(async () => {
            if (query.length > 1) {
                try {
                    const response = await fetch(`/auth/users/search?query=${query}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        throw new Error('Не удалось найти пользователей');
                    }
                    const users = await response.json();
                    userSuggestions.innerHTML = '';
                    if (users.length === 0) {
                        userSuggestions.innerHTML = '<div class="p-2 text-gray-500">Пользователи не найдены.</div>';
                        return;
                    }
                    users.forEach(user => {
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.classList.add('user-suggestion');
                        suggestionDiv.textContent = user.username;
                        suggestionDiv.addEventListener('click', () => {
                            newChatUsernameInput.value = user.username;
                            selectedUserId = user.id;
                            userSuggestions.innerHTML = '';
                        });
                        userSuggestions.appendChild(suggestionDiv);
                    });
                } catch (error) {
                    console.error('Ошибка поиска пользователей:', error);
                    userSuggestions.innerHTML = '';
                    Toastify({
                        text: "Не удалось найти пользователей.",
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        style: { background: "#F44336" },
                    }).showToast();
                }
            } else {
                userSuggestions.innerHTML = '';
            }
        }, 300);
    });

    newChatCreate.addEventListener('click', async () => {
        if (!selectedUserId) {
            Toastify({
                text: "Пожалуйста, выберите пользователя для начала чата.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#F44336" },
            }).showToast();
            return;
        }

        try {
            const response = await fetch('/chat/conversations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: null,
                    participant_ids: [currentUserId, selectedUserId]
                })
            });

            if (!response.ok) {
                throw new Error('Не удалось создать чат');
            }

            const data = await response.json();
            newChatModal.classList.add('hidden');
            await loadConversations();

            if (data.conversation_id) {
                loadConversation(data.conversation_id);
            }

            Toastify({
                text: "Чат успешно создан!",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#4CAF50" },
            }).showToast();
        } catch (error) {
            console.error('Ошибка создания чата:', error);
            Toastify({
                text: "Не удалось создать чат. Попробуйте снова.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#F44336" },
            }).showToast();
        }
    });

    // New Group Modal
    const newGroupModal = document.getElementById('new-group-modal');
    const newGroupBtn = document.getElementById('new-group-btn');
    const newGroupCancel = document.getElementById('new-group-cancel');
    const newGroupCreate = document.getElementById('new-group-create');

    if (newGroupBtn && newGroupModal) {
        newGroupBtn.addEventListener('click', () => {
            newConversationModal.classList.add('hidden');
            newGroupModal.classList.remove('hidden');
        });
    }

    if (newGroupCancel) {
        newGroupCancel.addEventListener('click', () => {
            newGroupModal.classList.add('hidden');
        });
    }

    newGroupCreate.addEventListener('click', async () => {
        const groupName = document.getElementById('new-group-name').value.trim();
        const usernames = document.getElementById('new-group-usernames').value.split(',').map(u => u.trim()).filter(u => u);
        if (!groupName || usernames.length < 1) {
            Toastify({
                text: "Введите название группы и хотя бы одно имя пользователя.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#F44336" },
            }).showToast();
            return;
        }

        const participantIds = [];
        for (const username of usernames) {
            const userResponse = await fetch(`/auth/user/${username}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!userResponse.ok) {
                Toastify({
                    text: `Пользователь "${username}" не найден.`,
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    style: { background: "#F44336" },
                }).showToast();
                return;
            }
            const userData = await userResponse.json();
            participantIds.push(userData.id);
        }
        participantIds.push(currentUserId);

        const response = await fetch('/chat/conversations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: groupName,
                participant_ids: participantIds
            })
        });
        if (response.ok) {
            newGroupModal.classList.add('hidden');
            await loadConversations();
            Toastify({
                text: "Группа успешно создана!",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#4CAF50" },
            }).showToast();
        } else {
            Toastify({
                text: "Не удалось создать группу. Попробуйте снова.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#F44336" },
            }).showToast();
        }
    });

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            hideReplyUI();
        });
    }

    setupMessageHandlers();
});

async function loadConversations() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Токен для загрузки бесед отсутствует');
            throw new Error('Нет токена авторизации');
        }

        console.log('Получение бесед с токеном...');
        const response = await fetch('/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.error('Не удалось загрузить беседы:', response.status, response.statusText);
            if (response.status === 401) {
                localStorage.removeItem('token');
                document.getElementById('chat').classList.add('hidden');
                document.getElementById('welcome').classList.remove('hidden');
                Toastify({
                    text: "Сессия истекла. Пожалуйста, войдите снова.",
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    style: { background: "#F44336" },
                }).showToast();
            }
            throw new Error('Не удалось загрузить беседы');
        }

        conversations = await response.json();
        console.log('Загруженные беседы:', conversations);
        renderChatList(conversations);

        if (currentConversationId) {
            const conversationExists = conversations.some(conv => conv.id === currentConversationId);
            if (conversationExists) {
                loadConversation(currentConversationId);
            } else if (conversations.length > 0) {
                loadConversation(conversations[0].id);
            }
        } else if (conversations.length > 0 && !document.getElementById('message-list').hasChildNodes()) {
            loadConversation(conversations[0].id);
        }
    } catch (error) {
        console.error('Ошибка загрузки бесед:', error);
        if (!error.message.includes('authentication token') && !error.message.includes('expired')) {
            Toastify({
                text: "Не удалось загрузить беседы. Попробуйте обновить страницу.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                style: { background: "#F44336" },
            }).showToast();
        }
    }
}

function renderChatList(convList) {
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = '';

    if (convList.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.classList.add('p-3', 'text-gray-300', 'text-center');
        emptyMessage.textContent = 'Пока нет бесед. Начните новый чат!';
        chatList.appendChild(emptyMessage);
        return;
    }

    convList.forEach(conv => {
        const chatItem = document.createElement('div');
        chatItem.classList.add('flex', 'items-center', 'p-3', 'hover:bg-[#5A4A40]', 'cursor-pointer', 'rounded-lg');

        if (conv.id === currentConversationId) {
            chatItem.classList.add('bg-blue-600');
        }

        // Use the actual unread count from the backend
        const unreadCount = conv.unread_count || 0;

        chatItem.innerHTML = `
            <img src="https://picsum.photos/seed/${conv.id}/40" alt="Profile" class="w-10 h-10 rounded-full mr-3">
            <div class="flex-1">
                <h4 class="font-bold text-gray-800">${conv.name || 'Chat'}</h4>
                <p class="text-sm text-gray-500">${conv.last_message || 'Сообщений пока нет'}</p>
            </div>
            ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
        `;
        chatItem.addEventListener('click', () => loadConversation(conv.id));
        chatList.appendChild(chatItem);
    });
}

async function loadConversation(conversationId) {
    try {
        currentConversationId = conversationId;

        if (typeof initializeSocket === 'function') {
            initializeSocket();
        }

        if (typeof joinConversation === 'function') {
            joinConversation(conversationId);
        }

        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Нет токена авторизации');
        }

        // Fetch messages
        const response = await fetch(`/chat/messages/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Не удалось загрузить сообщения');
        }

        const messages = await response.json();
        console.log('Получены сообщения для беседы', conversationId, messages);

        const messageList = document.getElementById('message-list');
        messageList.innerHTML = '';

        if (messages.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.classList.add('p-3', 'text-gray-500', 'text-center', 'w-full', 'system-message');
            emptyMessage.textContent = 'Сообщений пока нет. Начните общение!';
            messageList.appendChild(emptyMessage);
        } else {
            messages.forEach(msg => {
                const messageDiv = createMessageElement(msg);
                messageList.appendChild(messageDiv);
            });
        }

        messageList.scrollTop = messageList.scrollHeight;

        const conv = conversations.find(c => c.id === conversationId);
        document.getElementById('conversation-name').textContent = conv ? (conv.name || 'Chat') : 'Chat';

        // Mark conversation as read *after* successfully loading messages
        try {
            const markReadResponse = await fetch(`/chat/conversations/${conversationId}/mark_read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (markReadResponse.ok) {
                console.log(`Conversation ${conversationId} marked as read.`);
                // Update the local conversation data immediately
                const updatedConv = conversations.find(c => c.id === conversationId);
                if (updatedConv) {
                    updatedConv.unread_count = 0;
                }
                // Re-render the chat list with the updated local data
                renderChatList(conversations);
            } else {
                console.error('Failed to mark conversation as read:', markReadResponse.status);
            }
        } catch (markReadError) {
            console.error('Error marking conversation as read:', markReadError);
        }

        // Ensure the current chat is highlighted (renderChatList handles this)

        document.getElementById('message-input').focus();
    } catch (error) {
        console.error('Ошибка загрузки беседы:', error);
        // Handle error appropriately, maybe show a toast message
    }
}

function createMessageElement(msg) {
    if (!msg) return null;

    const messageDiv = document.createElement('div');
    const isOwnMessage = msg.sender_id === currentUserId;

    const classes = [
        'message',
        'p-3',
        'mb-2',
        'rounded-lg',
        isOwnMessage ? 'self-end' : 'self-start',
        'relative'
    ];

    if (msg.is_deleted) {
        classes.push('deleted');
    }

    classes.forEach(className => {
        if (className) messageDiv.classList.add(className);
    });

    messageDiv.dataset.senderId = msg.sender_id;
    messageDiv.dataset.messageId = msg.id;

    if (msg.replied_to_id && msg.replied_to_content) {
        const replyBox = document.createElement('div');
        replyBox.className = 'reply-box mb-2 p-2 rounded text-sm';
        replyBox.classList.add(isOwnMessage ? 'bg-blue-600' : 'bg-gray-400');

        let repliedToUserText = 'Кто-то';
        if (msg.replied_to_sender === currentUserId) {
            repliedToUserText = 'ваше сообщение';
        } else if (msg.replied_to_username) {
            repliedToUserText = msg.replied_to_username;
        }

        replyBox.innerHTML = `
            <div class="flex items-center gap-1 mb-1">
                <svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
                <span class="font-bold">Ответ на ${repliedToUserText}:</span>
            </div>
            <div class="pl-3 border-l-2 border-white border-opacity-70">
                "${msg.replied_to_content || '[удалённое сообщение]'}"
            </div>
        `;

        replyBox.addEventListener('click', (e) => {
            e.stopPropagation();
            const originalMsg = document.querySelector(`[data-message-id="${msg.replied_to_id}"]`);
            if (originalMsg) {
                originalMsg.classList.add('highlight');
                setTimeout(() => originalMsg.classList.remove('highlight'), 2000);
                originalMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        messageDiv.appendChild(replyBox);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content mr-10'; // Add margin for status icon
    contentDiv.textContent = msg.is_deleted ? "[Сообщение удалено]" : msg.content;
    messageDiv.appendChild(contentDiv);

    // Add timestamp and read status container
    const statusContainer = document.createElement('div');
    statusContainer.className = 'absolute bottom-1 right-2 flex items-center space-x-1';

    if (msg.timestamp) {
        const timeSpan = document.createElement('span');
        // Make timestamp slightly smaller
        timeSpan.className = 'text-xs opacity-70';
        const date = new Date(msg.timestamp);
        timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        statusContainer.appendChild(timeSpan);
    }

    // Add read status icon for own messages
    if (isOwnMessage && !msg.is_deleted) {
        const statusIcon = document.createElement('span');
        statusIcon.className = 'message-status-icon';
        statusIcon.innerHTML = msg.read_at
            ? '&#10004;&#10004;' // Double checkmark for read
            : '&#10004;'; // Single checkmark for sent/delivered
        // Style the checkmarks
        statusIcon.style.fontSize = '0.7rem';
        statusIcon.style.color = msg.read_at ? '#4ade80' : 'inherit'; // Green for read
        statusContainer.appendChild(statusIcon);
    }

    messageDiv.appendChild(statusContainer);

    if (!msg.is_deleted) {
        messageDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMessageClick(e, messageDiv);
        });
    }

    return messageDiv;
}

// Function to update read status icons for specific messages
function updateMessageReadStatus(messageIds) {
    if (!Array.isArray(messageIds)) return;

    messageIds.forEach(messageId => {
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            const statusIcon = messageElement.querySelector('.message-status-icon');
            if (statusIcon) {
                statusIcon.innerHTML = '&#10004;&#10004;'; // Double checkmark
                statusIcon.style.color = '#4ade80'; // Green color
            }
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.message') && !e.target.closest('.floating-actions-menu')) {
        clearMessageSelection();
    }
});

async function deleteMessage(messageId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                messageEl.classList.add('deleted');
                messageEl.textContent = "[Сообщение удалено]";
            }
            if (socket && socket.connected) {
                socket.emit('delete_message', { message_id: messageId });
            }
        }
    } catch (error) {
        console.error("Ошибка удаления сообщения:", error);
    }
}

function createMessageData(content) {
    const messageData = {
        conversation_id: currentConversationId,
        sender_id: currentUserId,
        content: content
    };

    const replyingTo = getReplyingToMessage();
    if (replyingTo) {
        messageData.replied_to_id = replyingTo.id;
    }

    return messageData;
}

document.getElementById('send-btn').addEventListener('click', () => {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();

    if (!content) return;

    const messageData = createMessageData(content);

    if (!currentConversationId) {
        Toastify({
            text: "Сначала выберите беседу",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            style: { background: "#F44336" },
        }).showToast();
        return;
    }

    if (!initializeSocket()) {
        Toastify({
            text: "Не удалось подключиться к серверу. Проверьте соединение.",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            style: { background: "#F44336" },
        }).showToast();
        return;
    }

    if (!socket.connected) {
        console.log('Сокет не подключён. Ожидаем подключения...');

        if (!socket.pendingMessages) {
            socket.pendingMessages = [];
        }

        socket.pendingMessages.push({
            conversation_id: currentConversationId,
            content: content,
            replied_to_id: getReplyingToMessage()?.id
        });

        Toastify({
            text: "Подключение к серверу...",
            duration: 2000,
            close: true,
            gravity: "top",
            position: "right",
            style: { background: "#FFA500" },
        }).showToast();

        const messageList = document.getElementById('message-list');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', 'self-end', 'opacity-50');

        if (getReplyingToMessage()) {
            const replyDiv = document.createElement('div');
            replyDiv.classList.add('reply-preview', 'text-xs', 'mb-1', 'p-1', 'rounded');
            replyDiv.textContent = `↩ ${getReplyingToMessage().content.substring(0, 50)}...`;
            messageDiv.appendChild(replyDiv);
        }

        const contentDiv = document.createElement('div');
        contentDiv.textContent = content + " (отправка...)";
        messageDiv.appendChild(contentDiv);

        messageDiv.dataset.senderId = currentUserId;
        messageDiv.dataset.pending = true;
        messageList.appendChild(messageDiv);
        messageList.scrollTop = messageList.scrollHeight;
        messageInput.value = '';

        hideReplyUI();
        return;
    }

    console.log('Отправка сообщения:', messageData);

    socket.emit('message', messageData);
    messageInput.value = '';

    hideReplyUI();
});