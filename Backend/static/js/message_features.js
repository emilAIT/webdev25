// Message editing and deletion functionality
let activeContextMenu = null;
let activeMessage = null;
const EDIT_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes in milliseconds

// Context Menu Functions
function showContextMenu(event, messageElement) {
    event.preventDefault();
    const contextMenu = document.getElementById('messageContextMenu');
    const editBtn = document.getElementById('editMessageBtn');
    const messageTimestamp = parseInt(messageElement.getAttribute('data-timestamp'));
    const timeDiff = Date.now() - messageTimestamp;
    
    // Only show edit option if within time limit and message is not deleted
    editBtn.style.display = timeDiff <= EDIT_TIME_LIMIT && !messageElement.classList.contains('deleted') ? 'block' : 'none';
    
    // Position the context menu
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.classList.add('show');
    
    activeContextMenu = contextMenu;
    activeMessage = messageElement;
}

// Hide context menu when clicking outside
document.addEventListener('click', function(event) {
    if (activeContextMenu && !activeContextMenu.contains(event.target)) {
        activeContextMenu.classList.remove('show');
    }
});

// Handle message deletion
document.getElementById('deleteMessageBtn').addEventListener('click', function() {
    if (activeMessage) {
        const messageId = activeMessage.getAttribute('data-message-id');
        const messageContent = activeMessage.querySelector('.message-content');
        
        // Update message content to show deleted state
        messageContent.textContent = 'This message was deleted';
        activeMessage.classList.add('deleted');
        
        // Hide context menu
        activeContextMenu.classList.remove('show');
        
        // Emit delete message event to server
        socket.emit('delete_message', {
            message_id: messageId,
            chat_id: window.currentChat.id,
            chat_type: window.currentChat.type
        });
    }
});

// Handle message editing
document.getElementById('editMessageBtn').addEventListener('click', function() {
    if (activeMessage) {
        const messageContent = activeMessage.querySelector('.message-content');
        const currentText = messageContent.textContent;
        
        // Create edit input
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'message-edit-input';
        editInput.value = currentText;
        
        // Add edit input before message content
        messageContent.parentNode.insertBefore(editInput, messageContent);
        activeMessage.classList.add('editing');
        
        // Focus input
        editInput.focus();
        
        // Handle edit submission
        editInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.trim()) {
                const messageId = activeMessage.getAttribute('data-message-id');
                const newText = this.value.trim();
                
                // Update message content
                messageContent.textContent = newText;
                
                // Add edited label if not exists
                if (!activeMessage.querySelector('.edited-label')) {
                    const editedLabel = document.createElement('span');
                    editedLabel.className = 'edited-label';
                    editedLabel.textContent = '(edited)';
                    messageContent.appendChild(editedLabel);
                }
                
                // Remove edit input and editing class
                this.remove();
                activeMessage.classList.remove('editing');
                
                // Hide context menu
                activeContextMenu.classList.remove('show');
                
                // Emit edit message event to server
                socket.emit('edit_message', {
                    message_id: messageId,
                    new_content: newText,
                    chat_id: window.currentChat.id,
                    chat_type: window.currentChat.type
                });
            }
        });
        
        // Handle edit cancellation
        editInput.addEventListener('blur', function() {
            this.remove();
            activeMessage.classList.remove('editing');
        });
    }
});

// Add context menu trigger to messages
function addContextMenuToMessage(messageElement) {
    messageElement.addEventListener('contextmenu', function(e) {
        // Only add context menu for sent messages
        if (messageElement.classList.contains('sent')) {
            showContextMenu(e, messageElement);
        }
    });
}

// Modify the existing message creation code to add context menu and timestamp data
const originalCreateMessageElement = window.createMessageElement || function(){};
window.createMessageElement = function(data) {
    const messageElement = originalCreateMessageElement(data);
    
    // Add message ID and timestamp as data attributes
    messageElement.setAttribute('data-message-id', data.message_id);
    messageElement.setAttribute('data-timestamp', data.timestamp);
    
    // Add context menu for sent messages
    if (messageElement.classList.contains('sent')) {
        addContextMenuToMessage(messageElement);
    }
    
    return messageElement;
};

// Handle incoming message updates from server
socket.on('message_deleted', function(data) {
    const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
    if (messageElement) {
        const messageContent = messageElement.querySelector('.message-content');
        messageContent.textContent = 'This message was deleted';
        messageElement.classList.add('deleted');
    }
});

socket.on('message_edited', function(data) {
    const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
    if (messageElement) {
        const messageContent = messageElement.querySelector('.message-content');
        messageContent.textContent = data.new_content;
        
        if (!messageElement.querySelector('.edited-label')) {
            const editedLabel = document.createElement('span');
            editedLabel.className = 'edited-label';
            editedLabel.textContent = '(edited)';
            messageContent.appendChild(editedLabel);
        }
    }
}); 