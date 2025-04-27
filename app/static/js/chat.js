/**
 * Chat functionality for ShrekChat
 */

console.log("Script execution started");


document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded - chat.js");

    // DOM Elements - Chat
    const contactsList = document.getElementById('contactsList');
    const searchInput = document.getElementById('searchInput');
    const chatContent = document.getElementById('chatContent');
    const welcomeContainer = document.getElementById('welcomeContainer');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const chatContactName = document.getElementById('chatContactName');
    const chatContactStatus = document.getElementById('chatContactPresence');
    const chatContactAvatar = document.getElementById('chatContactAvatar');
    const chatHeader = document.getElementById('chatHeader');
    const overlay = document.getElementById('overlay');

    // DOM Elements - Contact Info
    const contactInfoPopup = document.getElementById('contactInfoPopup');
    const closeContactInfoPopup = document.getElementById('closeContactInfoPopup');
    const contactInfoName = document.getElementById('contactInfoName');
    const contactInfoUsername = document.getElementById('contactInfoUsername');
    const contactInfoEmail = document.getElementById('contactInfoEmail');
    const contactInfoAvatar = document.getElementById('contactInfoAvatar');
    const contactInfoStatus = document.getElementById('contactInfoStatus');
    const closeInfoButton = document.getElementById('closeInfoButton');

    // DOM Elements - Message Template
    const messageTemplate = document.getElementById('messageTemplate');

    // Store current username to identify self messages
    const currentUsername = document.querySelector('.profile-name')?.textContent.trim();

    // Mobile responsiveness
    const backButton = document.querySelector('.back-btn');
    const sidebar = document.querySelector('.sidebar');

    // Log key DOM elements for debugging
    console.log("Chat.js: Key DOM elements loaded", {
        contactsList: !!contactsList,
        chatContent: !!chatContent,
        chatContactName: !!chatContactName,
        chatContactStatus: !!chatContactStatus,
        messageTemplate: !!messageTemplate
    });

    if (!chatContactName || !chatContactStatus) {
        console.error("Critical DOM elements missing:", {
            chatContactName: !!chatContactName,
            chatContactStatus: !!chatContactStatus
        });
    }

    // Save chat state (scroll position, room ID) before unload
    function saveChatState() {
        const timestamp = new Date().toISOString();
        if (chatMessages && chatContent) {
            const roomId = chatContent.getAttribute('data-current-room-id');
            if (roomId && chatContent.style.display === 'flex') {
                const scrollPosition = chatMessages.scrollTop;
                sessionStorage.setItem('chatState', JSON.stringify({
                    roomId,
                    scrollPosition,
                    timestamp
                }));
                console.log(`[${timestamp}] Saved chat state: roomId=${roomId}, scrollPosition=${scrollPosition}`);
            }
        }
    }

    // Restore chat state after load
    function restoreChatState(roomData) {
        const timestamp = new Date().toISOString();
        const chatState = sessionStorage.getItem('chatState');
        if (chatState && roomData) {
            const { roomId, scrollPosition } = JSON.parse(chatState);
            if (parseInt(roomId) === parseInt(roomData.id)) {
                console.log(`[${timestamp}] Restoring chat state: roomId=${roomId}, scrollPosition=${scrollPosition}`);
                updateChatHeader(roomData);
                chatMessages.innerHTML = ''; // Clear to ensure fresh messages
                loadMessages(roomData.id, scrollPosition);
                return true;
            }
        }
        return false;
    }

    // Check if chat is already open and restore if possible
    function restoreChatIfOpen(roomData) {
        const timestamp = new Date().toISOString();
        const currentRoomId = chatContent?.getAttribute('data-current-room-id');
        if (currentRoomId && parseInt(currentRoomId) === parseInt(roomData.id) && chatContent.style.display === 'flex') {
            console.log(`[${timestamp}] Chat for room ${roomData.id} already open, restoring state`);
            updateChatHeader(roomData);
            loadMessages(roomData.id); // Load messages without clearing if possible
            return true;
        }
        return restoreChatState(roomData);
    }

    // Mobile back button
    if (backButton) {
        backButton.addEventListener('click', function() {
            if (sidebar) {
                sidebar.classList.add('active');
            }
            if (chatContent) {
                chatContent.style.display = 'none';
            }
            if (welcomeContainer) {
                welcomeContainer.style.display = 'flex';
            }
        });
    }

    // Save chat state before page unload
    window.addEventListener('beforeunload', saveChatState);

    // Fetch user status immediately
    function fetchUserStatus(userId, callback) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Fetching status for user ${userId}`);
        fetch(`/api/user/${userId}/status`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch status for user ${userId}`);
                }
                return response.json();
            })
            .then(data => {
                const status = data.status === 'online' || data.status === 'offline' ? data.status : 'offline';
                console.log(`[${timestamp}] Fetched status for user ${userId}: ${status}`);
                window.shrekChatUtils.updateContactStatus(userId, status, 'api');
                if (typeof callback === 'function') callback(status);
            })
            .catch(error => {
                console.error(`[${timestamp}] Error fetching status for user ${userId}:`, error);
                if (typeof callback === 'function') callback(null);
            });
    }

    // Load rooms list (both direct chats and groups) with periodic polling
    function loadContacts() {
        console.log("Loading contacts...");
        function fetchRooms() {
            const timestamp = new Date().toISOString();
            fetch('/api/rooms')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load rooms');
                    }
                    return response.json();
                })
                .then(rooms => {
                    console.log(`[${timestamp}] Loaded rooms:`, rooms.length);
                    contactsList.innerHTML = '';
                    rooms.forEach(room => {
                        // Use cached status if available and fresher than API
                        if (!room.is_group && room.user_id && window.shrekChatUtils.statusCache[room.user_id]) {
                            const cached = window.shrekChatUtils.statusCache[room.user_id];
                            room.status = cached.status;
                            console.log(`[${timestamp}] Used cached status for user ${room.user_id}: ${room.status}`);
                        }
                        addRoomToList(room);
                    });
                })
                .catch(error => {
                    console.error(`[${timestamp}] Error loading rooms:`, error);
                });
        }

        fetchRooms();
    }

    // Refresh rooms list without clearing existing chats
    function refreshRoomsList() {
        const timestamp = new Date().toISOString();
        fetch('/api/rooms')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load rooms');
                }
                return response.json();
            })
            .then(rooms => {
                const existingRoomIds = Array.from(
                    document.querySelectorAll('.contact-item')
                ).map(el => el.getAttribute('data-room-id'));
                rooms.forEach(room => {
                    if (!existingRoomIds.includes(room.id.toString())) {
                        // Use cached status if available
                        if (!room.is_group && room.user_id && window.shrekChatUtils.statusCache[room.user_id]) {
                            room.status = window.shrekChatUtils.statusCache[room.user_id].status;
                            console.log(`[${timestamp}] Used cached status for new room user ${room.user_id}: ${room.status}`);
                        }
                        addRoomToList(room);
                    }
                });
            })
            .catch(error => {
                console.error(`[${timestamp}] Error refreshing rooms:`, error);
            });
    }

    // Add a single room to the list (direct chat or group)
    function addRoomToList(roomData) {
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        contactElement.setAttribute('data-room-id', roomData.id);
        if (roomData.is_group) {
            contactElement.setAttribute('data-is-group', 'true');
        } else {
            contactElement.setAttribute('data-user-id', roomData.user_id);
        }

        const statusClass = (roomData.status === 'online' || roomData.status === 'offline') ? roomData.status : 'offline';
        
        // Process last message if it appears to contain attachment markup
        let lastMessage = roomData.last_message || 'Click to start chatting!';
        if (lastMessage) {
            // Check for attachment patterns and replace with friendly names
            if (lastMessage.includes('<img-attachment')) {
                lastMessage = '📷 Photo';
            } else if (lastMessage.includes('<video-attachment')) {
                lastMessage = '🎥 Video';
            } else if (lastMessage.includes('<audio-attachment')) {
                lastMessage = '🎵 Audio';
            } else if (lastMessage.includes('<doc-attachment')) {
                lastMessage = '📄 Document';
            }
        }

        contactElement.innerHTML = `
            <div class="contact-avatar">
                <img src="${roomData.avatar || '/static/images/shrek.jpg'}" alt="${roomData.name} Avatar">
                ${!roomData.is_group ? `<span class="status-indicator ${statusClass}"></span>` : ''}
            </div>
            <div class="contact-info">
                <div class="contact-name-time">
                    <h4>${roomData.name || roomData.username || roomData.full_name}</h4>
                    <span class="message-time">${roomData.last_message_time || 'Now'}</span>
                </div>
                <p class="last-message">${lastMessage}</p>
            </div>
            ${roomData.unread_count > 0 ? `<div class="unread-count">${roomData.unread_count}</div>` : ''}
        `;

        contactElement.addEventListener('click', function() {
            console.log("Contact clicked:", roomData.id, roomData.name);
            openChat(roomData);
        });

        contactsList.appendChild(contactElement);
    }

    // Open a chat room (direct or group)
    function openChat(roomData) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] openChat called with:`, roomData);

        try {
            // Check if the chat is already open
            const currentRoomId = chatContent?.getAttribute('data-current-room-id');
            if (currentRoomId && parseInt(currentRoomId) === parseInt(roomData.id) && chatContent.style.display === 'flex') {
                console.log(`[${timestamp}] Chat for room ${roomData.id} already open, updating header only`);
                updateChatHeader(roomData);
                setupContactInfoHandler(roomData);
                return;
            }

            // Clean up existing status listeners to prevent leaks
            window.removeEventListener('status-update', window.currentStatusListener);
            document.querySelectorAll('.contact-item').forEach(contact => {
                contact.classList.remove('active');
            });

            const contactElement = document.querySelector(`.contact-item[data-room-id="${roomData.id}"]`);
            if (contactElement) {
                contactElement.classList.add('active');
                const unreadCount = contactElement.querySelector('.unread-count');
                if (unreadCount) {
                    unreadCount.remove();
                }
            }

            // Update chat header
            updateChatHeader(roomData);

            // Clear chat messages before loading new ones
            chatMessages.innerHTML = '';

            // Ensure the current room ID is updated correctly
            if (chatContent) {
                chatContent.setAttribute('data-current-room-id', roomData.id);
                if (!roomData.is_group) {
                    chatContent.setAttribute('data-current-user-id', roomData.user_id);
                } else {
                    chatContent.removeAttribute('data-current-user-id');
                }
            }

            // Store room info in WebSocket module
            if (window.shrekChatWebSocket) {
                window.shrekChatWebSocket.setCurrentRoom(
                    roomData.id,
                    roomData.is_group,
                    !roomData.is_group ? roomData.user_id : null
                );
            }

            // Show chat area
            if (welcomeContainer) welcomeContainer.style.display = 'none';
            if (chatContent) chatContent.style.display = 'flex';
            if (sidebar) sidebar.classList.remove('active');

            // Fetch latest status for direct chats
            if (!roomData.is_group && roomData.user_id) {
                fetchUserStatus(roomData.user_id, (status) => {
                    if (status) {
                        roomData.status = status; // Update roomData for header
                        updateChatHeader(roomData);
                    }
                });
            }

            // Connect WebSocket and load messages
            if (window.shrekChatWebSocket) {
                window.shrekChatWebSocket.connectChatWebSocket(roomData.id, function() {
                    loadMessages(roomData.id);
                }, false);
            } else {
                loadMessages(roomData.id);
            }

            setupContactInfoHandler(roomData);

            // Persistent status update listener
            window.currentStatusListener = function handler(event) {
                if (!roomData.is_group && event.detail.userId === roomData.user_id) {
                    roomData.status = event.detail.status;
                    updateChatHeader(roomData);
                    console.log(`[${timestamp}] Updated chat header for user ${roomData.user_id} to ${roomData.status} via status-update event`);
                }
            };
            window.addEventListener('status-update', window.currentStatusListener);
        } catch (error) {
            console.error(`[${timestamp}] Error in openChat function:`, error);
        }
    }

    // Update chat header with contact info
    function updateChatHeader(roomData) {
        const timestamp = new Date().toISOString();
        const chatContactNameElement = document.getElementById('chatContactName');
        const chatContactStatusElement = document.getElementById('chatContactPresence');
        const chatContactAvatarElement = document.getElementById('chatContactAvatar');

        if (!chatContactNameElement || !chatContactStatusElement || !chatContactAvatarElement) {
            console.error(`[${timestamp}] Critical DOM elements missing for chat header update`);
            return;
        }

        chatContactNameElement.textContent = roomData.name || roomData.username || roomData.full_name || 'Chat';

        if (!roomData.is_group) {
            // Use cached status if available
            const cachedStatus = roomData.user_id && window.shrekChatUtils.statusCache[roomData.user_id]?.status;
            const statusText = cachedStatus || (roomData.status === 'online' || roomData.status === 'offline' ? roomData.status : 'offline');
            chatContactStatusElement.textContent = statusText === 'online' ? 'Online' : 'Offline';
            chatContactStatusElement.className = `status-text ${statusText}`;
            console.log(`[${timestamp}] Updated chat header status for user ${roomData.user_id}: ${statusText} (cached: ${!!cachedStatus})`);
        } else {
            chatContactStatusElement.textContent = 'Group';
            chatContactStatusElement.className = 'status-text group';
        }

        chatContactAvatarElement.src = roomData.avatar || '/static/images/shrek.jpg';
    }

    // Setup handler for contact info button
    function setupContactInfoHandler(roomData) {
        const viewContactInfo = document.getElementById('viewContactInfo');
        if (viewContactInfo) {
            viewContactInfo.textContent = roomData.is_group ? 'Group info' : 'Contact info';
            const newViewContactInfo = viewContactInfo.cloneNode(true);
            viewContactInfo.parentNode.replaceChild(newViewContactInfo, viewContactInfo);
            newViewContactInfo.addEventListener('click', function() {
                if (roomData.is_group) {
                    const groupManagementPopup = document.getElementById('groupManagementPopup');
                    if (groupManagementPopup) {
                        groupManagementPopup.classList.add('open');
                        overlay.classList.add('active');
                        if (window.loadGroupDetails) {
                            window.loadGroupDetails(roomData.id);
                        }
                    }
                } else {
                    // Fetch full room details if email is missing
                    if (!roomData.email && !roomData.is_group) {
                        fetch(`/api/rooms/${roomData.id}`)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Failed to fetch room details');
                                }
                                return response.json();
                            })
                            .then(fullRoomData => {
                                Object.assign(roomData, fullRoomData); // Merge full details into roomData
                                showContactInfo(roomData); // Display contact info with email
                            })
                            .catch(error => {
                                console.error('Error fetching room details:', error);
                            });
                    } else {
                        showContactInfo(roomData); // Display contact info immediately if email is present
                    }
                }
                const dropdownMenu = document.querySelector('.dropdown-menu.active');
                if (dropdownMenu) {
                    dropdownMenu.classList.remove('active');
                }
            });
        }

        // Setup clear chat functionality
        const clearChatItem = document.getElementById('clearChat');
        if (clearChatItem) {
            const newClearChatItem = clearChatItem.cloneNode(true);
            clearChatItem.parentNode.replaceChild(newClearChatItem, clearChatItem);
            newClearChatItem.addEventListener('click', function() {
                Swal.fire({
                    icon: 'warning',
                    title: 'Are you sure?',
                    text: 'This cannot be undone.',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, clear it!',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed) {
                        const currentRoomId = chatContent.getAttribute('data-current-room-id');
                        if (!currentRoomId) {
                            return;
                        }

                        fetch(`/api/rooms/${currentRoomId}/messages`, {
                            method: 'DELETE'
                        })
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Failed to clear chat');
                                }
                                return response.json();
                            })
                            .then(data => {
                                console.log('Chat cleared:', data);
                                chatMessages.innerHTML = '';
                                if (window.shrekChatUtils) {
                                    window.shrekChatUtils.updateLastMessage(currentRoomId, 'Chat cleared', null);
                                }
                                Swal.fire({
                                    icon: 'success',
                                    title: 'Chat Cleared',
                                    text: 'All messages have been successfully cleared.',
                                    confirmButtonText: 'OK'
                                });
                            })
                            .catch(error => {
                                console.error('Error clearing chat:', error);
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error',
                                    text: 'Failed to clear chat. Please try again.',
                                    confirmButtonText: 'OK'
                                });
                            });
                    }
                });

                const dropdownMenu = document.querySelector('.dropdown-menu.active');
                if (dropdownMenu) {
                    dropdownMenu.classList.remove('active');
                }
            });
        }

        const chatContactInfo = document.querySelector('.chat-contact-info');
        if (chatContactInfo) {
            const newChatContactInfo = chatContactInfo.cloneNode(true);
            chatContactInfo.parentNode.replaceChild(newChatContactInfo, chatContactInfo);
            newChatContactInfo.addEventListener('click', function() {
                if (roomData.is_group) {
                    const groupManagementPopup = document.getElementById('groupManagementPopup');
                    if (groupManagementPopup) {
                        groupManagementPopup.classList.add('open');
                        overlay.classList.add('active');
                        if (window.loadGroupDetails) {
                            window.loadGroupDetails(roomData.id);
                        }
                    }
                } else {
                    // Fetch full room details if email is missing
                    if (!roomData.email && !roomData.is_group) {
                        fetch(`/api/rooms/${roomData.id}`)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Failed to fetch room details');
                                }
                                return response.json();
                            })
                            .then(fullRoomData => {
                                Object.assign(roomData, fullRoomData); // Merge full details into roomData
                                showContactInfo(roomData); // Display contact info with email
                            })
                            .catch(error => {
                                console.error('Error fetching room details:', error);
                            });
                    } else {
                        showContactInfo(roomData); // Display contact info immediately if email is present
                    }
                }
            });
        }
    }

    // Display contact info popup
    function showContactInfo(userData) {
        const timestamp = new Date().toISOString();
        
        // First set basic info that should be available
        contactInfoName.textContent = userData.full_name || userData.username;
        contactInfoUsername.textContent = userData.username;
        contactInfoEmail.textContent = userData.email || 'Not provided';
        contactInfoAvatar.src = userData.avatar || '/static/images/shrek.jpg';
        
        const contactInfoCountry = document.getElementById('contactInfoCountry');
        const contactInfoPhone = document.getElementById('contactInfoPhone');
        const contactInfoBio = document.getElementById('contactInfoBio');
        
        // Set status
        const cachedStatus = userData.user_id && window.shrekChatUtils.statusCache[userData.user_id]?.status;
        const statusText = cachedStatus || (userData.status === 'online' || userData.status === 'offline' ? userData.status : 'offline');
        contactInfoStatus.textContent = statusText === 'online' ? 'Online' : 'Offline';
        contactInfoStatus.className = `status-text ${statusText}`;
        
        // Set temp values while loading
        if (contactInfoCountry) {
            contactInfoCountry.textContent = 'Loading...';
        }
        
        if (contactInfoPhone) {
            contactInfoPhone.textContent = 'Loading...';
        }
        
        // Set bio placeholder until loaded
        if (contactInfoBio) {
            contactInfoBio.textContent = 'Loading...';
        }
        
        // Show the popup immediately
        contactInfoPopup.setAttribute('data-user-id', userData.user_id);
        contactInfoPopup.classList.add('open');
        overlay.classList.add('active');
        
        // Fetch complete user profile data to get country and phone_number
        fetch(`/api/user/${userData.user_id}/profile`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch user profile data');
                }
                return response.json();
            })
            .then(profileData => {
                // Update country and phone number with fresh data
                if (contactInfoCountry) {
                    contactInfoCountry.textContent = profileData.country || 'Not provided';
                }
                
                if (contactInfoPhone) {
                    contactInfoPhone.textContent = profileData.phone_number || 'Not provided';
                }
                
                // Update bio with profile data
                if (contactInfoBio) {
                    if (profileData.bio && profileData.bio.trim()) {
                        contactInfoBio.textContent = profileData.bio;
                        contactInfoBio.parentElement.style.display = 'block';
                    } else {
                        contactInfoBio.textContent = 'No bio provided';
                        contactInfoBio.parentElement.style.display = 'block';
                    }
                }
                
                console.log(`[${timestamp}] Updated contact info with profile data including country, phone, and bio for user ${userData.user_id}`);
            })
            .catch(error => {
                console.error(`[${timestamp}] Error fetching profile data:`, error);
                // Set default values in case of error
                if (contactInfoCountry) {
                    contactInfoCountry.textContent = userData.country || 'Not provided';
                }
                
                if (contactInfoPhone) {
                    contactInfoPhone.textContent = userData.phone_number || 'Not provided';
                }
                
                if (contactInfoBio) {
                    contactInfoBio.textContent = 'Not provided';
                }
            });
            
        console.log(`[${timestamp}] Showing contact info for user ${userData.user_id} with status ${statusText} (cached: ${!!cachedStatus})`);
    }

    // Load messages for a room
    function loadMessages(roomId, restoreScrollPosition = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Loading messages for room:`, roomId);

        // Check if messages are already loaded
        const existingMessages = document.querySelectorAll(`.message[data-message-id]`).length > 0;
        if (existingMessages && chatContent.getAttribute('data-current-room-id') === roomId.toString()) {
            console.log(`[${timestamp}] Messages already loaded for room ${roomId}, updating read receipts only`);
            // Update read receipts for unread messages
            const unreadMessageIds = Array.from(document.querySelectorAll(`.message[data-message-id]`))
                .filter(msg => !msg.querySelector('.message-status-double.read') && !msg.classList.contains('incoming'))
                .map(msg => msg.getAttribute('data-message-id'));
            if (unreadMessageIds.length > 0 && window.shrekChatWebSocket) {
                console.log(`[${timestamp}] Sending read receipts for existing messages:`, unreadMessageIds);
                window.shrekChatWebSocket.sendReadReceipts(roomId, unreadMessageIds);
                unreadMessageIds.forEach(id => {
                    if (window.shrekChatUtils) {
                        window.shrekChatUtils.updateMessageStatus(id, "read");
                    }
                });
            }
            return;
        }

        chatMessages.innerHTML = '<div class="system-message info">Loading messages...</div>';

        fetch(`/api/messages/${roomId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load messages');
                }
                return response.json();
            })
            .then(messages => {
                chatMessages.innerHTML = '';
                if (messages.length === 0) {
                    chatMessages.innerHTML = '';
                } else {
                    // Sort messages by their timestamp (if available) to ensure correct ordering
                    messages.sort((a, b) => {
                        const dateA = a.created_at ? new Date(a.created_at) : new Date();
                        const dateB = b.created_at ? new Date(b.created_at) : new Date();
                        return dateA - dateB;
                    });
                    
                    // Track current date to detect when we need to add a date separator
                    let currentDateStr = '';
                    
                    messages.forEach(message => {
                        // Determine message date (use timestamp if available, or fall back to created_at or current date)
                        const messageDate = message.timestamp ? new Date(message.timestamp) : 
                                           message.created_at ? new Date(message.created_at) : new Date();
                        const messageDateStr = messageDate.toISOString().split('T')[0]; // YYYY-MM-DD format for comparison
                        
                        // If this message is from a different day than previous one, add a date separator
                        if (messageDateStr !== currentDateStr) {
                            currentDateStr = messageDateStr;
                            
                            // Format the date for display (Today, Yesterday, or DD-MM-YY)
                            const displayDate = window.shrekChatUtils ? 
                                window.shrekChatUtils.formatDateForChat(messageDate) : 
                                messageDate.toLocaleDateString();
                            
                            // Create and add the date separator
                            const dateSeparator = document.createElement('div');
                            dateSeparator.className = 'date-separator';
                            dateSeparator.innerHTML = `<div class="date-separator-inner">${displayDate}</div>`;
                            chatMessages.appendChild(dateSeparator);
                            
                            console.log(`Added date separator: ${displayDate} for date: ${messageDateStr}`);
                        }
                        
                        // Display the message
                        displayMessage(message);
                    });
                }

                const unreadMessageIds = messages
                    .filter(msg => msg.sender !== 'user' && !msg.read)
                    .map(msg => msg.id);

                if (unreadMessageIds.length > 0 && window.shrekChatWebSocket) {
                    console.log(`[${timestamp}] Sending read receipts for messages:`, unreadMessageIds);
                    window.shrekChatWebSocket.sendReadReceipts(roomId, unreadMessageIds);
                    unreadMessageIds.forEach(id => {
                        if (window.shrekChatUtils) {
                            window.shrekChatUtils.updateMessageStatus(id, "read");
                        }
                    });
                }

                requestAnimationFrame(() => {
                    if (restoreScrollPosition !== null) {
                        chatMessages.scrollTop = restoreScrollPosition;
                        console.log(`[${timestamp}] Restored scroll position to ${restoreScrollPosition}`);
                    } else {
                        const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;
                        if (isNearBottom) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                            console.log(`[${timestamp}] Scrolled to bottom for initial message load`);
                        } else {
                            console.log(`[${timestamp}] Not scrolling: User is viewing older messages`);
                        }
                    }
                });
            })
            .catch(error => {
                console.error(`[${timestamp}] Error loading messages:`, error);
                chatMessages.innerHTML = '<div class="error-messages">Failed to load messages. Please try again.</div>';
            });
    }

    // Display a message in the chat
    function displayMessage(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] displayMessage called with:`, message);

        if (message.id && document.querySelector(`.message[data-message-id="${message.id}"]`)) {
            console.log(`[${timestamp}] Skipping duplicate message:`, message.id);
            return;
        }

        if (message.temp_id && document.querySelector(`.message[data-message-id="${message.temp_id}"]`)) {
            console.log(`[${timestamp}] This is a temp message we've already displayed:`, message.temp_id);
            return;
        }

        const isRoomGroup = window.shrekChatWebSocket ?
            window.shrekChatWebSocket.getCurrentRoomIsGroup() :
            message.is_group || false;

        const templateToUse = isRoomGroup ?
            document.getElementById('groupMessageTemplate') :
            messageTemplate;

        if (!templateToUse) {
            console.error(`[${timestamp}] Message template not found for`, isRoomGroup ? "group" : "direct", "message");
            return;
        }

        try {
            const messageElement = templateToUse.content.cloneNode(true);
            const messageDiv = messageElement.querySelector('.message');
            const messageContent = messageElement.querySelector('.message-content');
            const messageTime = messageElement.querySelector('.message-time');
            const messageAvatar = isRoomGroup ? messageElement.querySelector('.message-avatar') : null;
            const messageSender = isRoomGroup ? messageElement.querySelector('.message-sender') : null;

            // Check if message contains an attachment
            let hasAttachment = false;
            let attachmentContent = '';
            
            if (message.content) {
                // Check for image attachments
                if (message.content.includes('<img-attachment')) {
                    hasAttachment = true;
                    const src = message.content.match(/src='([^']+)'/)[1];
                    const filename = message.content.match(/filename='([^']+)'/)[1];
                    attachmentContent = `
                        <div class="attachment-preview">
                            <img src="${src}" alt="${filename}" onclick="window.openAttachmentFullscreen('${src}', 'image')">
                        </div>
                    `;
                    messageContent.innerHTML = attachmentContent;
                }
                // Check for video attachments
                else if (message.content.includes('<video-attachment')) {
                    hasAttachment = true;
                    const src = message.content.match(/src='([^']+)'/)[1];
                    const filename = message.content.match(/filename='([^']+)'/)[1];
                    attachmentContent = `
                        <div class="attachment-preview">
                            <video src="${src}" controls preload="metadata"></video>
                        </div>
                    `;
                    messageContent.innerHTML = attachmentContent;
                }
                // Check for audio attachments
                else if (message.content.includes('<audio-attachment')) {
                    hasAttachment = true;
                    const src = message.content.match(/src='([^']+)'/)[1];
                    const filename = message.content.match(/filename='([^']+)'/)[1];
                    attachmentContent = `
                        <div class="attachment-preview">
                            <audio src="${src}" controls></audio>
                            <div class="attachment-name">${filename}</div>
                        </div>
                    `;
                    messageContent.innerHTML = attachmentContent;
                }
                // Check for document attachments
                else if (message.content.includes('<doc-attachment')) {
                    hasAttachment = true;
                    const src = message.content.match(/src='([^']+)'/)[1];
                    const filename = message.content.match(/filename='([^']+)'/)[1];
                    attachmentContent = `
                        <div class="attachment-document">
                            <i class="fas fa-file-alt"></i>
                            <div class="attachment-info">
                                <div class="attachment-name">${filename}</div>
                                <a href="${src}" target="_blank" class="attachment-download">Download</a>
                            </div>
                        </div>
                    `;
                    messageContent.innerHTML = attachmentContent;
                }
                // If message has attachment data but no content markers (backward compatibility)
                else if (message.attachment && message.attachment.url) {
                    hasAttachment = true;
                    const { type, url, filename } = message.attachment;
                    
                    if (type === 'photo' || type === 'image') {
                        attachmentContent = `
                            <div class="attachment-preview">
                                <img src="${url}" alt="${filename}" onclick="window.openAttachmentFullscreen('${url}', 'image')">
                            </div>
                        `;
                    } else if (type === 'video') {
                        attachmentContent = `
                            <div class="attachment-preview">
                                <video src="${url}" controls preload="metadata"></video>
                            </div>
                        `;
                    } else if (type === 'audio') {
                        attachmentContent = `
                            <div class="attachment-preview">
                                <audio src="${url}" controls></audio>
                                <div class="attachment-name">${filename}</div>
                            </div>
                        `;
                    } else {
                        // Default to document
                        attachmentContent = `
                            <div class="attachment-document">
                                <i class="fas fa-file-alt"></i>
                                <div class="attachment-info">
                                    <div class="attachment-name">${filename}</div>
                                    <a href="${url}" target="_blank" class="attachment-download">Download</a>
                                </div>
                            </div>
                        `;
                    }
                    messageContent.innerHTML = attachmentContent;
                } else {
                    // Regular text message
                    messageContent.textContent = message.content;
                }
            } else {
                // Empty message content
                messageContent.textContent = '';
            }

            messageTime.textContent = message.time || (window.shrekChatUtils ?
                window.shrekChatUtils.formatTime(new Date()) :
                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

            if (message.id) {
                messageDiv.setAttribute('data-message-id', message.id);
            } else if (message.temp_id) {
                messageDiv.setAttribute('data-message-id', message.temp_id);
                messageDiv.setAttribute('data-temp-message', 'true');
            }

            let isCurrentUser = false;
            const currentUsername = document.querySelector('.profile-name')?.textContent.trim();

            if (message._isOptimistic === true) {
                isCurrentUser = true;
            } else if (message.sender === 'user') {
                isCurrentUser = true;
            } else if (currentUsername) {
                isCurrentUser = message.sender === currentUsername;
            }
            
            // Set data attribute on message div for sender identity
            if (isRoomGroup) {
                const senderId = isCurrentUser ? 'current-user' : (message.sender_id || message.sender || '');
                messageDiv.setAttribute('data-sender-id', senderId);
                
                // Set the username with appropriate styling
                if (messageSender) {
                    if (isCurrentUser) {
                        messageSender.textContent = "You";
                        messageSender.classList.add('current-user-name');
                    } else {
                        messageSender.textContent = message.sender_name || message.sender;
                        messageSender.classList.add('other-user-name');
                    }
                }
                
                // Set the avatar
                const messageAvatarImg = messageElement.querySelector('.message-avatar img');
                if (messageAvatarImg) {
                    if (isCurrentUser) {
                        // For current user's messages, use profile avatar
                        const profileAvatar = document.getElementById('profileAvatar');
                        if (profileAvatar && profileAvatar.src) {
                            messageAvatarImg.src = profileAvatar.src;
                            console.log(`[${timestamp}] Set own avatar in group message to: ${profileAvatar.src}`);
                        }
                    } else if (message.sender_avatar) {
                        // For other users' messages, use their avatar
                        messageAvatarImg.src = message.sender_avatar;
                        console.log(`[${timestamp}] Set group message avatar to: ${message.sender_avatar}`);
                    }
                }
                
                // Handle consecutive messages - check if the previous message is from the same sender
                const lastMessage = chatMessages.lastElementChild;
                
                if (lastMessage && lastMessage.classList.contains('message') && 
                    lastMessage.getAttribute('data-sender-id') === messageDiv.getAttribute('data-sender-id')) {
                    
                    // Hide avatar and username in current message (not the previous one)
                    if (messageSender) {
                        messageSender.style.display = 'none';
                    }
                    
                    // Add class to mark this message as part of a sequence
                    messageDiv.classList.add('consecutive-message');
                    lastMessage.classList.add('part-of-sequence');
                }
            }

            if (isCurrentUser) {
                messageDiv.classList.add('outgoing');
                
                if (!isRoomGroup) {
                    const messageStatusSingle = messageElement.querySelector('.message-status-single');
                    const messageStatusDouble = messageElement.querySelector('.message-status-double');
                    if (messageStatusSingle && messageStatusDouble) {
                        const messageStatus = message.status ||
                            (message.delivered ? (message.read ? 'read' : 'delivered') : 'sent');
                        if (messageStatus === 'sent' || !message.delivered) {
                            messageStatusSingle.style.display = 'inline';
                            messageStatusDouble.style.display = 'none';
                        } else if (messageStatus === 'delivered' || (message.delivered && !message.read)) {
                            messageStatusDouble.style.display = 'inline';
                            messageStatusDouble.classList.remove('read');
                            messageStatusSingle.style.display = 'none';
                        } else if (messageStatus === 'read' || message.read) {
                            messageStatusDouble.style.display = 'inline';
                            messageStatusDouble.classList.add('read');
                            messageStatusSingle.style.display = 'none';
                        }
                        if (window.pendingMessageStatuses && message.id && window.pendingMessageStatuses[message.id]) {
                            const pendingStatus = window.pendingMessageStatuses[message.id];
                            console.log(`[${timestamp}] Applying pending status update for message ${message.id}: ${pendingStatus}`);
                            if (pendingStatus === 'read') {
                                messageStatusDouble.style.display = 'inline';
                                messageStatusDouble.classList.add('read');
                                messageStatusSingle.style.display = 'none';
                            } else if (pendingStatus === 'delivered') {
                                messageStatusDouble.style.display = 'inline';
                                messageStatusDouble.classList.remove('read');
                                messageStatusSingle.style.display = 'none';
                            }
                            delete window.pendingMessageStatuses[message.id];
                        }
                    }
                }
            } else {
                messageDiv.classList.add('incoming');
                if (message.sender_id) {
                    messageDiv.setAttribute('data-sender-id', message.sender_id);
                }
                const statusIndicators = messageElement.querySelectorAll('.message-status');
                statusIndicators.forEach(indicator => indicator.remove());
            }

            chatMessages.appendChild(messageElement);

            const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;
            if (isNearBottom || isCurrentUser) {
                requestAnimationFrame(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    console.log(`[${timestamp}] Scrolled to bottom for ${isCurrentUser ? 'user-sent' : 'near-bottom'} message`);
                });
            } else {
                console.log(`[${timestamp}] Not scrolling: User is not near bottom and message is not from current user`);
            }
        } catch (error) {
            console.error(`[${timestamp}] Error displaying message:`, error, message);
        }
    }

    // Send message function
    function sendMessage() {
        const timestamp = new Date().toISOString();
        const message = messageInput.value.trim();
        if (!message) {
            return;
        }

        const currentRoomId = chatContent.getAttribute('data-current-room-id');
        if (!currentRoomId) {
            console.log(`[${timestamp}] Please select a contact or group first.`);
            return;
        }

        messageInput.value = '';

        if (!window.shrekChatWebSocket) {
            console.error(`[${timestamp}] WebSocket module not available`);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'system-message error';
            errorMsg.textContent = "Failed to send message. Please try again.";
            chatMessages.appendChild(errorMsg);
            return;
        }

        const result = window.shrekChatWebSocket.sendChatMessage(message, currentRoomId);
        if (result && result.success) {
            const isRoomGroup = window.shrekChatWebSocket.getCurrentRoomIsGroup();
            const optimisticMessage = {
                temp_id: result.tempId,
                content: message,
                sender: 'user',
                sender_name: currentUsername,
                time: result.timeStr,
                delivered: false,
                read: false,
                is_group: isRoomGroup,
                _isOptimistic: true
            };
            displayMessage(optimisticMessage);
            
            // Only update sidebar for regular text messages
            // For attachments, we'll wait for the server response
            if (!message.includes('<img-attachment') && 
                !message.includes('<video-attachment') && 
                !message.includes('<audio-attachment') && 
                !message.includes('<doc-attachment')) {
                if (window.shrekChatUtils) {
                    window.shrekChatUtils.updateLastMessage(currentRoomId, message, result.timeStr);
                }
            }
            
            setTimeout(() => {
                const tempMessage = document.querySelector(`.message[data-message-id="${result.tempId}"][data-temp-message="true"]`);
                if (tempMessage) {
                    console.log(`[${timestamp}] No confirmation received for message:`, result.tempId, "- may need to resend");
                    const statusIndicator = tempMessage.querySelector('.message-status-single');
                    if (statusIndicator) {
                        statusIndicator.classList.add('warning');
                    }
                }
            }, 5000);
        } else {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'system-message error';
            errorMsg.textContent = "Failed to send message. Please try again.";
            chatMessages.appendChild(errorMsg);
        }
    }

    // Event listeners
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (closeContactInfoPopup) {
        closeContactInfoPopup.addEventListener('click', function() {
            contactInfoPopup.classList.remove('open');
            overlay.classList.remove('active');
            contactInfoPopup.removeAttribute('data-user-id');
        });
    }

    if (closeInfoButton) {
        closeInfoButton.addEventListener('click', function() {
            contactInfoPopup.classList.remove('open');
            overlay.classList.remove('active');
            contactInfoPopup.removeAttribute('data-user-id');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const contacts = document.querySelectorAll('.contact-item');
            contacts.forEach(function(contact) {
                const name = contact.querySelector('h4').textContent.toLowerCase();
                const lastMessage = contact.querySelector('.last-message').textContent.toLowerCase();
                if (name.includes(searchTerm) || lastMessage.includes(searchTerm)) {
                    contact.style.display = 'flex';
                } else {
                    contact.style.display = 'none';
                }
            });
        });
    }

    document.querySelectorAll('.dropdown-toggle').forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const menu = this.nextElementSibling;
            menu.classList.toggle('active');
            document.querySelectorAll('.dropdown-menu.active').forEach(function(otherMenu) {
                if (otherMenu !== menu) {
                    otherMenu.classList.remove('active');
                }
            });
            document.addEventListener('click', function closeDropdown() {
                menu.classList.remove('active');
                document.removeEventListener('click', closeDropdown);
            });
        });
    });

    // Initialize chat
    console.log("Initializing chat...");
    loadContacts();

    if (window.shrekChatWebSocket) {
        window.shrekChatWebSocket.initializeWebSockets();
    } else {
        console.error("WebSocket module not loaded!");
    }

    window.refreshRoomsList = refreshRoomsList;
    window.addRoomToList = addRoomToList;
    window.openChat = openChat;
    window.displayMessage = displayMessage;
    window.restoreChatIfOpen = restoreChatIfOpen;

    console.log("Chat initialization complete");
});