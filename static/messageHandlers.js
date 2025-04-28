import { currentUserId } from './chat.js';
import { socket } from './socket.js';

// Global state
const state = {
    selectedMessage: null,
    replyingToMessage: null,
    editingMessage: null
};

// --- Define setupMessageHandlers earlier in the file --- 
function setupMessageHandlers() {
    console.log("[setupMessageHandlers] Running...");

    // --- Setup Edit Modal --- 
    setupEditMessageModal(); // Assuming this is defined elsewhere in the file

    // --- Setup Delete Modal --- 
    // Listeners are now attached in showDeleteConfirmation, so no separate setup needed here

    // --- Setup Double Click for Reply --- 
    setupDoubleClickForReply(); // Assuming this is defined elsewhere in the file

    // --- Setup Global Click/Key Listeners --- 
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message') && !e.target.closest('.floating-actions-menu')) {
            clearMessageSelection();
        }
    });

    document.addEventListener('keydown', (e) => {
        const replyContainer = document.getElementById('reply-container');
        if (e.key === 'Escape' && replyContainer && !replyContainer.classList.contains('hidden')) {
            hideReplyUI();
        }
        const deleteModal = document.getElementById('delete-message-modal');
        if (e.key === 'Escape' && deleteModal && !deleteModal.classList.contains('hidden')) {
            console.log("[Global Escape Listener] Closing delete modal.");
            hideDeleteConfirmation();
        }
        const editModal = document.getElementById('edit-message-modal');
        if (e.key === 'Escape' && editModal && !editModal.classList.contains('hidden')) {
            console.log("[Global Escape Listener] Closing edit modal.");
            hideEditUI();
        }
    });

    // --- Setup Socket Listeners --- 
    if (socket) {
        socket.on('message_edited', (data) => {
            if (!data || !data.message_id) return;

            const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.message-content');
                if (contentElement) {
                    contentElement.textContent = data.content;
                    messageElement.classList.add('highlight');
                    setTimeout(() => messageElement.classList.remove('highlight'), 1500);
                }
            }
        });
    } else {
        console.warn("[setupMessageHandlers] Socket not available yet for attaching listeners.");
    }

    console.log("[setupMessageHandlers] Finished.");
}

// --- Other function definitions (showReplyUI, hideReplyUI, etc.) ---

function showReplyUI(messageElement) {
    const messageId = messageElement.dataset.messageId;
    const messageContent = messageElement.querySelector('.message-content')?.textContent || '[deleted message]';
    const senderId = messageElement.dataset.senderId;

    selectedMessageForReply = {
        id: messageId,
        content: messageContent,
        senderId: senderId
    };

    const replyContainer = document.getElementById('reply-container');
    const replyPreview = document.getElementById('reply-preview');

    replyPreview.textContent = messageContent;
    replyContainer.classList.remove('hidden'); // Show the reply container
    document.getElementById('message-input').focus();
}

function hideReplyUI() {
    const replyContainer = document.getElementById('reply-container');

    // Clear the replying state
    state.replyingToMessage = null;
    selectedMessageForReply = null; // Also clear this if it's still used elsewhere

    // --- Explicitly add hidden class --- 
    if (replyContainer) {
        replyContainer.classList.add('hidden');
    }

    // Remove highlight from any message being replied to
    document.querySelectorAll('.message-being-replied-to').forEach(msg =>
        msg.classList.remove('message-being-replied-to'));
}

function showEditUI(messageElement) {
    const messageId = messageElement.dataset.messageId;
    const messageContent = messageElement.querySelector('.message-content')?.textContent;

    if (!messageContent || messageContent === '[Message deleted]') return;

    state.editingMessage = {
        id: messageId,
        content: messageContent
    };

    // Open the edit message modal
    const editModal = document.getElementById('edit-message-modal');
    const editTextarea = document.getElementById('edit-message-content');

    if (editModal && editTextarea) {
        editTextarea.value = messageContent;
        editModal.classList.remove('hidden');
        editTextarea.focus();
        // Put cursor at the end of text
        editTextarea.setSelectionRange(messageContent.length, messageContent.length);
    }
}

function hideEditUI() {
    const editModal = document.getElementById('edit-message-modal');
    if (editModal) {
        editModal.classList.add('hidden');
    }
    state.editingMessage = null;
}

// --- Add the missing function definition --- 
function getReplyingToMessage() {
    // This function should return the message being replied to, 
    // which is stored in the state object.
    return state.replyingToMessage;
}

function showDeleteConfirmation(messageElement) {
    const messageId = messageElement.dataset.messageId;
    const messageContent = messageElement.querySelector('.message-content')?.textContent;

    if (!messageContent || messageContent === '[Message deleted]') {
        console.warn("[showDeleteConfirmation] Attempted to delete an already deleted or invalid message.");
        return;
    }

    // Store the selected message details needed for the delete action
    state.selectedMessage = {
        id: messageId,
        content: messageContent
    };

    const deleteModal = document.getElementById('delete-message-modal');
    const deletePreview = document.getElementById('delete-message-preview');
    const closeBtn = document.getElementById('delete-modal-close');
    const cancelBtn = document.getElementById('delete-modal-cancel');
    const confirmBtn = document.getElementById('delete-modal-confirm');

    if (!deleteModal || !deletePreview || !closeBtn || !cancelBtn || !confirmBtn) {
        console.error("[showDeleteConfirmation] One or more modal elements not found!");
        return;
    }

    // --- Store message details --- 
    const messageIdToDelete = messageElement.dataset.messageId;
    const messageContentToDelete = messageElement.querySelector('.message-content')?.textContent;
    console.log(`[showDeleteConfirmation] Storing message ID for deletion: ${messageIdToDelete}`);
    // Store the ID directly in a variable accessible by the handler
    let currentMessageIdToDelete = messageIdToDelete;

    deletePreview.textContent = messageContentToDelete.length > 150
        ? messageContentToDelete.substring(0, 147) + '...'
        : messageContentToDelete;

    // --- Clear previous onclick handlers --- 
    closeBtn.onclick = null;
    cancelBtn.onclick = null;
    confirmBtn.onclick = null;
    console.log("[showDeleteConfirmation] Cleared previous handlers.");

    // --- Attach listeners directly here --- 
    closeBtn.onclick = () => {
        console.log("[Delete Modal] Close button clicked.");
        hideDeleteConfirmation();
    };
    cancelBtn.onclick = () => {
        console.log("[Delete Modal] Cancel button clicked.");
        hideDeleteConfirmation();
    };
    confirmBtn.onclick = async () => {
        console.log("[Delete Modal] Confirm button clicked.");
        // --- Use the locally scoped variable --- 
        if (!currentMessageIdToDelete) {
            console.error("[Delete Modal] No valid message ID found when confirm was clicked.");
            hideDeleteConfirmation();
            return;
        }
        console.log(`[Delete Modal] Attempting to call deleteMessage with ID: ${currentMessageIdToDelete}`);
        await deleteMessage(currentMessageIdToDelete); // Pass the ID directly
        hideDeleteConfirmation();
    };
    console.log("[showDeleteConfirmation] Attached new handlers.");

    // Show the modal
    deleteModal.classList.remove('hidden');
    console.log("[showDeleteConfirmation] Modal should be visible now.");
}

function hideDeleteConfirmation() {
    const deleteModal = document.getElementById('delete-message-modal');
    if (deleteModal) {
        console.log("[hideDeleteConfirmation] Hiding modal.");
        deleteModal.classList.add('hidden');
        // Clear handlers after hiding
        const closeBtn = document.getElementById('delete-modal-close');
        const cancelBtn = document.getElementById('delete-modal-cancel');
        const confirmBtn = document.getElementById('delete-modal-confirm');
        if (closeBtn) closeBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
        if (confirmBtn) confirmBtn.onclick = null;
        console.log("[hideDeleteConfirmation] Cleared button onclick handlers.");
    }
}

function setupDoubleClickForReply() {
    // Use event delegation for double-click handling
    document.getElementById('message-list').addEventListener('dblclick', (e) => {
        // Find the closest message element to where the click occurred
        const messageElement = e.target.closest('.message');
        if (!messageElement) return;

        // Prevent text selection on double click
        e.preventDefault();

        // Get message details
        const messageId = parseInt(messageElement.dataset.messageId);
        const content = messageElement.querySelector('.message-content')?.textContent;
        const senderId = parseInt(messageElement.dataset.senderId);

        if (!messageId || !content) return;

        // Set up the reply UI
        setupReplyUI(messageId, content, senderId);

        // Clear any selected message to prevent UI conflicts
        clearMessageSelection();

        // Focus the input field after setting up the reply
        document.getElementById('message-input')?.focus();
    });
}

function setupReplyUI(messageId, content, senderId) {
    if (!messageId || !content) return;

    const replyContainer = document.getElementById('reply-container');
    const replyPreview = document.getElementById('reply-preview');
    const cancelReply = document.getElementById('cancel-reply');

    // Store the message we're replying to
    state.replyingToMessage = {
        id: messageId,
        content: content,
        sender_id: senderId
    };

    if (replyPreview && replyContainer) {
        // Find and highlight the original message
        const originalMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (originalMessage) {
            // First remove highlight from any other messages
            document.querySelectorAll('.message-being-replied-to').forEach(msg =>
                msg.classList.remove('message-being-replied-to'));

            // Add highlight to the message being replied to
            originalMessage.classList.add('message-being-replied-to');

            // Scroll to make the message visible if needed
            originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Format the preview content with sender information
        let senderName = 'Someone';
        if (senderId === currentUserId) {
            senderName = 'You';
        } else {
            // Try to find username from message element
            const usernameEl = originalMessage?.querySelector('.message-sender');
            if (usernameEl) {
                senderName = usernameEl.textContent || 'Someone';
            }
        }

        // Create enhanced preview with sender name and truncated content
        const previewContent = `${senderName}: ${content}`;

        // Set preview content with formatting
        replyPreview.innerHTML = `
            <span class="font-medium text-blue-700">${senderName}</span>
            <span class="text-gray-600">: ${content.length > 50 ? content.substring(0, 47) + '...' : content}</span>
        `;

        // Explicitly remove hidden class
        replyContainer.classList.remove('hidden');

        // Focus the message input
        document.getElementById('message-input')?.focus();
    }
}

function handleMessageClick(e, messageElement) {
    e.stopPropagation();
    if (!messageElement || !currentUserId) return;

    // Clear previous selection
    clearMessageSelection();

    // Select current message
    messageElement.classList.add('message-selected');

    state.selectedMessage = {
        id: parseInt(messageElement.dataset.messageId),
        // Ensure content is fetched correctly, even if it was previously deleted/edited
        content: messageElement.querySelector('.message-content')?.textContent || '',
        senderId: parseInt(messageElement.dataset.senderId)
    };

    // Show and position floating menu
    const actionsMenu = document.querySelector('.floating-actions-menu');
    if (!actionsMenu) return;

    const deleteBtn = actionsMenu.querySelector('.delete');
    const editBtn = actionsMenu.querySelector('.edit');
    const isOwnMessage = state.selectedMessage.senderId === currentUserId;
    const isDeleted = messageElement.classList.contains('deleted');

    // Only show edit/delete for own, non-deleted messages
    if (editBtn) editBtn.style.display = (isOwnMessage && !isDeleted) ? 'flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = (isOwnMessage && !isDeleted) ? 'flex' : 'none';

    // Position the menu relative to the message
    const messageRect = messageElement.getBoundingClientRect();
    const menuRect = actionsMenu.getBoundingClientRect(); // Get menu dimensions *after* setting display
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let menuTop = messageRect.top; // Align top with message top initially
    let menuLeft = messageRect.left - menuRect.width - 10; // Position to the left of the message with 10px gap

    // Adjust if menu goes off-screen left
    if (menuLeft < 10) {
        menuLeft = 10; // Ensure minimum spacing from left edge
    }

    // Adjust if menu goes off-screen bottom
    if (menuTop + menuRect.height > viewportHeight - 10) {
        menuTop = viewportHeight - menuRect.height - 10;
    }

    // Adjust if menu goes off-screen top
    if (menuTop < 10) {
        menuTop = 10;
    }

    actionsMenu.style.position = 'fixed';
    actionsMenu.style.left = `${menuLeft}px`;
    actionsMenu.style.top = `${menuTop}px`;

    // Setup button handlers
    actionsMenu.querySelector('.reply').onclick = () => {
        if (state.selectedMessage && !isDeleted) {
            setupReplyUI(
                state.selectedMessage.id,
                state.selectedMessage.content,
                state.selectedMessage.senderId
            );
        }
        clearMessageSelection();
    };

    if (editBtn) {
        editBtn.onclick = () => {
            if (state.selectedMessage && isOwnMessage && !isDeleted) {
                showEditUI(messageElement);
            }
            clearMessageSelection();
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (state.selectedMessage && isOwnMessage && !isDeleted) {
                // *** Explicitly call showDeleteConfirmation ***
                showDeleteConfirmation(messageElement);
            }
            clearMessageSelection();
        };
    }

    actionsMenu.classList.remove('hidden');
}

function clearMessageSelection() {
    document.querySelectorAll('.message').forEach(msg => msg.classList.remove('selected', 'message-selected'));
    document.querySelector('.floating-actions-menu')?.classList.add('hidden');
    state.selectedMessage = null;
}

// Ensure deleteMessage does NOT use confirm()
async function deleteMessage(messageId) {
    // No confirm() call here
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                messageEl.classList.add('deleted');
                messageEl.querySelector('.message-content').textContent = '[Message deleted]';

                // Also emit socket event for real-time updates
                if (socket && socket.connected) {
                    socket.emit('delete_message', { message_id: messageId });
                }

                // Show toast notification
                Toastify({
                    text: "Message deleted successfully",
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "#4CAF50",
                }).showToast();
            }
        } else {
            console.error("Failed to delete message:", await response.text());
            Toastify({
                text: "Failed to delete message",
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
            }).showToast();
        }
    } catch (error) {
        console.error("Error deleting message:", error);
        Toastify({
            text: "Error deleting message",
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "#F44336",
        }).showToast();
    }
}

// Add the message editing function
async function editMessage(messageId, newContent) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/chat/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: newContent })
        });

        if (response.ok) {
            const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                const contentEl = messageEl.querySelector('.message-content');
                if (contentEl) {
                    contentEl.textContent = newContent;

                    // Highlight the edited message briefly
                    messageEl.classList.add('highlight');
                    setTimeout(() => messageEl.classList.remove('highlight'), 1500);

                    // Also emit socket event for real-time updates to other clients
                    if (socket && socket.connected) {
                        socket.emit('edit_message', {
                            message_id: messageId,
                            content: newContent
                        });
                    }

                    // Show toast notification
                    Toastify({
                        text: "Message updated successfully",
                        duration: 3000,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "#4CAF50",
                    }).showToast();
                }
            }
        } else {
            console.error("Failed to edit message:", await response.text());
            Toastify({
                text: "Failed to edit message",
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#F44336",
            }).showToast();
        }
    } catch (error) {
        console.error("Error editing message:", error);
        Toastify({
            text: "Error editing message",
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "#F44336",
        }).showToast();
    }
}

// --- setupEditMessageModal definition needs to be here or before setupMessageHandlers ---
function setupEditMessageModal() {
    // Placeholder: Ensure this function is defined correctly somewhere above
    console.log("Setting up edit message modal...");
    const editModal = document.getElementById('edit-message-modal');
    if (!editModal) return;

    const closeBtn = document.getElementById('edit-modal-close');
    const cancelBtn = document.getElementById('edit-modal-cancel');
    const saveBtn = document.getElementById('edit-modal-save');
    const textarea = document.getElementById('edit-message-content');

    if (closeBtn) closeBtn.onclick = hideEditUI;
    if (cancelBtn) cancelBtn.onclick = hideEditUI;

    if (saveBtn) {
        saveBtn.onclick = async () => {
            if (!state.editingMessage || !textarea) return;
            const newContent = textarea.value.trim();
            if (!newContent) {
                alert('Message cannot be empty.');
                return;
            }
            await editMessage(state.editingMessage.id, newContent);
            hideEditUI();
        };
    }
    if (textarea) {
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                saveBtn?.click();
            }
        });
    }
}

export {
    setupMessageHandlers,
    setupReplyUI,
    hideReplyUI,
    handleMessageClick,
    clearMessageSelection,
    deleteMessage,
    editMessage,
    getReplyingToMessage
};
