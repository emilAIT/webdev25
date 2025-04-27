/**
 * Shared utility functions for Blink
 */

// Format a date into time string (HH:MM)
function formatTime(date) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
}

// Format a date for display in chat header (Today, Yesterday, or DD-MM-YY)
function formatDateForChat(dateStr) {
    // If no date string is provided, return empty string
    if (!dateStr) return '';
    
    // Parse the date string (assuming ISO format or similar)
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return ''; // Invalid date
    }
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset hours, minutes, seconds and milliseconds for today and yesterday
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    
    // Create a date object from the input date with time part removed
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    // Check if date is today
    if (compareDate.getTime() === today.getTime()) {
        return 'Today';
    }
    
    // Check if date is yesterday
    if (compareDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    }
    
    // Format as DD-MM-YY for other dates
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
    
    return `${day}-${month}-${year}`;
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Update display of message status indicators
function updateMessageStatus(messageId, status) {
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageElement) {
        const messageStatusSingle = messageElement.querySelector('.message-status-single');
        const messageStatusDouble = messageElement.querySelector('.message-status-double');
        
        if (messageStatusSingle && messageStatusDouble) {
            if (status === 'delivered') {
                messageStatusDouble.style.display = 'inline';
                messageStatusDouble.classList.remove('read');
                messageStatusSingle.style.display = 'none';
            } else if (status === 'read') {
                messageStatusDouble.style.display = 'inline';
                messageStatusDouble.classList.add('read');
                messageStatusSingle.style.display = 'none';
            }
        }
    } else {
        // Message element not found in DOM - might be an old message that's not currently visible
        // Store this status update to apply when the message becomes visible
        if (!window.pendingMessageStatuses) {
            window.pendingMessageStatuses = {};
        }
        window.pendingMessageStatuses[messageId] = status;
        console.log(`Stored pending status update for message ${messageId}: ${status}`);
    }
}

// Update a contact's online status in the UI
function updateContactStatus(userId, status) {
    const contactElement = document.querySelector(`.contact-item[data-user-id="${userId}"]`);
    if (contactElement) {
        const statusIndicator = contactElement.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }
        
        // Also update the chat header if this is the current contact
        const chatContactStatus = document.getElementById('chatContactPresence');
        const chatHeader = document.getElementById('chatHeader');
        const currentUserId = parseInt(document.querySelector('.chat-area')?.getAttribute('data-current-user-id'));
        
        if (currentUserId === userId && chatContactStatus && chatHeader) {
            const headerStatusIndicator = chatHeader.querySelector('.status-indicator');
            if (headerStatusIndicator) {
                headerStatusIndicator.className = `status-indicator ${status}`;
            }
            chatContactStatus.textContent = status === 'online' ? 'Online' : 'Offline';
            
            const newStatusIndicator = document.createElement('span');
            newStatusIndicator.className = `status-indicator ${status}`;
            chatContactStatus.prepend(newStatusIndicator);
        }
    }
}

// Update the last message preview in a chat contact list item
function updateLastMessage(roomId, message, time) {
    const contactElement = document.querySelector(`.contact-item[data-room-id="${roomId}"]`);
    
    if (contactElement) {
        const lastMessageElement = contactElement.querySelector('.last-message');
        const messageTimeElement = contactElement.querySelector('.message-time');
        
        if (lastMessageElement) {
            const displayMessage = message.length > 30 ? message.substring(0, 27) + '...' : message;
            lastMessageElement.textContent = displayMessage;
        }
        
        if (messageTimeElement) {
            messageTimeElement.textContent = time;
        }
        
        // Move this contact to the top of the list
        const parentElement = contactElement.parentElement;
        if (parentElement) {
            parentElement.insertBefore(contactElement, parentElement.firstChild);
        }
    }
}

// Increment the unread message count badge for a room
function incrementUnreadCount(roomId) {
    const contactElement = document.querySelector(`.contact-item[data-room-id="${roomId}"]`);
    
    if (contactElement) {
        let unreadCount = contactElement.querySelector('.unread-count');
        
        if (unreadCount) {
            const count = parseInt(unreadCount.textContent) + 1;
            unreadCount.textContent = count;
        } else {
            unreadCount = document.createElement('div');
            unreadCount.className = 'unread-count';
            unreadCount.textContent = '1';
            contactElement.appendChild(unreadCount);
        }
        
        // Move this contact to the top of the list
        const parentElement = contactElement.parentElement;
        if (parentElement) {
            parentElement.insertBefore(contactElement, parentElement.firstChild);
        }
    }
}

// Menu button click handler
document.addEventListener('DOMContentLoaded', () => {
    const menuButton = document.getElementById('menuButton');
    const contextMenu = document.getElementById('contextMenu');

    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = contextMenu.style.display === 'block' ? 'none' : 'block';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target) && e.target !== menuButton) {
            contextMenu.style.display = 'none';
        }
    });

    // Friends display click handler
    friendsDisplay.addEventListener('click', () => {
        friendsModal.style.display = 'flex'; // Changed to flex for centering
        contextMenu.style.display = 'none'; // Hide the context menu after selection
    });

    // Close friends modal when clicking the close button
    closeFriendsModal.addEventListener('click', () => {
        friendsModal.style.display = 'none';
    });

    // Close friends modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === friendsModal) {
            friendsModal.style.display = 'none';
        }
    });
});

// Export all utility functions
window.BlinkUtils = {
    formatTime,
    formatDateForChat,
    debounce,
    updateMessageStatus,
    updateContactStatus,
    updateLastMessage,
    incrementUnreadCount
};