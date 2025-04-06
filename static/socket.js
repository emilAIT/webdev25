// Create socket connection with proper authentication
function createSocketConnection() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No authentication token available');
        return null;
    }

    return io('http://localhost:8000', {
        auth: { token },
        extraHeaders: {
            'Authorization': `Bearer ${token}`
        },
        query: { token }
    });
}

let socket = createSocketConnection();
let activeRooms = []; // Track which conversation rooms we've joined

function joinConversation(conversationId) {
    if (!socket || !socket.connected) {
        console.error('Socket not connected. Cannot join conversation.');
        return;
    }

    // Leave previous conversation rooms
    if (activeRooms.length > 0) {
        console.log(`Leaving previous conversation rooms: ${activeRooms.join(', ')}`);
        activeRooms.forEach(roomId => {
            socket.emit('leave_room', { conversation_id: roomId });
        });
        activeRooms = [];
    }

    // Join new conversation
    socket.emit('join_conversation', { conversation_id: conversationId });
    activeRooms.push(conversationId);
    console.log(`Joined conversation ${conversationId}`);
}

// Socket event handlers
function setupSocketEvents() {
    if (!socket) return;

    socket.on('connect', () => {
        console.log('Socket.IO connected');

        // Rejoin current conversation if any
        if (currentConversationId) {
            joinConversation(currentConversationId);
        }
    });

    socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);

        // Try to recreate connection if token might be the issue
        setTimeout(() => {
            socket = createSocketConnection();
            if (socket) {
                setupSocketEvents();
            }
        }, 2000);
    });

    socket.on('message', (data) => {
        console.log('Received message:', data);

        // Only show messages for the current conversation
        if (data.conversation_id === currentConversationId) {
            const messageList = document.getElementById('message-list');
            const existingMessages = Array.from(messageList.children);

            // Check if message already exists to prevent duplicates
            const messageExists = existingMessages.some(msg => {
                return msg.dataset.messageId === data.id?.toString() ||
                    (msg.textContent === data.content &&
                        msg.dataset.senderId === data.sender_id.toString());
            });

            if (!messageExists) {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg',
                    data.sender_id === currentUserId ? 'bg-blue-500' : 'bg-gray-300',
                    data.sender_id === currentUserId ? 'text-white' : 'text-gray-800',
                    data.sender_id === currentUserId ? 'self-end' : 'self-start');
                messageDiv.textContent = data.content;
                messageDiv.dataset.senderId = data.sender_id;

                // Store message ID if available
                if (data.id) {
                    messageDiv.dataset.messageId = data.id;
                }

                messageList.appendChild(messageDiv);
                messageList.scrollTop = messageList.scrollHeight;
            }
        } else {
            // For messages in other conversations, update the conversation list
            // to show there are new messages
            loadConversations();
        }
    });

    socket.on('update_chat_list', (data) => {
        console.log('Received update_chat_list event:', data);
        loadConversations(); // Refresh the chat list
    });
}

// Initialize socket events
setupSocketEvents();

document.getElementById('send-btn').addEventListener('click', () => {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    if (content && currentConversationId && socket && socket.connected) {
        const messageData = {
            conversation_id: currentConversationId,
            sender_id: currentUserId,
            content: content
        };
        console.log('Sending message:', messageData);

        // Optimistic UI update
        const messageList = document.getElementById('message-list');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', 'bg-blue-500', 'text-white', 'self-end');
        messageDiv.textContent = content;
        messageDiv.dataset.senderId = currentUserId;
        messageList.appendChild(messageDiv);
        messageList.scrollTop = messageList.scrollHeight;

        // Emit the message to the server
        socket.emit('message', messageData);
        messageInput.value = '';
    } else {
        if (!socket || !socket.connected) {
            console.log('Socket not connected. Attempting to reconnect...');
            socket = createSocketConnection();
            setupSocketEvents();

            Toastify({
                text: "Connection lost. Please try again in a moment.",
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
            }).showToast();
        } else {
            console.log('Message not sent: content or conversationId missing', { content, currentConversationId });
        }
    }
});

// Handle enter key to send messages
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('send-btn').click();
    }
});