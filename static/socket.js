const socket = io('http://localhost:8000', {
    auth: { token: localStorage.getItem('token') }
});

function joinConversation(conversationId) {
    socket.emit('join_conversation', { conversation_id: conversationId });
    console.log(`Joined conversation ${conversationId}`);
}

socket.on('connect', () => {
    console.log('Socket.IO connected');
});

socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err);
});

socket.on('message', (data) => {
    console.log('Received message:', data);
    if (data.conversation_id === currentConversationId) {
        const messageList = document.getElementById('message-list');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg',
            data.sender_id === currentUserId ? 'bg-blue-500' : 'bg-gray-300',
            data.sender_id === currentUserId ? 'text-white' : 'text-gray-800',
            data.sender_id === currentUserId ? 'self-end' : 'self-start');
        messageDiv.textContent = data.content;
        messageList.appendChild(messageDiv);
        messageList.scrollTop = messageList.scrollHeight;
    }
});

// Send message
document.getElementById('send-btn').addEventListener('click', () => {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    if (content && currentConversationId) {
        const messageData = {
            conversation_id: currentConversationId,
            sender_id: currentUserId,
            content: content
        };
        console.log('Sending message:', messageData);
        socket.emit('message', messageData);
        messageInput.value = '';
    }
});