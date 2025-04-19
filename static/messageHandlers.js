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

    // Setup double-click functionality for replying
    setupDoubleClickForReply();

    // Close floating menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message') && !e.target.closest('.floating-actions-menu')) {
            clearMessageSelection();
        }
    });

    // Also clear reply UI when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !replyContainer?.classList.contains('hidden')) {
            hideReplyUI();
        }
    });
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

    // Store the message we're replying to
    state.replyingToMessage = {
        id: messageId,
        content: content,
        sender_id: senderId
    };

    if (replyPreview && replyContainer) {
        // Highlight the original message
        const originalMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (originalMessage) {
            // First remove highlight from any other messages
            document.querySelectorAll('.message-being-replied-to').forEach(msg =>
                msg.classList.remove('message-being-replied-to'));

            // Add highlight to the message being replied to
            originalMessage.classList.add('message-being-replied-to');
        }

        // Format the preview content
        const previewContent = `${senderId === currentUserId ? 'You' : 'Someone'}: ${content}`;
        replyPreview.textContent = previewContent.length > 50
            ? previewContent.substring(0, 47) + '...'
            : previewContent;

        // Show the reply container with animation
        replyContainer.classList.remove('hidden');

        // Focus the message input
        document.getElementById('message-input')?.focus();
    }
}

function hideReplyUI() {
    const replyContainer = document.getElementById('reply-container');

    // Clear the replying state
    state.replyingToMessage = null;

    // Hide the reply container
    replyContainer?.classList.add('hidden');

    // Remove highlight from any message being replied to
    document.querySelectorAll('.message-being-replied-to').forEach(msg =>
        msg.classList.remove('message-being-replied-to'));
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
        setupReplyUI(
            state.selectedMessage.id,
            state.selectedMessage.content,
            state.selectedMessage.senderId
        );
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
