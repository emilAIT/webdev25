/**
 * Enhanced Chat Functionality for ShrekChat
 * Adds context menu functionality to messages
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("ChatFunc.js loaded - message context menu functionality initialized");

    // Create the context menu for messages
    let messageContextMenu;
    
    function createContextMenu() {
        // Check if context menu already exists
        messageContextMenu = document.getElementById('messageContextMenu');
        
        if (!messageContextMenu) {
            messageContextMenu = document.createElement('div');
            messageContextMenu.id = 'messageContextMenu';
            messageContextMenu.className = 'message-context-menu';
            
            messageContextMenu.innerHTML = `
                <ul>
                    <li id="editMessageOption"><i class="fas fa-edit"></i> Edit</li>
                    <li id="copyMessageOption"><i class="fas fa-copy"></i> Copy</li>
                    <li id="deleteMessageOption"><i class="fas fa-trash"></i> Delete</li>
                </ul>
            `;
            
            document.body.appendChild(messageContextMenu);
            
            // Add styles if they don't exist
            if (!document.getElementById('contextMenuStyles')) {
                const styles = document.createElement('style');
                styles.id = 'contextMenuStyles';
                styles.textContent = `
                    .message-context-menu {
                        position: absolute;
                        background: var(--popup-bg-color, #fff);
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                        display: none;
                        z-index: 1000;
                        overflow: hidden;
                        min-width: 150px;
                        border: 1px solid var(--border-color, #ddd);
                    }
                    
                    .message-context-menu ul {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    }
                    
                    .message-context-menu li {
                        padding: 10px 15px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        color: var(--text-color, #333);
                    }
                    
                    .message-context-menu li i {
                        margin-right: 8px;
                        width: 16px;
                        text-align: center;
                    }
                    
                    .message-context-menu li:hover {
                        background-color: var(--hover-color, #f0f0f0);
                    }
                    
                    .message-context-menu li#deleteMessageOption {
                        color: var(--danger-color, #e74c3c);
                    }
                    
                    .message.being-edited {
                        opacity: 0.7;
                    }
                    
                    .message-edit-form {
                        margin-top: 5px;
                    }
                    
                    .message-edit-form textarea {
                        width: 100%;
                        padding: 8px;
                        border-radius: 8px;
                        border: 1px solid var(--border-color, #ddd);
                        resize: vertical;
                        min-height: 60px;
                        background: var(--input-bg, #fff);
                        color: var(--text-color, #333);
                    }
                    
                    .message-edit-form .edit-actions {
                        display: flex;
                        justify-content: flex-end;
                        margin-top: 5px;
                    }
                    
                    .message-edit-form button {
                        padding: 5px 10px;
                        border-radius: 4px;
                        border: none;
                        margin-left: 5px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    
                    .message-edit-form .cancel-edit {
                        background: var(--secondary-button-bg, #ddd);
                    }
                    
                    .message-edit-form .save-edit {
                        background: var(--primary-button-bg, #28a745);
                        color: #fff;
                    }
                    
                    /* Message with edited indicator */
                    .message-content.edited:after {
                        content: " (edited)";
                        font-size: 0.8em;
                        opacity: 0.7;
                        font-style: italic;
                    }
                `;
                document.head.appendChild(styles);
            }
        }
        
        return messageContextMenu;
    }
    
    // Variables to store current context
    let currentMessageElement = null;
    let currentMessageId = null;
    let currentRoomId = null;
    let currentContent = null;
    
    // Handle click outside context menu
    document.addEventListener('click', function(e) {
        const contextMenu = document.getElementById('messageContextMenu');
        if (contextMenu && contextMenu.style.display === 'block') {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        }
    });
    
    // Add context menu to messages
    function addContextMenuToMessages() {
        // Create the context menu if it doesn't exist
        createContextMenu();
        
        // Get the chat messages container
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            console.error("Chat messages container not found");
            return;
        }
        
        // Remove any existing event listeners to avoid duplicates
        chatMessages.removeEventListener('contextmenu', handleContextMenu);
        chatMessages.removeEventListener('touchstart', handleTouchStart);
        chatMessages.removeEventListener('touchend', handleTouchEnd);
        chatMessages.removeEventListener('touchmove', handleTouchMove);
        
        // Add context menu event (right click)
        chatMessages.addEventListener('contextmenu', handleContextMenu);
        
        // Add long press events for mobile
        chatMessages.addEventListener('touchstart', handleTouchStart);
        chatMessages.addEventListener('touchend', handleTouchEnd);
        chatMessages.addEventListener('touchmove', handleTouchMove);
        
        console.log("Context menu events attached to chat messages container");
    }
    
    // Handle right-click context menu
    let longPressTimer;
    const longPressDuration = 500; // 500ms for long press
    
    function handleContextMenu(e) {
        // Find the closest message element
        const messageElement = e.target.closest('.message');
        
        // Only proceed if this is a message element and it's an outgoing message (user's own message)
        if (messageElement && messageElement.classList.contains('outgoing')) {
            e.preventDefault(); // Prevent default context menu
            
            // Store message context
            currentMessageElement = messageElement;
            currentMessageId = messageElement.getAttribute('data-message-id');
            currentRoomId = document.getElementById('chatContent')?.getAttribute('data-current-room-id');
            currentContent = messageElement.querySelector('.message-content').textContent;
            
            // Position menu on top of the message, not at the click position
            const menu = document.getElementById('messageContextMenu');
            const rect = messageElement.getBoundingClientRect();
            
            // Position the menu horizontally centered over the message and vertically above it
            menu.style.left = `${rect.left + window.pageXOffset + (rect.width / 2) - (menu.offsetWidth / 2 || 75)}px`;
            menu.style.top = `${rect.top + window.pageYOffset - (menu.offsetHeight || 120) - 10}px`;
            menu.style.display = 'block';
            
            // Show Edit option only if it's a recent message (within last 5 minutes)
            const messageTime = messageElement.querySelector('.message-time');
            const messageTimeText = messageTime ? messageTime.textContent : '';
            const isRecentMessage = isMessageRecent(messageTimeText);
            
            const editOption = document.getElementById('editMessageOption');
            if (editOption) {
                editOption.style.display = isRecentMessage ? 'flex' : 'none';
            }
        }
    }
    
    // Handle touch start for long press
    function handleTouchStart(e) {
        const messageElement = e.target.closest('.message');
        if (messageElement && messageElement.classList.contains('outgoing')) {
            longPressTimer = setTimeout(() => {
                // Store message context
                currentMessageElement = messageElement;
                currentMessageId = messageElement.getAttribute('data-message-id');
                currentRoomId = document.getElementById('chatContent')?.getAttribute('data-current-room-id');
                currentContent = messageElement.querySelector('.message-content').textContent;
                
                // Position menu on top of the message, not at the touch position
                const menu = document.getElementById('messageContextMenu');
                const rect = messageElement.getBoundingClientRect();
                
                // Position the menu horizontally centered over the message and vertically above it
                menu.style.left = `${rect.left + (rect.width / 2) - (menu.offsetWidth / 2 || 75)}px`;
                menu.style.top = `${rect.top - (menu.offsetHeight || 120) - 10}px`;
                menu.style.display = 'block';
                
                // Show Edit option only if it's a recent message
                const messageTime = messageElement.querySelector('.message-time');
                const messageTimeText = messageTime ? messageTime.textContent : '';
                const isRecentMessage = isMessageRecent(messageTimeText);
                
                const editOption = document.getElementById('editMessageOption');
                if (editOption) {
                    editOption.style.display = isRecentMessage ? 'flex' : 'none';
                }
            }, longPressDuration);
        }
    }
    
    function handleTouchEnd() {
        clearTimeout(longPressTimer);
    }
    
    function handleTouchMove() {
        clearTimeout(longPressTimer);
    }
    
    // Helper function to determine if a message is recent (editable)
    function isMessageRecent(timeString) {
        // If no time string is provided, assume not recent
        if (!timeString) return false;
        
        // Try to parse the time string (e.g., "14:30")
        const [hours, minutes] = timeString.split(':').map(Number);
        
        if (isNaN(hours) || isNaN(minutes)) return false;
        
        // Create message time and current time
        const now = new Date();
        const messageTime = new Date();
        messageTime.setHours(hours, minutes, 0); // Set hours and minutes
        
        // If message time is in future (past midnight), subtract one day
        if (messageTime > now) {
            messageTime.setDate(messageTime.getDate() - 1);
        }
        
        // Calculate difference in minutes
        const diffMinutes = (now - messageTime) / 60000;
        
        // Allow editing if message is less than 5 minutes old
        return diffMinutes <= 5;
    }
    
    // Initialize context menu actions
    function initContextMenuActions() {
        // Edit message action
        document.getElementById('editMessageOption')?.addEventListener('click', function() {
            if (!currentMessageElement || !currentMessageId || !currentRoomId) {
                console.error('Cannot edit message: missing context');
                return;
            }
            
            // Hide context menu
            document.getElementById('messageContextMenu').style.display = 'none';
            
            // Mark message as being edited
            currentMessageElement.classList.add('being-edited');
            
            // Create edit form
            const editForm = document.createElement('div');
            editForm.className = 'message-edit-form';
            editForm.innerHTML = `
                <textarea>${currentContent}</textarea>
                <div class="edit-actions">
                    <button class="cancel-edit">Cancel</button>
                    <button class="save-edit">Save</button>
                </div>
            `;
            
            // Insert form after message content
            const messageContent = currentMessageElement.querySelector('.message-content');
            messageContent.style.display = 'none';
            messageContent.insertAdjacentElement('afterend', editForm);
            
            // Focus textarea
            const textarea = editForm.querySelector('textarea');
            textarea.focus();
            
            // Set up cancel action
            editForm.querySelector('.cancel-edit').addEventListener('click', function() {
                messageContent.style.display = '';
                currentMessageElement.classList.remove('being-edited');
                editForm.remove();
            });
            
            // Set up save action
            editForm.querySelector('.save-edit').addEventListener('click', function() {
                const updatedContent = textarea.value.trim();
                
                if (!updatedContent) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Message cannot be empty!'
                    });
                    return;
                }
                
                if (updatedContent === currentContent) {
                    // No changes, just cancel
                    messageContent.style.display = '';
                    currentMessageElement.classList.remove('being-edited');
                    editForm.remove();
                    return;
                }
                
                // Send update to server using API or WebSocket
                if (window.shrekChatWebSocket) {
                    window.shrekChatWebSocket.updateMessage(
                        currentRoomId,
                        currentMessageId,
                        updatedContent,
                        function(success) {
                            if (success) {
                                // Update message content
                                messageContent.textContent = updatedContent;
                                messageContent.classList.add('edited');
                                
                                // Clean up
                                messageContent.style.display = '';
                                currentMessageElement.classList.remove('being-edited');
                                editForm.remove();
                            }
                        }
                    );
                } else {
                    // Fallback to REST API
                    fetch(`/api/messages/${currentMessageId}/edit`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: updatedContent
                        })
                    })
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to update message');
                        return response.json();
                    })
                    .then(data => {
                        // Update message content
                        messageContent.textContent = updatedContent;
                        messageContent.classList.add('edited');
                        
                        // Clean up
                        messageContent.style.display = '';
                        currentMessageElement.classList.remove('being-edited');
                        editForm.remove();
                    })
                    .catch(error => {
                        console.error('Error updating message:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Oops...',
                            text: 'Failed to update message. Please try again.'
                        });
                    });
                }
            });
        });
        
        // Copy message action
        document.getElementById('copyMessageOption')?.addEventListener('click', function() {
            if (!currentContent) {
                console.error('Cannot copy message: missing content');
                document.getElementById('messageContextMenu').style.display = 'none';
                return;
            }
            
            // Hide context menu
            document.getElementById('messageContextMenu').style.display = 'none';
            
            // Copy to clipboard using modern API
            if (navigator.clipboard) {
                navigator.clipboard.writeText(currentContent)
                    .then(() => showToast('Message copied to clipboard'))
                    .catch(err => {
                        console.error('Could not copy text: ', err);
                        // Fallback
                        copyTextFallback(currentContent);
                    });
            } else {
                // Fallback for browsers without clipboard API
                copyTextFallback(currentContent);
            }
        });
        
        // Delete message action
        document.getElementById('deleteMessageOption')?.addEventListener('click', function() {
            if (!currentMessageElement || !currentMessageId || !currentRoomId) {
                console.error('Cannot delete message: missing context');
                return;
            }
            
            // Hide context menu
            document.getElementById('messageContextMenu').style.display = 'none';
            
            // SweetAlert confirmation for delete
            Swal.fire({
                title: 'Are you sure?',
                text: 'You won\'t be able to revert this!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Send delete request to server
                    if (window.shrekChatWebSocket) {
                        window.shrekChatWebSocket.deleteMessage(
                            currentRoomId,
                            currentMessageId,
                            function(success) {
                                if (success) {
                                    // Remove message from UI
                                    currentMessageElement.remove();
                                    Swal.fire('Deleted!', 'Your message has been deleted.', 'success');
                                }
                            }
                        );
                    } else {
                        // Fallback to REST API
                        fetch(`/api/messages/${currentMessageId}`, {
                            method: 'DELETE'
                        })
                        .then(response => {
                            if (!response.ok) throw new Error('Failed to delete message');
                            return response.json();
                        })
                        .then(data => {
                            // Remove message from UI
                            currentMessageElement.remove();
                            Swal.fire('Deleted!', 'Your message has been deleted.', 'success');
                        })
                        .catch(error => {
                            console.error('Error deleting message:', error);
                            Swal.fire('Error!', 'Failed to delete message. Please try again.', 'error');
                        });
                    }
                }
            });
        });
    }
    
    // Helper function: fallback method for copying text
    function copyTextFallback(text) {
        // Create temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';  // Avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            // Execute copy command
            const successful = document.execCommand('copy');
            if (successful) {
                showToast('Message copied to clipboard');
            } else {
                console.error('Copy command was unsuccessful');
            }
        } catch (err) {
            console.error('Could not execute copy command', err);
        }
        
        // Clean up
        document.body.removeChild(textArea);
    }
    
    // Helper function: show a toast notification
    function showToast(message, duration = 2000) {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999;
            `;
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        toast.style.cssText = `
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            margin-top: 10px;
            animation: fadeInOut ${duration}ms ease-in-out;
        `;
        
        // Add animation if it doesn't exist
        if (!document.getElementById('toastAnimation')) {
            const style = document.createElement('style');
            style.id = 'toastAnimation';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add toast to container
        toastContainer.appendChild(toast);
        
        // Remove toast after duration
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }
    
    // Initialize the context menu functionality
    function initialize() {
        createContextMenu();
        addContextMenuToMessages();
        initContextMenuActions();
        
        // Re-initialize context menu when messages are loaded or added
        // This ensures that new messages also get the context menu functionality
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // If messages were added, re-apply the context menu
                    addContextMenuToMessages();
                }
            });
        });
        
        // Start observing chat messages area for changes
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            observer.observe(chatMessages, { childList: true });
        }
        
        // Expose functions for use in other modules
        window.shrekChatContextMenu = {
            addContextMenuToMessages: addContextMenuToMessages
        };
    }
    
    // Initialize on page load
    initialize();
});

// Message context menu event listener to remove deleted messages from view
window.addEventListener('message-deleted', function(e) {
    const messageId = e.detail.messageId;
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    
    if (messageElement) {
        // Fade out and remove
        messageElement.style.opacity = '0';
        setTimeout(() => {
            messageElement.remove();
        }, 300);
    }
});

// Message context menu event listener to update edited messages
window.addEventListener('message-updated', function(e) {
    const {messageId, content} = e.detail;
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    
    if (messageElement) {
        const contentElement = messageElement.querySelector('.message-content');
        if (contentElement) {
            contentElement.textContent = content;
            contentElement.classList.add('edited');
        }
    }
});