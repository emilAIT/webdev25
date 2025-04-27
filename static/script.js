let currentUserId = null;
let socket = null;
let lastMessageId = -1;
let pollingInterval = null;
let username = null;
let creatorId = null;

// Store the current date for "Today"/"Yesterday" comparisons
const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayDate = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function initializeChat(userId, receiver, isGroup = false, groupId = null, initialLastMessageId = -1, userUsername = null, groupCreatorId = null) {
    currentUserId = userId;
    username = userUsername;
    lastMessageId = initialLastMessageId;
    creatorId = groupCreatorId;
    console.log(`Initializing chat: userId=${userId}, receiver=${receiver}, isGroup=${isGroup}, groupId=${groupId}, lastMessageId=${initialLastMessageId}, username=${userUsername}, creatorId=${groupCreatorId}`);
    connectWebSocket(receiver, isGroup, groupId);
    startPolling(receiver, isGroup, groupId);
}

function connectWebSocket(receiver, isGroup, groupId) {
    socket = io.connect(window.location.origin, { 
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('WebSocket connected');
        joinChat(receiver, isGroup, groupId);
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        console.log('Falling back to polling...');
    });

    socket.on('error', (data) => {
        console.error('SocketIO error:', data.message);
        if (data.message === 'User not authenticated') {
            console.log('Redirecting to login');
            window.location.href = '/login';
        }
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });

    socket.on('new_message', (msg) => {
        console.log('Received new_message:', msg);
        if (msg.id > lastMessageId) {
            console.log(`Displaying new message: id=${msg.id}, sender_id=${msg.sender_id}, content=${msg.content}`);
            displayMessage(msg);
            lastMessageId = msg.id;
        } else {
            console.log(`Skipping duplicate/old message: id=${msg.id}`);
        }
    });

    socket.on('message_updated', (data) => {
        console.log('Received message_updated:', data);
        const messageDiv = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
        if (messageDiv) {
            messageDiv.querySelector('.content').textContent = data.content;
        }
    });

    socket.on('message_deleted', (data) => {
        console.log('Received message_deleted:', data);
        const messageDiv = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
        if (messageDiv) {
            const messageBlock = messageDiv.closest('.message-block');
            messageDiv.remove();
            if (messageBlock && !messageBlock.querySelector('.message')) {
                messageBlock.previousElementSibling.remove(); // Remove date-divider
                messageBlock.remove(); // Remove empty message-block
            }
        }
    });

    socket.on('chat_cleared', () => {
        console.log('Received chat_cleared event');
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
        }
    });

    socket.on('group_name_updated', (data) => {
        console.log('Received group_name_updated:', data);
        if (data.group_id === window.groupId) {
            document.getElementById('group-header-name').textContent = data.name;
            document.title = `SomeMsger - Group ${data.name}`;
            const descriptionSpan = document.getElementById('group-description');
            if (descriptionSpan) {
                descriptionSpan.textContent = data.description;
            }
        }
        const sidebarGroup = document.querySelector(`.chat-item[href="/group/${data.group_id}"] .chat-name`);
        if (sidebarGroup) {
            sidebarGroup.textContent = data.name;
        }
    });

    socket.on('group_member_added', (data) => {
        console.log('Received group_member_added:', data);
        if (data.group_id === window.groupId) {
            showInfoModal(); // Refresh modal to show new member
        }
    });

    socket.on('group_member_removed', (data) => {
        console.log('Received group_member_removed:', data);
        if (data.group_id === window.groupId) {
            showInfoModal(); // Refresh modal to show updated members
            fetchFriendsForAddMember(window.groupId);
        }
    });
}

function joinChat(receiver, isGroup, groupId) {
    if (socket && socket.connected) {
        console.log(`Joining chat: receiver=${receiver}, isGroup=${isGroup}, groupId=${groupId}`);
        socket.emit('join_chat', {
            receiver: receiver,
            is_group: isGroup,
            group_id: groupId
        });
    } else {
        console.log('Socket not connected, will retry on connect');
        socket.on('connect', () => {
            console.log('Socket reconnected, joining chat');
            socket.emit('join_chat', {
                receiver: receiver,
                is_group: isGroup,
                group_id: groupId
            });
        });
    }
}

function startPolling(receiver, isGroup = false, groupId = null) {
    if (pollingInterval) {
        console.log('Clearing existing polling interval');
        clearInterval(pollingInterval);
    }
    console.log(`Starting polling: receiver=${receiver}, isGroup=${isGroup}, groupId=${groupId}`);
    pollingInterval = setInterval(async () => {
        console.log(`Polling with lastMessageId=${lastMessageId}, receiver=${receiver}, isGroup=${isGroup}, groupId=${groupId}`);
        try {
            const formData = new FormData();
            formData.append('last_message_id', lastMessageId);
            formData.append('is_group', isGroup ? '1' : '0');
            if (isGroup) {
                formData.append('group_id', groupId);
            } else {
                if (!receiver) {
                    console.error('Receiver is required for polling private chats');
                    return;
                }
                formData.append('receiver', receiver);
            }
            const response = await fetch('/get_new_messages', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const result = await response.json();
            if (result.error) {
                console.error('Polling error:', result.error);
                if (result.error === 'Not logged in') {
                    window.location.href = '/login';
                }
                return;
            }
            if (result.messages && result.messages.length > 0) {
                console.log('Polling received messages:', result.messages);
                result.messages.forEach(msg => {
                    if (msg.id > lastMessageId) {
                        console.log(`Displaying polled message: id=${msg.id}, sender_id=${msg.sender_id}, content=${msg.content}`);
                        displayMessage(msg);
                        lastMessageId = msg.id;
                    }
                });
            } else {
                console.log('No new messages from polling');
            }
        } catch (error) {
            console.error('Polling fetch error:', error);
        }
    }, 5000);
}

function displayMessage(msg) {
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) {
        console.error('Messages div not found');
        return;
    }
    if (messagesDiv.querySelector(`[data-message-id="${msg.id}"]`)) {
        console.log(`Skipping duplicate message: id=${msg.id}`);
        return;
    }
    if (!msg.id.toString().startsWith('temp-')) {
        const tempMessages = messagesDiv.querySelectorAll('[data-temp-id]');
        tempMessages.forEach(tempMsg => {
            if (tempMsg.querySelector('.content').textContent === msg.content) {
                console.log(`Removing temp message with content: ${msg.content}`);
                tempMsg.remove();
            }
        });
    }

    // Extract the date from the timestamp (e.g., "Apr 26, 2025 20:32" -> "Apr 26, 2025")
    const messageDate = msg.timestamp.split(' ')[0] + ' ' + msg.timestamp.split(' ')[1] + ' ' + msg.timestamp.split(' ')[2];
    const formattedMessageDate = new Date(messageDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Determine the label for the date divider
    let dateLabel = formattedMessageDate;
    if (formattedMessageDate === todayDate) {
        dateLabel = 'Today';
    } else if (formattedMessageDate === yesterdayDate) {
        dateLabel = 'Yesterday';
    }

    // Find the existing message block for this date
    let messageBlock = null;
    let dateDivider = null;
    const dateDividers = messagesDiv.querySelectorAll('.date-divider');
    for (let i = 0; i < dateDividers.length; i++) {
        const span = dateDividers[i].querySelector('span');
        if (span && span.textContent.trim() === dateLabel) {
            dateDivider = dateDividers[i];
            messageBlock = dateDivider.nextElementSibling;
            break;
        }
    }

    // If no block exists for this date, create a new one
    if (!messageBlock || !messageBlock.classList.contains('message-block')) {
        dateDivider = document.createElement('div');
        dateDivider.className = 'date-divider';
        dateDivider.innerHTML = `<span>${dateLabel}</span>`;
        messagesDiv.appendChild(dateDivider);

        messageBlock = document.createElement('div');
        messageBlock.className = 'message-block';
        messagesDiv.appendChild(messageBlock);
    }

    // Extract just the time for display (e.g., "20:32")
    const timeOnly = msg.timestamp.split(' ')[3] || msg.timestamp;

    // Create and append the message to the block
    const messageDiv = document.createElement('div');
    const isSent = Number(msg.sender_id) === Number(currentUserId);
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.setAttribute('data-message-id', msg.id);
    if (msg.id.toString().startsWith('temp-')) {
        messageDiv.setAttribute('data-temp-id', msg.id);
    }
    const senderName = msg.is_group && !isSent ? (msg.username || 'Unknown') : '';
    const escapedContent = msg.content.replace(/'/g, "\\'");
    let dropdownContent = `
        <div onclick="showEditDialog('${msg.id}', '${escapedContent}')">Edit</div>
        <div onclick="showDeleteDialog('${msg.id}', ${msg.is_group})">Delete</div>
        <div onclick="showClearChatDialog()">Clear</div>
        <div onclick="showInfoModal()">Info</div>
    `;
    messageDiv.innerHTML = `
        <div class="bubble">
            ${msg.is_group && !isSent ? `<span class="sender">${senderName}</span>` : ''}
            <span class="content">${msg.content}</span>
        </div>
        <span class="timestamp">${timeOnly}</span>
        ${isSent ? `
            <div class="message-actions">
                <div class="dropdown">
                    ${dropdownContent}
                </div>
            </div>
        ` : ''}
    `;
    messageBlock.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    console.log(`Displayed message: id=${msg.id}, content=${msg.content}, sender_id=${msg.sender_id}, isSent=${isSent}`);
}

async function sendMessage(event, receiver, isGroup = false, groupId = null) {
    event.preventDefault();
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    if (!content) {
        console.log('Empty message ignored');
        return;
    }
    console.log(`Sending message: content="${content}", receiver=${receiver}, isGroup=${isGroup}, groupId=${groupId}`);
    const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const tempMessage = {
        id: 'temp-' + Date.now(),
        sender_id: currentUserId,
        content: content,
        timestamp: timestamp,
        is_group: isGroup,
        username: username
    };
    displayMessage(tempMessage);
    const formData = new FormData();
    formData.append('content', content);
    formData.append('is_group', isGroup ? '1' : '0');
    if (isGroup) {
        formData.append('group_id', groupId);
    } else {
        formData.append('receiver', receiver);
    }
    try {
        const response = await fetch('/send_message', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const result = await response.json();
        if (result.status === 'success') {
            console.log(`Message sent successfully: id=${result.message_id}`);
            lastMessageId = Math.max(lastMessageId, result.message_id);
        } else {
            console.error('Send message error:', result.error);
            alert('Error sending message: ' + result.error);
            removeTempMessage(tempMessage.id);
        }
    } catch (error) {
        console.error('Send message fetch error:', error);
        alert('Error sending message: ' + (error.message || 'Unknown error'));
        removeTempMessage(tempMessage.id);
    }
    messageInput.value = '';
}

function showClearChatDialog() {
    console.log('Showing clear chat dialog');
    showConfirmDialog('Clear this chat?', () => {
        clearChat();
    });
}

async function clearChat() {
    console.log('Attempting to clear chat');
    try {
        const formData = new FormData();
        if (window.isGroup) {
            formData.append('group_id', window.groupId);
            var endpoint = '/clear_group_chat';
        } else {
            formData.append('receiver', window.receiverUsername);
            var endpoint = '/clear_private_chat';
        }
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        console.log(`${endpoint} response status:`, response.status);
        const data = await response.json();
        console.log(`${endpoint} response data:`, data);
        if (data.status === 'success') {
            const messagesDiv = document.getElementById('messages');
            if (messagesDiv) {
                messagesDiv.innerHTML = '';
                console.log('Chat cleared successfully');
            }
        } else {
            console.error('Failed to clear chat:', data.error);
            alert('Failed to clear chat: ' + data.error);
        }
    } catch (error) {
        console.error('Error clearing chat:', error);
        alert('Error clearing chat: ' + error.message);
    }
}

async function showInfoModal() {
    console.log('Opening info modal for:', window.isGroup ? `group_id: ${window.groupId}` : `username: ${window.receiverUsername}`);
    const modal = document.getElementById('infoModal');
    if (!modal) {
        console.error('Info modal not found');
        return;
    }
    try {
        if (window.isGroup) {
            const response = await fetch(`/get_group_info?group_id=${encodeURIComponent(window.groupId)}`, {
                method: 'GET',
                credentials: 'include'
            });
            console.log('get_group_info response status:', response.status);
            const data = await response.json();
            console.log('get_group_info response data:', data);
            if (data.status === 'success') {
                const group = data.group;
                let modalContent = `
                    <h2>Group Info</h2>
                    <p><strong>Group Name:</strong> ${group.name}</p>
                    <p><strong>Description:</strong> ${group.description}</p>
                    <p><strong>Members:</strong> ${group.members.length}</p>
                    <p><strong>Member List:</strong> ${group.members.map(m => m.username).join(', ')}</p>
                `;
                if (Number(currentUserId) === Number(group.creator_id)) {
                    modalContent += `
                        <button class="edit-group-btn" onclick="toggleEditGroupForm()">Edit Group Info</button>
                        <form id="edit-group-form" style="display: none;">
                            <input type="hidden" name="group_id" value="${group.id}">
                            <label>Group Name:</label>
                            <input type="text" name="group_name" value="${group.name}" required>
                            <label>Description:</label>
                            <input type="text" name="description" value="${group.description}" required>
                            <p><strong>Member List:</strong></p>
                            <div id="members-manage-list">
                                ${group.members.map(member => `
                                    <div class="member-item" data-user-id="${member.id}">
                                        <span>${member.username}</span>
                                        ${member.id != currentUserId ? `<button type="button" onclick="removeMember('${member.id}')">Remove</button>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                            <form id="add-member-form" class="add-member-form" style="display: none;">
                                <input type="hidden" id="add-group-id" value="${group.id}">
                                <select id="add-username" required>
                                    <option value="" disabled selected>Select a friend</option>
                                </select>
                                <button type="button" onclick="submitAddToGroup()">Add</button>
                                <button type="button" onclick="toggleAddMemberForm()">Cancel</button>
                            </form>
                            <button type="button" onclick="updateGroupInfo()">Save</button>
                        </form>
                    `;
                }
                modalContent += `<button onclick="closeModal('infoModal')" style="position: sticky; bottom: 0; width: 100%;">Close</button>`;
                modal.querySelector('.modal-content').innerHTML = modalContent;
                modal.style.display = 'block';
                console.log('Info modal displayed successfully');
                if (Number(currentUserId) === Number(group.creator_id)) {
                    fetchFriendsForAddMember(group.id);
                }
            } else {
                console.error('Failed to fetch group info:', data.error);
                alert('Error fetching group info: ' + data.error);
            }
        } else {
            const response = await fetch(`/get_user_info?username=${encodeURIComponent(window.receiverUsername)}`, {
                method: 'GET',
                credentials: 'include'
            });
            console.log('get_user_info response status:', response.status);
            const data = await response.json();
            console.log('get_user_info response data:', data);
            if (data.status === 'success') {
                const user = data.user;
                const interestsList = user.interests && user.interests.length
                    ? user.interests.map(i => `#${i}`).join('<br>')
                    : 'None';
                modal.querySelector('.modal-content').innerHTML = `
                    <h2>User Info</h2>
                    <p><strong>Name:</strong> ${user.name} ${user.surname}</p>
                    <p><strong>Username:</strong> ${user.username}</p>
                    <p><strong>Age:</strong> ${user.age}</p>
                    <p><strong>Interests:</strong><br>${interestsList}</p>
                    <button onclick="closeModal('infoModal')" style="position: sticky; bottom: 0; width: 100%;">Close</button>
                `;
                modal.style.display = 'block';
                console.log('Info modal displayed successfully');
            } else {
                console.error('Failed to fetch user info:', data.error);
                alert('Error fetching user info: ' + data.error);
            }
        }
    } catch (error) {
        console.error('Error fetching info:', error);
        alert('Error fetching info: ' + error.message);
    }
}

// New function to toggle the edit group form visibility
function toggleEditGroupForm() {
    const editForm = document.getElementById('edit-group-form');
    if (editForm) {
        editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        console.log('Modal closed:', modalId);
    }
}

function updateGroupInfo() {
    const form = document.getElementById('edit-group-form');
    const formData = new FormData(form);
    console.log('Updating group info for group_id:', window.groupId);
    fetch('/update_group_info', {
        method: 'POST',
        body: formData,
        credentials: 'include'
    })
    .then(response => {
        console.log('update_group_info response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('update_group_info response data:', data);
        if (data.status === 'success') {
            const groupName = formData.get('group_name');
            const description = formData.get('description');
            document.getElementById('group-header-name').textContent = groupName;
            document.title = `SomeMsger - Group ${groupName}`;
            const descriptionSpan = document.getElementById('group-description');
            if (descriptionSpan) {
                descriptionSpan.textContent = description;
            }
            const sidebarGroup = document.querySelector(`.chat-item[href="/group/${window.groupId}"] .chat-name`);
            if (sidebarGroup) {
                sidebarGroup.textContent = groupName;
            }
            showInfoModal();
            console.log('Group info updated successfully:', groupName);
        } else {
            console.error('Failed to update group info:', data.error);
            alert('Failed to update group info: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error updating group info:', error);
        alert('Error updating group info: ' + error.message);
    });
}

function removeTempMessage(tempId) {
    const messagesDiv = document.getElementById('messages');
    const tempMessage = messagesDiv.querySelector(`[data-temp-id="${tempId}"]`);
    if (tempMessage) {
        tempMessage.remove();
    }
}

function showConfirmDialog(message, onConfirm) {
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.innerHTML = `
        <div>${message}</div>
        <div class="custom-dialog-buttons">
            <button class="confirm">Yes</button>
            <button class="cancel">No</button>
        </div>
    `;
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    dialog.style.display = 'block';
    overlay.style.display = 'block';
    dialog.querySelector('.confirm').onclick = () => {
        onConfirm();
        dialog.remove();
        overlay.remove();
    };
    dialog.querySelector('.cancel').onclick = () => {
        dialog.remove();
        overlay.remove();
    };
}

function showEditDialog(messageId, currentContent) {
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.innerHTML = `
        <div>Edit Message:</div>
        <input type="text" id="edit-message-input">
        <div class="custom-dialog-buttons">
            <button class="confirm">Save</button>
            <button class="cancel">Cancel</button>
        </div>
    `;
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    const input = dialog.querySelector('#edit-message-input');
    input.value = currentContent;
    dialog.style.display = 'block';
    overlay.style.display = 'block';
    dialog.querySelector('.confirm').onclick = () => {
        const newContent = input.value.trim();
        if (newContent && newContent !== currentContent) {
            editMessage(messageId, newContent);
        }
        dialog.remove();
        overlay.remove();
    };
    dialog.querySelector('.cancel').onclick = () => {
        dialog.remove();
        overlay.remove();
    };
}

function showDeleteDialog(messageId, isGroup) {
    showConfirmDialog('Delete this message?', () => {
        deleteMessage(messageId, isGroup);
    });
}

async function editMessage(messageId, newContent) {
    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('content', newContent);
    formData.append('is_group', window.isGroup ? '1' : '0');
    if (window.isGroup) {
        formData.append('group_id', window.groupId);
    }
    try {
        const response = await fetch('/edit_message', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.status !== 'success') {
            alert('Failed to edit message: ' + data.error);
        } else {
            // Update the UI immediately
            const messageDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageDiv) {
                messageDiv.querySelector('.content').textContent = newContent;
            }
        }
    } catch (error) {
        alert('Error editing message: ' + error.message);
    }
}

async function deleteMessage(messageId, isGroup) {
    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('is_group', isGroup ? '1' : '0');
    if (isGroup) {
        formData.append('group_id', window.groupId);
    }
    try {
        const response = await fetch('/delete_message', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.status !== 'success') {
            alert('Failed to delete message: ' + data.error);
        } else {
            // Remove the message from the UI
            const messageDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageDiv) {
                messageDiv.remove();
            }
        }
    } catch (error) {
        alert('Error deleting message: ' + error.message);
    }
}

async function updateProfile() {
    const formData = new FormData();
    formData.append('name', document.getElementById('name').value);
    formData.append('surname', document.getElementById('surname').value);
    formData.append('age', document.getElementById('age').value);
    formData.append('interests', document.getElementById('interests').value);
    try {
        const response = await fetch('/update_profile', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Profile updated');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error updating profile');
    }
}

async function updateUsername() {
    const formData = new FormData();
    formData.append('username', document.getElementById('username').value);
    try {
        const response = await fetch('/update_username', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Username updated');
            location.reload();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error updating username');
    }
}

async function changePassword() {
    const formData = new FormData();
    formData.append('old_password', document.getElementById('old_password').value);
    formData.append('new_password', document.getElementById('new_password').value);
    formData.append('confirm_password', document.getElementById('confirm_password').value);
    try {
        const response = await fetch('/change_password', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Password changed successfully');
            toggleChangePasswordForm();
            document.getElementById('change-password-form').reset();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error changing password');
    }
}

async function searchUsers() {
    const query = document.getElementById('search-input').value;
    const suggestionsDiv = document.getElementById('suggestions');
    if (query.length < 1) {
        suggestionsDiv.innerHTML = '';
        return;
    }
    try {
        const formData = new FormData();
        formData.append('query', query);
        const response = await fetch('/search', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const result = await response.json();
        suggestionsDiv.innerHTML = '';
        if (result.users && result.users.length > 0) {
            result.users.forEach(user => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>${user.username}</span>
                    ${user.can_send_request ? `<button onclick="sendFriendRequest('${user.username}')">Add</button>` : '<span style="color: #666; font-size: 14px;">Request sent or already friends</span>'}
                `;
                suggestionsDiv.appendChild(div);
            });
        } else {
            suggestionsDiv.innerHTML = '<p>No users found.</p>';
        }
    } catch (error) {
        console.error('Search error:', error);
        suggestionsDiv.innerHTML = '<p>Error searching for users.</p>';
    }
}

async function sendFriendRequest(username) {
    const formData = new FormData();
    formData.append('username', username);
    try {
        const response = await fetch('/send_friend_request', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Friend request sent');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error sending friend request');
    }
}

async function acceptFriendRequest(username) {
    console.log(`Accepting friend request from ${username}`);
    try {
        const formData = new FormData();
        formData.append('username', username);
        const response = await fetch('/accept_friend_request', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const result = await response.json();
        if (result.status === 'success') {
            console.log(`Friend request from ${username} accepted`);
            // Remove the pending request from the UI
            const pendingItem = document.querySelector(`.pending-item:has(span:contains("${username}"))`);
            if (pendingItem) {
                pendingItem.remove();
            }
            // Check if there are any remaining pending requests
            const pendingItems = document.querySelectorAll('.pending-item');
            if (pendingItems.length === 0) {
                const pendingSection = document.querySelector('.pending-requests');
                const noRequestsMessage = document.createElement('p');
                noRequestsMessage.style.padding = '10px';
                noRequestsMessage.style.fontSize = '14px';
                noRequestsMessage.style.color = '#666';
                noRequestsMessage.textContent = 'No pending friend requests.';
                pendingSection.appendChild(noRequestsMessage);
            }
            // Update the friends list in the sidebar (if present)
            const friendsList = document.querySelector('.chat-list');
            if (friendsList) {
                const friendItem = document.createElement('a');
                friendItem.href = `/chats/${username}`;
                friendItem.className = 'chat-item';
                friendItem.innerHTML = `
                    <div class="avatar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                    </div>
                    <div class="chat-info">
                        <span class="chat-name">${username}</span>
                    </div>
                `;
                friendsList.insertBefore(friendItem, friendsList.querySelector('.chat-item[href="/groups/create"]'));
            }
            alert(`Friend request from ${username} accepted!`);
        } else {
            console.error('Failed to accept friend request:', result.error);
            alert(`Failed to accept friend request: ${result.error}`);
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        alert('An error occurred while accepting the friend request.');
    }
}

async function createGroup() {
    const formData = new FormData(document.getElementById('group-form'));
    try {
        const response = await fetch('/create_group', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Group created');
            window.location.href = `/group/${result.group_id}`;
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error creating group');
    }
}

async function submitCreateGroup() {
    createGroup();
}

function toggleAddMemberForm() {
    const form = document.getElementById('add-member-form');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
}

function toggleChangePasswordForm() {
    const form = document.getElementById('change-password-form');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
}

async function fetchFriendsForAddMember(groupId) {
    try {
        const response = await fetch(`/get_friends_for_group?group_id=${groupId}`);
        const result = await response.json();
        const select = document.getElementById('add-username');
        if (select) {
            select.innerHTML = '<option value="" disabled selected>Select a friend</option>';
            result.friends.forEach(friend => {
                const option = document.createElement('option');
                option.value = friend;
                option.textContent = friend;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching friends:', error);
    }
}

async function submitAddToGroup() {
    const username = document.getElementById('add-username').value;
    const groupId = document.getElementById('add-group-id').value;
    const formData = new FormData();
    formData.append('username', username);
    formData.append('group_id', groupId);
    try {
        const response = await fetch('/add_to_group', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Member added');
            toggleAddMemberForm();
            showInfoModal(); // Refresh modal
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error adding member');
    }
}

async function removeMember(userId) {
    console.log('Attempting to remove member with user_id:', userId);
    showConfirmDialog('Remove this member?', () => {
        fetch('/remove_from_group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `group_id=${window.groupId}&user_id=${userId}`
        })
        .then(response => {
            console.log('remove_from_group response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('remove_from_group response data:', data);
            if (data.status === 'success') {
                showInfoModal(); // Refresh modal to show updated members
                fetchFriendsForAddMember(window.groupId);
                console.log('Member removed successfully:', userId);
            } else {
                console.error('Failed to remove member:', data.error);
                alert('Failed to remove member: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Error removing member:', error);
            alert('Error removing member: ' + error.message);
        });
    });
}

async function updateStyles() {
    const theme = document.getElementById('theme-select').value;
    const fontSize = document.getElementById('font-size-select').value;

    // Save to localStorage
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', fontSize);

    // Apply the styles by setting data attributes
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-size', fontSize);

    // Update UI indicators
    document.getElementById('current-theme').textContent = `Current: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
    document.getElementById('current-font-size').textContent = `Current: ${fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}`;

    // Optionally save to the server
    try {
        const formData = new FormData();
        formData.append('theme', theme);
        formData.append('font_size', fontSize);
        const response = await fetch('/update_styles', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Styles updated');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error updating styles: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedFontSize = localStorage.getItem('fontSize') || 'medium';

    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-size', savedFontSize);
});