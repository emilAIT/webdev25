/**
 * WebSocket handling for Blink
 */

// WebSocket connections
let chatWebSocket = null;
let presenceWebSocket = null;
let currentRoomId = null;
let currentRoomIsGroup = false;
let currentUserId = null;

// Debug mode - set to true for verbose logging
const WEBSOCKET_DEBUG = true;

// Logger function with timestamps
function wsLog(message, data = null) {
    if (WEBSOCKET_DEBUG) {
        const timestamp = new Date().toISOString();
        if (data) {
            console.log(`[${timestamp}] [WebSocket] ${message}`, data);
        } else {
            console.log(`[${timestamp}] [WebSocket] ${message}`);
        }
    }
}

// Debounce status updates to prevent rapid UI toggling
const statusUpdateDebounce = {};
function debounceStatusUpdate(userId, status, callback, delay = 100) {
    if (statusUpdateDebounce[userId]) {
        clearTimeout(statusUpdateDebounce[userId]);
    }
    statusUpdateDebounce[userId] = setTimeout(() => {
        callback(userId, status);
        delete statusUpdateDebounce[userId];
    }, delay);
}

// Observe messages for visibility and send read receipts
let messageObserver = null;
function observeMessagesForRead() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error("chatMessages element not found for observer");
        return;
    }

    // Disconnect previous observer to prevent leaks
    if (messageObserver) {
        messageObserver.disconnect();
        wsLog("Disconnected previous message observer");
    }

    messageObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const messageElement = entry.target;
                    const messageId = messageElement.getAttribute('data-message-id');
                    const isRead = messageElement.querySelector('.message-status-double.read');
                    if (!isRead && currentRoomId) {
                        wsLog(`Message ${messageId} is visible, sending read receipt`);
                        sendReadReceipts(currentRoomId, [messageId]);
                    }
                }
            });
        },
        {
            root: chatMessages,
            threshold: 0.5 // Trigger when 50% of the message is visible
        }
    );

    const messages = document.querySelectorAll('.message[data-message-id]');
    messages.forEach((message) => {
        messageObserver.observe(message);
        wsLog(`Observing message ${message.getAttribute('data-message-id')}`);
    });
}

// Initialize WebSocket - Should be called on page load
function initializeWebSockets() {
    wsLog("Initializing WebSockets...");
    connectPresenceWebSocket();

    const lastOpenedRoomId = localStorage.getItem('lastOpenedRoomId');
    if (lastOpenedRoomId) {
        const chatContent = document.getElementById('chatContent');
        if (chatContent && chatContent.style.display === 'flex') {
            wsLog("User is already in an active chat, skipping auto-reconnect");
            const currentRoomId = chatContent.getAttribute('data-current-room-id');
            if (currentRoomId) {
                connectChatWebSocket(currentRoomId, null, true);
            }
            return;
        }

        wsLog(`Attempting to reconnect to last opened room: ${lastOpenedRoomId}`);
        fetch(`/api/rooms/${lastOpenedRoomId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load room');
                }
                return response.json();
            })
            .then(roomData => {
                if (roomData) {
                    wsLog(`Reopening last active chat: ${roomData.name}`);
                    if (window.openChat) {
                        window.openChat(roomData);
                    }
                    const contactElement = document.querySelector(`.contact-item[data-room-id="${roomData.id}"]`);
                    if (contactElement) {
                        contactElement.classList.add('active');
                    }
                }
            })
            .catch(error => {
                console.error("Error reconnecting to room:", error);
            });
    }
}

// Connect to presence WebSocket
function connectPresenceWebSocket(retryCount = 0) {
    const currentUsername = document.querySelector('.profile-name')?.textContent.trim();
    if (!currentUsername) {
        console.error("Cannot connect to presence WebSocket: No username available");
        return;
    }

    const socket_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${socket_protocol}//${window.location.host}/ws/presence?username=${encodeURIComponent(currentUsername)}`;

    wsLog(`Connecting to presence WebSocket: ${wsUrl}`);
    try {
        presenceWebSocket = new WebSocket(wsUrl);

        presenceWebSocket.onopen = function() {
            wsLog("Presence WebSocket connection established successfully");
            setInterval(function() {
                if (presenceWebSocket && presenceWebSocket.readyState === WebSocket.OPEN) {
                    presenceWebSocket.send("ping");
                    wsLog("Sent ping to presence WebSocket");
                }
            }, 30000);
        };

        presenceWebSocket.onmessage = function(event) {
            try {
                if (event.data === "pong") {
                    wsLog("Received pong response");
                    return;
                }

                const data = JSON.parse(event.data);
                wsLog("Received presence message:", data);

                if (data.type === "status") {
                    handleStatusMessage(data);
                }
            } catch (error) {
                console.error("Error parsing presence message:", error, event.data);
            }
        };

        presenceWebSocket.onerror = function(event) {
            console.error("Presence WebSocket error:", event);
        };

        presenceWebSocket.onclose = function(event) {
            wsLog(`Presence WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
            if (event.code !== 1000) {
                const delay = Math.min(3000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                wsLog(`Presence WebSocket closed unexpectedly - reconnecting in ${delay}ms`);
                setTimeout(() => connectPresenceWebSocket(retryCount + 1), delay);
            }
        };
    } catch (error) {
        console.error("Error creating presence WebSocket:", error);
    }
}

// Handle status messages with debouncing
function handleStatusMessage(data) {
    const validStatus = data.status === 'online' || data.status === 'offline' ? data.status : 'offline';
    debounceStatusUpdate(data.user_id, validStatus, (userId, status) => {
        if (window.BlinkUtils) {
            requestAnimationFrame(() => {
                window.BlinkUtils.updateContactStatus(userId, status, 'websocket');
                wsLog(`Applied debounced status update for user ${userId}: ${status}`);
            });
        }
    });
}

// Connect to chat WebSocket for a specific room
function connectChatWebSocket(roomId, onConnectCallback, suppressReload = false, retryCount = 0) {
    wsLog(`Connecting chat WebSocket for room: ${roomId}`);
    currentRoomId = roomId;

    if (chatWebSocket) {
        wsLog("Closing existing chat WebSocket");
        try {
            chatWebSocket.close();
        } catch (e) {
            console.error("Error closing existing WebSocket:", e);
        }
        chatWebSocket = null;
    }

    if (!roomId) {
        console.error("Cannot connect WebSocket: No room ID provided");
        return;
    }

    wsLog("Fetching chat token...");
    fetch(`/api/token/chat?roomId=${roomId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to get chat token. Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const token = data.token;
            if (!token) {
                throw new Error('No token received from server');
            }

            wsLog("Chat token received successfully");

            const socket_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${socket_protocol}//${window.location.host}/ws/chat/${encodeURIComponent(token)}`;

            wsLog(`Creating chat WebSocket connection: ${wsUrl}`);
            try {
                chatWebSocket = new WebSocket(wsUrl);

                chatWebSocket.onopen = function() {
                    wsLog(`Chat WebSocket connection established for room ${roomId}`);
                    chatWebSocket.send(JSON.stringify({type: "ping"}));

                    const heartbeatInterval = setInterval(function() {
                        if (chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN) {
                            try {
                                chatWebSocket.send(JSON.stringify({type: "ping"}));
                                wsLog("Sent heartbeat ping");
                            } catch (e) {
                                console.error("Error sending heartbeat:", e);
                                clearInterval(heartbeatInterval);
                            }
                        } else {
                            wsLog("Clearing heartbeat interval - WebSocket not open");
                            clearInterval(heartbeatInterval);
                        }
                    }, 30000);

                    chatWebSocket.addEventListener('close', function() {
                        wsLog("Clearing heartbeat interval - WebSocket closed");
                        clearInterval(heartbeatInterval);
                    });

                    observeMessagesForRead();

                    if (typeof onConnectCallback === 'function') {
                        onConnectCallback();
                    }
                };

                setupChatWebSocketEvents(chatWebSocket, () => {
                    wsLog("Attempting to reconnect chat WebSocket...");
                    connectChatWebSocket(roomId, onConnectCallback, suppressReload, retryCount + 1);
                });

                chatWebSocket.onerror = function(event) {
                    console.error("Chat WebSocket error:", event);
                };

                chatWebSocket.onclose = function(event) {
                    wsLog(`Chat WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
                    if (event.code !== 1000 && currentRoomId === roomId) {
                        const delay = Math.min(3000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                        wsLog(`Chat WebSocket closed unexpectedly - reconnecting in ${delay}ms`);
                        setTimeout(() => {
                            connectChatWebSocket(roomId, onConnectCallback, suppressReload, retryCount + 1);
                        }, delay);
                    }
                };
            } catch (error) {
                console.error("Error creating chat WebSocket:", error);
            }
        })
        .catch(error => {
            console.error('Error getting chat token:', error);
            const delay = Math.min(3000 * Math.pow(2, retryCount), 10000);
            wsLog(`Will try to reconnect after ${delay}ms`);
            setTimeout(() => connectChatWebSocket(roomId, onConnectCallback, suppressReload, retryCount + 1), delay);
        });
}

// Process WebSocket events
function setupChatWebSocketEvents(webSocket, reconnectCallback) {
    webSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            wsLog("ChatSocket message received:", data);

            if (data.type === "message") {
                handleChatMessage(data);
            } else if (data.type === "message_read") {
                const messageIds = Array.isArray(data.message_ids) ? data.message_ids : [data.message_id];
                messageIds.forEach((id) => {
                    if (window.BlinkUtils) {
                        window.BlinkUtils.updateMessageStatus(id, "read");
                        wsLog(`Updated message ${id} to read status`);
                    }
                });
            } else if (data.type === "typing") {
                handleTypingIndicator(data);
            } else if (data.type === "new_room") {
                handleNewRoom(data);
            } else if (data.type === "chat_cleared") {
                handleChatCleared(data);
            } else if (data.type === "pong") {
                wsLog("Received pong response");
            } else if (data.type === "error") {
                console.error("WebSocket error from server:", data.error || data.message);
                if (data.message_id) {
                    console.error(`Error with message ID ${data.message_id}: ${data.error || data.message}`);
                }
            } else if (data.type === "message_updated") {
                handleMessageUpdated(data);
            } else if (data.type === "message_deleted") {
                handleMessageDeleted(data);
            } else if (data.type === "group_deleted") {
                handleGroupDeleted(data);
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error, event.data);
        }
    };
}

// Handle message update notification
function handleMessageUpdated(data) {
    wsLog("Message update notification received:", data);
    const currentRoomId = window.BlinkWebSocket ? window.BlinkWebSocket.getCurrentRoomId() : null;
    if (parseInt(currentRoomId) === parseInt(data.room_id)) {
        const updateEvent = new CustomEvent('message-updated', {
            detail: {
                messageId: data.message_id,
                content: data.content
            }
        });
        window.dispatchEvent(updateEvent);
    }
}

// Handle message deletion notification
function handleMessageDeleted(data) {
    wsLog("Message deletion notification received:", data);
    const currentRoomId = window.BlinkWebSocket ? window.BlinkWebSocket.getCurrentRoomId() : null;
    if (parseInt(currentRoomId) === parseInt(data.room_id)) {
        const deleteEvent = new CustomEvent('message-deleted', {
            detail: {
                messageId: data.message_id,
                deletedBy: data.deleted_by
            }
        });
        window.dispatchEvent(deleteEvent);
    }
}

// Handle incoming chat message
function handleChatMessage(data) {
    const message = data.message;
    const isConfirmation = message.sender === "user";
    wsLog("Handling chat message:", message);

    // Check if this is an attachment message
    const isAttachment = message.content && (
        message.content.includes('<img-attachment') || 
        message.content.includes('<video-attachment') || 
        message.content.includes('<audio-attachment') || 
        message.content.includes('<doc-attachment')
    );

    if (window.BlinkUtils) {
        // Get proper display text for attachments
        let displayContent = message.content;
        if (isAttachment) {
            if (message.content.includes('<img-attachment')) {
                displayContent = '📷 Photo';
            } else if (message.content.includes('<video-attachment')) {
                displayContent = '🎥 Video';
            } else if (message.content.includes('<audio-attachment')) {
                displayContent = '🎵 Audio';
            } else if (message.content.includes('<doc-attachment')) {
                displayContent = '📄 Document';
            }
        }
        
        // Always update the last message in the sidebar
        const timeToDisplay = message.time || 
            (message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false}) : null);
        window.BlinkUtils.updateLastMessage(message.room_id, displayContent, timeToDisplay);
        
        // Move the contact to the top of the sidebar regardless of whether it's the current chat or not
        const contactElement = document.querySelector(`.contact-item[data-room-id="${message.room_id}"]`);
        const parentElement = contactElement?.parentElement;
        if (parentElement && contactElement) {
            parentElement.insertBefore(contactElement, parentElement.firstChild);
            wsLog(`Moved chat ${message.room_id} to top of sidebar`);
        }
    }

    if (parseInt(currentRoomId) === parseInt(message.room_id)) {
        if (isConfirmation && message.temp_id) {
            wsLog(`Received confirmation for temp message: ${message.temp_id} -> ${message.id}`);
            const tempMessage = document.querySelector(`.message[data-message-id="${message.temp_id}"]`);
            if (tempMessage) {
                tempMessage.setAttribute('data-message-id', message.id);
                tempMessage.removeAttribute('data-temp-message');
                const messageStatusSingle = tempMessage.querySelector('.message-status-single');
                const messageStatusDouble = tempMessage.querySelector('.message-status-double');
                
                // Apply delivered status to confirmed messages
                if (messageStatusSingle && messageStatusDouble) {
                    messageStatusSingle.style.display = 'none';
                    messageStatusDouble.style.display = 'inline';
                    
                    // Update status based on delivered/read properties
                    if (message.read === true) {
                        messageStatusDouble.classList.add('read');
                        tempMessage.setAttribute('data-read', 'true');
                    }
                    
                    // Always mark as delivered when confirmed
                    tempMessage.setAttribute('data-delivered', 'true');
                }
                
                // Add timestamp if provided
                if (message.timestamp) {
                    tempMessage.setAttribute('data-timestamp', message.timestamp);
                    const timeElement = tempMessage.querySelector('.message-time');
                    if (timeElement) {
                        const messageDate = new Date(message.timestamp);
                        timeElement.textContent = window.BlinkUtils ? 
                            window.BlinkUtils.formatTime(messageDate) : 
                            messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                }

                // If it's an attachment, update the content with proper rendering
                if (isAttachment) {
                    const messageContent = tempMessage.querySelector('.message-content');
                    if (messageContent) {
                        updateAttachmentContent(messageContent, message.content);
                    }
                }
            } else {
                wsLog("Temp message not found in DOM, displaying as new message");
                if (window.displayMessage) {
                    // Process the attachment content before displaying
                    if (isAttachment) {
                        let processedMessage = {...message};
                        processedMessage.processedContent = processAttachmentContent(message.content);
                        window.displayMessage(processedMessage);
                    } else {
                        window.displayMessage(message);
                    }
                    observeMessagesForRead();
                }
            }
        } else {
            const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);
            if (!existingMessage && window.displayMessage) {
                // Process the attachment content before displaying
                if (isAttachment) {
                    let processedMessage = {...message};
                    processedMessage.processedContent = processAttachmentContent(message.content);
                    window.displayMessage(processedMessage);
                } else {
                    window.displayMessage(message);
                }
                observeMessagesForRead();
            } else if (existingMessage) {
                wsLog(`Message ${message.id} already exists in DOM, updating status`);
                // Update existing message status if delivered or read status changed
                if (message.delivered || message.read) {
                    const messageStatusSingle = existingMessage.querySelector('.message-status-single');
                    const messageStatusDouble = existingMessage.querySelector('.message-status-double');
                    
                    if (messageStatusSingle && messageStatusDouble) {
                        if (message.delivered === true) {
                            messageStatusSingle.style.display = 'none';
                            messageStatusDouble.style.display = 'inline';
                            existingMessage.setAttribute('data-delivered', 'true');
                            
                            if (message.read === true) {
                                messageStatusDouble.classList.add('read');
                                existingMessage.setAttribute('data-read', 'true');
                            } else {
                                messageStatusDouble.classList.remove('read');
                            }
                        }
                    }
                }
                
                // If it's an attachment, ensure it's properly rendered
                if (isAttachment) {
                    const messageContent = existingMessage.querySelector('.message-content');
                    if (messageContent && !messageContent.querySelector('.attachment-preview') && !messageContent.querySelector('.attachment-document')) {
                        updateAttachmentContent(messageContent, message.content);
                    }
                }
            }
        }
    } else {
        wsLog(`Message is for room ${message.room_id}, but current room is ${currentRoomId}`);
        if (!isConfirmation && window.BlinkUtils) {
            window.BlinkUtils.incrementUnreadCount(message.room_id);
            
            // Play notification sound for messages that aren't from the current user and aren't in the current chat
            try {
                const notificationSound = new Audio('/static/sounds/notification.mp3');
                notificationSound.play().catch(e => console.log('Failed to play notification sound:', e));
                wsLog(`Playing notification sound for message in room ${message.room_id}`);
            } catch (soundError) {
                console.log('Failed to play notification sound:', soundError);
            }
        }
    }
}

// Process attachment content into HTML
function processAttachmentContent(content) {
    if (!content) return '';
    
    if (content.includes('<img-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        return `
            <div class="attachment-preview">
                <img src="${src}" alt="${filename}" onclick="window.open('${src}', '_blank')">
            </div>
        `;
    } else if (content.includes('<video-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        return `
            <div class="attachment-preview">
                <video src="${src}" controls preload="metadata"></video>
            </div>
        `;
    } else if (content.includes('<audio-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        return `
            <div class="attachment-preview">
                <audio src="${src}" controls></audio>
                <div class="attachment-name">${filename}</div>
            </div>
        `;
    } else if (content.includes('<doc-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        return `
            <div class="attachment-document">
                <i class="fas fa-file-alt"></i>
                <div class="attachment-info">
                    <div class="attachment-name">${filename}</div>
                    <a href="${src}" target="_blank" class="attachment-download">Download</a>
                </div>
            </div>
        `;
    }
    
    return content;
}

// Update attachment content in an element
function updateAttachmentContent(messageContentElement, content) {
    if (!content || !messageContentElement) return;
    
    if (content.includes('<img-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        messageContentElement.innerHTML = `
            <div class="attachment-preview">
                <img src="${src}" alt="${filename}" onclick="window.open('${src}', '_blank')">
            </div>
        `;
    } else if (content.includes('<video-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        messageContentElement.innerHTML = `
            <div class="attachment-preview">
                <video src="${src}" controls preload="metadata"></video>
            </div>
        `;
    } else if (content.includes('<audio-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        messageContentElement.innerHTML = `
            <div class="attachment-preview">
                <audio src="${src}" controls></audio>
                <div class="attachment-name">${filename}</div>
            </div>
        `;
    } else if (content.includes('<doc-attachment')) {
        const src = content.match(/src='([^']+)'/)[1];
        const filename = content.match(/filename='([^']+)'/)[1];
        messageContentElement.innerHTML = `
            <div class="attachment-document">
                <i class="fas fa-file-alt"></i>
                <div class="attachment-info">
                    <div class="attachment-name">${filename}</div>
                    <a href="${src}" target="_blank" class="attachment-download">Download</a>
                </div>
            </div>
        `;
    }
}

// Handle typing indicators
function handleTypingIndicator(data) {
    wsLog("Typing indicator:", data);
}

// Handle new room notifications
function handleNewRoom(data) {
    wsLog("Handling new room notification:", data);
    const existingRoom = document.querySelector(`.contact-item[data-room-id="${data.room.id}"]`);
    if (existingRoom) {
        wsLog("Room already exists in sidebar, skipping");
        return;
    }

    if (window.addRoomToList) {
        wsLog("Adding new room to sidebar:", data.room);
        window.addRoomToList(data.room);
        try {
            const notificationSound = new Audio('/static/sounds/notification.mp3');
            notificationSound.play().catch(e => console.log('Failed to play notification sound'));
        } catch (soundError) {
            console.log('Failed to play notification sound', soundError);
        }
        const newRoomElement = document.querySelector(`.contact-item[data-room-id="${data.room.id}"]`);
        if (newRoomElement) {
            newRoomElement.classList.add('new-contact');
            setTimeout(() => {
                newRoomElement.classList.remove('new-contact');
            }, 3000);
        }
    } else {
        console.error("addRoomToList function not available");
    }
}

// Handle chat cleared notifications
function handleChatCleared(data) {
    wsLog("Handling chat cleared notification:", data);
    if (parseInt(data.room_id) === parseInt(currentRoomId)) {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            const clearMessage = document.createElement('div');
            clearMessage.className = 'system-message info';
            clearMessage.textContent = `Chat was cleared by ${data.cleared_by}`;
            chatMessages.appendChild(clearMessage);
        }
    }

    if (window.BlinkUtils) {
        window.BlinkUtils.updateLastMessage(
            data.room_id,
            'Chat cleared',
            new Date(data.cleared_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        );
    }
}

// Handle group deletion notification
function handleGroupDeleted(data) {
    wsLog("Handling group deletion notification:", data);
    const groupElement = document.querySelector(`.contact-item[data-room-id="${data.room_id}"]`);
    if (groupElement) {
        groupElement.remove();
        wsLog(`Group ${data.room_id} removed from sidebar`);
    }

    if (parseInt(data.room_id) === parseInt(currentRoomId)) {
        wsLog(`Currently open group ${data.room_id} was deleted, showing welcome screen`);
        const welcomeContainer = document.getElementById('welcomeContainer');
        const chatContent = document.getElementById('chatContent');
        if (welcomeContainer && chatContent) {
            welcomeContainer.style.display = 'flex';
            chatContent.style.display = 'none';
        }
    }
}

// Send a message through WebSocket
function sendChatMessage(message, roomId) {
    if (!message.trim() || !roomId) {
        console.error("Cannot send message: Empty message or missing room ID");
        return false;
    }

    if (!chatWebSocket) {
        console.error("Cannot send message: WebSocket is not initialized");
        return false;
    }

    if (chatWebSocket.readyState !== WebSocket.OPEN) {
        console.error(`WebSocket is not connected. Current state: ${
            chatWebSocket.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
            chatWebSocket.readyState === WebSocket.CLOSING ? 'CLOSING' :
            chatWebSocket.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN'
        }`);
        return false;
    }

    wsLog(`Sending message to room ${roomId}: ${message}`);

    const now = new Date();
    const timeStr = window.BlinkUtils ?
        window.BlinkUtils.formatTime(now) :
        now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12:false});
    const tempId = 'temp-' + Date.now();

    const msgData = {
        type: "message",
        content: message,
        room_id: roomId,
        time: timeStr,
        temp_id: tempId
    };

    try {
        const jsonStr = JSON.stringify(msgData);
        wsLog(`Sending WebSocket message: ${jsonStr}`);
        chatWebSocket.send(jsonStr);
        return { success: true, tempId, timeStr };
    } catch (error) {
        console.error("Error sending message:", error);
        return { success: false, error };
    }
}

// Send read receipts for messages
function sendReadReceipts(roomId, messageIds) {
    if (!roomId || !messageIds || !messageIds.length || !chatWebSocket) {
        console.error("Cannot send read receipts: Missing parameters");
        return false;
    }

    if (chatWebSocket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not connected");
        return false;
    }

    wsLog(`Sending read receipts for messages: ${messageIds.join(', ')}`);

    if (window.BlinkUtils) {
        messageIds.forEach((id) => {
            window.BlinkUtils.updateMessageStatus(id, "read");
            wsLog(`Optimistically updated message ${id} to read`);
        });
    }

    const readData = {
        type: "seen",
        room_id: roomId,
        message_ids: messageIds
    };

    try {
        chatWebSocket.send(JSON.stringify(readData));
        return true;
    } catch (error) {
        console.error("Error sending read receipts:", error);
        if (window.BlinkUtils) {
            messageIds.forEach((id) => {
                window.BlinkUtils.updateMessageStatus(id, "delivered");
            });
        }
        return false;
    }
}

// Set current room information
function setCurrentRoom(roomId, isGroup, userId) {
    wsLog(`Setting current room: id=${roomId}, isGroup=${isGroup}, userId=${userId}`);
    currentRoomId = roomId;
    currentRoomIsGroup = isGroup;
    currentUserId = userId;

    const isUserAction = document.getElementById('chatContent')?.style.display === 'flex';
    if (roomId && isUserAction) {
        localStorage.setItem('lastOpenedRoomId', roomId);
    }
}

// Export the WebSocket API
window.BlinkWebSocket = {
    initializeWebSockets,
    connectPresenceWebSocket,
    connectChatWebSocket,
    sendChatMessage,
    sendReadReceipts,
    setCurrentRoom,
    getCurrentRoomId: () => currentRoomId,
    getCurrentRoomIsGroup: () => currentRoomIsGroup,
    getCurrentUserId: () => currentUserId,

    updateMessage: function(roomId, messageId, content, callback) {
        if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not connected");
            if (typeof callback === 'function') callback(false);
            return false;
        }

        wsLog(`Updating message ${messageId} in room ${roomId}`);

        const updateData = {
            type: "update_message",
            room_id: roomId,
            message_id: messageId,
            content: content
        };

        try {
            const messageHandler = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "message_updated" && data.message_id === messageId) {
                        wsLog("Message update confirmed:", data);
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(true);
                    }
                    else if (data.type === "error" && data.message_id === messageId) {
                        wsLog("Message update failed:", data);
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(false);
                    }
                } catch (error) {
                    console.error("Error parsing message update response:", error);
                }
            };

            chatWebSocket.addEventListener('message', messageHandler);

            setTimeout(() => {
                chatWebSocket.removeEventListener('message', messageHandler);
                if (typeof callback === 'function') callback(false);
            }, 5000);

            chatWebSocket.send(JSON.stringify(updateData));
            return true;
        } catch (error) {
            console.error("Error sending message update:", error);
            if (typeof callback === 'function') callback(false);
            return false;
        }
    },

    deleteMessage: function(roomId, messageId, callback) {
        if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not connected");
            if (typeof callback === 'function') callback(false);
            return false;
        }

        wsLog(`Deleting message ${messageId} in room ${roomId}`);

        const deleteData = {
            type: "delete_message",
            room_id: roomId,
            message_id: messageId
        };

        try {
            const messageHandler = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "message_deleted" && data.message_id === messageId) {
                        wsLog("Message deletion confirmed:", data);
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(true);
                    }
                    else if (data.type === "error" && data.message_id === messageId) {
                        wsLog("Message deletion failed:", data);
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(false);
                    }
                } catch (error) {
                    console.error("Error parsing message deletion response:", error);
                }
            };

            chatWebSocket.addEventListener('message', messageHandler);

            setTimeout(() => {
                chatWebSocket.removeEventListener('message', messageHandler);
                if (typeof callback === 'function') callback(false);
            }, 5000);

            chatWebSocket.send(JSON.stringify(deleteData));
            return true;
        } catch (error) {
            console.error("Error sending message deletion:", error);
            if (typeof callback === 'function') callback(false);
            return false;
        }
    }
};