import { currentConversationId, loadConversations, currentUserId, createMessageElement, updateMessageReadStatus } from './chat.js'; // Import updateMessageReadStatus

// Create socket connection with proper authentication
function createSocketConnection() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No authentication token available');
        return null;
    }

    console.log('Creating socket connection with token');


    const socketInstance = io('http://localhost:8000', {
        query: { token: token },
        auth: {
            token: token
        },
        extraHeaders: {
            Authorization: `Bearer ${token}`
        },
        transportOptions: {
            polling: {
                extraHeaders: {
                    Authorization: `Bearer ${token}`
                }
            }
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: false
    });

    // Setup basic event handlers before connecting
    socketInstance.on('connect_error', (error) => {

        if (error.message && error.message.includes('auth')) {
            console.error('Authentication error. Token may be invalid.');
            // Clear token and redirect to login
            localStorage.removeItem('token');

            console.error("Authentication failed. Redirecting to signin.");

            // Show login screen
            setTimeout(() => {
                document.getElementById('chat').classList.add('hidden');
                document.getElementById('signin').classList.remove('hidden');
            }, 1000);

            return;
        }

        console.error("Connection error. Retrying...");
    });

    // Attempt connection
    socketInstance.connect();

    return socketInstance;
}

// Initialize socket as null - we'll create it when needed
let socket = null;
let activeRooms = []; // Track which conversation rooms we've joined
let socketInitialized = false;

// Initialize socket connection
function initializeSocket() {
    if (socket === null) {
        console.log('Creating new socket connection...');
        try {
            socket = createSocketConnection();
            if (socket) {
                setupSocketEvents();
                socketInitialized = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error initializing socket:', error);
            return false;
        }
    }
    return socketInitialized;
}

function joinConversation(conversationId) {
    // Ensure socket is initialized
    if (!initializeSocket()) {
        console.error('Could not initialize socket. Cannot join conversation.');


        console.error("Connection issue. Please refresh the page.");
        return;
    }

    // Check if socket is connected
    if (!socket.connected) {
        console.warn('Socket not yet connected. Will join room when connected.');

        // Store the conversation ID to join when connected
        socket.conversationToJoin = conversationId;


        console.log("Connecting...");
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

    socket.io.on("error", (error) => {
        console.error('Transport error:', error);
    });

    socket.io.on("reconnect_attempt", (attempt) => {
        console.log('Reconnection attempt:', attempt);
    });

    socket.on('connect', () => {
        console.log('Socket.IO connected');

        // Rejoin current conversation if any
        if (socket.conversationToJoin) {
            joinConversation(socket.conversationToJoin);
            socket.conversationToJoin = null;
        } else if (currentConversationId) {
            joinConversation(currentConversationId);
        }


        // Handle pending messages when connected
        if (socket.pendingMessages && socket.pendingMessages.length > 0) {
            console.log('Sending pending messages:', socket.pendingMessages);

            socket.pendingMessages.forEach(msg => {
                socket.emit('message', {
                    conversation_id: msg.conversation_id,
                    sender_id: currentUserId,
                    content: msg.content
                });
            });

            // Clear pending messages
            socket.pendingMessages = [];

            // Update UI to show messages are sent
            const pendingMessages = document.querySelectorAll('[data-pending="true"]');
            pendingMessages.forEach(msg => {
                msg.classList.remove('opacity-50');
                msg.textContent = msg.textContent.replace(' (sending...)', '');
                msg.removeAttribute('data-pending');
            });
        }
    });

    socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);
        console.log('Connection details:', {
            id: socket.id,
            connected: socket.connected,
            disconnected: socket.disconnected
        });

        // Try to recreate connection if token might be the issue
        if (err.message && err.message.includes("auth")) {
            console.log("Authentication error. Refreshing connection in 2 seconds...");
            setTimeout(() => {
                socket = createSocketConnection();
                if (socket) {
                    setupSocketEvents();
                }
            }, 2000);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);

        if (reason === 'io server disconnect') {
            // Server disconnected us, try to reconnect
            socket.connect();
        }


        console.log("Disconnected from chat server");
    });

    // Message handling with reply support
    socket.on('message', function (data) {
        console.log('Received message:', data);

        // If this is a message for the current conversation, add it to the UI
        if (data.conversation_id === currentConversationId) {
            const messageList = document.getElementById('message-list');
            const messageDiv = createMessageElement(data);
            if (messageDiv) {
                messageList.appendChild(messageDiv);

                // Use smooth scroll to the new message
                messageList.scrollTo({
                    top: messageList.scrollHeight,
                    behavior: 'smooth'
                });

                // Handle read receipt for other user's messages
                if (data.sender_id !== currentUserId) {
                    socket.emit('mark_read', {
                        message_id: data.id,
                        conversation_id: data.conversation_id
                    });
                }
            }
        }

        // Refresh conversations list to show the latest message
        loadConversations();
    });

    socket.on('message_deleted', (data) => {
        console.log('Received message_deleted event:', data);

        // Update UI for deleted message
        if (data.conversation_id === currentConversationId) {
            const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
            if (messageElement) {
                messageElement.classList.add('deleted');
                messageElement.innerHTML = '<div>[Message deleted]</div>';
            }
        }
    });

    socket.on('update_chat_list', (data) => {
        console.log('Received update_chat_list event:', data);
        loadConversations(); // Refresh the chat list
    });

    // Add handler for messages_read event
    socket.on('messages_read', (data) => {
        console.log('Received messages_read event:', data);
        if (data.conversation_id === currentConversationId) {
            // Call function from chat.js to update UI
            updateMessageReadStatus(data.message_ids);
        }
        // Optionally, update unread counts in the main list if needed, 
        // but mark_read already triggers loadConversations which should handle it.
    });
}

// Expose a function to check if socket is connected
function isSocketConnected() {
    return socket && socket.connected;
}

document.getElementById('send-btn').addEventListener('click', () => {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();

    if (!content) {
        return;
    }

    if (!currentConversationId) {

        console.error("Please select a conversation first");
        return;
    }

    // Initialize socket if needed
    if (!initializeSocket()) {

        console.error("Cannot connect to server. Please check your connection.");
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
            content: content
        });

        // Toastify({
        //     text: "Connecting to server...",
        //     duration: 2000,
        //     close: true,
        //     gravity: "top",
        //     position: "right",
        //     backgroundColor: "#FFA500",
        // }).showToast();
        console.log("Connecting to server...");

        // Try to reconnect
        socket.connect();

        // Show message in UI anyway (will be sent when connected)
        const messageList = document.getElementById('message-list');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'mb-2', 'rounded-lg', 'bg-blue-500', 'text-white', 'self-end', 'opacity-50');
        messageDiv.textContent = content + " (sending...)";
        messageDiv.dataset.senderId = currentUserId;
        messageDiv.dataset.pending = true;
        messageList.appendChild(messageDiv);
        messageList.scrollTop = messageList.scrollHeight;
        messageInput.value = '';

        return;
    }

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
});

// Handle enter key to send messages
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('send-btn').click();
    }
});

export { socket, initializeSocket, joinConversation, isSocketConnected };