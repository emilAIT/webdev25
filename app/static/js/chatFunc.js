/**
 * Enhanced Chat Functionality for Blink
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
                <button class="menu-button edit-message" id="editMessageOption">
                    <img src="/static/images/edit.png" alt="Edit">
                    Edit
                </button>
                <button class="menu-button copy-message" id="copyMessageOption">
                    <img src="/static/images/copy.png" alt="Copy">
                    Copy text
                </button>
                <button class="menu-button delete-message" id="deleteMessageOption">
                    <img src="/static/images/trashbin.png" alt="Delete">
                    Delete
                </button>
            `;
            
            document.body.appendChild(messageContextMenu);
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
            
            // Always show the edit option
            const editOption = document.getElementById('editMessageOption');
            if (editOption) {
                editOption.style.display = 'flex';
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
                
                // Always show the edit option
                const editOption = document.getElementById('editMessageOption');
                if (editOption) {
                    editOption.style.display = 'flex';
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
    
    // Helper function: show notification
    function showToast(message) {
        alert(message);
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
                    alert('Message cannot be empty!');
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
                if (window.BlinkWebSocket) {
                    window.BlinkWebSocket.updateMessage(
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
                        alert('Failed to update message. Please try again.');
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
                    .then(() => alert('Message copied to clipboard'))
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
            
            if (confirm('Are you sure? You won\'t be able to revert this!')) {
                // Send delete request to server
                if (window.BlinkWebSocket) {
                    window.BlinkWebSocket.deleteMessage(
                        currentRoomId,
                        currentMessageId,
                        function(success) {
                            if (success) {
                                // Remove message from UI
                                currentMessageElement.remove();
                                alert('Message deleted successfully');
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
                        alert('Message deleted successfully');
                    })
                    .catch(error => {
                        console.error('Error deleting message:', error);
                        alert('Failed to delete message. Please try again.');
                    });
                }
            }
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
                alert('Message copied to clipboard');
            } else {
                console.error('Copy command was unsuccessful');
            }
        } catch (err) {
            console.error('Could not execute copy command', err);
        }
        
        // Clean up
        document.body.removeChild(textArea);
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
        window.BlinkContextMenu = {
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