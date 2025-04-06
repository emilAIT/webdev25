let replyingToMessage = null;
let selectedMessages = [];
let selectedMessageForAction = null;
let selectedMessage = null;

function getReplyingToMessage() {
    return replyingToMessage;
}

function setupMessageHandlers() {
    // Reply container handlers
    const replyContainer = document.getElementById('reply-container');
    const cancelReplyBtn = document.getElementById('cancel-reply');

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', hideReplyUI);
    }

    // Add delete handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedMessages.length > 0) {
            deleteSelectedMessages();
        }
    });

    // Message selection button
    const selectBtn = document.createElement('button');
    selectBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>`;
    selectBtn.className = 'ml-4 p-2 rounded-full hover:bg-gray-200 transition-colors';
    selectBtn.title = 'Select Messages';

    const header = document.querySelector('#conversation-header > div');
    header.appendChild(selectBtn);

    selectBtn.addEventListener('click', toggleSelectionMode);

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

    replyingToMessage = {
        id: messageId,
        content: content,
        sender_id: senderId
    };

    if (replyPreview && replyContainer) {
        replyPreview.textContent = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        replyContainer.classList.remove('hidden');
        document.getElementById('message-input')?.focus();
    }
}

function hideReplyUI() {
    const replyContainer = document.getElementById('reply-container');
    replyingToMessage = null;
    replyContainer?.classList.add('hidden');
}

function toggleSelectionMode() {
    const messageList = document.getElementById('message-list');
    const isSelecting = messageList.classList.toggle('selecting-messages');

    if (isSelecting) {
        messageList.querySelectorAll('.message').forEach(msg => {
            const checkbox = document.createElement('div');
            checkbox.className = 'message-checkbox';
            msg.insertBefore(checkbox, msg.firstChild);
        });
    } else {
        messageList.querySelectorAll('.message-checkbox').forEach(checkbox => checkbox.remove());
        selectedMessages = [];
    }
}

async function deleteSelectedMessages() {
    if (!selectedMessages.length || !confirm(`Delete ${selectedMessages.length} selected message(s)?`)) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    for (const messageId of selectedMessages) {
        try {
            const response = await fetch(`/chat/messages/${messageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageEl) {
                    messageEl.classList.add('deleted');
                    messageEl.innerHTML = '<div>[Message deleted]</div>';
                }

                if (window.socket?.connected) {
                    socket.emit('delete_message', { message_id: messageId });
                }
            }
        } catch (error) {
            console.error(`Error deleting message ${messageId}:`, error);
        }
    }

    // Clear selection
    selectedMessages = [];
    const messageList = document.getElementById('message-list');
    messageList?.classList.remove('selecting-messages');
    document.querySelectorAll('.message-checkbox').forEach(cb => cb.remove());
}

function handleMessageClick(e, messageElement) {
    e.stopPropagation();

    // Clear previous selection
    clearMessageSelection();

    // Select current message
    messageElement.classList.add('selected');
    selectedMessage = {
        id: parseInt(messageElement.dataset.messageId),
        content: messageElement.textContent,
        senderId: parseInt(messageElement.dataset.senderId)
    };

    // Show floating menu
    const actionsMenu = document.querySelector('.floating-actions-menu');
    const deleteBtn = actionsMenu.querySelector('.delete');

    // Show/hide delete button based on ownership
    const isOwnMessage = selectedMessage.senderId === currentUserId;
    deleteBtn.style.display = isOwnMessage ? 'flex' : 'none';

    // Setup button handlers
    actionsMenu.querySelector('.reply').onclick = () => {
        setupReplyUI(selectedMessage.id, selectedMessage.content, selectedMessage.senderId);
        clearMessageSelection();
    };

    deleteBtn.onclick = async () => {
        if (confirm('Delete this message?')) {
            await deleteMessage(selectedMessage.id);
            clearMessageSelection();
        }
    };

    // Show the menu
    actionsMenu.classList.remove('hidden');
}

function clearMessageSelection() {
    document.querySelectorAll('.message').forEach(msg => msg.classList.remove('selected'));
    document.querySelector('.floating-actions-menu')?.classList.add('hidden');
    selectedMessage = null;
}

export {
    setupMessageHandlers,
    setupReplyUI,
    hideReplyUI,
    getReplyingToMessage,
    deleteSelectedMessages,
    handleMessageClick,
    clearMessageSelection
};
