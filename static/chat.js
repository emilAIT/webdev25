let currentConversationId = null;
let currentUserId = null;
let conversations = [];
let selectedMessages = []; // To keep track of selected messages
let replyingToMessage = null; // To keep track of message being replied to

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        return;
    }

    // Fetch current user ID
    try {
        const userResponse = await fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userResponse.ok) {
            throw new Error('Failed to fetch user data');
        }
        const userData = await userResponse.json();
        currentUserId = userData.id;
        console.log('Current user:', userData);

        // Show chat interface
        document.getElementById('signin').classList.add('hidden');
        document.getElementById('signup').classList.add('hidden');
        document.getElementById('chat').classList.remove('hidden');

        // Initialize socket connection
        if (typeof initializeSocket === 'function') {
            initializeSocket();
        }

        // Load conversations
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

    // Add search functionality with reduced toasts
    const searchInput = document.getElementById('chat-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filteredConversations = conversations.filter(conv =>
            (conv.name || 'Chat').toLowerCase().includes(query)
        );
        renderChatList(filteredConversations);
        // Only show toast if there's no result after typing at least 3 characters
        if (filteredConversations.length === 0 && query.length >= 3) {
            console.log("No chats found matching search criteria");
            // Don't show toast here to reduce notifications
        }
    });

    // Add message selection mode handling
    document.getElementById('select-mode-btn').addEventListener('click', toggleSelectionMode);
    document.getElementById('cancel-selection-btn').addEventListener('click', cancelSelectionMode);
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedMessages);

    // New Chat Modal
    const newChatModal = document.getElementById('new-chat-modal');
    const newChatBtn = document.getElementById('new-chat-btn');
    const newChatCancel = document.getElementById('new-chat-cancel');
    const newChatCreate = document.getElementById('new-chat-create');
    const newChatUsernameInput = document.getElementById('new-chat-username');
    const userSuggestions = document.getElementById('user-suggestions');
    let selectedUserId = null;

    newChatBtn.addEventListener('click', () => {
        newChatModal.classList.remove('hidden');
        newChatUsernameInput.value = '';
        userSuggestions.innerHTML = '';
        selectedUserId = null;
    });

    newChatCancel.addEventListener('click', () => {
        newChatModal.classList.add('hidden');
    });

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

            // Auto-select the new conversation
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

    newGroupBtn.addEventListener('click', () => {
        newGroupModal.classList.remove('hidden');
    });

    newGroupCancel.addEventListener('click', () => {
        newGroupModal.classList.add('hidden');
    });

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

    // Add reply UI handling
    document.getElementById('cancel-reply').addEventListener('click', () => {
        hideReplyUI();
    });
});

// Add this new function to toggle message selection mode
function toggleSelectionMode() {
    document.getElementById('normal-message-controls').classList.add('hidden');
    document.getElementById('selection-message-controls').classList.remove('hidden');

    // Enable selection on all messages
    const messageElements = document.querySelectorAll('#message-list > div:not(.system-message)');
    messageElements.forEach(msg => {
        msg.classList.add('selectable');
        msg.addEventListener('click', toggleMessageSelection);
    });
}

function cancelSelectionMode() {
    document.getElementById('selection-message-controls').classList.add('hidden');
    document.getElementById('normal-message-controls').classList.remove('hidden');

    // Disable selection and clear selections
    const messageElements = document.querySelectorAll('#message-list > div');
    messageElements.forEach(msg => {
        msg.classList.remove('selectable', 'selected');
    });
    selectedMessages = [];
}

function toggleMessageSelection(event) {
    const messageElement = event.currentTarget;
    const messageId = parseInt(messageElement.dataset.messageId);

    if (messageElement.classList.contains('selected')) {
        messageElement.classList.remove('selected');
        selectedMessages = selectedMessages.filter(id => id !== messageId);
    } else {
        messageElement.classList.add('selected');
        selectedMessages.push(messageId);
    }

    // Update delete button based on selection
    document.getElementById('delete-selected-btn').disabled = selectedMessages.length === 0;
}

async function deleteSelectedMessages() {
    if (selectedMessages.length === 0) return;

    if (!confirm(`Delete ${selectedMessages.length} selected message(s)?`)) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Delete all selected messages
    for (const messageId of selectedMessages) {
        try {
            const response = await fetch(`/chat/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.error(`Failed to delete message ${messageId}`);
                continue;
            }

            // Update UI for deleted message
            const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                messageEl.classList.add('deleted');
                messageEl.textContent = "[Message deleted]";
            }

            // If using socket, notify about deletion
            if (socket && socket.connected) {
                socket.emit('delete_message', { message_id: messageId });
            }
        } catch (error) {
            console.error(`Error deleting message ${messageId}:`, error);
        }
    }

    // Exit selection mode
    cancelSelectionMode();
}

function setupReplyUI(messageId, content, senderId) {
    replyingToMessage = {
        id: messageId,
        content: content,
        sender_id: senderId
    };

    const replyPreview = document.getElementById('reply-preview');
    replyPreview.textContent = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    document.getElementById('reply-container').classList.remove('hidden');
    document.getElementById('message-input').focus();
}

function hideReplyUI() {
    replyingToMessage = null;
    document.getElementById('reply-container').classList.add('hidden');
}

async function loadConversations() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to load conversations');
        }

        conversations = await response.json();
        console.log('Loaded conversations:', conversations);
        renderChatList(conversations);

        // If we have a current conversation, reload it to get any new messages
        if (currentConversationId) {
            // Find if the conversation still exists
            const conversationExists = conversations.some(conv => conv.id === currentConversationId);
            if (conversationExists) {
                loadConversation(currentConversationId);
            } else if (conversations.length > 0) {
                // If current conversation doesn't exist, load the first one
                loadConversation(conversations[0].id);
            }
        } else if (conversations.length > 0 && !document.getElementById('message-list').hasChildNodes()) {
            // Auto-load the first conversation if none is selected
            loadConversation(conversations[0].id);
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
        // Removed toast notification here to reduce spam
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

        // Highlight current conversation
        if (conv.id === currentConversationId) {
            chatItem.classList.add('bg-[#5A4A40]');
        }

        chatItem.innerHTML = `
            <img src="https://picsum.photos/seed/${conv.id}/40" alt="Profile" class="w-10 h-10 rounded-full mr-3">
            <div>
                <h4 class="font-bold text-white">${conv.name || 'Chat'}</h4>
                <p class="text-sm text-gray-300">${conv.last_message || 'No messages yet'}</p>
            </div>
        `;
        chatItem.addEventListener('click', () => loadConversation(conv.id));
        chatList.appendChild(chatItem);
    });
}

async function loadConversation(conversationId) {
    try {
        currentConversationId = conversationId;

        // Initialize socket if needed before joining
        if (typeof initializeSocket === 'function') {
            initializeSocket();
        }

        // Join the conversation (this will check if socket is connected)
        joinConversation(conversationId);

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

        // Update conversation header
        const conv = conversations.find(c => c.id === conversationId);
        document.getElementById('conversation-name').textContent = conv ? (conv.name || 'Chat') : 'Chat';

        // Highlight the selected conversation in the list
        renderChatList(conversations);

        // Focus the message input
        document.getElementById('message-input').focus();
    } catch (error) {
        console.error('Error loading conversation:', error);
        // Removed toast notification here to reduce spam
    }
}

function createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = msg.sender_id === currentUserId;

    messageDiv.classList.add(
        'p-3', 'mb-2', 'rounded-lg',
        isOwnMessage ? 'bg-blue-500' : 'bg-gray-300',
        isOwnMessage ? 'text-white' : 'text-gray-800',
        isOwnMessage ? 'self-end' : 'self-start',
        msg.is_deleted ? 'deleted' : ''
    );

    messageDiv.dataset.senderId = msg.sender_id;
    messageDiv.dataset.messageId = msg.id;

    // Add reply content if this is a reply
    if (msg.replied_to_id) {
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('reply-preview', 'text-xs', 'mb-1', 'p-1',
            isOwnMessage ? 'bg-blue-600' : 'bg-gray-400',
            'rounded');

        replyDiv.textContent = `↩ ${msg.replied_to_content || "[Message unavailable]"}`;
        messageDiv.appendChild(replyDiv);
    }

    // Add message content
    const contentDiv = document.createElement('div');
    contentDiv.textContent = msg.is_deleted ? "[Message deleted]" : msg.content;
    messageDiv.appendChild(contentDiv);

    // Add message actions
    if (!msg.is_deleted) {
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('message-actions', 'text-xs', 'mt-1', 'opacity-0', 'hover:opacity-100');

        // Add reply button
        const replyButton = document.createElement('button');
        replyButton.classList.add('mr-2', isOwnMessage ? 'text-white' : 'text-gray-700');
        replyButton.textContent = "Reply";
        replyButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering message selection
            setupReplyUI(msg.id, msg.content, msg.sender_id);
        });
        actionsDiv.appendChild(replyButton);

        // Add delete button (only for own messages)
        if (isOwnMessage) {
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('text-white');
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent triggering message selection

                if (confirm("Delete this message?")) {
                    try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`/chat/messages/${msg.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (response.ok) {
                            messageDiv.classList.add('deleted');
                            contentDiv.textContent = "[Message deleted]";
                            actionsDiv.remove();

                            // If using socket, notify about deletion
                            if (socket && socket.connected) {
                                socket.emit('delete_message', { message_id: msg.id });
                            }
                        }
                    } catch (error) {
                        console.error("Error deleting message:", error);
                    }
                }
            });
            actionsDiv.appendChild(deleteButton);
        }

        messageDiv.appendChild(actionsDiv);
    }

    return messageDiv;
}

document.getElementById('send-btn').addEventListener('click', () => {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();

    if (!content) {
        return;
    }

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

    // Initialize socket if needed
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

    // Check if socket is connected
    if (!socket.connected) {
        console.log('Socket not connected. Waiting to connect...');

        // Store message to send after connection
        if (!socket.pendingMessages) {
            socket.pendingMessages = [];
        }

        socket.pendingMessages.push({
            conversation_id: currentConversationId,
            content: content,
            replied_to_id: replyingToMessage?.id
        });

        Toastify({
            text: "Connecting to server...",
            duration: 2000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#FFA500",
        }).showToast();

        // Try to reconnect
        socket.connect();

        // Show message in UI anyway (will be sent when connected)
        const messageList = document.getElementById('message-list');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', 'bg-blue-500', 'text-white', 'self-end', 'opacity-50');

        // Add reply preview if replying
        if (replyingToMessage) {
            const replyDiv = document.createElement('div');
            replyDiv.classList.add('reply-preview', 'text-xs', 'mb-1', 'p-1', 'bg-blue-600', 'rounded');
            replyDiv.textContent = `↩ ${replyingToMessage.content.substring(0, 50)}...`;
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

        // Hide reply UI if active
        hideReplyUI();

        return;
    }

    const messageData = {
        conversation_id: currentConversationId,
        sender_id: currentUserId,
        content: content
    };

    // Add reply information if replying
    if (replyingToMessage) {
        messageData.replied_to_id = replyingToMessage.id;
    }

    console.log('Sending message:', messageData);

    // Optimistic UI update
    const messageList = document.getElementById('message-list');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', 'bg-blue-500', 'text-white', 'self-end');

    // Add reply preview if replying
    if (replyingToMessage) {
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('reply-preview', 'text-xs', 'mb-1', 'p-1', 'bg-blue-600', 'rounded');
        replyDiv.textContent = `↩ ${replyingToMessage.content.substring(0, 50)}${replyingToMessage.content.length > 50 ? '...' : ''}`;
        messageDiv.appendChild(replyDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.textContent = content;
    messageDiv.appendChild(contentDiv);

    messageDiv.dataset.senderId = currentUserId;
    messageList.appendChild(messageDiv);
    messageList.scrollTop = messageList.scrollHeight;

    // Emit the message to the server
    socket.emit('message', messageData);
    messageInput.value = '';

    // Hide reply UI after sending
    hideReplyUI();
}