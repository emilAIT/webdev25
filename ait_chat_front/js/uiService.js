import { formatLastSeen } from './utils.js';
import * as stateService from './stateService.js'; // May need state for display logic
import * as apiService from './apiService.js'; // Added for API calls

// Keep references to DOM elements
let elements = {};

export function initElements() {
    elements = {
        sendButton: document.getElementById('send-button'),
        messageInput: document.getElementById('message-input'),
        chatMessages: document.getElementById('chat-messages'),
        logoutButton: document.querySelector('.logout-button'),
        chatListElement: document.getElementById('chat-list'),
        chatHeaderName: document.getElementById('chat-header-name'),
        chatHeaderAvatar: document.getElementById('chat-header-avatar'),
        chatHeaderStatus: document.getElementById('chat-header-status'),
        chatHeaderStatusIndicator: document.getElementById('chat-header-status-indicator'),
        typingIndicator: document.getElementById('typing-indicator'),
        chatArea: document.querySelector('.chat-area'),
        usersButton: document.getElementById('users-button'),
        addContactPopup: document.getElementById('add-contact-popup'),
        closeAddContactPopup: document.getElementById('close-add-contact-popup'),
        addContactUsernameInput: document.getElementById('add-contact-username'),
        addContactSearchResults: document.getElementById('add-contact-search-results'),
        addContactButton: document.getElementById('add-contact-button'),
        addContactStatus: document.getElementById('add-contact-status'),
        combinedModal: document.getElementById('combined-modal'),
        closeCombinedModal: document.getElementById('close-combined-modal'),
        modalAddContact: document.getElementById('modal-add-contact'),
        modalCreateGroup: document.getElementById('modal-create-group'),
        newChatContactList: document.getElementById('new-chat-contact-list'),
        groupListElement: document.getElementById('group-list'),
        createGroupButton: document.getElementById('create-group-button'),
        createGroupPopup: document.getElementById('create-group-popup'),
        closeCreateGroupPopup: document.getElementById('close-create-group-popup'),
        createGroupNameInput: document.getElementById('create-group-name'),
        createGroupSubmitButton: document.getElementById('create-group-submit-button'),
        createGroupStatus: document.getElementById('create-group-status'),
        addGroupMemberButton: document.getElementById('add-group-member-button'),
        memberList: document.getElementById('selected-member-list'),
        chatHeaderMoreOptionsButton: document.getElementById('chat-header-more-options'),
        chatActionsDropdown: document.getElementById('chat-actions-dropdown'),
        manageMembersModal: document.getElementById('manage-members-modal'),
        closeManageMembersModal: document.getElementById('close-manage-members-modal'),
        groupMemberList: document.getElementById('group-member-list'),
        addMemberUsernameInput: document.getElementById('add-member-username'),
        addMemberSearchResults: document.getElementById('add-member-search-results'),
        addMemberButton: document.getElementById('add-member-button'),
        addMemberStatus: document.getElementById('add-member-status'),
        createGroupContactList: document.getElementById('create-group-contact-list'),
        sidebarProfileHeader: document.getElementById('sidebar-profile-header'),
        sidebarProfileAvatar: document.getElementById('sidebar-profile-avatar'),
        sidebarProfileUsername: document.getElementById('sidebar-profile-username'),
        profileModal: document.getElementById('profile-modal'),
        closeProfileModal: document.getElementById('close-profile-modal'),
        attachButton: document.getElementById('attach-button'),
        // NEW: Attachment Preview Elements
        attachmentPreview: document.getElementById('attachment-preview'),
        attachmentLoading: document.querySelector('#attachment-preview .loading-indicator'),
        attachmentContent: document.querySelector('#attachment-preview .preview-content'),
        attachmentIcon: document.querySelector('#attachment-preview .preview-icon'),
        attachmentFilename: document.querySelector('#attachment-preview .preview-filename'),
        attachmentClearButton: document.querySelector('#attachment-preview .clear-attachment-button'),
        // NEW: Element for image preview
        attachmentPreviewImage: document.getElementById('attachment-preview-image'),
        groupAvatar: document.getElementById('group-avatar'),
        groupNameHeader: document.getElementById('group-name-header'),
        groupMembersCount: document.getElementById('group-members-count'),
        // NEW: Edit Group Modal Elements
        editGroupModal: document.getElementById('edit-group-modal'),
        closeEditGroupModal: document.getElementById('close-edit-group-modal'),
        editGroupNameInput: document.getElementById('edit-group-name'),
        editGroupDescriptionInput: document.getElementById('edit-group-description'),
        editGroupAvatarPreview: document.getElementById('edit-group-avatar-preview'),
        editGroupAvatarUploadButton: document.getElementById('edit-group-avatar-upload-button'),
        editGroupAvatarInput: document.getElementById('edit-group-avatar-input'),
        saveGroupChangesButton: document.getElementById('save-group-changes-button'),
        editGroupStatus: document.getElementById('edit-group-status'),
    };
    elements.memberList = elements.memberList;
    return elements; // Return for main.js to use
}

// --- NEW: Unified Chat List Rendering ---
export function populateChatList(chatItems) {
    if (!elements.chatListElement) return;
    elements.chatListElement.innerHTML = ''; // Clear existing list

    if (!chatItems || chatItems.length === 0) {
        elements.chatListElement.innerHTML = '<li class="no-chats-message">No chats yet.</li>'; // Add a placeholder message
        return;
    }

    // Ensure items are sorted by timestamp (most recent first) - stateService should provide sorted list
    chatItems.forEach(item => {
        const listItem = document.createElement('li');
        listItem.classList.add('chat-list-item'); // Use a common class
        listItem.dataset.type = item.type; // Store type ('user' or 'group')
        
        if (item.type === 'user') {
            listItem.dataset.userId = item.id;
        } else {
            listItem.dataset.groupId = item.id;
        }

        // Determine active state
        const isActive = item.id === stateService.getCurrentChatTarget() && 
                         (item.type === 'user' && !stateService.isGroupChat()) || 
                         (item.type === 'group' && stateService.isGroupChat());
        if (isActive) {
            listItem.classList.add('active');
        }

        const isOnline = item.type === 'user' ? item.isOnline : false; // Groups aren't online
        const statusClass = isOnline ? 'online' : 'offline';
        const statusTitle = isOnline ? 'Online' : (item.type === 'user' ? `Offline (${formatLastSeen(item.lastSeen)})` : '');
        const unreadCount = item.unreadCount || 0;
        const lastMessageTime = item.lastMessageTimestamp 
            ? formatTimestampForList(item.lastMessageTimestamp) 
            : '';

        listItem.innerHTML = `
            <div class="avatar-container">
                <img src="${item.avatarUrl}" alt="Avatar" class="avatar">
                ${item.type === 'user' ? `<div class="status-indicator ${statusClass}" title="${statusTitle}"></div>` : ''}
            </div>
            <div class="contact-info">
                <span class="contact-name">${item.name}</span>
                <span class="contact-preview">${item.lastMessagePreview || ''}</span>
            </div>
            <div class="contact-meta">
                <span class="timestamp">${lastMessageTime}</span>
                <span class="unread-count" style="display: ${unreadCount > 0 ? 'inline-block' : 'none'};">${unreadCount}</span>
                ${item.type === 'user' && !isOnline ? `<span class="last-seen">${formatLastSeen(item.lastSeen)}</span>` : ''}
            </div>
        `;

        // Add click listener in main.js using event delegation
        elements.chatListElement.appendChild(listItem);
    });
}

// Helper function to format timestamp for the list view
function formatTimestampForList(isoTimestamp) {
    if (!isoTimestamp) return '';
    const now = new Date();
    const msgDate = new Date(isoTimestamp);
    const diffSeconds = Math.floor((now - msgDate) / 1000);
    const diffDays = Math.floor(diffSeconds / (60 * 60 * 24));

    if (diffSeconds < 60) {
        return 'Now';
    } else if (diffSeconds < 60 * 60) {
        return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 0 && now.getDate() === msgDate.getDate()) {
        // Same day
        return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else {
        // Older than yesterday
        return msgDate.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
}

// --- End Unified Chat List Rendering ---

export function appendMessage(sender, text, isMe, isoTimestamp = null, readAt = null, messageId = null, recipientId = null, isGroup = false, groupId = null, mediaUrl = null, mediaType = null, mediaFilename = null, mediaSize = null) {
     if (!elements.chatMessages) return;
    // Add log to check the isMe value being passed
    console.log(`[appendMessage] Rendering msgId=${messageId}, isMe=${isMe}, sender=${sender}, isGroup=${isGroup}, groupId=${groupId}`);
    const messageGroup = document.createElement('div');
    messageGroup.classList.add('message-group');
    messageGroup.classList.add(isMe ? 'sender' : 'receiver');
    if (messageId) {
        messageGroup.dataset.messageId = messageId;
    }
    if (isMe && recipientId !== null && !isGroup) {
         messageGroup.dataset.recipientId = recipientId;
    }

    const avatarImg = document.createElement('img');
    avatarImg.src = isGroup && !isMe ? "assets/svg/group-avatar.svg" : "assets/images/default-avatar.png";
    avatarImg.alt = "Avatar";
    avatarImg.classList.add('avatar');

    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');

    const senderNameSpan = document.createElement('span');
    senderNameSpan.classList.add('sender-name');
    // Use stateService to get username if sender is not 'Me' and info isn't passed directly
    const senderDisplayName = isMe ? 'Me' : (sender || stateService.getUsername(isMe ? null : (isGroup ? groupId : recipientId)) || 'Unknown');
    senderNameSpan.textContent = senderDisplayName;
    if (isGroup || isMe) { // Only show sender name for groups or if it's me (maybe always show for groups?)
        messageContentDiv.appendChild(senderNameSpan);
    }
    if (!isGroup && !isMe) {
        // senderNameSpan.style.display = 'none'; // Optionally hide sender name for receiver in DMs
    }


    const messageBubbleDiv = document.createElement('div');
    messageBubbleDiv.classList.add('message-bubble');
    // messageBubbleDiv.textContent = text; // Clear this, content added below
    console.log(`APPEND_MSG (isMe=${isMe}, isGroup=${isGroup}, messageId=${messageId}): mediaUrl=${mediaUrl}, mediaType=${mediaType}, mediaFilename=${mediaFilename}, mediaSize=${mediaSize}`);
    // --- NEW: Media Rendering --- 


    if (mediaUrl) {
        if (mediaType && mediaType.startsWith('image')) {
            // Create a container for the thumbnail
            const thumbnailContainer = document.createElement('a'); // Use anchor for link
            thumbnailContainer.href = mediaUrl;
            thumbnailContainer.target = '_blank';
            thumbnailContainer.classList.add('media-thumbnail-container');

            const img = document.createElement('img');
            img.src = mediaUrl; // Use the same URL for thumbnail source
            img.alt = mediaFilename || 'Image attachment';
            img.classList.add('media-thumbnail'); // Add thumbnail specific class

            thumbnailContainer.appendChild(img); // Add image to link container
            messageBubbleDiv.appendChild(thumbnailContainer); // Add container to bubble
        } else {
            // Placeholder for non-image files
            const placeholder = document.createElement('a'); // Make it a link
            placeholder.href = mediaUrl;
            placeholder.target = '_blank'; // Open in new tab
            placeholder.classList.add('media-placeholder');
            
            // Simple icon based on type (extend as needed)
            const icon = document.createElement('img');
            icon.src = 'assets/svg/file-text.svg'; // Default file icon
            if (mediaType?.startsWith('video/')) icon.src = 'assets/svg/file-video.svg';
            if (mediaType?.startsWith('audio/')) icon.src = 'assets/svg/file-audio.svg';
            // Add more icons for pdf, doc, zip etc.
            icon.classList.add('file-icon');
            icon.alt = 'File type icon';

            const fileInfo = document.createElement('div');
            fileInfo.classList.add('file-info');

            const fileNameSpan = document.createElement('span');
            fileNameSpan.classList.add('file-name');
            fileNameSpan.textContent = mediaFilename || 'Attached File';
            fileInfo.appendChild(fileNameSpan);

            if (mediaSize) {
                const fileSizeSpan = document.createElement('span');
                fileSizeSpan.classList.add('file-size');
                // Format size (optional)
                const sizeKB = Math.round(mediaSize / 1024);
                fileSizeSpan.textContent = `${sizeKB} KB`;
                fileInfo.appendChild(fileSizeSpan);
            }

            placeholder.appendChild(icon);
            placeholder.appendChild(fileInfo);
            messageBubbleDiv.appendChild(placeholder);
        }
    }
    // --- END Media Rendering ---

    // Add text content if it exists
    if (text) {
        const textNode = document.createElement('span'); // Use span for text part
        textNode.textContent = text;
        messageBubbleDiv.appendChild(textNode);
    }

    const messageMetaDiv = document.createElement('div');
    messageMetaDiv.classList.add('message-meta');

    const timestamp = isoTimestamp ? new Date(isoTimestamp) : new Date();
    const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    timestampSpan.textContent = formattedTime;

    const readStatusContainer = document.createElement('span');
    readStatusContainer.classList.add('read-status-icon-container');
    if (isMe && !isGroup) {
        const readStatusIcon = document.createElement('img');
        // This line determines the initial icon based on readAt
        const iconSrc = readAt ? 'assets/svg/read.svg' : 'assets/svg/unread.svg';
        // --- DEBUG LOG --- 
        console.log(`APPEND_MSG (isMe=${isMe}, isGroup=${isGroup}, messageId=${messageId}): Setting initial icon based on readAt='${readAt}'. IconSrc: ${iconSrc}`);
        // --- END DEBUG LOG ---
        readStatusIcon.src = iconSrc;
        readStatusIcon.alt = readAt ? 'Read' : 'Sent';
        readStatusIcon.classList.add('read-status-icon');
        readStatusContainer.appendChild(readStatusIcon);
    }

    messageMetaDiv.appendChild(timestampSpan);
    messageMetaDiv.appendChild(readStatusContainer);

    messageContentDiv.appendChild(messageBubbleDiv);
    messageContentDiv.appendChild(messageMetaDiv);

    messageGroup.appendChild(avatarImg);
    messageGroup.appendChild(messageContentDiv);

    elements.chatMessages.appendChild(messageGroup);

    // Scroll to bottom (might need slight delay sometimes)
    scrollToBottom();
}

export function appendSystemMessage(text) {
    if (!elements.chatMessages) return;
    const messageElem = document.createElement('div');
    messageElem.classList.add('chat-message', 'system');
    messageElem.textContent = text;
    elements.chatMessages.appendChild(messageElem);
    scrollToBottom();
}

export function clearChatMessages() {
    if (elements.chatMessages) elements.chatMessages.innerHTML = '';
}

export function scrollToBottom() {
     if (elements.chatMessages) {
         // Use setTimeout to ensure DOM has updated
         setTimeout(() => {
             elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
         }, 0);
     }
}

export function updateUnreadBadge(targetId, isGroup, count) { // Pass explicit count
    const listElement = elements.chatListElement;
    if (!listElement) return;
    const dataAttr = isGroup ? 'data-group-id' : 'data-user-id';
    const listItem = listElement.querySelector(`.chat-list-item[${dataAttr}="${targetId}"]`);
    if (!listItem) return;

    const badge = listItem.querySelector('.unread-count');
    if (!badge) return;

    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

export function updateUserStatusInUI(userId) {
    const userState = stateService.getUser(userId);
    if (!userState) return;
    
    // Update combined list state first
    stateService.updateChatItemUserStatus(userId, userState.is_online, userState.last_seen);

    // Find the item in the DOM
    const listItem = elements.chatListElement?.querySelector(`.chat-list-item[data-user-id="${userId}"]`);
    if (listItem) {
        const isOnline = userState.is_online;
        const lastSeenIso = userState.last_seen;
        const statusIndicator = listItem.querySelector('.status-indicator');
        const lastSeenElement = listItem.querySelector('.last-seen');
        const statusClass = isOnline ? 'online' : 'offline';
        const statusTitle = isOnline ? 'Online' : `Offline (${formatLastSeen(lastSeenIso)})`;

        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${statusClass}`;
            statusIndicator.title = statusTitle;
        }
        if (lastSeenElement) {
            lastSeenElement.textContent = formatLastSeen(lastSeenIso);
            lastSeenElement.style.display = isOnline ? 'none' : 'block';
        }
    }

    // Update header if this user is currently selected
    if (!stateService.isGroupChat() && stateService.getCurrentChatTarget() === userId) {
        updateChatHeaderStatus(); // Let it read from state
    }
}

export function updateChatHeaderStatus(groupDetails = null) { // Pass group details if available
    const isGroup = stateService.isGroupChat();
    const targetId = stateService.getCurrentChatTarget();

    if (!targetId) { // No chat selected
        elements.chatHeaderName.textContent = 'Select a chat';
        elements.chatHeaderStatus.textContent = 'Offline / Group Info';
        elements.chatHeaderStatusIndicator.className = 'status-indicator offline'; // Default or hide?
        hideChatActionsButton(); // Hide 3-dots too
        return;
    }

    // Show 3-dots button if chat is selected
    if (elements.chatHeaderMoreOptionsButton) {
        elements.chatHeaderMoreOptionsButton.style.display = 'inline-block';
    }

    if (isGroup) {
        const group = groupDetails || stateService.getGroup(targetId);
        if (!group) return; // Should not happen if selected
        elements.chatHeaderName.textContent = group.group_name;
        const memberCount = group.members?.length ?? 0; // Assuming members are part of fetched details
        const memberText = memberCount > 0 ? `${memberCount} member${memberCount !== 1 ? 's' : ''}` : '';
        elements.chatHeaderStatus.textContent = group.description || memberText;
        elements.chatHeaderStatusIndicator.className = 'status-indicator group'; // Specific class or hide?
        const avatarUrl = group.avatar_url || 'assets/svg/group-avatar.svg';
        const avatarContainer = elements.chatHeaderAvatar.closest('.avatar-container');

        elements.chatHeaderAvatar.src = avatarUrl;
        if (avatarContainer) avatarContainer.classList.add('group'); // Add class for specific styling
        if (elements.chatHeaderStatusIndicator) elements.chatHeaderStatusIndicator.className = 'status-indicator group'; // Ensure indicator class is set
    } else {
        const user = stateService.getUser(targetId);
        if (!user) return; // Should not happen if selected
        elements.chatHeaderName.textContent = user.username;
        elements.chatHeaderStatusIndicator.className = `status-indicator ${user.is_online ? 'online' : 'offline'}`;
        elements.chatHeaderStatus.textContent = user.is_online ? 'Online' : formatLastSeen(user.last_seen);
    }
}

export function updateActiveListItem(targetId, isGroup) {
     document.querySelectorAll('.chat-list-item').forEach(item => item.classList.remove('active'));
     const listElement = elements.chatListElement;
     if (!listElement) return;
     const dataAttr = isGroup ? 'data-group-id' : 'data-user-id';
     const itemSelector = `.chat-list-item[data-type="${isGroup ? 'group' : 'user'}"][${dataAttr}="${targetId}"]`;
     listElement.querySelector(itemSelector)?.classList.add('active');
}

export function disableChatArea(disabled) {
    if (elements.chatArea) {
         elements.chatArea.classList.toggle('chat-disabled', disabled);
    }
    // Optionally disable input/send button explicitly too
    if (elements.messageInput) elements.messageInput.disabled = disabled;
    if (elements.sendButton) elements.sendButton.disabled = disabled;
}

export function showTypingIndicator(username) {
     if (elements.typingIndicator) {
         const indicatorSpan = elements.typingIndicator.querySelector('span');
         if (indicatorSpan) indicatorSpan.textContent = username || 'Someone';
         elements.typingIndicator.style.display = 'block';
     }
}

export function updateGroupTypingIndicator() {
    const targetId = stateService.getCurrentChatTarget();
    const isGroup = stateService.isGroupChat();
    if (!isGroup || !elements.typingIndicator || !targetId) {
        hideTypingIndicator(); // Hide if not in a group chat
        return;
    }

    const typingUsers = stateService.getGroupTypingUsers(targetId);
    const userNames = typingUsers.map(u => u.username);

    if (userNames.length === 0) {
        hideTypingIndicator();
    } else {
        let text = '';
        if (userNames.length === 1) {
            text = `${userNames[0]} is typing...`;
        } else if (userNames.length === 2) {
            text = `${userNames[0]} and ${userNames[1]} are typing...`;
        } else {
            text = `${userNames[0]}, ${userNames[1]} and others are typing...`;
        }
        const indicatorSpan = elements.typingIndicator.querySelector('span');
        if (indicatorSpan) indicatorSpan.textContent = text; // Set the full text here
        else elements.typingIndicator.textContent = text; // Fallback if span missing

        elements.typingIndicator.style.display = 'block';
    }
}


export function hideTypingIndicator() {
    if (elements.typingIndicator) {
        elements.typingIndicator.style.display = 'none';
    }
}

export function updateReadStatusIcons(userIdWhoRead) {
    if (!elements.chatMessages) return;
    console.log(`UI: Updating read status icons for reader: ${userIdWhoRead}`);

    // Select only sent messages in the current chat potentially intended for the reader
    const sentMessages = elements.chatMessages.querySelectorAll(`.message-group.sender[data-recipient-id="${userIdWhoRead}"]`);
    console.log(`Found ${sentMessages.length} sent message elements matching reader ${userIdWhoRead}.`);

    sentMessages.forEach((msgElement) => {
        const messageId = msgElement.dataset.messageId; // For logging
        const iconContainer = msgElement.querySelector('.read-status-icon-container');
        if (iconContainer) {
            const existingIcon = iconContainer.querySelector('img.read-status-icon');
            if (existingIcon) {
                if (existingIcon.src.includes('unread.svg')) {
                    console.log(`Updating icon for message ${messageId || 'N/A'}`);
                    existingIcon.src = 'assets/svg/read.svg';
                    existingIcon.alt = 'Read';
                    // Add animation class
                    iconContainer.classList.add('icon-updating');
                    setTimeout(() => {
                         iconContainer.classList.remove('icon-updating');
                    }, 500);
                } else {
                    // console.log(`Icon for message ${messageId || 'N/A'} already read.`);
                }
            } else {
                 console.log(`Icon image not found inside container for message ${messageId || 'N/A'}.`);
            }
        } else {
             console.log(`Icon container not found for message ${messageId || 'N/A'}`);
        }
    });
}


// --- Helper to close all known popups/modals ---
function closeAllPopups() {
    console.log("Closing all popups..."); // Debug log
    if (elements.addContactPopup?.classList.contains('visible')) toggleAddContactPopup(false);
    if (elements.createGroupPopup?.classList.contains('visible')) toggleCreateGroupPopup(false);
    if (elements.manageMembersModal?.classList.contains('visible')) toggleManageMembersPopup(false);
    if (elements.profileModal?.classList.contains('visible')) toggleProfileModal(false);
    if (elements.combinedModal?.classList.contains('visible')) toggleCombinedModal(false);
    if (elements.chatActionsDropdown?.classList.contains('visible')) toggleChatActionsDropdown(false); // Also close dropdown
}

// --- Popup/Modal Toggles (Modified) ---

export function toggleAddContactPopup(show) {
    if (show) closeAllPopups(); // Close others before showing
    if (elements.addContactPopup) {
        elements.addContactPopup.classList.toggle('visible', show);
        if (show) {
            elements.addContactUsernameInput?.focus();
        } else {
            setAddContactStatus(''); // Clear status/input on hide
            if(elements.addContactUsernameInput) elements.addContactUsernameInput.value = '';
            clearContactSearchResults(); // Clear search results too
        }
    }
}

export function toggleCombinedModal(show) {
    if (show) closeAllPopups(); // Close others before showing
    if (elements.combinedModal) {
        elements.combinedModal.classList.toggle('visible', show);
        if (show) {
            populateNewChatModalList(); // Populate contact list when opening
        }
    }
}

export function setAddContactStatus(message, isError = false) {
     if (elements.addContactStatus) {
         elements.addContactStatus.textContent = message;
         elements.addContactStatus.className = 'add-contact-status'; // Reset
         if (message) {
            elements.addContactStatus.classList.add(isError ? 'error' : 'success');
         }
     }
}

export function setAddContactLoading(loading) {
    if(elements.addContactButton) elements.addContactButton.disabled = loading;
}

export function populateNewChatModalList() {
    if (!elements.newChatContactList) return;
    elements.newChatContactList.innerHTML = ''; // Clear existing list

    const contacts = stateService.getContacts();
    const currentUserId = stateService.getCurrentUserId();

    if (contacts.length === 0) {
        elements.newChatContactList.innerHTML = '<li>No contacts found.</li>';
        return;
    }

    contacts.forEach(user => {
        if (user.id === currentUserId) return; // Skip self

        const listItem = document.createElement('li');
        listItem.classList.add('contact-item');
        listItem.dataset.userId = user.id; // For click handler in main.js

        const isOnline = user.is_online;
        const statusClass = isOnline ? 'online' : 'offline';

        listItem.innerHTML = `
            <div class="avatar-container">
                <img src="assets/images/default-avatar.png" alt="Avatar" class="avatar">
                <div class="status-indicator ${statusClass}"></div>
            </div>
            <div class="contact-info">
                <span class="contact-name">${user.username}</span>
            </div>
        `;
        // Add click listener in main.js
        elements.newChatContactList.appendChild(listItem);
    });
}

export function toggleCreateGroupPopup(show) {
     if (show) closeAllPopups(); // Close others before showing
     if (elements.createGroupPopup) {
        elements.createGroupPopup.classList.toggle('visible', show);
        if (show) {
            elements.createGroupNameInput?.focus();
            if (elements.selectedMemberList) {
                elements.selectedMemberList.innerHTML = ''; // Clear selected members list
            }
             if (elements.createGroupContactList) {
                elements.createGroupContactList.innerHTML = ''; // Clear contacts list
            }

            // Populate lists
            const currentUser = stateService.getCurrentUser();
            if (currentUser) {
                addMemberToList(currentUser.username, currentUser.id, true); // Add self to selected list
            }
            const contacts = stateService.getContacts();
            populateCreateGroupContactList(contacts); // Populate contacts list

            // Add event listener for avatar upload button
            const avatarUploadBtn = document.getElementById('group-avatar-upload-button');
            const avatarInput = document.getElementById('group-avatar-input');
            const avatarPreview = document.getElementById('group-avatar-placeholder');
            
            if (avatarUploadBtn && avatarInput && avatarPreview) {
                avatarUploadBtn.onclick = () => avatarInput.click();
                
                // Handle file selection
                avatarInput.onchange = (event) => {
                    const file = event.target.files[0];
                    if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            avatarPreview.src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                };
            }
        } else {
            setCreateGroupStatus(''); // Clear on hide
            if (elements.createGroupNameInput) elements.createGroupNameInput.value = '';
            if (elements.selectedMemberList) elements.selectedMemberList.innerHTML = '';
             if (elements.createGroupContactList) elements.createGroupContactList.innerHTML = '';
             
             // Reset avatar preview
             const avatarPreview = document.getElementById('group-avatar-placeholder');
             if (avatarPreview) {
                 avatarPreview.src = 'assets/images/group-avatar-placeholder.png';
             }
        }
    }
}

export function populateCreateGroupContactList(contacts) {
    if (!elements.createGroupContactList) return;
    elements.createGroupContactList.innerHTML = '';

    if (!contacts || contacts.length === 0) {
        const noContactsMsg = document.createElement('div');
        noContactsMsg.className = 'no-contacts-message';
        noContactsMsg.textContent = 'No contacts available';
        elements.createGroupContactList.appendChild(noContactsMsg);
        return;
    }

    // Get selected member IDs for filtering
    const selectedMemberIds = getMemberIds();

    contacts.forEach(contact => {
        // Skip contacts already in the selected list
        if (selectedMemberIds.includes(contact.id)) return;

        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item-for-group';
        contactItem.dataset.userId = contact.id;

        // Create avatar
        const avatar = document.createElement('img');
        avatar.src = contact.avatar_url || 'assets/images/default-avatar.png';
        avatar.alt = contact.username;
        avatar.className = 'member-avatar';

        // Create name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-name';
        nameSpan.textContent = contact.username;

        // Create add button
        const addButton = document.createElement('button');
        addButton.className = 'add-contact-to-group-button';
        addButton.innerHTML = '<img src="assets/svg/plus.svg" alt="Add">';
        addButton.onclick = () => {
            // Add to member list
            addMemberToList(contact.username, contact.id);
            // Remove from contacts list
            contactItem.remove();
            
            // If contacts list is now empty, show message
            if (elements.createGroupContactList.children.length === 0) {
                const noMoreMsg = document.createElement('div');
                noMoreMsg.className = 'no-contacts-message';
                noMoreMsg.textContent = 'All contacts added';
                elements.createGroupContactList.appendChild(noMoreMsg);
            }
        };

        // Append everything
        contactItem.appendChild(avatar);
        contactItem.appendChild(nameSpan);
        contactItem.appendChild(addButton);

        elements.createGroupContactList.appendChild(contactItem);
    });
}

export function addMemberToList(username, userId, isCurrentUser = false) {
    if (!elements.selectedMemberList) return;
    
    // Check if already in the list
    const existingMember = Array.from(elements.selectedMemberList.children)
        .find(item => item.dataset.userId === userId.toString());
    
    if (existingMember) return; // Already in the list
    
    // Create new member item
    const memberItem = document.createElement('div');
    memberItem.className = 'member-item';
    memberItem.dataset.userId = userId;
    
    // Avatar
    const avatar = document.createElement('img');
    avatar.src = 'assets/images/default-avatar.png'; // Default avatar
    avatar.alt = username;
    avatar.className = 'member-avatar';
    
    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'member-name';
    nameSpan.textContent = username;
    
    // Append avatar and name
    memberItem.appendChild(avatar);
    memberItem.appendChild(nameSpan);
    
    // Add "you" indicator for current user
    if (isCurrentUser) {
        const youIndicator = document.createElement('span');
        youIndicator.textContent = '(You)';
        youIndicator.className = 'self-indicator';
        memberItem.appendChild(youIndicator);
    } else {
        // Add remove button for others
        const removeButton = document.createElement('button');
        removeButton.innerHTML = '&times;';
        removeButton.className = 'remove-member-icon';
        removeButton.onclick = () => {
            // Remove from members list
            memberItem.remove();
            
            // Add back to contacts list if it's not there
            const contactsList = elements.createGroupContactList;
            if (contactsList) {
                // Check if contact is already in the list
                const existingContact = Array.from(contactsList.children)
                    .find(item => item.dataset?.userId === userId.toString());
                    
                if (!existingContact) {
                    // Find the contact data
                    const contact = stateService.getUser(userId);
                    if (contact) {
                        // Re-add to contacts list
                        const contacts = [contact]; // Wrap in array
                        populateCreateGroupContactList([...contacts, ...stateService.getContacts().filter(c => 
                            !getMemberIds().includes(c.id) && c.id !== contact.id)]);
                    }
                }
            }
        };
        memberItem.appendChild(removeButton);
    }
    
    // Add to list
    elements.selectedMemberList.appendChild(memberItem);
}

export function getMemberIds() {
    if (!elements.selectedMemberList) return [];
    
    const memberItems = elements.selectedMemberList.querySelectorAll('.member-item');
    return Array.from(memberItems).map(item => item.dataset.userId);
}

export function setCreateGroupStatus(message, isError = false) {
     if (elements.createGroupStatus) {
         elements.createGroupStatus.textContent = message;
         elements.createGroupStatus.className = 'create-group-status'; // Reset
         if (message) {
            elements.createGroupStatus.classList.add(isError ? 'error' : 'success');
         }
     }
}

export function setCreateGroupLoading(loading) {
    if(elements.createGroupSubmitButton) elements.createGroupSubmitButton.disabled = loading;
}

export function toggleManageMembersPopup(show) {
    if (show) closeAllPopups(); // Close others before showing
    if (elements.manageMembersModal) {
        elements.manageMembersModal.classList.toggle('visible', show);
        if (show) {
            const groupId = stateService.getCurrentChatTarget();
            if (stateService.isGroupChat() && groupId) {
                populateManageMembersModal(groupId); // Populate on show
                elements.addMemberUsernameInput?.focus();
            }
        } else {
            setAddMemberStatus(''); // Clear on hide
            if (elements.addMemberUsernameInput) elements.addMemberUsernameInput.value = '';
            clearMemberSearchResults(); // Clear results when closing
        }
    }
}

export function setAddMemberStatus(message, isError = false) {
     if (elements.addMemberStatus) {
         elements.addMemberStatus.textContent = message;
         elements.addMemberStatus.className = 'add-member-status'; // Reset
         if (message) {
            elements.addMemberStatus.classList.add(isError ? 'error' : 'success');
         }
     }
}
export function setAddMemberLoading(loading) {
     if(elements.addMemberButton) elements.addMemberButton.disabled = loading;
     if(elements.addMemberUsernameInput) elements.addMemberUsernameInput.disabled = loading;
}

export function populateManageMembersModal(groupId, members = []) {
    console.log("Populating manage members modal for group:", groupId);
    
    if (!elements.manageMembersModal ||
        !elements.groupMemberList ||
        !elements.groupAvatar ||
        !elements.groupNameHeader ||
        !elements.groupMembersCount) {
        console.error("Missing required elements for manage members modal");
        return;
    }
    
    // Update the group details
    const group = stateService.getGroup(groupId);
    if (group) {
        elements.groupNameHeader.textContent = group.group_name;
        // If we have a group avatar URL in the future, set it here
        // elements.groupAvatar.src = group.avatar_url || 'assets/images/default-avatar.png';
    }
    
    // Clear existing member list
    elements.groupMemberList.innerHTML = '';
    
    // If no members were passed, try to fetch them (older function fallback)
    if (!members || members.length === 0) {
        apiService.fetchGroupDetails(groupId)
            .then(groupDetails => {
                if (groupDetails && groupDetails.members) {
                    populateMembersList(groupDetails.members);
                    elements.groupMembersCount.textContent = `${groupDetails.members.length} members`;
                }
            })
            .catch(error => {
                console.error("Failed to fetch group details:", error);
                elements.groupMemberList.innerHTML = '<li class="error-message">Failed to load members</li>';
            });
    } else {
        // Use the provided members array
        populateMembersList(members);
        elements.groupMembersCount.textContent = `${members.length} members`;
    }
    
    // Add new member button event handler
    const addNewMemberBtn = document.getElementById('add-new-member-button');
    const addMemberForm = document.getElementById('add-member-form');
    
    if (addNewMemberBtn && addMemberForm) {
        addNewMemberBtn.onclick = () => {
            addMemberForm.style.display = addMemberForm.style.display === 'none' ? 'block' : 'none';
            if (addMemberForm.style.display === 'block') {
                elements.addMemberUsernameInput?.focus();
            }
        };
    }
}

// Helper to populate members list
function populateMembersList(members) {
    if (!elements.groupMemberList) return;
    
    const currentUserId = stateService.getCurrentUserId();
    
    members.forEach(member => {
        const isCurrentUser = member.id === currentUserId;
        
        const listItem = document.createElement('li');
        
        // Create avatar
        const avatar = document.createElement('img');
        avatar.src = member.avatar_url || 'assets/images/default-avatar.png';
        avatar.alt = member.username;
        avatar.classList.add('member-avatar');
        
        // Create name span
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('member-name');
        nameSpan.textContent = member.username;
        
        // Add to list item
        listItem.appendChild(avatar);
        listItem.appendChild(nameSpan);
        
        // Add "You" indicator if it's the current user
        if (isCurrentUser) {
            const youIndicator = document.createElement('span');
            youIndicator.classList.add('self-indicator');
            youIndicator.textContent = 'You';
            listItem.appendChild(youIndicator);
        } else {
            // Add remove button for other members
            const removeButton = document.createElement('button');
            removeButton.classList.add('remove-member-button');
            removeButton.innerHTML = '&times;';
            removeButton.onclick = function() {
                // When clicked, call the API to remove the member
                const groupId = stateService.getCurrentChatTarget();
                if (groupId && confirm(`Remove ${member.username} from the group?`)) {
                    apiService.removeGroupMember(groupId, member.id)
                        .then(() => {
                            // Remove from UI on success
                            listItem.remove();
                            // Update the count
                            const newCount = parseInt(elements.groupMembersCount.textContent) - 1;
                            elements.groupMembersCount.textContent = `${newCount} members`;
                        })
                        .catch(error => {
                            console.error("Failed to remove member:", error);
                            alert("Failed to remove member. You might not have permission.");
                        });
                }
            };
            listItem.appendChild(removeButton);
        }
        
        elements.groupMemberList.appendChild(listItem);
    });
}

// --- Input Handling ---
export function getMessageInput() {
    return elements.messageInput?.value.trim() || '';
}

export function clearMessageInput() {
    if(elements.messageInput) elements.messageInput.value = '';
}

export function getAddContactUsername() {
    return elements.addContactUsernameInput?.value.trim() || '';
}

export function getCreateGroupName() {
     return elements.createGroupNameInput?.value.trim() || '';
}

export function getCreateGroupDesc() {
     return '';
}

export function getAddMemberUsername() {
     return elements.addMemberUsernameInput?.value.trim() || '';
}

// Function to display search results
export function displayMemberSearchResults(results, clickHandler) {
    if (!elements.addMemberSearchResults) return;
    const list = elements.addMemberSearchResults;
    list.innerHTML = ''; // Clear previous results

    if (results.length === 0) {
        list.classList.remove('visible');
        return;
    }

    results.forEach(user => {
        const item = document.createElement('div');
        item.classList.add('search-result-item');
        item.dataset.userId = user.id;
        item.dataset.username = user.username;
        item.innerHTML = `
            <img src="assets/images/default-avatar.png" alt="Avatar" class="avatar">
            <span>${user.username}</span>
        `;
        item.addEventListener('click', () => clickHandler(user.id, user.username));
        list.appendChild(item);
    });

    list.classList.add('visible');
}

// Function to clear search results
export function clearMemberSearchResults() {
    if (elements.addMemberSearchResults) {
        elements.addMemberSearchResults.innerHTML = '';
        elements.addMemberSearchResults.classList.remove('visible');
    }
}

// NEW: Function to update sidebar header with user info
export function populateSidebarHeader(user) {
    if (elements.sidebarProfileAvatar) {
        // TODO: Replace with actual user avatar URL when available
        elements.sidebarProfileAvatar.src = 'assets/images/default-avatar.png'; 
        elements.sidebarProfileAvatar.alt = `${user.username}'s Avatar`;
    }
    if (elements.sidebarProfileUsername) {
        elements.sidebarProfileUsername.textContent = user.username;
    }
}

// NEW: Function to toggle the profile modal
export function toggleProfileModal(show) {
    if (show) closeAllPopups(); // Close others before showing
    if (elements.profileModal) {
        elements.profileModal.classList.toggle('visible', show);
        // Add focus logic or data loading here if needed when modal opens
    }
}

// NEW: Function to display contact search results
export function displayContactSearchResults(results, clickHandler) {
    if (!elements.addContactSearchResults) return;
    const list = elements.addContactSearchResults;
    list.innerHTML = ''; // Clear previous results

    if (results.length === 0) {
        list.classList.remove('visible');
        return;
    }

    results.forEach(user => {
        const item = document.createElement('div');
        item.classList.add('search-result-item'); // Reuse class
        item.dataset.userId = user.id;
        item.dataset.username = user.username;
        item.innerHTML = `
            <img src="assets/images/default-avatar.png" alt="Avatar" class="avatar">
            <span>${user.username}</span>
        `;
        item.addEventListener('click', () => clickHandler(user.id, user.username));
        list.appendChild(item);
    });

    list.classList.add('visible');
}

// NEW: Function to clear contact search results
export function clearContactSearchResults() {
    if (elements.addContactSearchResults) {
        elements.addContactSearchResults.innerHTML = '';
        elements.addContactSearchResults.classList.remove('visible');
    }
}

// Updated: Toggle and populate chat actions dropdown
export function toggleChatActionsDropdown(show, isGroup) {
    // Close *other* popups when opening dropdown, but not the dropdown itself yet
    if (show) {
        console.log("Closing other popups for dropdown..."); // Debug log
        if (elements.addContactPopup?.classList.contains('visible')) toggleAddContactPopup(false);
        if (elements.createGroupPopup?.classList.contains('visible')) toggleCreateGroupPopup(false);
        if (elements.manageMembersModal?.classList.contains('visible')) toggleManageMembersPopup(false);
        if (elements.profileModal?.classList.contains('visible')) toggleProfileModal(false);
        if (elements.combinedModal?.classList.contains('visible')) toggleCombinedModal(false);
    }

    if (!elements.chatActionsDropdown || !elements.chatHeaderMoreOptionsButton) return;
    
    const dropdown = elements.chatActionsDropdown;
    const button = elements.chatHeaderMoreOptionsButton;

    // If we are explicitly told to hide, or if it's currently visible and we are toggling
    if (!show) {
        dropdown.classList.remove('visible');
        return;
    }

    // --- Logic to Show --- 
    // Show the 3-dots button only if a chat is selected
    button.style.display = stateService.getCurrentChatTarget() ? 'inline-block' : 'none';
    if (!stateService.getCurrentChatTarget()) {
        dropdown.classList.remove('visible');
        return; // Don't show dropdown if no chat selected
    }

    // Determine if current user is admin (needs state access or fetched details)
    // Placeholder for admin check - needs proper implementation!
    const isAdmin = true; // Assume admin for now

    const list = dropdown.querySelector('ul');
    if (!list) return;
    list.innerHTML = ''; // Clear previous items

    if (isGroup) {
        // Group Actions (Example - TODO: Add admin checks later)
        list.innerHTML = `
            <li><button data-action="edit-details">Edit Group Details</button></li>
            <li><button data-action="manage-members">Manage Members</button></li>
            <li><button data-action="leave-group">Leave Group</button></li>
            <li class="separator"><hr></li>
            <li><button data-action="delete-group" class="danger" ${!isAdmin ? 'disabled' : ''}>Delete Group</button></li>
        `;
    } else {
        // Direct Message Actions (Example)
        list.innerHTML = `
            <li><button data-action="view-profile">View Profile</button></li>
            <li><button data-action="clear-history">Clear History</button></li>
            <li class="separator"><hr></li>
            <li><button data-action="block-user" class="danger">Block User</button></li>
             <li><button data-action="delete-chat" class="danger">Delete Chat</button></li>
        `;
    }
    
    dropdown.classList.add('visible');
}

// Hide 3-dots button initially or when no chat is selected
export function hideChatActionsButton() {
     if (elements.chatHeaderMoreOptionsButton) {
         elements.chatHeaderMoreOptionsButton.style.display = 'none';
     }
      if (elements.chatActionsDropdown) {
         elements.chatActionsDropdown.classList.remove('visible');
     }
}

// --- Attachment Preview UI Functions ---

export function showAttachmentLoading() {
    if (elements.attachmentPreview) elements.attachmentPreview.style.display = 'flex';
    if (elements.attachmentLoading) elements.attachmentLoading.style.display = 'inline';
    if (elements.attachmentContent) elements.attachmentContent.style.display = 'none';
    // Hide image preview during loading
    if (elements.attachmentPreviewImage) elements.attachmentPreviewImage.style.display = 'none'; 
}

// MODIFIED: Accept fileInfo object and optional objectUrl for preview
export function showAttachmentPreview(fileInfo, objectUrl = null) {
    if (!elements.attachmentPreview || !elements.attachmentContent || !elements.attachmentFilename || !elements.attachmentIcon || !elements.attachmentClearButton || !elements.attachmentPreviewImage) return;

    elements.attachmentLoading.style.display = 'none';
    // elements.attachmentFilename.textContent = fileInfo.filename;
    // elements.attachmentFilename.title = fileInfo.filename; // Show full name on hover

    let iconSrc = 'assets/svg/file-text.svg'; // Default icon
    const isImage = fileInfo.mediaType?.startsWith('image/');

    // --- NEW: Handle Image Preview --- 
    if (isImage && objectUrl) {
        elements.attachmentIcon.style.display = 'none'; // Hide generic icon
        elements.attachmentPreviewImage.src = objectUrl;
        elements.attachmentPreviewImage.style.display = 'block'; // Show image preview
    } else {
        // Use icons for non-images or if objectUrl is not available
        elements.attachmentPreviewImage.style.display = 'none'; // Hide image element
        elements.attachmentIcon.style.display = 'inline-block'; // Show generic icon

        // Set icon based on media type
        if (fileInfo.mediaType?.startsWith('video/')) iconSrc = 'assets/svg/file-video.svg';
        else if (fileInfo.mediaType?.startsWith('audio/')) iconSrc = 'assets/svg/file-audio.svg';
        else if (fileInfo.mediaType === 'application/pdf') iconSrc = 'assets/svg/file-pdf.svg';
        // Add more specific icons if needed
        elements.attachmentIcon.src = iconSrc;
    }
    // --- END Image Preview Handling ---

    elements.attachmentContent.style.display = 'flex'; // Show the content block (icon/filename/clear button)
    elements.attachmentPreview.style.display = 'flex'; // Show the whole preview area

    // The clear button listener should be attached in main.js
}

export function clearAttachmentPreview() {
    if (elements.attachmentPreview) elements.attachmentPreview.style.display = 'none';
    if (elements.attachmentLoading) elements.attachmentLoading.style.display = 'none';
    if (elements.attachmentContent) elements.attachmentContent.style.display = 'none';
    if (elements.attachmentFilename) elements.attachmentFilename.textContent = '';
    // NEW: Clear image preview src and hide it
    if (elements.attachmentPreviewImage) {
        elements.attachmentPreviewImage.src = '';
        elements.attachmentPreviewImage.style.display = 'none';
    }
     // Ensure generic icon is visible when cleared (ready for next attachment)
    if (elements.attachmentIcon) {
        elements.attachmentIcon.src = 'assets/svg/file-text.svg'; // Reset to default
        elements.attachmentIcon.style.display = 'inline-block';
    }
}

// --- End Attachment Preview UI Functions ---

// --- NEW: Edit Group Modal Functions ---
export function toggleEditGroupModal(show) {
    if (show) closeAllPopups(); // Close others before showing
    if (elements.editGroupModal) {
        elements.editGroupModal.classList.toggle('visible', show);
        elements.editGroupModal.style.display = show ? 'block' : 'none'; // Toggle display too
        if (show) {
            const groupId = stateService.getCurrentChatTarget();
            if (stateService.isGroupChat() && groupId) {
                populateEditGroupModal(groupId); // Populate on show
                elements.editGroupNameInput?.focus();
            }
        } else {
            setEditGroupStatus(''); // Clear status on hide
            // Clear inputs and reset preview
            if(elements.editGroupNameInput) elements.editGroupNameInput.value = '';
            if(elements.editGroupDescriptionInput) elements.editGroupDescriptionInput.value = '';
            if(elements.editGroupAvatarPreview) elements.editGroupAvatarPreview.src = 'assets/images/group-avatar-placeholder.png';
            if(elements.editGroupAvatarInput) elements.editGroupAvatarInput.value = ''; // Reset file input
        }
    }
}

export function populateEditGroupModal(groupId) {
    const group = stateService.getGroup(groupId);
    if (!group || !elements.editGroupNameInput || !elements.editGroupDescriptionInput || !elements.editGroupAvatarPreview) return;

    elements.editGroupNameInput.value = group.group_name || '';
    elements.editGroupDescriptionInput.value = group.description || '';
    elements.editGroupAvatarPreview.src = group.avatar_url || 'assets/images/group-avatar-placeholder.png';
    
    // Clear any previous status message
    setEditGroupStatus('');
}

export function getEditGroupDetails() {
    return {
        name: elements.editGroupNameInput?.value.trim(),
        description: elements.editGroupDescriptionInput?.value.trim(),
    };
}

export function getEditGroupAvatarFile() {
    return elements.editGroupAvatarInput?.files[0] || null;
}

export function setEditGroupStatus(message, isError = false) {
    if (elements.editGroupStatus) {
        elements.editGroupStatus.textContent = message;
        elements.editGroupStatus.className = 'create-group-status'; // Reset base class
        if (message) {
            elements.editGroupStatus.classList.add(isError ? 'error' : 'success');
        }
    }
}

export function setEditGroupLoading(loading) {
    if (elements.saveGroupChangesButton) elements.saveGroupChangesButton.disabled = loading;
    if (elements.editGroupNameInput) elements.editGroupNameInput.disabled = loading;
    if (elements.editGroupDescriptionInput) elements.editGroupDescriptionInput.disabled = loading;
    if (elements.editGroupAvatarUploadButton) elements.editGroupAvatarUploadButton.disabled = loading;
}

// --- End Edit Group Modal Functions ---