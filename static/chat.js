let currentConversationId = null;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('chat').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
        return;
    }

    const userResponse = await fetch('/chat/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const conversations = await userResponse.json();
    const chatList = document.getElementById('chat-list');
    conversations.forEach(conv => {
        const chatItem = document.createElement('div');
        chatItem.classList.add('flex', 'items-center', 'p-3', 'hover:bg-blue-800', 'cursor-pointer', 'rounded-lg');
        chatItem.innerHTML = `
            <img src="images/avatar1.jpg" alt="Profile" class="w-10 h-10 rounded-full mr-3">
            <div>
                <h4 class="font-bold text-white">${conv.name || 'Chat'}</h4>
                <p class="text-sm text-gray-300">Last message...</p>
            </div>
        `;
        chatItem.addEventListener('click', () => loadConversation(conv.id));
        chatList.appendChild(chatItem);
    });

    async function loadConversation(conversationId) {
        currentConversationId = conversationId;
        const response = await fetch(`/chat/messages/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await response.json();
        const messageList = document.getElementById('message-list');
        messageList.innerHTML = '';
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', msg.sender_id === currentUserId ? 'bg-blue-500 text-white self-end' : 'bg-gray-300 text-gray-800');
            messageDiv.textContent = msg.content;
            messageList.appendChild(messageDiv);
        });
    }

    document.getElementById('send-btn').addEventListener('click', () => {
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();
        if (content && currentConversationId) {
            socket.emit('message', { conversation_id: currentConversationId, content });
            messageInput.value = '';
        }
    });
});