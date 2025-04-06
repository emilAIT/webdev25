const socket = io('http://localhost:8000', {
    auth: { token: localStorage.getItem('token') }
});

socket.on('message', (data) => {
    if (data.conversation_id === currentConversationId) {
        const messageList = document.getElementById('message-list');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', 'bg-gray-300', 'text-gray-800');
        messageDiv.textContent = data.content;
        messageList.appendChild(messageDiv);
    }
});