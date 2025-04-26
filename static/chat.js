import { setupMessageHandlers, setupReplyUI, hideReplyUI, getReplyingToMessage, handleMessageClick, clearMessageSelection } from './messageHandlers.js';
import { initializeSocket, joinConversation } from './socket.js';

let currentConversationId = null;
let currentUserId = null;
let conversations = [];

export {
    currentConversationId,
    currentUserId,
    conversations,
    loadConversations,
    loadConversation,
    createMessageElement
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    console.log('Token found in localStorage:', token ? 'Yes' : 'No');

    if (!token) {
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        console.log('No token found, showing signin page');
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
            document.getElementById('chat').classList.add('hidden');
            document.getElementById('signin').classList.remove('hidden');
            Toastify({
                text: "Session expired. Please sign in again.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
            }).showToast();
            return;
        }

        const userData = await userResponse.json();
        currentUserId = userData.id;
        console.log('Current user:', userData);

        document.getElementById('signin').classList.add('hidden');
        document.getElementById('signup').classList.add('hidden');
        document.getElementById('chat').classList.remove('hidden');

        if (typeof initializeSocket === 'function') {
            initializeSocket();
        }

        await loadConversations();
    } catch (error) {
        console.error('Authentication error:', error);
        localStorage.removeItem('token');
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        Toastify({
            text: "Session expired. Please sign in again.",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#F44336",
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
            console.log("No chats found matching search criteria");
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
    // Определение всех модальных окон и кнопок
    const newConversationModal = document.getElementById('new-conversation-modal');
    const newConversationBtn = document.getElementById('new-conversation-btn');
    const newConversationModalClose = document.getElementById('new-conversation-modal-close');
    const newChatModal = document.getElementById('new-chat-modal');
    const newChatBtn = document.getElementById('new-chat-btn');
    const newChatCancel = document.getElementById('new-chat-cancel');
    const newGroupModal = document.getElementById('new-group-modal');
    const newGroupBtn = document.getElementById('new-group-btn');
    const newGroupCancel = document.getElementById('new-group-cancel');
    const menuModal = document.getElementById('menu-modal');
    const menuBtn = document.getElementById('menu-btn');
    const menuModalClose = document.getElementById('menu-modal-close');
    const logoutBtn = document.getElementById('logoutBtn');
    const myProfileBtn = document.getElementById('my-profile-btn');

    // Закрытие модальных окон при клике вне их
    document.addEventListener('click', (e) => {
    if (
        newConversationModal &&
        !newConversationModal.classList.contains('hidden') &&
        !newConversationModal.contains(e.target) &&
        e.target !== newConversationBtn &&
        e.target !== newChatBtn &&
        e.target !== newGroupBtn
    ) {
        newConversationModal.classList.add('hidden');
    }

    if (
        newChatModal &&
        !newChatModal.classList.contains('hidden') &&
        !newChatModal.contains(e.target) &&
        e.target !== newChatBtn
    ) {
        newChatModal.classList.add('hidden');
    }

    if (
        newGroupModal &&
        !newGroupModal.classList.contains('hidden') &&
        !newGroupModal.contains(e.target) &&
        e.target !== newGroupBtn
    ) {
        newGroupModal.classList.add('hidden');
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

    // Открытие модального окна New Conversation
    if (newConversationBtn && newConversationModal) {
    newConversationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        newConversationModal.classList.remove('hidden');
    });
    }

    // Закрытие модального окна New Conversation по кнопке крестика
    if (newConversationModalClose) {
    newConversationModalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        newConversationModal.classList.add('hidden');
    });
    }

    // Открытие модального окна Menu
    if (menuBtn && menuModal) {
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Menu button clicked, toggling menu-modal. Current state:', menuModal.classList.contains('hidden'));
        menuModal.classList.toggle('hidden');
        console.log('New state:', menuModal.classList.contains('hidden'));
    });
    }

    // Закрытие модального окна Menu по кнопке крестика
    if (menuModalClose) {
    menuModalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        menuModal.classList.add('hidden');
    });
    }

    // Обработчик для кнопки Log out
    if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        menuModal.classList.add('hidden'); // Закрываем модальное окно
        Toastify({
        text: "Logged out successfully.",
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "#4CAF50",
        }).showToast();
    });
    }

    // Закрытие модального окна Menu после клика на Profile
    if (myProfileBtn && menuModal) {
    myProfileBtn.addEventListener('click', () => {
        menuModal.classList.add('hidden');
    });
    }

    // New Chat Modal
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

    // New Group Modal
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

    const myProfileBtn = document.getElementById('my-profile-btn');

if (myProfileBtn && menuModal) {
  myProfileBtn.addEventListener('click', () => {
    menuModal.classList.add('hidden');
  });
}
if (menuBtn && menuModal) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Menu button clicked, toggling menu-modal. Current state:', menuModal.classList.contains('hidden'));
      menuModal.classList.toggle('hidden');
      console.log('New state:', menuModal.classList.contains('hidden'));
    });
  }

    // Обработчик для кнопки Log out
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        Toastify({
            text: "Logged out successfully.",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#4CAF50",
        }).showToast();
        });
    }

    // Обработчик для кнопки Profile
    const profileBtn = document.getElementById('profile-btn');
    const chatSection = document.getElementById('chat');
    const profileSection = document.getElementById('profile');

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
          console.log('Profile button clicked, currentUserId:', currentUserId);
          menuModal.classList.add('hidden');
          
          if (chatSection && profileSection) {
            chatSection.classList.add('hidden');
            profileSection.classList.remove('hidden');
            
            if (typeof loadProfile === 'function') {
              console.log('Calling loadProfile with userId:', currentUserId);
              loadProfile(currentUserId);
            } else {
              console.warn('loadProfile function not found. Make sure profile.js is loaded and defines this function.');
            }
          } else {
            console.error('Chat or profile section not found');
          }
        });
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
        userSuggestions.innerHTML = '<div class="p-2 text-gray-500">Searching...</div>';
        searchTimeout = setTimeout(async () => {
            if (query.length > 1) {
                try {
                    const response = await fetch(`/auth/users/search?query=${query}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        throw new Error('Failed to search users');
                    }
                    const users = await response.json();
                    userSuggestions.innerHTML = '';
                    if (users.length === 0) {
                        userSuggestions.innerHTML = '<div class="p-2 text-gray-500">No users found.</div>';
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
                    console.error('Error searching users:', error);
                    userSuggestions.innerHTML = '';
                    Toastify({
                        text: "Failed to search users.",
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "#F44336",
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
                text: "Please select a user to start a chat.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
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
                throw new Error('Failed to create chat');
            }

            const data = await response.json();
            newChatModal.classList.add('hidden');
            await loadConversations();

            if (data.conversation_id) {
                loadConversation(data.conversation_id);
            }

            Toastify({
                text: "Chat created successfully!",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#4CAF50",
            }).showToast();
        } catch (error) {
            console.error('Error creating chat:', error);
            Toastify({
                text: "Failed to create chat. Please try again.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
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
                text: "Please enter a group name and at least one username.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
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
                    text: `User "${username}" not found.`,
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "#F44336",
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
                text: "Group created successfully!",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#4CAF50",
            }).showToast();
        } else {
            Toastify({
                text: "Failed to create group. Please try again.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
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
            console.error('No token available for loading conversations');
            throw new Error('No authentication token');
        }

        console.log('Fetching conversations with token...');
        const response = await fetch('/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.error('Failed to load conversations:', response.status, response.statusText);
            if (response.status === 401) {
                localStorage.removeItem('token');
                document.getElementById('chat').classList.add('hidden');
                document.getElementById('signin').classList.remove('hidden');
                Toastify({
                    text: "Session expired. Please sign in again.",
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "#F44336",
                }).showToast();
            }
            throw new Error('Failed to load conversations');
        }

        conversations = await response.json();
        console.log('Loaded conversations:', conversations);
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
        console.error('Error loading conversations:', error);
        if (!error.message.includes('authentication token') && !error.message.includes('expired')) {
            Toastify({
                text: "Failed to load conversations. Please try refreshing the page.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
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
        emptyMessage.textContent = 'No conversations yet. Start a new chat!';
        chatList.appendChild(emptyMessage);
        return;
    }

    convList.forEach(conv => {
        const chatItem = document.createElement('div');
        chatItem.classList.add('flex', 'items-center', 'p-3', 'hover:bg-[#5A4A40]', 'cursor-pointer', 'rounded-lg');

        if (conv.id === currentConversationId) {
            chatItem.classList.add('bg-blue-600');
        }

        chatItem.innerHTML = `
            <img src="https://picsum.photos/seed/${conv.id}/40" alt="Profile" class="w-10 h-10 rounded-full mr-3">
            <div class="flex-1">
                <h4 class="font-bold text-gray-800">${conv.name || 'Chat'}</h4>
                <p class="text-sm text-gray-500">${conv.last_message || 'No messages yet'}</p>
            </div>
            <span class="unread-count">1</span>
        `;
        chatItem.addEventListener('click', () => loadConversation(conv.id));
        chatList.appendChild(chatItem);
    });

    console.log('Selected chat ID:', currentConversationId, 'Applied class:', chatItem.classList);
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
            throw new Error('No authentication token');
        }

        const response = await fetch(`/chat/messages/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to load messages');
        }

        const messages = await response.json();
        console.log('Fetched messages for conversation', conversationId, messages);

        const messageList = document.getElementById('message-list');
        messageList.innerHTML = '';

        if (messages.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.classList.add('p-3', 'text-gray-500', 'text-center', 'w-full', 'system-message');
            emptyMessage.textContent = 'No messages yet. Start a conversation!';
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

        renderChatList(conversations);

        document.getElementById('message-input').focus();
    } catch (error) {
        console.error('Error loading conversation:', error);
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

        let repliedToUserText = 'Someone';
        if (msg.replied_to_sender === currentUserId) {
            repliedToUserText = 'your message';
        } else if (msg.replied_to_username) {
            repliedToUserText = msg.replied_to_username;
        }

        replyBox.innerHTML = `
            <div class="flex items-center gap-1 mb-1">
                <svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
                <span class="font-bold">Replying to ${repliedToUserText}:</span>
            </div>
            <div class="pl-3 border-l-2 border-white border-opacity-70">
                "${msg.replied_to_content || '[deleted message]'}"
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
    contentDiv.className = 'message-content mr-10';
    contentDiv.textContent = msg.is_deleted ? "[Message deleted]" : msg.content;
    messageDiv.appendChild(contentDiv);

    if (msg.timestamp) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-timestamp';
        const date = new Date(msg.timestamp);
        timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        messageDiv.appendChild(timeSpan);
    }

    if (!msg.is_deleted) {
        messageDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMessageClick(e, messageDiv);
        });
    }

    return messageDiv;
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
                messageEl.textContent = "[Message deleted]";
            }
            if (socket && socket.connected) {
                socket.emit('delete_message', { message_id: messageId });
            }
        }
    } catch (error) {
        console.error("Error deleting message:", error);
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
            text: "Please select a conversation first",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#F44336",
        }).showToast();
        return;
    }

    if (!initializeSocket()) {
        Toastify({
            text: "Cannot connect to server. Please check your connection.",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#F44336",
        }).showToast();
        return;
    }

    if (!socket.connected) {
        console.log('Socket not connected. Waiting to connect...');

        if (!socket.pendingMessages) {
            socket.pendingMessages = [];
        }

        socket.pendingMessages.push({
            conversation_id: currentConversationId,
            content: content,
            replied_to_id: getReplyingToMessage()?.id
        });

        Toastify({
            text: "Connecting to server...",
            duration: 2000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#FFA500",
        }).showToast();

        socket.connect();

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
        contentDiv.textContent = content + " (sending...)";
        messageDiv.appendChild(contentDiv);

        messageDiv.dataset.senderId = currentUserId;
        messageDiv.dataset.pending = true;
        messageList.appendChild(messageDiv);
        messageList.scrollTop = messageList.scrollHeight;
        messageInput.value = '';

        hideReplyUI();
        return;
    }

    console.log('Sending message:', messageData);

    const messageList = document.getElementById('message-list');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', 'self-end');

    if (getReplyingToMessage()) {
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('reply-preview', 'text-xs', 'mb-1', 'p-1', 'rounded');
        replyDiv.textContent = `↩ ${getReplyingToMessage().content.substring(0, 50)}${getReplyingToMessage().content.length > 50 ? '...' : ''}`;
        messageDiv.appendChild(replyDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.textContent = content;
    messageDiv.appendChild(contentDiv);

    messageDiv.dataset.senderId = currentUserId;
    messageList.appendChild(messageDiv);
    messageList.scrollTop = messageList.scrollHeight;

    socket.emit('message', messageData);
    messageInput.value = '';

    hideReplyUI();
});