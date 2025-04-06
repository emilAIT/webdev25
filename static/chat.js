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

    // Load conversations
    await loadConversations();
});

async function loadConversations() {
    const token = localStorage.getItem('token');
    const response = await fetch('/chat/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        Toastify({
            text: "Failed to load conversations.",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#F44336",
        }).showToast();
        return;
    }
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
                <h4 class="font-bold text-white">${conv.name}</h4>
                <p class="text-sm text-gray-300">Last message...</p>
            </div>
        `;
        chatItem.addEventListener('click', () => loadConversation(conv.id));
        chatList.appendChild(chatItem);
    });
}

async function loadConversation(conversationId) {
    currentConversationId = conversationId;
    joinConversation(conversationId); // Join Socket.IO room
    const token = localStorage.getItem('token');
    const response = await fetch(`/chat/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        Toastify({
            text: "Failed to load messages.",
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: "#F44336",
        }).showToast();
        return;
    }
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

    // Set conversation name
    const conv = conversations.find(c => c.id === conversationId);
    document.getElementById('conversation-name').textContent = conv ? conv.name : 'Chat';
}