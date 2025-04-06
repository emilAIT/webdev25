let currentConversationId = null;
let currentUserId = null;
let conversations = [];

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        return;
    }

    // Fetch current user ID
    const userResponse = await fetch('/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!userResponse.ok) {
        localStorage.removeItem('token');
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        return;
    }
    const userData = await userResponse.json();
    currentUserId = userData.id;

    // Load conversations
    await loadConversations();

    // Add search functionality
    const searchInput = document.getElementById('chat-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filteredConversations = conversations.filter(conv =>
            (conv.name || 'Chat').toLowerCase().includes(query)
        );
        renderChatList(filteredConversations);
    });

    async function loadConversations() {
        const token = localStorage.getItem('token');
        const response = await fetch('/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        conversations = await response.json();
        renderChatList(conversations);
    }

    function renderChatList(convList) {
        const chatList = document.getElementById('chat-list');
        chatList.innerHTML = '';
        convList.forEach(conv => {
            const chatItem = document.createElement('div');
            chatItem.classList.add('flex', 'items-center', 'p-3', 'hover:bg-[#5A4A40]', 'cursor-pointer', 'rounded-lg');
            chatItem.innerHTML = `
                <img src="https://picsum.photos/40" alt="Profile" class="w-10 h-10 rounded-full mr-3">
                <div>
                    <h4 class="font-bold text-white">${conv.name || 'Chat'}</h4>
                    <p class="text-sm text-gray-300">Last message...</p>
                </div>
            `;
            chatItem.addEventListener('click', () => loadConversation(conv.id));
            chatList.appendChild(chatItem);
        });
    }

    async function loadConversation(conversationId) {
        currentConversationId = conversationId;
        joinConversation(conversationId);
        const response = await fetch(`/chat/messages/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await response.json();
        const messageList = document.getElementById('message-list');
        messageList.innerHTML = '';
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg',
                msg.sender_id === currentUserId ? 'bg-blue-500' : 'bg-gray-300',
                msg.sender_id === currentUserId ? 'text-white' : 'text-gray-800',
                msg.sender_id === currentUserId ? 'self-end' : 'self-start');
            messageDiv.textContent = msg.content;
            messageList.appendChild(messageDiv);
        });
        messageList.scrollTop = messageList.scrollHeight;
    }

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

    newChatUsernameInput.addEventListener('input', async () => {
        const query = newChatUsernameInput.value.trim();
        if (query.length > 1) {
            const response = await fetch(`/auth/users/search?query=${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const users = await response.json();
                userSuggestions.innerHTML = '';
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
            }
        } else {
            userSuggestions.innerHTML = '';
        }
    });

    newChatCreate.addEventListener('click', async () => {
        if (!selectedUserId) {
            Toastify({
                text: "Please select a user",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
            }).showToast();
            return;
        }

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
        if (response.ok) {
            newChatModal.classList.add('hidden');
            await loadConversations();
            Toastify({
                text: "Chat created successfully",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#4CAF50",
            }).showToast();
        } else {
            Toastify({
                text: "Failed to create chat",
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
                text: "Please enter a group name and at least one username",
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
                    text: `User ${username} not found`,
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
                text: "Group created successfully",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#4CAF50",
            }).showToast();
        } else {
            Toastify({
                text: "Failed to create group",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
            }).showToast();
        }
    });
});