import * as authService from './authService.js';
import * as apiService from './apiService.js';
import * as websocketService from './webSocketService.js';
import * as uiService from './uiService.js';
import * as stateService from './stateService.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Chat App Initializing...");

    if (!authService.hasToken()) {
        authService.redirectToLogin();
        return;
    }

    // --- Initialize UI Elements ---
    const elements = uiService.initElements();
    const fileInput = document.getElementById('file-input');
    let attachedFileObject = null;
    let previewObjectUrl = null;
    uiService.disableChatArea(true); // Start with chat disabled
    uiService.hideChatActionsButton(); // Hide 3-dots initially

    // --- Setup WebSocket Handlers ---
    websocketService.setOnOpen(() => {
        uiService.appendSystemMessage('Connected to chat.');
        // Fetch initial data only after successful connection? Or do it regardless?
        // Let's do it after connection to ensure user is validated by WS potentially
        loadInitialData();
    });

    websocketService.setOnClose((event) => {
        uiService.appendSystemMessage('Disconnected from chat. Attempting to reconnect...');
        // authService handles redirect on certain close codes via websocketService logic
        if (event.code === 1000 || event.code === 1008) { // Clean close or bad token
            authService.logout(); // Force logout/redirect
        }
    });

    websocketService.setOnError((errorMsg) => {
        uiService.appendSystemMessage(`Connection error: ${errorMsg || 'Unknown'}`);
    });

    // --- Register WebSocket Action Handlers ---
    websocketService.registerActionHandler('message', (payload) => {
        const msg = payload;
        const senderIsCurrentUser = stateService.getCurrentUserId() === msg.sender_id;
        const recipientIsCurrentUser = stateService.getCurrentUserId() === msg.recipient_id;

        // Store sender info if not known (might happen with auto-add contact)
        if(msg.sender && !stateService.getUser(msg.sender.id)){
             stateService.addContactToState(msg.sender);
             // Update combined list - potentially need to add item if not present
             // For now, assume initial load handled it
             uiService.populateChatList(stateService.getCombinedSortedChatList()); 
        }
        const senderName = senderIsCurrentUser ? 'Me' : (msg.sender?.username || stateService.getUsername(msg.sender_id) || `User ${msg.sender_id}`);

        // --- DEBUG LOG: Check condition for sending mark_read --- 
        console.log(`MSG HANDLER (recipient ${msg.recipient_id} from ${msg.sender_id}): 
          recipientIsCurrentUser=${recipientIsCurrentUser}, 
          isGroupChat=${stateService.isGroupChat()}, 
          currentChatTarget=${stateService.getCurrentChatTarget()}, 
          msg.sender_id=${msg.sender_id}. 
          Condition MET? ${recipientIsCurrentUser && !stateService.isGroupChat() && stateService.getCurrentChatTarget() === msg.sender_id}`);
        // --- END DEBUG LOG ---

        // If it's a message for the currently active DM chat
        if (recipientIsCurrentUser && !stateService.isGroupChat() && stateService.getCurrentChatTarget() === msg.sender_id) {
            uiService.appendMessage(senderName, msg.content, senderIsCurrentUser, msg.timestamp, msg.read_at, msg.id, msg.recipient_id, false, null, msg.media_url, msg.media_type, msg.media_filename, msg.media_size);
            // Mark as read immediately since the chat is open
            websocketService.send('mark_read', { sender_id: msg.sender_id });
            // Update item state (timestamp, preview) & re-render list
            stateService.updateChatItemOnMessage(msg.sender_id, false, msg); 
            uiService.populateChatList(stateService.getCombinedSortedChatList());
        }
        // If it's my own message echoed back for the current DM chat
        else if (senderIsCurrentUser && !stateService.isGroupChat() && stateService.getCurrentChatTarget() === msg.recipient_id) {
            uiService.appendMessage(senderName, msg.content, true, msg.timestamp, msg.read_at, msg.id, msg.recipient_id, false, null, msg.media_url, msg.media_type, msg.media_filename, msg.media_size);
            // Update the read status based on the echoed message (initial state is likely unread)
             uiService.updateReadStatusIcons(msg.recipient_id); // Check if needed here
        }
        // If it's a DM for the current user, but not the active chat
        else if (recipientIsCurrentUser) {
            console.log('Received DM for inactive chat from:', msg.sender_id);
            // Update item state (timestamp, preview, unread) & re-render list
            stateService.updateChatItemOnMessage(msg.sender_id, false, msg); 
            uiService.populateChatList(stateService.getCombinedSortedChatList());
            // uiService.updateUnreadBadge(msg.sender_id, false, stateService.getUserUnreadCount(msg.sender_id)); // Handled by populateChatList
             // TODO: Update preview in sidebar? (Handled by populateChatList)
        }
         // Ignore messages not involving the current user
    });

    websocketService.registerActionHandler('group_message', (payload) => {
        const msg = payload;
        const senderIsCurrentUser = stateService.getCurrentUserId() === msg.sender_id;

         // Store sender info if not known
        if(msg.sender && !stateService.getUser(msg.sender.id)){
             stateService.addContactToState(msg.sender); // Add to general user cache
        }
        const senderName = senderIsCurrentUser ? 'Me' : (msg.sender?.username || stateService.getUsername(msg.sender_id) || `User ${msg.sender_id}`);


        if (stateService.isGroupChat() && stateService.getCurrentChatTarget() === msg.group_id) {
            // Message for the active group chat
             uiService.appendMessage(senderName, msg.content, senderIsCurrentUser, msg.timestamp, null, msg.id, null, true, msg.group_id, msg.media_url, msg.media_type, msg.media_filename, msg.media_size);
             // TODO: Implement group read receipts?
             // Update item state (timestamp, preview) & re-render list
             stateService.updateChatItemOnMessage(msg.group_id, true, msg);
             uiService.populateChatList(stateService.getCombinedSortedChatList());
        } else {
             // Message for an inactive group chat
            console.log('Received message for inactive group:', msg.group_id);
            // Update item state (timestamp, preview, unread) & re-render list
            stateService.updateChatItemOnMessage(msg.group_id, true, msg);
            uiService.populateChatList(stateService.getCombinedSortedChatList());
            // stateService.incrementGroupUnreadCount(msg.group_id); // Handled in updateChatItemOnMessage
            // uiService.updateUnreadBadge(msg.group_id, true, stateService.getGroupUnreadCount(msg.group_id)); // Handled by populateChatList
             // TODO: Update group preview in sidebar? (Handled by populateChatList)
        }

         // Hide typing indicator for the sender if they were typing in this group
         stateService.clearTypingUserFromGroupOnMessage(msg.group_id, msg.sender_id);
         if (msg.group_id === stateService.getCurrentChatTarget()) {
              uiService.updateGroupTypingIndicator();
         }
    });

    websocketService.registerActionHandler('status_update', (payload) => {
         console.log(`Handler: Status update for user ${payload.user_id}: online=${payload.status_value}`);
         stateService.updateUserState(payload.user_id, payload.status_value, payload.last_seen);
         uiService.updateUserStatusInUI(payload.user_id); // Update list and potentially header
         // Re-render chat list to show updated status/last seen
         uiService.populateChatList(stateService.getCombinedSortedChatList());
    });

    websocketService.registerActionHandler('typing_update', (payload) => {
        // Handle direct message typing indicator
        if (!stateService.isGroupChat() && stateService.getCurrentChatTarget() === payload.user_id) {
            if (payload.is_typing) {
                uiService.showTypingIndicator(payload.username);
            } else {
                uiService.hideTypingIndicator();
            }
        }
    });

    websocketService.registerActionHandler('group_typing_update', (payload) => {
        // Handle group typing indicator
        const { group_id, user_id, username, is_typing } = payload;
        if (is_typing) {
             stateService.updateGroupTypingUser(group_id, user_id, username);
        } else {
             stateService.removeGroupTypingUser(group_id, user_id);
        }
        // Update UI only if this is the currently active group chat
        if (stateService.isGroupChat() && stateService.getCurrentChatTarget() === group_id) {
             uiService.updateGroupTypingIndicator();
        }
    });

    websocketService.registerActionHandler('messages_read', (payload) => {
        console.log('Handler: Received messages_read for reader:', payload.reader_id);
        // Update icons for messages sent *by me* to the reader
         if (stateService.getCurrentUserId() === payload.sender_id) { // Check if I sent the original messages
            uiService.updateReadStatusIcons(payload.reader_id);
         }
    });

    // --- Connect WebSocket ---
    websocketService.connect(); // Will trigger onOpen -> loadInitialData on success


    // --- Function to Load Initial Data ---
    async function loadInitialData() {
        console.log("Loading initial data...");
        try {
            const user = await apiService.fetchCurrentUser();
            if (!user) throw new Error("Failed to fetch current user.");
            stateService.setCurrentUser(user);
            console.log('Current user:', stateService.getCurrentUser());
            
            // NEW: Populate sidebar header with user info
            uiService.populateSidebarHeader(user);

            // Fetch contacts and groups in parallel
            const [contacts, groups] = await Promise.all([
                apiService.fetchContacts(),
                apiService.fetchGroups()
            ]);

            // Set individual caches (still useful for lookups)
            stateService.setContacts(contacts || []);
            stateService.setGroups(groups || []);
            console.log('Contacts loaded:', stateService.getContacts().length);
            console.log('Groups loaded:', stateService.getGroups().length);

            // Initialize the unified list state
            stateService.initializeCombinedList(contacts, groups);
            // Populate the unified UI list
            uiService.populateChatList(stateService.getCombinedSortedChatList());

            // Initial setup complete, can enable chat area elements if needed
            // uiService.disableChatArea(false); // Enable after data loaded, but maybe wait for selection

        } catch (error) {
            console.error('Failed to load initial data:', error);
            uiService.appendSystemMessage(`Error loading data: ${error.detail || error.message}`);
            // Maybe force logout if user fetch fails critically
            if (error.message.includes("current user")) {
                 websocketService.disconnect();
                 authService.logout();
            }
        }
    }

    // --- Helper Function to Reload Chat History --- 
    async function reloadCurrentChat() {
        const targetId = stateService.getCurrentChatTarget();
        const isGroup = stateService.isGroupChat();

        if (!targetId) return; // No chat selected

        console.log(`Reloading chat for ${isGroup ? 'group' : 'user'} ${targetId}`);
        uiService.clearChatMessages();
        uiService.appendSystemMessage('Refreshing history...');

        try {
            let history = [];
            if (isGroup) {
                const groupDetails = await apiService.fetchGroupDetails(targetId);
                history = groupDetails?.messages || [];
                history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort oldest first
            } else {
                history = await apiService.fetchConversationHistory(targetId);
                // DM history is already sorted by backend
            }

            uiService.clearChatMessages(); // Clear 'Refreshing...'
            if (!history || history.length === 0) {
                uiService.appendSystemMessage('No messages yet.');
            } else {
                history.forEach(msg => {
                    const senderIsCurrentUser = stateService.getCurrentUserId() === msg.sender_id;
                    const senderName = senderIsCurrentUser ? 'Me' : (stateService.getUsername(msg.sender_id) || `User ${msg.sender_id}`);
                    // Use the correct isMe flag during reload
                    uiService.appendMessage(
                        senderName, 
                        msg.content, 
                        senderIsCurrentUser, // Use calculated value
                        msg.timestamp, 
                        msg.read_at, // Pass read_at for DMs
                        msg.id, 
                        msg.recipient_id, // Pass recipient_id for DMs
                        isGroup, 
                        isGroup ? msg.group_id : null, // Pass group_id for groups
                        msg.media_url, 
                        msg.media_type, 
                        msg.media_filename, 
                        msg.media_size
                    );
                });
            }
            uiService.scrollToBottom();

            // If it was a DM, re-send mark_read after reloading
            if (!isGroup) {
                 websocketService.send('mark_read', { sender_id: targetId });
            }

        } catch (error) {
            console.error('Error during chat reload:', error);
            uiService.clearChatMessages();
            uiService.appendSystemMessage(`Failed to reload chat: ${error.detail || 'Network error'}`);
        }
    }

    // --- Event Listeners Setup ---
    const emojiButton = document.getElementById('emoji-button');
    const emojiPicker = document.getElementById('emoji-picker');

    // Send Message
    elements.sendButton?.addEventListener('click', handleSendMessage);
    elements.messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow newline with Shift+Enter
             e.preventDefault(); // Prevent default newline on Enter
             handleSendMessage();
             // Stop typing indicator immediately after sending
             stateService.clearTypingTimeout();
             sendTypingStatus(false);
        }
    });

    // Typing Indicator
    elements.messageInput?.addEventListener('input', () => {
         sendTypingStatus(true); // Indicate typing started/continued

         stateService.clearTypingTimeout(); // Clear existing timeout
         const timeoutId = setTimeout(() => {
             sendTypingStatus(false); // Indicate stopped typing after delay
         }, 1500); // 1.5 seconds debounce
         stateService.setTypingTimeout(timeoutId);
    });

    // Logout
    elements.logoutButton?.addEventListener('click', () => {
        console.log('Logging out...');
        websocketService.disconnect(); // Clean disconnect
        authService.logout();
    });

    // Select Chat (Event Delegation on Lists)
    // REMOVE old listeners
    /*
    elements.userListElement?.addEventListener('click', (e) => {
        const listItem = e.target.closest('.contact-item');
        if (listItem && listItem.dataset.userId) {
            selectChat(parseInt(listItem.dataset.userId, 10), false);
        }
    });
    elements.groupListElement?.addEventListener('click', (e) => {
        const listItem = e.target.closest('.group-item');
        if (listItem && listItem.dataset.groupId) {
            selectChat(parseInt(listItem.dataset.groupId, 10), true);
        }
    });
    */
   
    // ADD new listener for the combined list
    elements.chatListElement?.addEventListener('click', (e) => {
        const listItem = e.target.closest('.chat-list-item');
        if (!listItem) return;

        const isGroup = listItem.dataset.type === 'group';
        const targetId = isGroup ? listItem.dataset.groupId : listItem.dataset.userId;

        if (targetId) {
            selectChat(parseInt(targetId, 10), isGroup);
        }
    });

     // Select Chat from New Chat Modal
    elements.newChatContactList?.addEventListener('click', (e) => {
        const listItem = e.target.closest('.contact-item');
        if (listItem && listItem.dataset.userId) {
            selectChat(parseInt(listItem.dataset.userId, 10), false);
            uiService.toggleCombinedModal(false); // Close modal
        }
    });

    // --- Popup/Modal Toggles & Actions ---

    // NEW: Profile Header Click -> Open Profile Modal
    elements.sidebarProfileHeader?.addEventListener('click', () => uiService.toggleProfileModal(true));
    elements.closeProfileModal?.addEventListener('click', () => uiService.toggleProfileModal(false));

    // Combined Modal
    elements.usersButton?.addEventListener('click', () => uiService.toggleCombinedModal(true));
    elements.closeCombinedModal?.addEventListener('click', () => uiService.toggleCombinedModal(false));
    
    // Within Combined Modal:
    // - Add Contact button
    elements.modalAddContact?.addEventListener('click', () => {
        uiService.toggleCombinedModal(false); // Close the combined modal
        uiService.toggleAddContactPopup(true); // Open the add contact popup
    });
    
    // - Create Group button
    elements.modalCreateGroup?.addEventListener('click', () => {
        uiService.toggleCombinedModal(false); // Close the combined modal
        uiService.toggleCreateGroupPopup(true); // Open the create group popup
    });
    
    // - Contact List (for starting chats)
    elements.newChatContactList?.addEventListener('click', (e) => {
        const listItem = e.target.closest('.contact-item');
        if (listItem && listItem.dataset.userId) {
            selectChat(parseInt(listItem.dataset.userId, 10), false);
            uiService.toggleCombinedModal(false); // Close modal
        }
    });

    // Add Contact Popup (now opened via combined modal)
    elements.closeAddContactPopup?.addEventListener('click', () => uiService.toggleAddContactPopup(false));
    // Remove old button listener
    // elements.addContactButton?.addEventListener('click', handleAddContact);
    // Add input listener for live search
    elements.addContactUsernameInput?.addEventListener('input', debounce(handleContactSearch, 300));

    // Create Group (now opened via combined modal)
    elements.closeCreateGroupPopup?.addEventListener('click', () => uiService.toggleCreateGroupPopup(false));
    elements.createGroupSubmitButton?.addEventListener('click', handleCreateGroup);

    // Add event listener for adding contacts within the create group popup
    elements.createGroupContactList?.addEventListener('click', (e) => {
        const addButton = e.target.closest('.add-contact-to-group-button');
        if (addButton && !addButton.disabled) {
            const contactItem = addButton.closest('.contact-item-for-group');
            if (contactItem && contactItem.dataset.userId && contactItem.dataset.username) {
                const userId = parseInt(contactItem.dataset.userId, 10);
                const username = contactItem.dataset.username;
                uiService.addMemberToList(username, userId);
                addButton.disabled = true; // Disable button after adding
            }
        }
    });

    // Manage Group Members
    elements.manageGroupMembersButton?.addEventListener('click', () => uiService.toggleManageMembersPopup(true));
    elements.closeManageMembersModal?.addEventListener('click', () => uiService.toggleManageMembersPopup(false));
    
    // Live search for adding members
    elements.addMemberUsernameInput?.addEventListener('input', debounce(handleMemberSearch, 300)); // 300ms debounce
    
    // Remove member (using event delegation on the list)
    elements.groupMemberList?.addEventListener('click', (e) => {
        const removeButton = e.target.closest('.remove-member-button');
        if (removeButton && removeButton.dataset.userIdToRemove) {
             const userIdToRemove = parseInt(removeButton.dataset.userIdToRemove, 10);
             const groupId = stateService.getCurrentChatTarget();
             if (stateService.isGroupChat() && groupId && userIdToRemove) {
                 handleRemoveMemberFromGroup(groupId, userIdToRemove, removeButton);
             }
        }
    });

    // Chat Header More Options Button
    elements.chatHeaderMoreOptionsButton?.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent triggering click-outside-to-close immediately
        const isVisible = elements.chatActionsDropdown?.classList.contains('visible');
        const isGroup = stateService.isGroupChat(); // Check if current chat is a group
        uiService.toggleChatActionsDropdown(!isVisible, isGroup); // Pass isGroup flag
    });

    // Optional: Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!elements.chatActionsDropdown?.contains(event.target) && 
            !elements.chatHeaderMoreOptionsButton?.contains(event.target)) 
        {
            uiService.toggleChatActionsDropdown(false); // Just hide, don't need isGroup flag here
        }
    });

    // Listener for clicks *inside* the dropdown
    elements.chatActionsDropdown?.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (button) {
            const action = button.dataset.action;
            console.log(`Dropdown action clicked: ${action}`);
            uiService.toggleChatActionsDropdown(false); // Close dropdown after action
            
            switch (action) {
                case 'manage-members':
                    uiService.toggleManageMembersPopup(true); // Open the manage members modal
                    break;
                case 'edit-details':
                    // TODO: handleEditChatDetails();
                    uiService.toggleEditGroupModal(true); // Open the edit group modal
                    break;
                case 'leave-group':
                    // TODO: handleLeaveGroup();
                    handleLeaveGroup();
                    break;
                case 'delete-group':
                    // TODO: handleDeleteGroup();
                    handleDeleteGroup();
                    break;
                // Add cases for DM actions later
                case 'view-profile':
                case 'clear-history':
                case 'block-user':
                case 'delete-chat':
                   handleDeleteDirectChat(); // Call the new handler
                    break;
            }
        }
    });

    // NEW: Edit Group Modal Listeners
    elements.closeEditGroupModal?.addEventListener('click', () => uiService.toggleEditGroupModal(false));
    elements.saveGroupChangesButton?.addEventListener('click', handleEditGroupDetails);
    elements.editGroupAvatarUploadButton?.addEventListener('click', () => elements.editGroupAvatarInput?.click());
    elements.editGroupAvatarInput?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/') && elements.editGroupAvatarPreview) {
            const reader = new FileReader();
            reader.onload = (e) => {
                elements.editGroupAvatarPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
            // Note: We don't upload immediately, only on Save Changes
        }
    });

    // NEW: Attach File Button Listener
    elements.attachButton?.addEventListener('click', () => {
        // --- DEBUG LOG --- 
        console.log("Attach button clicked!");
        // ------------------
        fileInput?.click(); // Trigger hidden file input
    });

    // NEW: File Input Change Listener
    fileInput?.addEventListener('change', handleFileSelect);

    // NEW: Clear Attachment Preview Button Listener
    elements.attachmentClearButton?.addEventListener('click', clearAttachedFile);

    // Emoji Picker Toggle
    emojiButton?.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent closing immediately if click outside listener exists
        const isVisible = emojiPicker.style.display !== 'none';
        emojiPicker.style.display = isVisible ? 'none' : 'block';
        // Close other popups when opening emoji picker
        if (!isVisible) {
            uiService.toggleChatActionsDropdown(false); // Close action dropdown explicitly
        }
    });

    // Insert Emoji into Input
    emojiPicker?.addEventListener('emoji-click', event => {
        const emoji = event.detail.unicode;
        const input = elements.messageInput;
        if (!input) return;

        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;

        input.value = text.substring(0, start) + emoji + text.substring(end);
        
        // Move cursor position after inserted emoji
        const newCursorPos = start + emoji.length;
        input.selectionStart = input.selectionEnd = newCursorPos;
        input.focus(); // Keep focus on input

        // Optionally hide picker after selection
        // emojiPicker.style.display = 'none';
    });

    // Close picker when clicking outside
    document.addEventListener('click', (event) => {
        if (emojiPicker && emojiButton &&
            emojiPicker.style.display !== 'none' &&
            !emojiPicker.contains(event.target) &&
            !emojiButton.contains(event.target)) {
            emojiPicker.style.display = 'none';
        }
    });

    // --- Handler Functions ---

    async function handleSendMessage() {
        const messageText = uiService.getMessageInput();
        // Send message ONLY if there's text OR an attached file object
        if (messageText === '' && !attachedFileObject) return;

        const targetId = stateService.getCurrentChatTarget();
        const isGroup = stateService.isGroupChat();

        if (!targetId) {
            console.warn('Send attempt with no active chat target.');
            return;
        }

        let action;
        let basePayload;
        let mediaInfo = null; // To store upload result

        if (isGroup) {
            action = 'group_message';
            basePayload = { group_id: targetId, content: messageText };
        } else {
            action = 'message';
            basePayload = { recipient_id: targetId, content: messageText };
        }

        // --- NEW: Upload file if attached ---
        if (attachedFileObject) {
            uiService.showAttachmentLoading(); // Show loading indicator
            try {
                mediaInfo = await apiService.uploadMediaFile(attachedFileObject);
                // Add media info to the payload *after* successful upload
                basePayload.media_url = mediaInfo.url;
                basePayload.media_type = mediaInfo.media_type;
                basePayload.media_filename = mediaInfo.filename;
                basePayload.media_size = mediaInfo.size;
            } catch (error) {
                console.error('Error uploading file during send:', error);
                uiService.appendSystemMessage(`Upload failed: ${error.detail || 'Server error'}`);
                clearAttachedFile(); // Clear preview/file object on upload error
                return; // Stop sending if upload fails
            } finally {
                 // Hide loading indicator regardless of success/failure
                 // uiService.clearAttachmentPreview(); // Let clearAttachedFile handle this below
            }
        }
        // --- END: Upload file ---


        if (websocketService.send(action, basePayload)) {
            // --- MODIFICATION: Reload chat instead of just clearing input --- 
            uiService.clearMessageInput(); // Clear input immediately
            clearAttachedFile(); // Clear attachment immediately
            uiService.hideTypingIndicator();
            // Stop typing indicator immediately after sending
            stateService.clearTypingTimeout();
            sendTypingStatus(false);

            // Reload the chat view after a very short delay to allow WS message to potentially arrive
            // This might still cause race conditions
            setTimeout(reloadCurrentChat, 100); 
            // --- END MODIFICATION ---
        } else {
            uiService.appendSystemMessage("Failed to send message. Not connected.");
            // If sending failed but upload succeeded, the file is uploaded but message not sent.
            // Consider how to handle this state (e.g., retry sending, notify user).
            // For now, the preview will be cleared.
            if(mediaInfo) {
                 console.warn("Upload succeeded but WebSocket send failed.");
                 clearAttachedFile(); 
            }
        }
    }

    function sendTypingStatus(isTyping) {
        const targetId = stateService.getCurrentChatTarget();
        if (!targetId) return; // Don't send if no chat selected

        const isGroup = stateService.isGroupChat();
        const action = isTyping
            ? (isGroup ? 'group_typing' : 'typing')
            : (isGroup ? 'group_stopped_typing' : 'stopped_typing');
        const payload = isGroup ? { group_id: targetId } : {};

        // Only send "stopped" if a timeout was actually running (or if forced)
        if (!isTyping && !stateService.getTypingTimeout()) return;

        websocketService.send(action, payload);

        if(!isTyping) {
            stateService.clearTypingTimeout(); // Ensure timeout cleared when explicitly stopping
        }
    }

    async function selectChat(targetId, isGroup) {
         // --- MODIFICATION: Use reloadCurrentChat for loading history --- 
        const currentTargetId = stateService.getCurrentChatTarget();
        const currentIsGroup = stateService.isGroupChat();

        if (targetId === currentTargetId && isGroup === currentIsGroup) return; // No change

        console.log(`Selecting ${isGroup ? 'group' : 'user'} ${targetId}`);
        stateService.setCurrentChatTarget(targetId, isGroup);

        uiService.disableChatArea(false); // Enable chat area
        uiService.updateActiveListItem(targetId, isGroup); // Highlight in sidebar
        uiService.hideTypingIndicator(); // Hide indicator from previous chat
        uiService.updateChatHeaderStatus(); // Update header immediately based on state

        // Reset unread count locally FIRST & update state
        stateService.resetChatItemUnreadCount(targetId, isGroup); 
        // uiService.updateUnreadBadge(targetId, isGroup, 0); // Now handled by populateChatList

        // Reload the chat content
        await reloadCurrentChat(); // Use the new reload function
        
        // Re-render the list to show the cleared badge and potentially updated active item
        uiService.populateChatList(stateService.getCombinedSortedChatList()); 
         // --- END MODIFICATION --- 
    }

    // NEW: Handler for live contact search
    async function handleContactSearch() {
        const query = uiService.getAddContactUsername();

        if (query.length < 2) { // Or 1?
            uiService.clearContactSearchResults();
            return;
        }

        uiService.setAddContactStatus('Searching...');
        uiService.setAddContactLoading(true); // Visually indicate loading

        try {
            const searchResults = await apiService.searchUsers(query);
            // TODO: Filter out users already in contacts?
            uiService.displayContactSearchResults(searchResults, handleContactResultClick);
            if (searchResults.length === 0) {
                 uiService.setAddContactStatus('No users found matching that name.');
            } else {
                 uiService.setAddContactStatus(''); // Clear status
            }

        } catch (error) {
            console.error('Error searching contacts:', error);
            uiService.setAddContactStatus(`Error: ${error.detail || 'Search failed'}`, true);
            uiService.clearContactSearchResults();
        } finally {
            uiService.setAddContactLoading(false);
        }
    }

    // Renamed/Modified: Handler for clicking a contact search result
    async function handleContactResultClick(userId, username) {
        uiService.setAddContactStatus(`Adding ${username}...`);
        uiService.setAddContactLoading(true);
        uiService.clearContactSearchResults(); // Hide results list
        
        try {
            // Use the same API call as before, but now with the selected username
            const result = await apiService.addContact(username); 
            uiService.setAddContactStatus(`User '${result.username}' added!`);
            stateService.addContactToState(result); // Add to local state
            // uiService.populateUserList(stateService.getContacts()); // Refresh UI list // OLD
            // Update combined list state (need a function for adding) and refresh UI
            // For now, manual refresh might be needed or re-fetch all data
            uiService.populateChatList(stateService.getCombinedSortedChatList()); // Attempt refresh
            
            // Clear the search input
            if(elements.addContactUsernameInput) elements.addContactUsernameInput.value = '';
            
            // Optionally close popup after delay
            setTimeout(() => uiService.toggleAddContactPopup(false), 1500);
        } catch (error) {
            console.error('Error adding contact:', error);
            uiService.setAddContactStatus(`Error: ${error.detail || 'Failed to add'}`, true);
        } finally {
            uiService.setAddContactLoading(false);
        }
    }

    async function handleCreateGroup() {
        const name = uiService.getCreateGroupName();
        const description = uiService.getCreateGroupDesc();
        const memberIds = uiService.getMemberIds();

        if (!name) {
            uiService.setCreateGroupStatus('Group name is required.', true);
            return;
        }

        uiService.setCreateGroupStatus('Creating...');
        uiService.setCreateGroupLoading(true);

        try {
            const result = await apiService.createGroup(name, description);
            
            // Add members to the group (if any were selected)
            const promises = memberIds
                .filter(id => id !== stateService.getCurrentUserId().toString()) // Skip self (already added as admin)
                .map(userId => apiService.addUserToGroup(result.id, parseInt(userId, 10)));
                
            if (promises.length > 0) {
                await Promise.all(promises);
            }
            
            uiService.setCreateGroupStatus(`Group '${result.group_name}' created!`);
            stateService.addGroupToState(result); // Add new group to state
            // uiService.populateGroupList(stateService.getGroups()); // Refresh UI list // OLD
             // Update combined list state and refresh UI
            // TODO: Add stateService.addChatItem for groups
            uiService.populateChatList(stateService.getCombinedSortedChatList()); // Attempt refresh
            setTimeout(() => uiService.toggleCreateGroupPopup(false), 1500);
        } catch (error) {
            console.error('Error creating group:', error);
            uiService.setCreateGroupStatus(`Error: ${error.detail || 'Failed to create'}`, true);
        } finally {
            uiService.setCreateGroupLoading(false);
        }
    }

    // Debounce function (simple implementation)
    let debounceTimer;
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // New handler for live member search input
    async function handleMemberSearch() {
        const query = uiService.getAddMemberUsername();
        
        if (query.length < 2) { // Only search if query is reasonably long
            uiService.clearMemberSearchResults();
            return;
        }

        uiService.setAddMemberStatus('Searching...');
        uiService.setAddMemberLoading(true);

        try {
            const searchResults = await apiService.searchUsers(query);
            // Filter out users already in the group? Optional, but good UX.
            // For now, just display results.
            uiService.displayMemberSearchResults(searchResults, handleSearchResultClick);
            if (searchResults.length === 0) {
                uiService.setAddMemberStatus('No users found.', false);
            } else {
                uiService.setAddMemberStatus(''); // Clear status if results found
            }
        } catch (error) {
            console.error('Error searching users:', error);
            uiService.setAddMemberStatus(`Error: ${error.detail || 'Search failed'}`, true);
            uiService.clearMemberSearchResults();
        } finally {
            uiService.setAddMemberLoading(false);
        }
    }

    // New handler for clicking a search result
    async function handleSearchResultClick(userId, username) {
        const groupId = stateService.getCurrentChatTarget();
        if (!stateService.isGroupChat() || !groupId) {
            uiService.setAddMemberStatus('No group selected.', true);
            return;
        }

        uiService.setAddMemberStatus(`Adding ${username}...`);
        uiService.setAddMemberLoading(true);
        uiService.clearMemberSearchResults(); // Hide results list immediately
        
        try {
            await apiService.addUserToGroup(groupId, userId);
            uiService.setAddMemberStatus(`User '${username}' added successfully.`);
            
            // Clear the search input
            if(elements.addMemberUsernameInput) elements.addMemberUsernameInput.value = '';
            
            // Refresh member list in modal
            const details = await apiService.fetchGroupDetails(groupId);
            uiService.populateManageMembersModal(groupId, details?.members || []);
            
            // Optionally clear status after a delay
            // setTimeout(() => uiService.setAddMemberStatus(''), 2000);

        } catch (error) {
            console.error('Error adding member to group:', error);
            uiService.setAddMemberStatus(`Error: ${error.detail || 'Failed to add member'}`, true);
        } finally {
            uiService.setAddMemberLoading(false);
        }
    }

    async function handleRemoveMemberFromGroup(groupId, userIdToRemove, buttonElement) {
         if (!confirm(`Are you sure you want to remove this user from the group?`)) {
             return;
         }

         console.log(`Attempting to remove user ${userIdToRemove} from group ${groupId}`);
         if (buttonElement) buttonElement.disabled = true; // Visually disable button

         try {
             await apiService.removeUserFromGroup(groupId, userIdToRemove);
             console.log(`User ${userIdToRemove} removed successfully.`);
             // Refresh member list
             const details = await apiService.fetchGroupDetails(groupId);
             uiService.populateManageMembersModal(groupId, details?.members || []);
             // No need to re-enable button as the element will be removed/re-rendered
         } catch (error) {
             console.error('Failed to remove user:', error);
             alert(`Error removing user: ${error.detail || 'Unknown error'}`);
             if (buttonElement) buttonElement.disabled = false; // Re-enable on error
         }
    }

    // NEW: Handler for file selection - PREVIEW ONLY
    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const maxSize = 10 * 1024 * 1024; // 10MB example
        if (file.size > maxSize) {
             uiService.appendSystemMessage(`File is too large (max ${maxSize / 1024 / 1024}MB).`);
             clearAttachedFile();
             if (fileInput) fileInput.value = ''; // Clear input
             return;
        }

        clearAttachedFile(); // Clear previous attachment if any
        attachedFileObject = file; // Store the file object

        // --- Create Preview ---
        const fileInfo = {
            filename: file.name,
            mediaType: file.type || 'application/octet-stream',
            size: file.size
        };

        // For images, create an Object URL for immediate preview
        if (fileInfo.mediaType.startsWith('image/')) {
            previewObjectUrl = URL.createObjectURL(file);
            uiService.showAttachmentPreview(fileInfo, previewObjectUrl);
        } else {
            // For non-images, just show icon and filename
            uiService.showAttachmentPreview(fileInfo); 
        }
        
        // Reset file input value so the same file can be selected again
        if (fileInput) fileInput.value = '';
    }

    // NEW: Function to clear attached file state and UI
    function clearAttachedFile() {
        attachedFileObject = null;
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl); // Clean up Object URL
            previewObjectUrl = null;
        }
        uiService.clearAttachmentPreview();
    }

    // --- NEW: Handler for Editing Group Details ---
    async function handleEditGroupDetails() {
        const groupId = stateService.getCurrentChatTarget();
        if (!stateService.isGroupChat() || !groupId) {
            uiService.setEditGroupStatus('Error: No group selected', true);
            return;
        }

        const details = uiService.getEditGroupDetails();
        const avatarFile = uiService.getEditGroupAvatarFile();

        uiService.setEditGroupLoading(true);
        uiService.setEditGroupStatus('Saving changes...');

        try {
            let updatedGroup = null;
            // Upload avatar first if a new one was selected
            if (avatarFile) {
                console.log(`Uploading new avatar for group ${groupId}`);
                updatedGroup = await apiService.uploadGroupAvatar(groupId, avatarFile);
                console.log('Avatar uploaded, group data:', updatedGroup);
            }

            // Then update name/description
            console.log(`Updating details for group ${groupId}:`, details);
            // Fetch the current group details to compare
            const currentGroup = stateService.getGroup(groupId);
            if (details.name !== currentGroup?.group_name || details.description !== currentGroup?.description) {
                 updatedGroup = await apiService.updateGroupDetails(groupId, details.name, details.description);
                 console.log('Details updated, group data:', updatedGroup);
            } else {
                 console.log('Name and description unchanged.');
            }

            // Update state with the latest group data (either from avatar upload or details update)
            if (updatedGroup) {
                stateService.updateGroupInCombinedList(updatedGroup); // NEW: Update item in combined list
            }

            uiService.setEditGroupStatus('Group details updated successfully!');

            // Refresh UI elements
            uiService.populateChatList(stateService.getCombinedSortedChatList()); // NEW: Refresh combined list
            uiService.updateChatHeaderStatus(); // Refresh chat header

            setTimeout(() => uiService.toggleEditGroupModal(false), 1500); // Close modal after success

        } catch (error) {
            console.error('Error updating group details:', error);
            uiService.setEditGroupStatus(`Error: ${error.detail || 'Failed to save changes'}`, true);
        } finally {
            uiService.setEditGroupLoading(false);
        }
    }
    // --- END: Handler for Editing Group Details ---

    // --- Handler for Leaving Group ---
    async function handleLeaveGroup() {
        const groupId = stateService.getCurrentChatTarget();
        const group = stateService.getGroup(groupId);
        if (!stateService.isGroupChat() || !groupId || !group) {
            uiService.appendSystemMessage("Error: No group selected or group not found.");
            return;
        }

        if (!confirm(`Are you sure you want to leave the group "${group.group_name}"?`)) {
            return;
        }

        try {
            await apiService.leaveGroup(groupId);
            uiService.appendSystemMessage(`You have left the group "${group.group_name}".`);

            // Remove group from state
            stateService.removeGroupFromState(groupId); // Need to add this function to stateService
            stateService.removeGroupFromCombinedList(groupId); // Need to add this function to stateService

            // Clear chat area and disable it
            uiService.clearChatMessages();
            uiService.disableChatArea(true);
            uiService.updateChatHeaderStatus(); // Clear header

            // Refresh the chat list
            uiService.populateChatList(stateService.getCombinedSortedChatList());

        } catch (error) {
            console.error('Error leaving group:', error);
            uiService.appendSystemMessage(`Error leaving group: ${error.detail || 'Failed to leave'}`);
        }
    }

    // --- Handler for Deleting Direct Chat History ---
    async function handleDeleteDirectChat() {
        const otherUserId = stateService.getCurrentChatTarget();
        const otherUser = stateService.getUser(otherUserId);
        if (stateService.isGroupChat() || !otherUserId || !otherUser) {
            uiService.appendSystemMessage("Error: No direct chat selected or user not found.");
            return;
        }

        if (!confirm(`Are you sure you want to delete your chat history with "${otherUser.username}"? This cannot be undone.`)) {
            return;
        }

        try {
            const result = await apiService.deleteDirectChat(otherUserId);
            uiService.appendSystemMessage(result.message || `Chat history with "${otherUser.username}" deleted.`);

            // Clear the message display area immediately
            uiService.clearChatMessages();
            
            // Optional: Update the chat preview in the sidebar list
            // This requires modifying updateChatItemOnMessage or adding a new state function
            stateService.updateChatItemPreview(otherUserId, false, 'Chat deleted'); // Need to add this
            uiService.populateChatList(stateService.getCombinedSortedChatList());

            // You might want to keep the chat in the list but show it as empty,
            // or remove it entirely depending on desired UX.
            // For now, we just clear the messages UI and update preview.

        } catch (error) {
            console.error('Error deleting chat history:', error);
            uiService.appendSystemMessage(`Error deleting chat: ${error.detail || 'Failed to delete'}`);
        }
    }

    // --- Handler for Deleting Group ---
    async function handleDeleteGroup() {
        const groupId = stateService.getCurrentChatTarget();
        const group = stateService.getGroup(groupId);
        if (!stateService.isGroupChat() || !groupId || !group) {
            uiService.appendSystemMessage("Error: No group selected or group not found.");
            return;
        }

        if (!confirm(`DANGER: Are you sure you want to permanently delete the group "${group.group_name}"? This will remove all members and messages!`)) {
            return;
        }

        try {
            await apiService.deleteGroup(groupId);
            uiService.appendSystemMessage(`Group "${group.group_name}" has been deleted.`);

            // Remove group from state
            stateService.removeGroupFromState(groupId);
            stateService.removeGroupFromCombinedList(groupId);

            // Clear chat area and disable it
            uiService.clearChatMessages();
            uiService.disableChatArea(true);
            uiService.updateChatHeaderStatus(); // Clear header

            // Refresh the chat list
            uiService.populateChatList(stateService.getCombinedSortedChatList());

        } catch (error) {
            console.error('Error deleting group:', error);
            uiService.appendSystemMessage(`Error deleting group: ${error.detail || 'Failed to delete'}`);
        }
    }

}); // End DOMContentLoaded