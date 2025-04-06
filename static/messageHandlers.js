let replyingToMessage = null;
let selectedMessages = [];

function setupMessageHandlers() {
    // Reply container handlers
    const replyContainer = document.getElementById('reply-container');
    const cancelReplyBtn = document.getElementById('cancel-reply');

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            hideReplyUI();
        });
    }

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
}

function setupReplyUI(messageId, content, senderId) {
    const replyContainer = document.getElementById('reply-container');
    const replyPreview = document.getElementById('reply-preview');

    replyingToMessage = {
        id: messageId,
        content: content,
        sender_id: senderId
    };

    replyPreview.textContent = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    replyContainer.classList.remove('hidden');
    document.getElementById('message-input').focus();
}

function hideReplyUI() {
    const replyContainer = document.getElementById('reply-container');
    replyingToMessage = null;
    replyContainer.classList.add('hidden');
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

export {
    setupMessageHandlers,
    setupReplyUI,
    hideReplyUI,
    toggleSelectionMode,
    replyingToMessage,
    selectedMessages
};
