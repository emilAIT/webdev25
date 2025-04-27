// This file controls message interactions like replies, deletion, and selection

let activeReplyMessage = null; // Track if we're currently replying to a message

// Initialize all message-related functionality
function initMessageInteractions() {
    const messageList = document.getElementById('message-list');
    const replyContainer = document.getElementById('reply-container');
    const cancelReplyBtn = document.getElementById('cancel-reply');
    const sendBtn = document.getElementById('send-btn');

    // Always ensure the reply container is hidden initially
    replyContainer.classList.add('hidden');

    // Handle double-click on message to reply
    messageList.addEventListener('dblclick', event => {
        const messageElement = event.target.closest('.message');
        if (!messageElement) return;

        startReply(messageElement);
    });

    // Clear reply when clicking cancel button
    cancelReplyBtn.addEventListener('click', () => {
        clearReply();
    });

    // Clear reply after sending a message
    sendBtn.addEventListener('click', () => {
        // Wait briefly to ensure the message sending process gets the reply data first
        setTimeout(clearReply, 100);
    });

    // Also clear reply with Escape key
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !replyContainer.classList.contains('hidden')) {
            clearReply();
        }
    });
}

// Start a reply to a specific message
function startReply(messageElement) {
    const messageId = messageElement.dataset.messageId;
    const messageContent = messageElement.querySelector('.message-content')?.textContent || '[deleted message]';
    const senderId = messageElement.dataset.senderId;

    const replyContainer = document.getElementById('reply-container');
    const replyPreview = document.getElementById('reply-preview');

    // Store active reply data
    activeReplyMessage = {
        id: messageId,
        content: messageContent,
        senderId: senderId
    };

    // Set preview content and show container
    replyPreview.textContent = messageContent.length > 50
        ? messageContent.substring(0, 50) + '...'
        : messageContent;

    replyContainer.classList.remove('hidden');

    // Focus message input
    document.getElementById('message-input').focus();
}

// Clear any active reply
function clearReply() {
    const replyContainer = document.getElementById('reply-container');

    activeReplyMessage = null;
    replyContainer.classList.add('hidden');
}

// Get current reply data (for message sending)
function getReplyData() {
    return activeReplyMessage;
}

// Export functions for use in other modules
export {
    initMessageInteractions,
    startReply,
    clearReply,
    getReplyData
};