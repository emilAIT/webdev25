// Chat functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    // DOM Elements
    const chatList = document.getElementById('chat-list');
    const messageArea = document.getElementById('message-area');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const selectedChatName = document.getElementById('selected-chat-name');
    const selectedChatAvatar = document.getElementById('selected-chat-avatar');
    const currentUserId = parseInt(document.getElementById('current-user-id').value);
    const currentUserName = document.getElementById('current-user-name').value;
    const currentUserPhoto = document.getElementById('current-user-photo').value;
    
    // Add new chat modal elements
    const addChatButton = document.getElementById('add-chat-button');
    const newChatModal = document.getElementById('new-chat-modal');
    const closeModalButton = document.getElementById('close-modal');
    const userSearchInput = document.getElementById('user-search');
    const searchResults = document.getElementById('search-results');
    
    // Sidebar element
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    const sidebarWrapper = document.querySelector('.sidebar-wrapper');
    
    // Add these variables at the top with other DOM elements
    const messageContextMenu = document.getElementById('message-context-menu');
    const editMessageBtn = document.getElementById('edit-message');
    const deleteMessageBtn = document.getElementById('delete-message');
    
    // Variables to track state
    let chats = [];
    let selectedChatId = null;
    let isFirstLoad = true;
    let isResizing = false;
    let searchTimeout = null;
    let currentSearchResults = [];
    let chatSocket = null;

    // Voice message functionality
    const voiceMessageButton = document.getElementById('voice-message-button');
    const voiceRecordingContainer = document.getElementById('voice-recording-container');
    const recordingTimer = document.getElementById('recording-timer');
    const stopRecordingButton = document.getElementById('stop-recording-button');
    const cancelRecordingButton = document.getElementById('cancel-recording-button');
    
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = null;
    let recordingTimerInterval = null;

    // Mobile navigation logic
    const mainChatWrapper = document.querySelector('.main-chat-wrapper');
    const backToChatsBtn = document.querySelector('.back-to-chats');

    function isMobileView() {
        return window.innerWidth <= 768;
    }

    if (backToChatsBtn) {
        backToChatsBtn.addEventListener('click', () => {
            if (isMobileView()) {
                mainChatWrapper.classList.remove('active');
                sidebarWrapper.classList.remove('hide');
            }
        });
    }

    // Initialize the chat interface
    init();
    
    // Initialize sidebar resizer
    initSidebarResizer();
    
    // Initialize new chat modal functionality
    initNewChatModal();

    // Video call button handler
    const videoCallButton = document.getElementById('video-call-button');
    if (videoCallButton) {
        videoCallButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Only allow call if a chat is selected and WebSocket is connected
            if (selectedChatId && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                // Send a call request through WebSocket
                chatSocket.send(JSON.stringify({
                    type: "call_request"
                }));
                
                // Store the current chat ID globally for call notifications
                window.currentCallChatId = selectedChatId;
                console.log('Setting global currentCallChatId to:', selectedChatId);
                
                // Show calling status (this function is implemented in call-notification.js)
                if (window.handleCallNotification) {
                    window.handleCallNotification({
                        type: "call_status",
                        status: "ringing",
                        message: "Calling...",
                        chat_id: selectedChatId
                    });
                }
            } else if (!selectedChatId) {
                showError('Please select a chat first to start a video call.');
            } else {
                showError('Chat connection lost. Please refresh the page.');
            }
        });
    }

    // Functions
    async function init() {
        try {
            await loadChats();

            initMessageContextMenu();
        } catch (error) {
            console.error('Error initializing chat:', error);
            showError('Failed to load chats. Please try again later.');
        }
    }

    // Sidebar resize functionality
    function initSidebarResizer() {
        let startX, startWidth;
        const resizeAreaWidth = 8;

        function startResizing(e) {
            const sidebarRect = sidebar.getBoundingClientRect();
            const clickX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            const distanceFromRight = sidebarRect.right - clickX;
            
            if (distanceFromRight > resizeAreaWidth) {
                return;
            }
            
            e.preventDefault();
                        
            startX = clickX;
            startWidth = parseInt(getComputedStyle(sidebarWrapper).width, 10);
            isResizing = true;
            
            sidebar.classList.add('resizing');
            
            document.addEventListener('mousemove', resize);
            document.addEventListener('touchmove', resize, { passive: false });
            document.addEventListener('mouseup', stopResizing);
            document.addEventListener('touchend', stopResizing);
            document.addEventListener('mouseleave', stopResizing);
            
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        }
        
        function resize(e) {
            if (!isResizing) return;
            
            e.preventDefault();
            
            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const newWidth = startWidth + (clientX - startX);
            
            const containerWidth = chatContainer.offsetWidth;
            const minWidth = 250;
            const maxWidth = containerWidth * 0.7;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                sidebarWrapper.style.width = `${newWidth}px`;
                chatList.style.display = 'none';
                setTimeout(() => {
                    chatList.style.display = '';
                }, 0);
            }
        }
        
        function stopResizing() {
            if (!isResizing) return;
            
            isResizing = false;
            sidebar.classList.remove('resizing');
            
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('touchmove', resize);
            document.removeEventListener('mouseup', stopResizing);
            document.removeEventListener('touchend', stopResizing);
            document.removeEventListener('mouseleave', stopResizing);
            
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            
            const sidebarWidth = sidebarWrapper.style.width;
            localStorage.setItem('chat-sidebar-width', sidebarWidth);
        }
        
        const savedWidth = localStorage.getItem('chat-sidebar-width');
        if (savedWidth) {
            sidebarWrapper.style.width = savedWidth;
        }
        
        sidebar.addEventListener('mousedown', startResizing);
        sidebar.addEventListener('touchstart', startResizing, { passive: false });
    }
    
    // Define selectedGroupMembers at a higher scope
    const selectedGroupMembers = new Map();
    
    function initNewChatModal() {
        // Group chat elements
        const directChatBtn = document.getElementById('direct-chat-btn');
        const groupChatBtn = document.getElementById('group-chat-btn');
        const directChatSection = document.getElementById('direct-chat-section');
        const groupChatSection = document.getElementById('group-chat-section');
        const groupUserSearchInput = document.getElementById('group-user-search');
        const groupSearchResults = document.getElementById('group-search-results');
        const selectedMembersContainer = document.getElementById('selected-members');
        const memberCountElement = document.getElementById('member-count');
        const createGroupButton = document.getElementById('create-group-button');
        const groupNameInput = document.getElementById('group-name');
        
        // Chat type toggle
        directChatBtn.addEventListener('click', () => {
            directChatBtn.classList.add('active');
            groupChatBtn.classList.remove('active');
            directChatSection.style.display = 'block';
            groupChatSection.style.display = 'none';
        });
        
        groupChatBtn.addEventListener('click', () => {
            groupChatBtn.classList.add('active');
            directChatBtn.classList.remove('active');
            groupChatSection.style.display = 'block';
            directChatSection.style.display = 'none';
        });

        addChatButton.addEventListener('click', () => {
            newChatModal.classList.add('active');
            userSearchInput.focus();
            searchResults.innerHTML = '';
            
            // Reset group chat UI
            selectedGroupMembers.clear();
            updateSelectedMembersUI();
            groupNameInput.value = '';
            groupUserSearchInput.value = '';
            groupSearchResults.innerHTML = '';
            updateCreateGroupButton();
            
            // Default to direct chat view
            directChatBtn.click();
        });
        
        closeModalButton.addEventListener('click', () => {
            newChatModal.classList.remove('active');
            userSearchInput.value = '';
            searchResults.innerHTML = '';
            // Clear group chat data also
            groupNameInput.value = '';
            groupUserSearchInput.value = '';
            groupSearchResults.innerHTML = '';
            selectedGroupMembers.clear();
            updateSelectedMembersUI();
        });
        
        newChatModal.addEventListener('click', (e) => {
            if (e.target === newChatModal) {
                newChatModal.classList.remove('active');
                userSearchInput.value = '';
                searchResults.innerHTML = '';
                // Clear group chat data
                groupNameInput.value = '';
                groupUserSearchInput.value = '';
                groupSearchResults.innerHTML = '';
                selectedGroupMembers.clear();
                updateSelectedMembersUI();
            }
        });
        
        // Input event for direct chat search
        userSearchInput.addEventListener('input', () => {
            const query = userSearchInput.value.trim();
            
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            if (query.length < 3) {
                searchResults.innerHTML = '';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                searchUsers(query, false);
            }, 300);
        });
        
        // Input event for group chat search
        groupUserSearchInput.addEventListener('input', () => {
            const query = groupUserSearchInput.value.trim();
            
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            if (query.length < 3) {
                groupSearchResults.innerHTML = '';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                searchUsers(query, true);
            }, 300);
        });
        
        // Group name input validation
        groupNameInput.addEventListener('input', updateCreateGroupButton);
        
        // Create group button - Add direct event listener here
        createGroupButton.addEventListener('click', async () => {
            console.log('Create Group button clicked');
            await createGroupChat();
        });
        
        function updateSelectedMembersUI() {
            selectedMembersContainer.innerHTML = '';
            selectedGroupMembers.forEach((user) => {
                const memberTag = document.createElement('div');
                memberTag.classList.add('member-tag');
                
                const avatar = document.createElement('div');
                avatar.classList.add('avatar');
                
                if (user.profile_photo) {
                    const img = document.createElement('img');
                    img.src = user.profile_photo;
                    img.alt = user.name;
                    img.onerror = function() {
                        this.onerror = null;
                        this.parentElement.textContent = user.name[0].toUpperCase();
                    };
                    avatar.appendChild(img);
                } else {
                    avatar.textContent = user.name[0].toUpperCase();
                }
                
                const name = document.createElement('div');
                name.classList.add('name');
                name.textContent = user.name;
                
                const removeBtn = document.createElement('div');
                removeBtn.classList.add('remove');
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.addEventListener('click', () => {
                    selectedGroupMembers.delete(user.id);
                    updateSelectedMembersUI();
                    updateCreateGroupButton();
                });
                
                memberTag.appendChild(avatar);
                memberTag.appendChild(name);
                memberTag.appendChild(removeBtn);
                selectedMembersContainer.appendChild(memberTag);
            });
            
            memberCountElement.textContent = selectedGroupMembers.size;
        }
        
        function updateCreateGroupButton() {
            const hasName = groupNameInput.value.trim().length >= 3;
            const hasMembers = selectedGroupMembers.size > 0;
            createGroupButton.disabled = !(hasName && hasMembers);
        }
        
        async function createGroupChat() {
            const groupName = groupNameInput.value.trim();
            if (groupName.length < 3) {
                showError('Group name must be at least 3 characters long');
                return;
            }

            try {
                console.log('Creating group chat with name:', groupName);
                
                const memberIds = Array.from(selectedGroupMembers.keys());
                const response = await fetch('/api/chats/groups', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: groupName,
                        member_ids: memberIds
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to create group chat');
                }
                
                const newChat = await response.json();
                
                // Add the new chat to the list and select it
                chats.unshift(newChat);
                renderChatList();
                selectChat(newChat.id);
                
                // Close the modal
                newChatModal.classList.remove('active');
                
                // Reset group inputs
                groupNameInput.value = '';
                groupUserSearchInput.value = '';
                groupSearchResults.innerHTML = '';
                selectedGroupMembers.clear();
                updateSelectedMembersUI();
                
            } catch (error) {
                console.error('Error creating group chat:', error);
                showError('Failed to create group chat. Please try again.');
            }
        }
    }
    
    async function searchUsers(query, isForGroup = false) {
        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const users = await response.json();
            
            if (isForGroup) {
                renderGroupSearchResults(users);
            } else {
                renderSearchResults(users);
            }
        } catch (error) {
            console.error('Error searching users:', error);
            const container = isForGroup ? searchResults : searchResults;
            container.innerHTML = '<div class="error-message">Failed to search users</div>';
        }
    }
    
    function renderSearchResults(users) {
        const infoMessage = searchResults.querySelector('.info-message');
        if (infoMessage) {
            searchResults.removeChild(infoMessage);
        }
        
        const previousIds = new Set(currentSearchResults.map(user => user.id));
        const newIds = new Set(users.map(user => user.id));
        
        let hasElementsToRemove = false;
        
        Array.from(searchResults.querySelectorAll('.user-result')).forEach((element, index) => {
            const userId = parseInt(element.dataset.userId);
            
            if (!newIds.has(userId)) {
                hasElementsToRemove = true;
                
                element.style.animation = 'fade-out 0.3s forwards';
                element.style.animationDelay = `${index * 50}ms`;
                element.style.pointerEvents = 'none';
                
                element.setAttribute('data-removing', 'true');
                
                const removeTimeout = setTimeout(() => {
                    if (element && searchResults.contains(element)) {
                        searchResults.removeChild(element);
                    }
                }, 350 + (index * 50));
                
                element.dataset.removeTimeout = removeTimeout;
            }
        });
        
        if (users.length === 0 && searchResults.querySelectorAll('.user-result').length === 0) {
            searchResults.innerHTML = '<div class="info-message">No users found</div>';
            currentSearchResults = [];
            return;
        }
        
        if (users.length === 0) {
            setTimeout(() => {
                if (searchResults.querySelectorAll('.user-result').length === 0) {
                    searchResults.innerHTML = '<div class="info-message">No users found</div>';
                }
            }, 350);
            currentSearchResults = [];
            return;
        }
        
        const limitedUsers = users.slice(0, 20);
        
        limitedUsers.forEach((user, index) => {
            const firstLetter = user.name.charAt(0).toUpperCase();
            
            let userElement = Array.from(searchResults.querySelectorAll('.user-result')).find(
                element => parseInt(element.dataset.userId) === user.id
            );
            
            if (!userElement) {
                userElement = document.createElement('div');
                userElement.className = 'user-result';
                userElement.dataset.userId = user.id;
                
                userElement.style.animationDelay = `${index * 30}ms`;
                
                searchResults.appendChild(userElement);
            } else {
                userElement.style.animation = 'none';
                userElement.style.opacity = '1';
                userElement.style.transform = 'translateY(0)';
            }
            
            let avatarContent;
            if (user.profile_photo && user.profile_photo !== 'None' && user.profile_photo !== '') {
                avatarContent = `<img src="${user.profile_photo}" alt="${user.name}" class="chat-avatar-img" 
                                 onerror="this.onerror=null;this.parentElement.innerHTML='${firstLetter}';
                                 console.log('Failed to load profile photo for: ${user.name}');">`;
            } else {
                avatarContent = firstLetter;
            }
            
            userElement.innerHTML = `
                <div class="user-result-avatar">${avatarContent}</div>
                <div class="user-result-info">
                    <div class="user-result-name">${user.name}</div>
                    <div class="user-result-details">${user.email || user.phone || ''}</div>
                </div>
            `;
            
            userElement.onclick = () => {
                startNewChat(user.id);
            };
        });
        
        currentSearchResults = [...limitedUsers];
    }

    function renderGroupSearchResults(users) {
        const groupSearchResults = document.getElementById('group-search-results');
        
        // Don't create a new Map - use the global one
        // Just clear the content for rendering
        groupSearchResults.innerHTML = '';
        
        if (users.length === 0) {
            groupSearchResults.innerHTML = '<div class="info-message">No users found</div>';
            return;
        }
        
        users.forEach(user => {
            if (user.id === currentUserId) {
                return; // Skip current user
            }
            
            const isSelected = selectedGroupMembers.has(user.id);
            
            const userElement = document.createElement('div');
            userElement.className = 'user-result';
            userElement.dataset.userId = user.id;
            
            let avatarContent;
            if (user.profile_photo && user.profile_photo !== 'None' && user.profile_photo !== '') {
                avatarContent = `<img src="${user.profile_photo}" alt="${user.name}" 
                                onerror="this.onerror=null;this.parentElement.innerHTML='${user.name[0].toUpperCase()}';">`;
            } else {
                avatarContent = user.name[0].toUpperCase();
            }
            
            userElement.innerHTML = `
                <div class="user-result-avatar">${avatarContent}</div>
                <div class="user-result-info">
                    <div class="user-result-name">${user.name}</div>
                    <div class="user-result-details">${user.email || user.phone || ''}</div>
                </div>
                <div class="user-result-action ${isSelected ? 'selected' : ''}">
                    <i class="fas fa-${isSelected ? 'check-circle' : 'plus-circle'}"></i>
                </div>
            `;
            
            userElement.addEventListener('click', () => {
                const isCurrentlySelected = userElement.querySelector('.user-result-action').classList.contains('selected');
                
                if (isCurrentlySelected) {
                    // Remove from selected members
                    selectedGroupMembers.delete(user.id);
                    userElement.querySelector('.user-result-action').classList.remove('selected');
                    userElement.querySelector('.user-result-action i').className = 'fas fa-plus-circle';
                } else {
                    // Add to selected members
                    selectedGroupMembers.set(user.id, user);
                    userElement.querySelector('.user-result-action').classList.add('selected');
                    userElement.querySelector('.user-result-action i').className = 'fas fa-check-circle';
                }
                
                // Update selected members UI and button state
                updateSelectedMembersUI();
                updateCreateGroupButton();
            });
            
            groupSearchResults.appendChild(userElement);
        });
        
        // Update these functions in the outer scope to make them accessible
        window.updateSelectedMembersUI = function() {
            const selectedMembersContainer = document.getElementById('selected-members');
            const memberCountElement = document.getElementById('member-count');
            
            selectedMembersContainer.innerHTML = '';
            selectedGroupMembers.forEach((user) => {
                const memberTag = document.createElement('div');
                memberTag.classList.add('member-tag');
                
                const avatar = document.createElement('div');
                avatar.classList.add('avatar');
                
                if (user.profile_photo) {
                    const img = document.createElement('img');
                    img.src = user.profile_photo;
                    img.alt = user.name;
                    img.onerror = function() {
                        this.onerror = null;
                        this.parentElement.textContent = user.name[0].toUpperCase();
                    };
                    avatar.appendChild(img);
                } else {
                    avatar.textContent = user.name[0].toUpperCase();
                }
                
                const name = document.createElement('div');
                name.classList.add('name');
                name.textContent = user.name;
                
                const removeBtn = document.createElement('div');
                removeBtn.classList.add('remove');
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.addEventListener('click', () => {
                    selectedGroupMembers.delete(user.id);
                    updateSelectedMembersUI();
                    updateCreateGroupButton();
                });
                
                memberTag.appendChild(avatar);
                memberTag.appendChild(name);
                memberTag.appendChild(removeBtn);
                selectedMembersContainer.appendChild(memberTag);
            });
            
            memberCountElement.textContent = selectedGroupMembers.size;
        };
        
        window.updateCreateGroupButton = function() {
            const groupNameInput = document.getElementById('group-name');
            const createGroupButton = document.getElementById('create-group-button');
            const hasName = groupNameInput.value.trim().length >= 3;
            const hasMembers = selectedGroupMembers.size > 0;
            createGroupButton.disabled = !(hasName && hasMembers);
        };
    }
    
    async function startNewChat(userId) {
        try {
            const response = await fetch('/api/chats/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const chatData = await response.json();
            
            chats.unshift(chatData);
            renderChatList();
            selectChat(chatData.id);
            
            newChatModal.classList.remove('active');
            userSearchInput.value = '';
            searchResults.innerHTML = '';
            
        } catch (error) {
            console.error('Error creating new chat:', error);
            showError('Failed to create chat. Please try again.');
        }
    }

    async function loadChats() {
        try {
            showLoadingIndicator(chatList);
            
            const response = await fetch('/api/chats/');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            chats = await response.json();
            
            // Make sure all chats with is_group property are properly identified
            chats.forEach(chat => {
                if (chat.is_group) {
                    console.log(`Chat ${chat.id} (${chat.user_name}) is a group chat`);
                }
            });
            
            renderChatList();
        } catch (error) {
            console.error('Error loading chats:', error);
            throw error;
        }
    }

    function renderChatList() {
        chatList.innerHTML = '';
        
        if (chats.length === 0) {
            chatList.innerHTML = '<div class="empty-state">No chats available</div>';
            return;
        }
        
        chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            // Add group-chat class if this is a group chat
            if (chat.is_group) {
                chatItem.classList.add('group-chat');
            }
            
            chatItem.dataset.chatId = chat.id;
            if (chat.id === selectedChatId) {
                chatItem.classList.add('active');
            }
            
            let avatarContent;
            const firstLetter = chat.user_name.charAt(0).toUpperCase();
            
            if (chat.user_photo && chat.user_photo !== 'None' && chat.user_photo !== '') {
                // Улучшенная обработка ошибки загрузки изображения
                avatarContent = `<img src="${chat.user_photo}" alt="${chat.user_name}" class="chat-avatar-img" 
                                 onerror="this.onerror=null;this.parentElement.innerHTML='${firstLetter}';
                                 console.log('Failed to load profile photo for: ${chat.user_name}');">`;
            } else {
                avatarContent = firstLetter;
            }
            
            let nameWithIndicator = chat.user_name;
            // Add group member count indicator for group chats
            if (chat.is_group && chat.member_count) {
                nameWithIndicator = `
                    ${chat.user_name}
                    <span class="group-indicator">
                        <i class="fas fa-users"></i>${chat.member_count}
                    </span>
                `;
            }
            
            chatItem.innerHTML = `
                <div class="chat-item-avatar">${avatarContent}</div>
                <div class="chat-item-content">
                    <div class="chat-item-header">
                        <div class="chat-item-name">${nameWithIndicator}</div>
                        <div class="chat-item-time">${formatTimestamp(chat.timestamp)}</div>
                    </div>
                    <div class="chat-item-message">${chat.latest_message}</div>
                </div>
                ${chat.unread ? '<div class="unread-indicator"></div>' : ''}
            `;
            
            chatItem.addEventListener('click', () => selectChat(chat.id));
            chatList.appendChild(chatItem);
        });
    }

    async function loadMessages(chatId) {
        try {
            messageArea.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><span>Loading messages...</span></div>';
            
            // Find the selected chat in the chats array
            const selectedChat = chats.find(chat => chat.id === chatId);
            console.log('Selected chat object:', selectedChat);
            
            // Check if this is a group chat
            const isGroupChat = selectedChat && selectedChat.is_group === true;
            console.log(`Chat ${chatId} is detected as: ${isGroupChat ? 'GROUP CHAT' : 'DIRECT CHAT'}`);
            
            // Use the appropriate endpoint based on chat type
            const endpoint = isGroupChat ? 
                `/api/chats/groups/${chatId}/messages` : 
                `/api/chats/${chatId}/messages`;
            
            console.log(`Loading messages from endpoint: ${endpoint}`);
            
            const response = await fetch(endpoint);
            if (!response.ok) {
                console.error(`Failed to fetch messages from ${endpoint}:`, response.status, response.statusText);
                
                // Only try fallback if we're not already using the group endpoint
                if (response.status === 404 && !isGroupChat) {
                    console.log('Direct chat endpoint failed, trying group endpoint as fallback...');
                    const groupEndpoint = `/api/chats/groups/${chatId}/messages`;
                    
                    try {
                        const groupResponse = await fetch(groupEndpoint);
                        
                        if (groupResponse.ok) {
                            console.log('Group endpoint worked! This is actually a group chat.');
                            // Update the chat object to mark it as a group chat
                            const chatIndex = chats.findIndex(c => c.id === chatId);
                            if (chatIndex !== -1) {
                                chats[chatIndex].is_group = true;
                                // Also add the group-chat class to the DOM element if it exists
                                const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
                                if (chatElement) {
                                    chatElement.classList.add('group-chat');
                                }
                            }
                            
                            const messages = await groupResponse.json();
                            renderMessages(messages);
                            return;
                        } else {
                            throw new Error(`Group endpoint failed: ${groupResponse.status}`);
                        }
                    } catch (groupError) {
                        console.error('Error trying group endpoint:', groupError);
                        throw new Error('Both direct and group endpoints failed');
                    }
                }
                
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const messages = await response.json();
            renderMessages(messages);
            
            // Mark chat as read
            const chatIndex = chats.findIndex(chat => chat.id === chatId);
            if (chatIndex !== -1) {
                chats[chatIndex].unread = false;
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            messageArea.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-exclamation-circle"></i></div><p>Failed to load messages</p></div>';
        }
    }

    async function selectChat(chatId) {
        closeWebSocket();
        
        selectedChatId = chatId;
        
        const selectedChat = chats.find(chat => chat.id === chatId);
        if (selectedChat) {
            selectedChatName.textContent = selectedChat.user_name;
            
            const firstLetter = selectedChat.user_name.charAt(0).toUpperCase();
            
            if (selectedChat.user_photo && selectedChat.user_photo !== 'None' && selectedChat.user_photo !== '') {
                selectedChatAvatar.innerHTML = `<img src="${selectedChat.user_photo}" alt="${selectedChat.user_name}" class="chat-avatar-img" 
                                                 onerror="this.onerror=null;this.parentElement.innerHTML='${firstLetter}';">`;
            } else {
                selectedChatAvatar.textContent = firstLetter;
            }
            
            messageInput.disabled = false;
            sendButton.disabled = false;
            
            const chatElements = document.querySelectorAll('.chat-item');
            chatElements.forEach(chatElement => {
                if (parseInt(chatElement.dataset.chatId) === chatId) {
                    chatElement.querySelector('.unread-indicator')?.remove();
                }
            });
            
            // Обновляем список чатов, чтобы отметить выбранный чат
            renderChatList();
            
            await loadMessages(chatId);
            
            connectWebSocket(chatId);
        }

        // Update video call button href for this chat
        const videoCallBtn = document.getElementById('video-call-button');
        if (videoCallBtn) {
            videoCallBtn.href = `/videocall/${chatId}`;
        }

        if (isMobileView()) {
            mainChatWrapper.classList.add('active');
            sidebarWrapper.classList.add('hide');
        }
    }
    
    function connectWebSocket(chatId) {
        const token = localStorage.getItem('access_token');
        if (!token) {
            showError('Authentication token not found. Please log in again.');
            return;
        }
        
        closeWebSocket(); // Close any existing connection
        
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${chatId}?token=${token}`;
        
        console.log('Connecting WebSocket to:', wsUrl);
        
        try {
            chatSocket = new WebSocket(wsUrl);
            
            // Make the WebSocket accessible globally so call-notification.js can use it
            window.activeWebSocket = chatSocket;
            
            chatSocket.onopen = (event) => {
                console.log('WebSocket connection established');
            };
            
            chatSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Received WebSocket message:', data);
                    
                    if (data.type === 'new_message') {
                        handleIncomingMessage(data.message);
                    } else if (data.type === 'message_edited') {
                        console.log('Handling edited message:', data.message);
                        handleMessageEdit(data.message);
                    } else if (data.type === 'message_deleted') {
                        console.log('Handling deleted message:', data.message_id);
                        handleMessageDelete(data.message_id);
                    } else if (data.type === 'connection_established') {
                        console.log('WebSocket connection confirmed by server');
                    } else if (data.type === 'error') {
                        console.error('WebSocket error from server:', data.message);
                        showError(data.message);
                    } else if (data.type === 'incoming_call' || 
                              data.type === 'call_status' || 
                              data.type === 'call_accepted' || 
                              data.type === 'call_declined' ||
                              data.type === 'call_canceled' ||
                              data.type === 'call_error') {
                        // Handle call notification messages
                        console.log('Forwarding call event to notification handler:', data.type);
                        if (window.handleCallNotification) {
                            window.handleCallNotification(data);
                        } else {
                            console.error('Call notification handler not available');
                        }
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            chatSocket.onerror = (error) => {
                console.error('WebSocket error occurred:', error);
                showError('Connection error. Messages will not be updated in real-time.');
            };
            
            chatSocket.onclose = (event) => {
                console.log('WebSocket connection closed', event.code, event.reason);
                
                // Show a user-friendly message for some common close codes
                if (event.code === 1008) {
                    showError('Authentication failed. Please log in again.');
                    setTimeout(() => window.location.href = '/', 3000);
                } else if (event.code === 4001) {
                    showError('Authentication failed. Please log in again.');
                    setTimeout(() => window.location.href = '/', 3000);
                } else if (event.code === 4003) {
                    showError('You are not authorized to access this chat.');
                } else if (event.code !== 1000 && selectedChatId === chatId) {
                    // Only try to reconnect if this wasn't a normal closure
                    console.log('Attempting to reconnect WebSocket in 5 seconds...');
                    setTimeout(() => {
                        if (selectedChatId === chatId) {
                            connectWebSocket(chatId);
                        }
                    }, 5000);
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            showError('Failed to establish chat connection. Please refresh the page.');
        }
    }
    
    function closeWebSocket() {
        if (chatSocket) {
            console.log('Closing existing WebSocket connection');
            try {
                if (chatSocket.readyState !== WebSocket.CLOSED && chatSocket.readyState !== WebSocket.CLOSING) {
                    chatSocket.close(1000, 'Changing chat');
                }
            } catch (error) {
                console.error('Error closing WebSocket:', error);
            }
            chatSocket = null;
            window.activeWebSocket = null; // Also clear the global reference
        }
    }
    
    function handleIncomingMessage(message) {
        if (message.chat_id !== selectedChatId) return;
        
        console.log('Handling incoming message:', message);
        
        // Check if this is a group chat
        const selectedChat = chats.find(chat => chat.id === selectedChatId);
        const isGroupChat = selectedChat && selectedChat.is_group === true;
        
        // Проверяем, не существует ли уже сообщение с таким ID
        const existingMessage = messageArea.querySelector(`[data-message-id="${message.id}"]`);
        if (existingMessage) {
            console.log('Message already exists:', message.id);
            return;
        }
        
        // Проверяем, является ли это нашим сообщением
        const isOurMessage = message.sender_id === parseInt(currentUserId);
        
        // Если это наше сообщение, обновляем временный ID
        if (isOurMessage) {
            const tempMessage = messageArea.querySelector(`[data-message-id^="temp_"]`);
            if (tempMessage) {
                console.log('Updating temporary message ID from', tempMessage.dataset.messageId, 'to', message.id);
                tempMessage.dataset.messageId = message.id;
                return;
            }
        }
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = isOurMessage ? 'message message-sent' : 'message message-received';
        messageElement.dataset.messageId = message.id;
        
        // Handle voice messages
        if (message.type === 'voice_message' || message.message_type === 'voice_message') {
            const voiceMessageHTML = `
                <div class="voice-message">
                    <button class="voice-message-play">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-message-duration">00:00</div>
                    <div class="voice-message-waveform"></div>
                </div>
            `;
            messageElement.innerHTML = voiceMessageHTML;
            
            // Add click handler for play button
            const playButton = messageElement.querySelector('.voice-message-play');
            const audio = new Audio('data:audio/webm;base64,' + message.content);
            
            // Get audio duration
            audio.addEventListener('loadedmetadata', () => {
                const duration = Math.floor(audio.duration);
                const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
                const seconds = (duration % 60).toString().padStart(2, '0');
                messageElement.querySelector('.voice-message-duration').textContent = `${minutes}:${seconds}`;
            });
            
            playButton.addEventListener('click', () => {
                const icon = playButton.querySelector('i');
                if (audio.paused) {
                    audio.play();
                    icon.className = 'fas fa-pause';
                } else {
                    audio.pause();
                    icon.className = 'fas fa-play';
                }
            });
            
            audio.onended = () => {
                playButton.querySelector('i').className = 'fas fa-play';
            };
        } else {
            // Regular text message
            messageElement.innerHTML = `
                <div class="message-content">${message.content}</div>
                <div class="message-time">${formatTimestamp(message.timestamp)}</div>
            `;
        }
        
        messageArea.appendChild(messageElement);
        scrollToBottom();
        
        // Обновляем превью чата только если это не наше сообщение
        if (!isOurMessage) {
            updateChatPreview(selectedChatId, message.type === 'voice_message' || message.message_type === 'voice_message' ? 'Voice message' : message.content, false, message.sender_name);
        }
    }
    
    function renderMessages(messages) {
        messageArea.innerHTML = '';
        
        if (messages.length === 0) {
            messageArea.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="far fa-comment-dots"></i></div><p>No messages yet. Start a conversation!</p></div>';
            return;
        }
        
        // Check if this is a group chat
        const selectedChat = chats.find(chat => chat.id === selectedChatId);
        const isGroupChat = selectedChat && selectedChat.is_group === true;
        
        let currentDate = '';
        
        // Process messages to identify chains (consecutive messages from same sender within a minute)
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const nextMessage = i < messages.length - 1 ? messages[i + 1] : null;
            
            // Parse timestamps to compare message times
            let messageTime = null;
            try {
                if (message.timestamp.includes('T') || message.timestamp.includes('-')) {
                    messageTime = new Date(message.timestamp);
                } else if (/^\d{1,2}:\d{2}$/.test(message.timestamp)) {
                    // For HH:MM format
                    const [hours, minutes] = message.timestamp.split(':');
                    const today = new Date();
                    messageTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
                                          parseInt(hours), parseInt(minutes));
                }
            } catch (e) {
                console.error('Error parsing timestamp for chain detection:', e);
            }
            
            // Mark messages as part of a chain
            message.isPartOfChain = false;
            message.isLastInChain = false;
            
            if (nextMessage && nextMessage.sender_id === message.sender_id && 
                nextMessage.is_sent_by_me === message.is_sent_by_me && messageTime) {
                
                let nextMessageTime = null;
                try {
                    if (nextMessage.timestamp.includes('T') || nextMessage.timestamp.includes('-')) {
                        nextMessageTime = new Date(nextMessage.timestamp);
                    } else if (/^\d{1,2}:\d{2}$/.test(nextMessage.timestamp)) {
                        const [hours, minutes] = nextMessage.timestamp.split(':');
                        const today = new Date();
                        nextMessageTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
                                                parseInt(hours), parseInt(minutes));
                    }
                } catch (e) {
                    console.error('Error parsing next message timestamp:', e);
                }
                
                // If messages are within 1 minute, they're part of a chain
                if (nextMessageTime && 
                    Math.abs(nextMessageTime - messageTime) < 60000) {
                    message.isPartOfChain = true;
                    nextMessage.isPartOfChain = true;
                    nextMessage.isLastInChain = true;
                    message.isLastInChain = false;
                }
            } else if (message.isPartOfChain) {
                message.isLastInChain = true;
            }
        }
        
        // Render messages with date separators
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            
            try {
                console.log('Processing message timestamp:', message.timestamp);
                
                // Handle different timestamp formats
                if (/^\d{1,2}:\d{2}$/.test(message.timestamp)) {
                    // Simple HH:MM format
                    const today = new Date();
                    messageDate = today.toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit'
                    });
                } else if (message.timestamp.includes('T') || message.timestamp.includes('-')) {
                    // ISO format date (2023-07-19T12:34:56.789) or similar
                    const date = new Date(message.timestamp);
                    
                    if (!isNaN(date.getTime())) {
                        messageDate = date.toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                        });
                        
                        // Also update the message timestamp to show only the time part
                        message.timestamp = date.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                    } else {
                        console.error('Invalid ISO date format:', message.timestamp);
                        messageDate = 'Unknown date';
                    }
                } else {
                    // Try to parse with simple HH:MM splitting
                    const msgTime = new Date();
                    const [hours, minutes] = message.timestamp.split(':');
                    if (hours && minutes) {
                        msgTime.setHours(parseInt(hours, 10));
                        msgTime.setMinutes(parseInt(minutes, 10));
                        messageDate = msgTime.toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                        });
                    } else {
                        throw new Error('Cannot split timestamp into hours and minutes');
                    }
                }
            } catch (e) {
                console.error('Error parsing date:', e, 'for timestamp:', message.timestamp);
                messageDate = 'Unknown date';
            }
            
            if (messageDate !== currentDate) {
                const dateSeparator = document.createElement('div');
                dateSeparator.className = 'date-separator';
                dateSeparator.innerHTML = `<div class="date-label">${messageDate}</div>`;
                messageArea.appendChild(dateSeparator);
                currentDate = messageDate;
            }
            
            // Create message element
            const messageElement = document.createElement('div');
            
            // Basic message class setup
            messageElement.className = message.is_sent_by_me ? 'message message-sent' : 'message message-received';
            
            // Add chain-related classes
            if (message.isPartOfChain) {
                messageElement.classList.add('in-chain');
                
                if (!message.isLastInChain) {
                    messageElement.classList.add('not-last-in-chain');
                } else {
                    messageElement.classList.add('last-in-chain');
                }
            }
            
            // Modified: Add has-avatar class to ALL group chat received messages 
            // for proper alignment, but only show avatar on last or standalone
            const isReceivedGroupMessage = isGroupChat && 
                                       !message.is_sent_by_me && 
                                       message.sender_name;
                                       
            if (isReceivedGroupMessage) {
                messageElement.classList.add('has-avatar');
            }
            
            // Only prepare and show avatar for last messages in chain or standalone messages
            let avatarHTML = '';
            if (isReceivedGroupMessage && (message.isLastInChain || !message.isPartOfChain)) {
                const firstLetter = message.sender_name.charAt(0).toUpperCase();
                
                // Check if the message has sender profile photo
                let avatarContent = '';
                if (message.sender_photo && message.sender_photo !== 'None' && message.sender_photo !== '') {
                    avatarContent = `<img src="${message.sender_photo}" alt="${message.sender_name}" onerror="this.onerror=null;this.parentElement.innerHTML='${firstLetter}';">`;
                } else {
                    avatarContent = firstLetter;
                }
                
                avatarHTML = `
                    <div class="message-sender-avatar">${avatarContent}</div>
                    <div class="message-sender-name">${message.sender_name}</div>
                `;
            }
            
            // MODIFIED: Always show timestamps for all messages
            const timeHTML = `<div class="message-time">${message.timestamp}</div>`;
            
            // Build the message HTML
            messageElement.innerHTML = `
                ${avatarHTML}
                <div class="message-content">${message.content}</div>
                ${timeHTML}
            `;
            
            messageElement.dataset.messageId = message.id;
            
            messageArea.appendChild(messageElement);
        }
        
        scrollToBottom();
    }

    function scrollToBottom() {
        messageArea.scrollTop = messageArea.scrollHeight;
    }

    // Enhance the sendMessage function to better handle group chats
    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content || !selectedChatId) return;
        
        try {
            messageInput.disabled = true;
            sendButton.disabled = true;
            
            // Get the selected chat
            const selectedChat = chats.find(chat => chat.id === selectedChatId);
            console.log('Selected chat for sending message:', selectedChat);
            
            // Check if this is a group chat - use only the definitive is_group flag
            const isGroupChat = selectedChat && selectedChat.is_group === true;
            console.log(`Sending message to ${isGroupChat ? 'GROUP CHAT' : 'DIRECT CHAT'}`);
            
            if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                // Создаем временный элемент сообщения
                const messageElement = document.createElement('div');
                messageElement.className = 'message message-sent';
                
                // Проверяем, является ли это частью цепочки
                const lastMessage = messageArea.lastElementChild;
                if (lastMessage && lastMessage.classList.contains('message-sent')) {
                    messageElement.classList.add('in-chain');
                    messageElement.classList.add('last-in-chain');
                    
                    // Обновляем классы последнего сообщения
                    if (lastMessage.classList.contains('last-in-chain')) {
                        lastMessage.classList.remove('last-in-chain');
                        lastMessage.classList.add('not-last-in-chain');
                    }
                }
                
                const currentTime = new Date();
                const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                messageElement.innerHTML = `
                    <div class="message-content">${content}</div>
                    <div class="message-time">${formattedTime}</div>
                `;
                
                // Добавляем временный ID, который будет обновлен после получения ответа от сервера
                const tempId = 'temp_' + Date.now();
                messageElement.dataset.messageId = tempId;
                
                messageArea.appendChild(messageElement);
                
                // Отправляем сообщение через WebSocket
                chatSocket.send(JSON.stringify({
                    content: content
                }));
                
                messageInput.value = '';
                scrollToBottom();
                updateChatPreview(selectedChatId, content, true);
                
                messageInput.disabled = false;
                sendButton.disabled = false;
                messageInput.focus();
            } else {
                console.log('WebSocket not available, using HTTP fallback');
                
                // Use the appropriate endpoint based on chat type
                const endpoint = isGroupChat ? 
                    `/api/chats/groups/${selectedChatId}/messages` : 
                    `/api/chats/${selectedChatId}/messages`;
                console.log(`Sending message to endpoint: ${endpoint}`);
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const message = await response.json();
                
                const messageElement = document.createElement('div');
                messageElement.className = 'message message-sent';
                
                // Проверяем, является ли это частью цепочки
                const lastMessage = messageArea.lastElementChild;
                if (lastMessage && lastMessage.classList.contains('message-sent')) {
                    messageElement.classList.add('in-chain');
                    messageElement.classList.add('last-in-chain');
                    
                    // Обновляем классы последнего сообщения
                    if (lastMessage.classList.contains('last-in-chain')) {
                        lastMessage.classList.remove('last-in-chain');
                        lastMessage.classList.add('not-last-in-chain');
                    }
                }
                
                messageElement.dataset.messageId = message.id;
                messageElement.innerHTML = `
                    <div class="message-content">${message.content}</div>
                    <div class="message-time">${formatTimestamp(message.timestamp)}</div>
                `;
                
                messageArea.appendChild(messageElement);
                
                messageInput.value = '';
                scrollToBottom();
                updateChatPreview(selectedChatId, message.content, true);
                
                messageInput.disabled = false;
                sendButton.disabled = false;
                messageInput.focus();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showError('Failed to send message. Please try again.');
            messageInput.disabled = false;
            sendButton.disabled = false;
        }
    }

    function updateChatPreview(chatId, messageContent, isSentByMe, senderName = null) {
        const chatItem = Array.from(chatList.children).find(item => item.dataset.chatId === chatId.toString());
        if (!chatItem) return;

        const chatNameElement = chatItem.querySelector('.chat-item-name');
        const chatMessageElement = chatItem.querySelector('.chat-item-message');
        const chatTimeElement = chatItem.querySelector('.chat-item-time');

        if (senderName) {
            chatNameElement.textContent = senderName;
        }

        chatMessageElement.textContent = messageContent;

        const currentTime = new Date();
        chatTimeElement.textContent = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        chatItem.classList.add('active');
    }

    function showLoadingIndicator(element) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        element.appendChild(loadingIndicator);
    }

    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        document.body.appendChild(errorElement);
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    function formatTimestamp(timestamp) {
        if (timestamp === 'Just now') return timestamp;
        
        if (typeof timestamp === 'string' && /^\d+[hmdwy]$/i.test(timestamp)) {
            return timestamp;
        }
        
        let date;
        try {
            if (typeof timestamp === 'string') {
                if (/^\d{1,2}:\d{2}\s?(?:AM|PM)?$/i.test(timestamp)) {
                    // Простой формат времени (HH:MM или HH:MM AM/PM)
                    const today = new Date();
                    const [time, period] = timestamp.split(/\s/);
                    const [hours, minutes] = time.split(':');
                    let hour = parseInt(hours);
                    
                    if (period) {
                        if (period.toUpperCase() === 'PM' && hour < 12) {
                            hour += 12;
                        } else if (period.toUpperCase() === 'AM' && hour === 12) {
                            hour = 0;
                        }
                    }
                    
                    date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, parseInt(minutes));
                } else if (timestamp.includes('T')) {
                    // ISO формат (2023-07-19T12:34:56.789)
                    date = new Date(timestamp);
                } else if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                    // Формат с датой и временем (2023-07-19 12:34:56)
                    date = new Date(timestamp.replace(' ', 'T') + 'Z');
                } else {
                    // Пробуем другие форматы
                    date = new Date(timestamp);
                }
            } else {
                date = new Date(timestamp);
            }
            
            if (isNaN(date.getTime())) {
                console.error('Invalid date format:', timestamp);
                return timestamp;
            }
        } catch (error) {
            console.error('Error parsing date:', error);
            return timestamp;
        }
        
        const now = new Date();
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        return date.toLocaleString([], {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });
    
    // Add this function after other initialization code
    function initMessageContextMenu() {
        let currentMessageElement = null;
        let currentMessageId = null;

        // Show context menu on right click
        messageArea.addEventListener('contextmenu', function(e) {
            const messageElement = e.target.closest('.message');
            if (!messageElement) return;
            
            // Only show menu for sent messages
            if (!messageElement.classList.contains('message-sent')) return;
            
            e.preventDefault();
            
            currentMessageElement = messageElement;
            currentMessageId = messageElement.dataset.messageId;
            
            console.log('Context menu opened for message:', currentMessageId);
            
            // Position the menu
            messageContextMenu.style.display = 'block';
            
            // Ensure menu stays within viewport
            const menuWidth = messageContextMenu.offsetWidth;
            const menuHeight = messageContextMenu.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let left = e.pageX;
            let top = e.pageY;
            
            if (left + menuWidth > viewportWidth) {
                left = viewportWidth - menuWidth - 10;
            }
            if (top + menuHeight > viewportHeight) {
                top = viewportHeight - menuHeight - 10;
            }
            
            messageContextMenu.style.left = `${left}px`;
            messageContextMenu.style.top = `${top}px`;
        });

        // Hide context menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!messageContextMenu.contains(e.target)) {
                messageContextMenu.style.display = 'none';
            }
        });

        // Handle escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                messageContextMenu.style.display = 'none';
                if (currentMessageElement) {
                    const messageContent = currentMessageElement.querySelector('.message-content');
                    if (messageContent.classList.contains('editing')) {
                        const originalText = messageContent.dataset.originalText;
                        messageContent.textContent = originalText;
                        messageContent.classList.remove('editing');
                    }
                }
            }
        });

        // Handle edit message
        editMessageBtn.addEventListener('click', function() {
            console.log('Edit button clicked for message:', currentMessageId);
            
            if (!currentMessageElement || !currentMessageId) {
                console.error('No message selected for editing');
                return;
            }
            
            // Проверяем, не является ли это временным сообщением
            if (currentMessageId.startsWith('temp_')) {
                showError('Please wait for the message to be sent before editing');
                return;
            }
            
            const messageContent = currentMessageElement.querySelector('.message-content');
            if (!messageContent) {
                console.error('Message content element not found');
                return;
            }
            
            console.log('Creating edit form for message:', currentMessageId);
            
            const originalText = messageContent.textContent;
            
            // Store original text
            messageContent.dataset.originalText = originalText;
            
            // Create edit interface
            const editForm = document.createElement('div');
            editForm.className = 'message-edit-form';
            editForm.innerHTML = `
                <input type="text" class="message-edit-input" value="${originalText}">
                <div class="message-edit-actions">
                    <button class="save-edit">Save</button>
                    <button class="cancel-edit">Cancel</button>
                </div>
            `;
            
            // Очищаем содержимое и добавляем форму
            messageContent.innerHTML = '';
            messageContent.appendChild(editForm);
            messageContent.classList.add('editing');
            
            // Получаем элементы формы
            const input = editForm.querySelector('.message-edit-input');
            const saveButton = editForm.querySelector('.save-edit');
            const cancelButton = editForm.querySelector('.cancel-edit');
            
            // Фокусируемся на поле ввода
            input.focus();
            input.select();
            
            // Handle save
            saveButton.addEventListener('click', async function() {
                const newText = input.value.trim();
                if (newText && newText !== originalText) {
                    try {
                        // Отправляем уведомление через WebSocket
                        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                            console.log('Sending edit notification through WebSocket for message:', currentMessageId);
                            chatSocket.send(JSON.stringify({
                                type: 'edit_message',
                                message_id: currentMessageId,
                                content: newText
                            }));
                            
                            // Обновляем сообщение локально
                            messageContent.textContent = newText;
                            messageContent.classList.remove('editing');
                        } else {
                            throw new Error('WebSocket connection not available');
                        }
                    } catch (error) {
                        console.error('Error editing message:', error);
                        showError('Failed to edit message');
                        messageContent.textContent = originalText;
                        messageContent.classList.remove('editing');
                    }
                } else {
                    messageContent.textContent = originalText;
                    messageContent.classList.remove('editing');
                }
                messageContextMenu.style.display = 'none';
            });
            
            // Handle cancel
            cancelButton.addEventListener('click', function() {
                messageContent.textContent = originalText;
                messageContent.classList.remove('editing');
                messageContextMenu.style.display = 'none';
            });
            
            // Handle enter key in input
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveButton.click();
                }
            });
            
            // Добавляем обработчик клика вне формы
            document.addEventListener('click', function closeEditForm(e) {
                if (!messageContent.contains(e.target) && !messageContextMenu.contains(e.target)) {
                    messageContent.textContent = originalText;
                    messageContent.classList.remove('editing');
                    messageContextMenu.style.display = 'none';
                    document.removeEventListener('click', closeEditForm);
                }
            });
        });
        
        // Handle delete message
        deleteMessageBtn.addEventListener('click', async function() {
            if (!currentMessageElement || !currentMessageId) return;
            
            if (confirm('Are you sure you want to delete this message?')) {
                try {
                    // Отправляем уведомление через WebSocket
                    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                        console.log('Sending delete notification through WebSocket');
                        chatSocket.send(JSON.stringify({
                            type: 'delete_message',
                            message_id: currentMessageId
                        }));
                        
                        // Удаляем сообщение локально
                        currentMessageElement.remove();
                        
                        // Обновляем превью чата
                        const chatItem = Array.from(chatList.children).find(item => item.dataset.chatId === selectedChatId.toString());
                        if (chatItem) {
                            const chatMessageElement = chatItem.querySelector('.chat-item-message');
                            if (chatMessageElement) {
                                // Если это было последнее сообщение, обновляем превью
                                const lastMessage = messageArea.lastElementChild;
                                if (lastMessage && lastMessage.classList.contains('message')) {
                                    const lastMessageContent = lastMessage.querySelector('.message-content');
                                    if (lastMessageContent) {
                                        chatMessageElement.textContent = lastMessageContent.textContent;
                                    }
                                } else {
                                    chatMessageElement.textContent = 'No messages yet';
                                }
                            }
                        }
                    } else {
                        throw new Error('WebSocket connection not available');
                    }
                } catch (error) {
                    console.error('Error deleting message:', error);
                    showError('Failed to delete message');
                }
            }
            messageContextMenu.style.display = 'none';
        });
    }

    // Add these new functions to handle message edits and deletes
    function handleMessageEdit(message) {
        console.log('Finding message element for ID:', message.id);
        const messageElement = document.querySelector(`.message[data-message-id="${message.id}"]`);
        console.log('Found message element:', messageElement);
        
        if (messageElement) {
            const messageContent = messageElement.querySelector('.message-content');
            if (messageContent) {
                console.log('Updating message content from:', messageContent.textContent, 'to:', message.content);
                
                // Обновляем только содержимое
                messageContent.textContent = message.content;
                
                // Обновляем превью чата
                const chatItem = Array.from(chatList.children).find(item => item.dataset.chatId === selectedChatId.toString());
                if (chatItem) {
                    const chatMessageElement = chatItem.querySelector('.chat-item-message');
                    if (chatMessageElement) {
                        chatMessageElement.textContent = message.content;
                    }
                }
            }
        } else {
            console.error('Message element not found for ID:', message.id);
        }
        
        // Перезагружаем сообщения после редактирования
        if (selectedChatId) {
            loadMessages(selectedChatId);
        }
    }

    function handleMessageDelete(messageId) {
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
            
            // Remove any temporary messages
            const tempMessages = messageArea.querySelectorAll(`[data-message-id^="temp_"]`);
            tempMessages.forEach(msg => msg.remove());
            
            // Обновляем превью чата после удаления сообщения
            const chatItem = Array.from(chatList.children).find(item => item.dataset.chatId === selectedChatId.toString());
            if (chatItem) {
                const chatMessageElement = chatItem.querySelector('.chat-item-message');
                if (chatMessageElement) {
                    // Если это было последнее сообщение, обновляем превью
                    const lastMessage = messageArea.lastElementChild;
                    if (lastMessage && lastMessage.classList.contains('message')) {
                        const lastMessageContent = lastMessage.querySelector('.message-content');
                        if (lastMessageContent) {
                            chatMessageElement.textContent = lastMessageContent.textContent;
                        }
                    } else {
                        chatMessageElement.textContent = 'No messages yet';
                    }
                }
            }
            
            // Перезагружаем сообщения после удаления
            if (selectedChatId) {
                loadMessages(selectedChatId);
            }
        }
    }

    // Voice message functionality
    voiceMessageButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                if (audioChunks.length === 0) {
                    showError('No audio data recorded');
                    return;
                }
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // Create a temporary message element
                const messageElement = document.createElement('div');
                messageElement.className = 'message message-sent';
                messageElement.dataset.messageId = 'temp_' + Date.now();
                
                // Create voice message player
                const voiceMessageHTML = `
                    <div class="voice-message">
                        <button class="voice-message-play">
                            <i class="fas fa-play"></i>
                        </button>
                        <div class="voice-message-duration">00:00</div>
                        <div class="voice-message-waveform"></div>
                    </div>
                `;
                
                messageElement.innerHTML = voiceMessageHTML;
                messageArea.appendChild(messageElement);
                
                // Add click handler for play button
                const playButton = messageElement.querySelector('.voice-message-play');
                const audio = new Audio(audioUrl);
                
                // Get audio duration
                audio.addEventListener('loadedmetadata', () => {
                    const duration = Math.floor(audio.duration);
                    const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
                    const seconds = (duration % 60).toString().padStart(2, '0');
                    messageElement.querySelector('.voice-message-duration').textContent = `${minutes}:${seconds}`;
                });
                
                playButton.addEventListener('click', () => {
                    const icon = playButton.querySelector('i');
                    if (audio.paused) {
                        audio.play();
                        icon.className = 'fas fa-pause';
                    } else {
                        audio.pause();
                        icon.className = 'fas fa-play';
                    }
                });
                
                audio.onended = () => {
                    playButton.querySelector('i').className = 'fas fa-play';
                };
                
                // Send the voice message through WebSocket
                if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64Audio = reader.result.split(',')[1];
                        chatSocket.send(JSON.stringify({
                            type: 'voice_message',
                            content: base64Audio,
                            message_type: 'voice_message'  // Add message type
                        }));
                    };
                    reader.readAsDataURL(audioBlob);
                }
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                
                // Reset UI
                voiceMessageButton.classList.remove('recording');
                voiceRecordingContainer.style.display = 'none';
                clearInterval(recordingTimerInterval);
                const timerElement = document.querySelector('.recording-timer');
                if (timerElement) {
                    timerElement.textContent = '00:00';
                }
                
                scrollToBottom();
            };
            
            // Show recording UI first
            voiceMessageButton.classList.add('recording');
            voiceRecordingContainer.style.display = 'flex';
            
            // Start recording with 100ms timeslice to get data more frequently
            mediaRecorder.start(100);
            recordingStartTime = Date.now();
            
            // Start timer only after UI is shown
            recordingTimerInterval = setInterval(updateRecordingTimer, 1000);
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            showError('Failed to access microphone. Please check your permissions.');
        }
    });
    
    stopRecordingButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
    });
    
    cancelRecordingButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            audioChunks = [];
        }
    });
    
    function updateRecordingTimer() {
        const timerElement = document.querySelector('.recording-timer');
        if (!timerElement) {
            clearInterval(recordingTimerInterval);
            return;
        }
        
        const elapsedTime = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
        const seconds = (elapsedTime % 60).toString().padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }

    window.addEventListener('resize', () => {
        if (!isMobileView()) {
            mainChatWrapper.classList.add('active');
            sidebarWrapper.classList.remove('hide');
        } else {
            mainChatWrapper.classList.remove('active');
            sidebarWrapper.classList.remove('hide');
        }
    });

    // Установка стартовой ширины sidebar-wrapper, если нет сохранённой
    if (window.innerWidth > 768) {
        const savedWidth = localStorage.getItem('chat-sidebar-width');
        if (savedWidth) {
            sidebarWrapper.style.width = savedWidth;
        } else {
            sidebarWrapper.style.width = '320px';
        }
    }
});

