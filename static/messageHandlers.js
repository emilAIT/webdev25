import { currentUserId } from './chat.js';
import { socket } from './socket.js';

// Global state - simplified without selection functionality
const state = {
    selectedMessage: null,
    replyingToMessage: null
};

export function getReplyingToMessage() {
    return state.replyingToMessage;
}

function setupMessageHandlers() {
    // Reply container handlers
    const replyContainer = document.getElementById('reply-container');
    const cancelReplyBtn = document.getElementById('cancel-reply');

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', hideReplyUI);
    }

    // Remove all selection-related code

    // Close floating menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message') && !e.target.closest('.floating-actions-menu')) {
            clearMessageSelection();
        }
    });
}

function setupReplyUI(messageId, content, senderId) {
    if (!messageId || !content) return;

    const replyContainer = document.getElementById('reply-container');
    const replyPreview = document.getElementById('reply-preview');

    state.replyingToMessage = {
        id: messageId,
        content: content,
        sender_id: senderId
    };

    if (replyPreview && replyContainer) {
        const previewContent = `${senderId === currentUserId ? 'You' : 'Someone'}: ${content}`;
        replyPreview.textContent = previewContent.length > 50
            ? previewContent.substring(0, 47) + '...'
            : previewContent;
        replyContainer.classList.remove('hidden');
        document.getElementById('message-input')?.focus();
    }
}

function hideReplyUI() {
    const replyContainer = document.getElementById('reply-container');
    state.replyingToMessage = null;
    replyContainer?.classList.add('hidden');
}

// Remove toggleSelectionMode function and deleteSelectedMessages function

function handleMessageClick(e, messageElement) {
    e.stopPropagation();
    if (!messageElement || !currentUserId) return;

    // Clear previous selection
    clearMessageSelection();

    // Select current message
    messageElement.classList.add('message-selected');

    state.selectedMessage = {
        id: parseInt(messageElement.dataset.messageId),
        content: messageElement.querySelector('.message-content').textContent,
        senderId: parseInt(messageElement.dataset.senderId)
    };

    // Show and position floating menu
    const actionsMenu = document.querySelector('.floating-actions-menu');
    if (!actionsMenu) return;

    const deleteBtn = actionsMenu.querySelector('.delete');
    const isOwnMessage = state.selectedMessage.senderId === currentUserId;
    deleteBtn.style.display = isOwnMessage ? 'flex' : 'none';

    // Position the menu next to the message
    const messageRect = messageElement.getBoundingClientRect();
    actionsMenu.style.position = 'fixed';
    actionsMenu.style.left = `${messageRect.right + 10}px`;
    actionsMenu.style.top = `${messageRect.top}px`;

    // Setup button handlers
    actionsMenu.querySelector('.reply').onclick = () => {
        setupReplyUI(state.selectedMessage.id, state.selectedMessage.content, state.selectedMessage.senderId);
        clearMessageSelection();
    };

    deleteBtn.onclick = async () => {
        if (confirm('Delete this message?')) {
            await deleteMessage(state.selectedMessage.id);
            clearMessageSelection();
        }
    };

    actionsMenu.classList.remove('hidden');
}

function clearMessageSelection() {
    document.querySelectorAll('.message').forEach(msg => msg.classList.remove('selected', 'message-selected'));
    document.querySelector('.floating-actions-menu')?.classList.add('hidden');
    state.selectedMessage = null;
}

// Add the missing deleteMessage function
async function deleteMessage(messageId) {
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
                messageEl.innerHTML = '<div class="message-content">[Message deleted]</div>';
                if (socket && socket.connected) {
                    socket.emit('delete_message', { message_id: messageId });
                }
            }
        } else {
            console.error("Failed to delete message:", await response.text());
        }
    } catch (error) {
        console.error("Error deleting message:", error);
    }
}

export {
    setupMessageHandlers,
    setupReplyUI,
    hideReplyUI,
    handleMessageClick,
    clearMessageSelection,
    deleteMessage
};
