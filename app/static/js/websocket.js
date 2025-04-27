/**
 * WebSocket handling for ShrekChat
 * Core connection and message handling functionality
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

// Initialize WebSocket - Should be called on page load
function initializeWebSockets() {
    wsLog("Initializing WebSockets...");
    connectPresenceWebSocket();
    setupCallEventListeners();

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

// Set up event listeners for call-related UI elements
function setupCallEventListeners() {
    if (window.shrekChatCall && typeof window.shrekChatCall.initWebRTC === 'function') {
        window.shrekChatCall.initWebRTC();
    } else {
        window.addEventListener('websocket_message', handleWebSocketCallMessage);
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
        if (window.shrekChatUtils) {
            requestAnimationFrame(() => {
                window.shrekChatUtils.updateContactStatus(userId, status, 'websocket');
                wsLog(`Applied status update for user ${userId}: ${status}`);
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

                    // Setup heartbeat
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

                setupChatWebSocketEvents(chatWebSocket);

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
function setupChatWebSocketEvents(webSocket) {
    webSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            wsLog("ChatSocket message received:", data);

            // Create a custom event to propagate WebSocket messages
            const messageEvent = new CustomEvent('websocket_message', { detail: data });
            window.dispatchEvent(messageEvent);

            if (data.type === "message") {
                handleChatMessage(data);
            } else if (data.type === "message_read") {
                const messageIds = Array.isArray(data.message_ids) ? data.message_ids : [data.message_id];
                messageIds.forEach((id) => {
                    if (window.shrekChatUtils) {
                        window.shrekChatUtils.updateMessageStatus(id, "read");
                    }
                });
            } else if (data.type === "typing") {
                // Typing indicators handled by custom events
            } else if (data.type === "message_updated" || data.type === "message_deleted") {
                // Message updates handled by custom events
                const eventName = data.type === "message_updated" ? "message-updated" : "message-deleted";
                const eventDetail = data.type === "message_updated" 
                    ? { messageId: data.message_id, content: data.content } 
                    : { messageId: data.message_id, deletedBy: data.deleted_by };
                
                window.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
            } else if (data.type === "new_room") {
                // Handle new room notification (both direct and group)
                if (window.shrekChatUtils && window.shrekChatUtils.updateRoomList) {
                    window.shrekChatUtils.updateRoomList(data.room);
                }
                
                // Play notification sound for new room
                try {
                    const notificationSound = new Audio('/static/sounds/notification.mp3');
                    notificationSound.play().catch(e => console.log('Failed to play notification sound:', e));
                } catch (soundError) {
                    console.log('Failed to play notification sound:', soundError);
                }
            } else if (data.type === "group_deleted") {
                // Handle group deletion notification
                const roomElement = document.querySelector(`.contact-item[data-room-id="${data.room_id}"]`);
                if (roomElement) {
                    roomElement.remove();
                }
                // If the deleted group is currently open, close it
                if (parseInt(currentRoomId) === parseInt(data.room_id)) {
                    const chatContent = document.getElementById('chatContent');
                    const welcomeContainer = document.getElementById('welcomeContainer');
                    if (chatContent) chatContent.style.display = 'none';
                    if (welcomeContainer) welcomeContainer.style.display = 'flex';
                }
            } else if (data.type === "chat_cleared") {
                // Handle chat cleared notification
                if (parseInt(currentRoomId) === parseInt(data.room_id)) {
                    const chatMessages = document.getElementById('chatMessages');
                    if (chatMessages) {
                        chatMessages.innerHTML = '';
                    }
                }
            } else if (data.type === "avatar_update") {
                handleAvatarUpdate(data.user_id, data.avatar_url);
            } else if (data.type === "own_avatar_update") {
                handleOwnAvatarUpdate(data.avatar_url);
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error, event.data);
        }
    };
}

// Observe messages for visibility and send read receipts
function observeMessagesForRead() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const messageElement = entry.target;
                    const messageId = messageElement.getAttribute('data-message-id');
                    const isRead = messageElement.querySelector('.message-status-double.read');
                    if (!isRead && currentRoomId && messageId) {
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

    // Observe all messages with IDs
    document.querySelectorAll('.message[data-message-id]').forEach((message) => {
        messageObserver.observe(message);
    });
}

// Handle WebSocket call messages
function handleWebSocketCallMessage(event) {
    const data = event.detail;
    if (!data || !data.type) return;

    const callModule = window.shrekChatCall;
    if (callModule) {
        switch (data.type) {
            case 'call_offer': callModule.handleCallOffer(data); break;
            case 'call_answer': callModule.handleCallAnswer(data); break;
            case 'call_ice_candidate': callModule.handleIceCandidate(data); break;
            case 'call_end': callModule.handleCallEnd(data); break;
            case 'call_decline': callModule.handleCallDeclined(data); break;
        }
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
        message.content.includes('<doc-attachment') ||
        (message.attachment && message.attachment.url)
    );

    // Update sidebar UI with new message info
    if (window.shrekChatUtils) {
        // Get consistent display name for attachments
        let displayContent = isAttachment ? getAttachmentDisplayName(message) : message.content;
        
        // Always update the last message in the sidebar
        window.shrekChatUtils.updateLastMessage(message.room_id, displayContent, message.time);
        
        // Move contact to top of sidebar
        const contactElement = document.querySelector(`.contact-item[data-room-id="${message.room_id}"]`);
        if (contactElement?.parentElement) {
            contactElement.parentElement.insertBefore(contactElement, contactElement.parentElement.firstChild);
        }
    }

    if (parseInt(currentRoomId) === parseInt(message.room_id)) {
        if (isConfirmation && message.temp_id) {
            // Update temporary message with confirmed ID
            processConfirmedMessage(message, isAttachment);
        } else {
            // New incoming message from another user - prioritize immediate display for attachments
            if (isAttachment) {
                wsLog(`Prioritizing immediate display of attachment message: ${message.id}`);
                processIncomingMessage(message, true);
            } else {
                processIncomingMessage(message, false);
            }
        }
    } else {
        // Message for a different room - increment unread count
        // Always increment unread count for non-confirmation messages
        if (!isConfirmation && window.shrekChatUtils) {
            wsLog(`Incrementing unread count for room: ${message.room_id} (attachment: ${isAttachment})`);
            window.shrekChatUtils.incrementUnreadCount(message.room_id);
            
            // Play notification sound
            try {
                const notificationSound = new Audio('/static/sounds/notification.mp3');
                notificationSound.play().catch(e => console.log('Failed to play notification sound:', e));
            } catch (soundError) {
                console.log('Failed to play notification sound:', soundError);
            }
        }
    }
}

// Process a confirmed message (sent by current user)
function processConfirmedMessage(message, isAttachment) {
    const tempMessage = document.querySelector(`.message[data-message-id="${message.temp_id}"]`);
    
    if (tempMessage) {
        // Update message ID and status indicators
        tempMessage.setAttribute('data-message-id', message.id);
        tempMessage.removeAttribute('data-temp-message');
        
        const messageStatusSingle = tempMessage.querySelector('.message-status-single');
        const messageStatusDouble = tempMessage.querySelector('.message-status-double');
        
        if (messageStatusSingle && messageStatusDouble) {
            messageStatusSingle.style.display = 'none';
            messageStatusDouble.style.display = 'inline';
            if (message.read) {
                messageStatusDouble.classList.add('read');
            }
        }

        // For attachments, update content and sidebar
        if (isAttachment) {
            updateAttachmentContent(tempMessage, message.content, message.attachment);
            
            // Update sidebar for sender's own attachments
            if (window.shrekChatUtils) {
                // Get consistent display name for the attachment
                let displayContent = getAttachmentDisplayName(message);
                
                // Force update the sidebar display for the sender
                window.shrekChatUtils.updateLastMessage(message.room_id, displayContent, message.time);
                wsLog(`Updated sender's sidebar for attachment: ${displayContent}`);
            }
        }
    } else if (window.displayMessage) {
        // If temp message not found, display as new
        window.displayMessage(message);
        observeMessagesForRead();
    }
}

// Helper function to get consistent display name for attachments
function getAttachmentDisplayName(message) {
    // Use the provided display_name if available
    if (message.display_name) {
        return message.display_name;
    }
    
    // Otherwise determine from content/attachment type
    if (message.content) {
        if (message.content.includes('<img-attachment')) return '📷 Photo';
        if (message.content.includes('<video-attachment')) return '🎥 Video';
        if (message.content.includes('<audio-attachment')) return '🎵 Audio';
        if (message.content.includes('<doc-attachment')) return '📄 Document';
    }
    
    // Check legacy attachment format
    if (message.attachment && message.attachment.type) {
        const type = message.attachment.type;
        if (type === 'photo' || type === 'image') return '📷 Photo';
        if (type === 'video') return '🎥 Video';
        if (type === 'audio') return '🎵 Audio';
        return `📎 ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }
    
    // Default fallback
    return '📎 Attachment';
}

// Process an incoming message from another user    
function processIncomingMessage(message, isAttachment) {
    const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);
    
    if (!existingMessage && window.displayMessage) {
        if (isAttachment && typeof message.content === 'string') {
            const originalContent = message.content;
            window.displayMessage(message);
            
            // Verify attachment rendering after display
            setTimeout(() => {
                verifyAttachmentRendering(message.id, originalContent);
            }, 50);
        } else {
            window.displayMessage(message);
        }
        observeMessagesForRead();
    }
}

// Update attachment content in a message element
function updateAttachmentContent(messageElement, content, attachmentData) {
    const messageContent = messageElement.querySelector('.message-content');
    if (!messageContent) return;

    if (content && typeof content === 'string') {
        if (content.includes('<img-attachment')) {
            const src = content.match(/src='([^']+)'/)[1];
            const filename = content.match(/filename='([^']+)'/)[1];
            messageContent.innerHTML = `
                <div class="attachment-preview">
                    <img src="${src}" alt="${filename}" onclick="window.openAttachmentFullscreen('${src}', 'image')">
                </div>
            `;
        } else if (content.includes('<video-attachment')) {
            const src = content.match(/src='([^']+)'/)[1];
            const filename = content.match(/filename='([^']+)'/)[1];
            messageContent.innerHTML = `
                <div class="attachment-preview">
                    <video src="${src}" controls preload="metadata"></video>
                </div>
            `;
        } else if (content.includes('<audio-attachment')) {
            const src = content.match(/src='([^']+)'/)[1];
            const filename = content.match(/filename='([^']+)'/)[1];
            messageContent.innerHTML = `
                <div class="attachment-preview">
                    <audio src="${src}" controls></audio>
                    <div class="attachment-name">${filename}</div>
                </div>
            `;
        } else if (content.includes('<doc-attachment')) {
            const src = content.match(/src='([^']+)'/)[1];
            const filename = content.match(/filename='([^']+)'/)[1];
            messageContent.innerHTML = `
                <div class="attachment-document">
                    <i class="fas fa-file-alt"></i>
                    <div class="attachment-info">
                        <div class="attachment-name">${filename}</div>
                        <a href="${src}" target="_blank" class="attachment-download">Download</a>
                    </div>
                </div>
            `;
        }
    } else if (attachmentData && attachmentData.url) {
        // Legacy format support
        const { type, url, filename } = attachmentData;
        if (type === 'photo' || type === 'image') {
            messageContent.innerHTML = `
                <div class="attachment-preview">
                    <img src="${url}" alt="${filename}" onclick="window.openAttachmentFullscreen('${url}', 'image')">
                </div>
            `;
        } else if (type === 'video') {
            messageContent.innerHTML = `
                <div class="attachment-preview">
                    <video src="${url}" controls preload="metadata"></video>
                </div>
            `;
        } else if (type === 'audio') {
            messageContent.innerHTML = `
                <div class="attachment-preview">
                    <audio src="${url}" controls></audio>
                    <div class="attachment-name">${filename}</div>
                </div>
            `;
        } else {
            messageContent.innerHTML = `
                <div class="attachment-document">
                    <i class="fas fa-file-alt"></i>
                    <div class="attachment-info">
                        <div class="attachment-name">${filename}</div>
                        <a href="${url}" target="_blank" class="attachment-download">Download</a>
                    </div>
                </div>
            `;
        }
    }
}

// Verify an attachment was rendered correctly and fix if needed
function verifyAttachmentRendering(messageId, originalContent) {
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const content = messageElement.querySelector('.message-content');
    if (!content) return;
    
    if (!content.innerHTML.includes('attachment-preview') && !content.innerHTML.includes('attachment-document')) {
        updateAttachmentContent(messageElement, originalContent);
        wsLog(`Fixed attachment display for message ${messageId}`);
    }
}

// Send read receipts for messages
function sendReadReceipts(roomId, messageIds) {
    if (!roomId || !messageIds || !messageIds.length || !chatWebSocket) {
        return false;
    }

    if (chatWebSocket.readyState !== WebSocket.OPEN) {
        return false;
    }

    wsLog(`Sending read receipts for messages: ${messageIds.join(', ')}`);

    // Optimistically update UI
    if (window.shrekChatUtils) {
        messageIds.forEach((id) => {
            window.shrekChatUtils.updateMessageStatus(id, "read");
        });
    }

    try {
        chatWebSocket.send(JSON.stringify({
            type: "seen",
            room_id: roomId,
            message_ids: messageIds
        }));
        return true;
    } catch (error) {
        console.error("Error sending read receipts:", error);
        return false;
    }
}

// Send a message through WebSocket
function sendChatMessage(message, roomId) {
    if (!message.trim() || !roomId || !chatWebSocket) {
        return false;
    }

    if (chatWebSocket.readyState !== WebSocket.OPEN) {
        return false;
    }

    const now = new Date();
    const timeStr = window.shrekChatUtils?.formatTime(now) || 
        now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12:false});
    const tempId = 'temp-' + Date.now();

    try {
        chatWebSocket.send(JSON.stringify({
            type: "message",
            content: message,
            room_id: roomId,
            time: timeStr,
            temp_id: tempId
        }));
        return { success: true, tempId, timeStr };
    } catch (error) {
        console.error("Error sending message:", error);
        return { success: false, error };
    }
}

// Set current room information
function setCurrentRoom(roomId, isGroup, userId) {
    currentRoomId = roomId;
    currentRoomIsGroup = isGroup;
    currentUserId = userId;

    if (roomId && document.getElementById('chatContent')?.style.display === 'flex') {
        localStorage.setItem('lastOpenedRoomId', roomId);
    }
}

// Handle avatar update for other users
function handleAvatarUpdate(userId, avatarUrl) {
    wsLog(`Received avatar update for user ${userId}: ${avatarUrl}`);
    
    // Update avatar in contact list
    const contactItems = document.querySelectorAll(`.contact-item[data-user-id="${userId}"]`);
    contactItems.forEach(contactItem => {
        const avatarImg = contactItem.querySelector('.contact-avatar img');
        if (avatarImg) {
            avatarImg.src = avatarUrl;
        }
    });
    
    // Update avatar in group member lists
    const groupMembers = document.querySelectorAll(`.group-member[data-user-id="${userId}"]`);
    groupMembers.forEach(member => {
        const avatarImg = member.querySelector('.member-avatar img');
        if (avatarImg) {
            avatarImg.src = avatarUrl;
        }
    });
    
    // Update avatar in active chat header if this user's chat is open
    const chatHeader = document.getElementById('chatHeader');
    if (chatHeader) {
        const currentUserId = chatHeader.getAttribute('data-user-id');
        if (currentUserId === userId.toString()) {
            const headerAvatar = document.getElementById('chatContactAvatar');
            if (headerAvatar) {
                headerAvatar.src = avatarUrl;
            }
        }
    }
    
    // Update avatar in contact info popup
    const contactInfoAvatar = document.getElementById('contactInfoAvatar');
    const contactInfoUserIdAttr = document.getElementById('contactInfoPopup')?.getAttribute('data-user-id');
    if (contactInfoAvatar && contactInfoUserIdAttr === userId.toString()) {
        contactInfoAvatar.src = avatarUrl;
    }
    
    // Update avatar in group messages from this user
    const userMessages = document.querySelectorAll(`.group-message[data-sender-id="${userId}"]`);
    userMessages.forEach(message => {
        const avatarImg = message.querySelector('.message-avatar img');
        if (avatarImg) {
            avatarImg.src = avatarUrl;
        }
    });
}

// Handle own avatar update
function handleOwnAvatarUpdate(avatarUrl) {
    wsLog(`Received own avatar update: ${avatarUrl}`);
    
    // Update avatar in profile sidebar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = avatarUrl;
    }
    
    // Update avatar in sidebar header
    const sidebarAvatar = document.querySelector('.profile-btn .profile-picture img');
    if (sidebarAvatar) {
        sidebarAvatar.src = avatarUrl;
    }
    
    // Update avatar in profile edit popup
    const editProfileAvatar = document.querySelector('.profile-avatar-circle img');
    if (editProfileAvatar) {
        editProfileAvatar.src = avatarUrl;
    }
    
    // Update all other places where the current user's avatar appears
    const currentUserElements = document.querySelectorAll('.current-user-avatar');
    currentUserElements.forEach(element => {
        const avatarImg = element.querySelector('img');
        if (avatarImg) {
            avatarImg.src = avatarUrl;
        }
    });
}

// Export the WebSocket API
window.shrekChatWebSocket = {
    initializeWebSockets,
    connectPresenceWebSocket,
    connectChatWebSocket,
    sendChatMessage,
    sendReadReceipts,
    setCurrentRoom,
    getCurrentRoomId: () => currentRoomId,
    getCurrentRoomIsGroup: () => currentRoomIsGroup,
    getCurrentUserId: () => currentUserId,
    
    // Message editing
    updateMessage: function(roomId, messageId, content, callback) {
        if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
            if (typeof callback === 'function') callback(false);
            return false;
        }

        const messageHandler = function(event) {
            try {
                const data = JSON.parse(event.data);
                if ((data.type === "message_updated" || data.type === "error") && data.message_id === messageId) {
                    chatWebSocket.removeEventListener('message', messageHandler);
                    if (typeof callback === 'function') callback(data.type === "message_updated");
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

        try {
            chatWebSocket.send(JSON.stringify({
                type: "update_message",
                room_id: roomId,
                message_id: messageId,
                content: content
            }));
            return true;
        } catch (error) {
            console.error("Error sending message update:", error);
            if (typeof callback === 'function') callback(false);
            return false;
        }
    },

    // Message deletion
    deleteMessage: function(roomId, messageId, callback) {
        if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
            if (typeof callback === 'function') callback(false);
            return false;
        }

        const messageHandler = function(event) {
            try {
                const data = JSON.parse(event.data);
                if ((data.type === "message_deleted" || data.type === "error") && data.message_id === messageId) {
                    chatWebSocket.removeEventListener('message', messageHandler);
                    if (typeof callback === 'function') callback(data.type === "message_deleted");
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

        try {
            chatWebSocket.send(JSON.stringify({
                type: "delete_message",
                room_id: roomId,
                message_id: messageId
            }));
            return true;
        } catch (error) {
            console.error("Error sending message deletion:", error);
            if (typeof callback === 'function') callback(false);
            return false;
        }
    },
    
    // WebRTC call signaling
    sendCallSignaling: function(data) {
        if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            chatWebSocket.send(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Error sending call signaling:", error);
            return false;
        }
    }
};