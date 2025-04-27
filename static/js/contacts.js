/**
 * Contact management functions
 */

/**
 * Load user contacts, groups and chats
 */
function loadSidebar() {
  console.log('Loading sidebar data');
  
  // Load contacts, groups and chats
  Promise.all([fetchContacts(), fetchUserGroups(), fetchChatList()])
    .then(([contactsData, groupsData, chatsData]) => {
      console.log('Contacts data:', contactsData);
      console.log('Groups data:', groupsData);
      console.log('Chats data:', chatsData);
      
      // Store data in app state
      if (contactsData.contacts) {
        ChatApp.contacts = contactsData.contacts;
      }
      
      if (groupsData.success && groupsData.groups) {
        ChatApp.groups = groupsData.groups;
      } else {
        ChatApp.groups = [];
      }
      
      if (chatsData.chats) {
        ChatApp.chats = chatsData.chats;
      }
      
      // Render sidebar items
      renderSidebar(ChatApp.contacts, ChatApp.groups, ChatApp.chats);
    })
    .catch(error => {
      console.error('Error loading sidebar data:', error);
      showErrorNotification('Failed to load contacts and chats');
    });
}

/**
 * Render the sidebar with contacts, groups and chats
 */
function renderSidebar(contacts, groups, chats) {
  const contactsList = document.getElementById('contactsList');
  const noContactsMessage = document.querySelector('.no-contacts-message'); // Keep this reference
  
  if (!contactsList) return;
  
  // Clear existing items
  contactsList.innerHTML = '';
  
  // Combine groups and chats into a single list for rendering under one section
  const allChatItems = [];
  
  // Add groups to the list
  if (groups && groups.length > 0) {
    groups.forEach(group => {
      allChatItems.push({ type: 'group', data: group });
    });
  }
  
  // Add chats to the list
  if (chats && chats.length > 0) {
    chats.forEach(chat => {
      allChatItems.push({ type: 'chat', data: chat });
    });
  }
  
  // Sort combined list (optional, e.g., by last activity)
  // For now, groups will appear first, then chats
  
  // Create a single "Chats" section
  const chatSection = document.createElement('div');
  chatSection.className = 'sidebar-section chats-section'; // Keep class for potential styling
  
  const chatTitle = document.createElement('div');
  chatTitle.className = 'section-title';
  chatTitle.textContent = 'Chats'; // Use a single title
  chatSection.appendChild(chatTitle);
  
  // Add all items (groups and chats) to this section
  if (allChatItems.length > 0) {
    allChatItems.forEach(item => {
      let element;
      if (item.type === 'group') {
        element = createGroupElement(item.data);
      } else { // type === 'chat'
        element = createChatElement(item.data);
      }
      chatSection.appendChild(element);
    });
    
    // Hide the main "no contacts" message if it exists outside the list
    if (noContactsMessage) noContactsMessage.style.display = 'none';
    
  } else {
    // If no groups or chats, show a message within the section
    const noItemsMsg = document.createElement('div');
    noItemsMsg.className = 'no-items-message'; // Use the existing class
    noItemsMsg.textContent = 'No chats or groups yet';
    chatSection.appendChild(noItemsMsg);
    
    // Show the main "no contacts" message if it exists outside the list
    if (noContactsMessage) noContactsMessage.style.display = 'block';
  }
  
  // Append the single section to the list
  contactsList.appendChild(chatSection);
  
  // Remove the logic for the separator as there's only one section now
}

/**
 * Create a group element
 */
function createGroupElement(group) {
  const groupItem = document.createElement('div');
  groupItem.className = 'contact-item group-item';
  groupItem.dataset.groupId = group.id;
  
  // Group avatar
  const groupAvatar = document.createElement('div');
  groupAvatar.className = 'contact-avatar group-avatar';
  
  // Check if group has an avatar path
  if (group.avatar_path) {
    // Fix avatar path - ensure it starts with /static/ if needed
    let avatarSrc = group.avatar_path;
    if (!avatarSrc.startsWith('http') && !avatarSrc.startsWith('/static/')) {
      avatarSrc = `/static/${avatarSrc}`;
    }
    groupAvatar.innerHTML = `<img src="${avatarSrc}" alt="${group.name}" class="avatar-image">`;
  } else {
    // For numeric group names, use 'G' as the initial instead of a number
    const isNumericOnly = /^\d+$/.test(group.name);
    const initial = isNumericOnly ? 'G' : group.name.charAt(0);
    groupAvatar.innerHTML = `<div class="avatar-initials">${initial}</div>`;
  }
  
  // Group info
  const groupInfo = document.createElement('div');
  groupInfo.className = 'contact-info';
  
  // Header row with name and group indicator
  const headerRow = document.createElement('div');
  headerRow.className = 'contact-header-row';
  
  const groupName = document.createElement('div');
  groupName.className = 'contact-name';
  groupName.textContent = group.name;
  
  const groupIndicator = document.createElement('span');
  groupIndicator.className = 'contact-indicator group-indicator';
  groupIndicator.textContent = 'G';
  groupIndicator.setAttribute('data-tooltip', 'Group chat');
  groupIndicator.addEventListener('mouseenter', showTooltip);
  groupIndicator.addEventListener('mouseleave', hideTooltip);
  
  headerRow.appendChild(groupName);
  headerRow.appendChild(groupIndicator);
  
  // Details row with message preview and time
  const detailsRow = document.createElement('div');
  detailsRow.className = 'contact-details-row';
  
  const lastMessagePreview = document.createElement('div');
  lastMessagePreview.className = 'message-preview';
  
  const lastTime = document.createElement('div');
  lastTime.className = 'message-time';
  
  if (group.last_message) {
    // Format message preview
    let messagePreviewText = group.last_message.content;
    if (messagePreviewText.length > 25) {
      messagePreviewText = messagePreviewText.substring(0, 25) + '...';
    }
    const senderName = group.last_message.sender_name || 'Someone';
    lastMessagePreview.textContent = `${senderName}: ${messagePreviewText}`;
    lastTime.textContent = formatMessageTime(group.last_message.timestamp);
  } else {
    lastMessagePreview.textContent = `${group.member_count || 0} members`;
    lastTime.textContent = '';
  }
  
  detailsRow.appendChild(lastMessagePreview);
  detailsRow.appendChild(lastTime);
  
  // Assemble the group item
  groupInfo.appendChild(headerRow);
  groupInfo.appendChild(detailsRow);
  
  groupItem.appendChild(groupAvatar);
  groupItem.appendChild(groupInfo);
  
  // Unread badge
  if (group.unread_count && group.unread_count > 0) {
    const unreadBadge = document.createElement('div');
    unreadBadge.className = 'unread-badge';
    unreadBadge.textContent = group.unread_count;
    groupItem.appendChild(unreadBadge);
  }
  
  // Add click handler
  groupItem.addEventListener('click', () => {
    openGroupChat(group.id, group.name);
  });
  
  return groupItem;
}

/**
 * Create a contact element
 */
function createContactElement(contact) {
  const contactItem = document.createElement('div');
  contactItem.className = 'contact-item';
  contactItem.dataset.contactId = contact.id;
  
  // Avatar
  const contactAvatar = document.createElement('div');
  contactAvatar.className = 'contact-avatar';
  
  if (contact.avatar_path) {
    contactAvatar.innerHTML = `<img src="${contact.avatar_path}" alt="${contact.name}">`;
  } else {
    contactAvatar.innerHTML = `<div class="avatar-initials">${contact.name.charAt(0)}</div>`;
  }
  
  // Contact info
  const contactInfo = document.createElement('div');
  contactInfo.className = 'contact-info';
  
  const contactName = document.createElement('div');
  contactName.className = 'contact-name';
  
  // Add "C" indicator for contacts
  contactName.innerHTML = `${contact.name} <span class="contact-indicator">C</span>`;
  
  // Assemble elements
  contactInfo.appendChild(contactName);
  
  contactItem.appendChild(contactAvatar);
  contactItem.appendChild(contactInfo);
  
  // Add click handler
  contactItem.addEventListener('click', () => {
    openChatWithUser(contact.id, contact.name);
  });
  
  return contactItem;
}

/**
 * Create a chat element
 */
function createChatElement(chat) {
  const chatItem = document.createElement('div');
  chatItem.className = 'contact-item';
  chatItem.dataset.userId = chat.user_id;

  // Avatar
  const chatAvatar = document.createElement('div');
  chatAvatar.className = 'contact-avatar';
  if (chat.avatar_path) {
    chatAvatar.innerHTML = `<img src="${chat.avatar_path}" alt="${chat.name}">`;
  } else {
    chatAvatar.innerHTML = `<div class="avatar-initials">${chat.name.charAt(0)}</div>`;
  }

  // Contact info container
  const chatInfo = document.createElement('div');
  chatInfo.className = 'contact-info';
  
  // Header row with name and indicator
  const headerRow = document.createElement('div');
  headerRow.className = 'contact-header-row';
  
  const chatName = document.createElement('div');
  chatName.className = 'contact-name';
  chatName.textContent = chat.name;
  headerRow.appendChild(chatName);
  
  // Add appropriate indicator
  if (chat.is_blocked_by_you) {
    const indicator = document.createElement('span');
    indicator.className = 'contact-indicator blocked-indicator';
    indicator.textContent = 'B';
    indicator.setAttribute('data-tooltip', 'You have blocked this user');
    indicator.addEventListener('mouseenter', showTooltip);
    indicator.addEventListener('mouseleave', hideTooltip);
    headerRow.appendChild(indicator);
  } else if (chat.has_blocked_you) {
    const indicator = document.createElement('span');
    indicator.className = 'contact-indicator blocked-by-indicator';
    indicator.textContent = 'B';
    indicator.setAttribute('data-tooltip', 'This user has blocked you');
    indicator.addEventListener('mouseenter', showTooltip);
    indicator.addEventListener('mouseleave', hideTooltip);
    headerRow.appendChild(indicator);
  } else if (chat.is_contact) {
    const indicator = document.createElement('span');
    indicator.className = 'contact-indicator';
    indicator.textContent = 'C';
    indicator.setAttribute('data-tooltip', 'This user is in your contacts');
    indicator.addEventListener('mouseenter', showTooltip);
    indicator.addEventListener('mouseleave', hideTooltip);
    headerRow.appendChild(indicator);
  }
  
  // Details row with message preview and time
  const detailsRow = document.createElement('div');
  detailsRow.className = 'contact-details-row';
  
  const lastMessagePreview = document.createElement('div');
  lastMessagePreview.className = 'message-preview';
  if (chat.last_message) {
    lastMessagePreview.textContent = chat.last_message;
  }
  
  const lastTime = document.createElement('div');
  lastTime.className = 'message-time';
  if (chat.last_timestamp) {
    lastTime.textContent = formatMessageTime(chat.last_timestamp);
  }
  
  detailsRow.appendChild(lastMessagePreview);
  detailsRow.appendChild(lastTime);
  
  // Assemble the elements
  chatInfo.appendChild(headerRow);
  chatInfo.appendChild(detailsRow);
  
  chatItem.appendChild(chatAvatar);
  chatItem.appendChild(chatInfo);
  
  // Add unread badge if there are unread messages
  if (chat.unread_count && chat.unread_count > 0) {
    const unreadBadge = document.createElement('div');
    unreadBadge.className = 'unread-badge';
    unreadBadge.textContent = chat.unread_count;
    chatItem.appendChild(unreadBadge);
  }
  
  // Add click handler
  chatItem.addEventListener('click', () => {
    openChatWithUser(chat.user_id, chat.name);
  });
  
  return chatItem;
}

/**
 * Format message timestamp for the sidebar, similar to Telegram
 * - Shows time (HH:MM) for today
 * - Shows day of week for this week
 * - Shows date (MM/DD) for older messages
 */
function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  // Format time as HH:MM
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;
  
  // If it's today, return just the time
  if (date >= today) {
    return timeString;
  }
  
  // If it's yesterday, return "Yesterday"
  if (date >= yesterday) {
    return 'Yesterday';
  }
  
  // If it's within the last week, return day of week
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  if (date >= weekAgo) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }
  
  // For older messages, return MM/DD
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * Show tooltip when hovering over contact indicator
 */
function showTooltip(event) {
  // Remove any existing tooltips
  hideAllTooltips();
  
  const targetElement = event.currentTarget;
  const tooltipText = targetElement.getAttribute('data-tooltip');
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'dynamic-tooltip';
  tooltip.textContent = tooltipText;
  tooltip.id = 'contact-tooltip';
  document.body.appendChild(tooltip);
  
  // Position tooltip above the indicator
  const rect = targetElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  tooltip.style.left = `${centerX}px`;
  tooltip.style.top = `${rect.top - 40}px`; // Position above with some margin
}

/**
 * Hide tooltip when not hovering
 */
function hideTooltip() {
  hideAllTooltips();
}

/**
 * Helper to remove all tooltips
 */
function hideAllTooltips() {
  const existingTooltip = document.getElementById('contact-tooltip');
  if (existingTooltip) {
    document.body.removeChild(existingTooltip);
  }
}

/**
 * Handler for adding a contact
 */
function addContactHandler(userId, userName) {
  addToContacts(userId)
    .then(data => {
      if (data.success) {
        showSuccessNotification(`${userName} added to contacts`);
        loadSidebar(); // Reload to show updated contacts
        
        // Update menu in chat interface
        updateContactMenu(userId, true);
      }
    })
    .catch(error => {
      showErrorNotification('Failed to add contact. Please try again.');
    });
}

/**
 * Handler for removing a contact
 */
function removeContactHandler(userId) {
  removeFromContacts(userId)
    .then(data => {
      if (data.success) {
        showNotification('Contact removed', 'remove-contact');
        loadSidebar(); // Reload to show updated contacts
        
        // Update menu in chat interface
        updateContactMenu(userId, false);
      }
    })
    .catch(error => {
      showErrorNotification('Failed to remove contact. Please try again.');
    });
}

/**
 * Update contact menu after adding/removing contact
 */
function updateContactMenu(userId, isAdded) {
  const dropdown = document.getElementById('contactDropdownMenu');
  if (!dropdown) return;
  
  if (isAdded) {
    dropdown.innerHTML = `
      <div class="dropdown-menu-options">
        <div class="dropdown-option" id="removeContactOption">
          <div class="dropdown-option-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 7l-10 10"></path>
              <path d="M7 7l10 10"></path>
            </svg>
          </div>
          <div class="dropdown-option-label">Remove from contacts</div>
        </div>
      </div>
    `;
    
    document.getElementById('removeContactOption').addEventListener('click', function() {
      removeContactHandler(userId);
      dropdown.style.display = 'none';
    });
  } else {
    dropdown.innerHTML = `
      <div class="dropdown-menu-options">
        <div class="dropdown-option" id="addContactOption">
          <div class="dropdown-option-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14"></path>
              <path d="M5 12h14"></path>
            </svg>
          </div>
          <div class="dropdown-option-label">Add to contacts</div>
        </div>
      </div>
    `;
    
    document.getElementById('addContactOption').addEventListener('click', function() {
      const userName = document.querySelector('.chat-user-name').textContent;
      addContactHandler(userId, userName);
      dropdown.style.display = 'none';
    });
  }
}

/**
 * Handler for blocking a user
 */
function blockUserHandler(userId, userName) {
  blockUser(userId)
    .then(data => {
      if (data.success) {
        showNotification(`You have blocked ${userName}`, 'block-user');
        loadSidebar(); // Reload to show updated UI
        
        // Redirect to main screen if currently chatting with blocked user
        if (ChatApp.activeChat && ChatApp.activeChat.id == userId) {
          // Instead of clearing the interface, reopen the chat with the blocked state
          // This will ensure the header with avatar and name remains visible
          openChatWithUser(userId, userName);
        }
      }
    })
    .catch(error => {
      showErrorNotification('Failed to block user. Please try again.');
    });
}

/**
 * Handler for unblocking a user
 */
function unblockUserHandler(userId, userName) {
  unblockUser(userId)
    .then(data => {
      if (data.success) {
        showSuccessNotification(`${userName} has been unblocked`);
        loadSidebar(); // Reload to show updated UI
        
        // If we're in the block message screen, reload the chat
        const blockMessage = document.querySelector('.block-message');
        if (blockMessage && ChatApp.activeChat && ChatApp.activeChat.id == userId) {
          openChatWithUser(userId, userName);
        }
      }
    })
    .catch(error => {
      showErrorNotification('Failed to unblock user. Please try again.');
    });
}
