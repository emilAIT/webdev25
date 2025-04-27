/**
 * API communication functions for interacting with the server
 */

/**
 * Fetch current user information
 */
function fetchCurrentUser() {
  return fetch('/get_current_user_info', {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to load user info');
    return response.json();
  })
  .then(data => {
    // Store user info in app state
    ChatApp.currentUser = data;
    return data;
  });
}

/**
 * Get user information by ID
 */
function getUserInfo(userId) {
  return fetch(`/get_user_info?user_id=${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to load user info');
    return response.json();
  });
}

/**
 * Check if a user is in contacts
 */
function checkContactStatus(userId) {
  return fetch('/check_contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contact_id: userId })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to check contact status');
    return response.json();
  })
  .then(data => {
    return data.is_contact;
  })
  .catch(error => {
    console.error('Error checking contact status:', error);
    return false;
  });
}

/**
 * Check if the user is blocked
 */
function checkBlockStatus(userId) {
  return fetch('/check_block_status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_id: userId })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to check block status');
    return response.json();
  })
  .then(data => {
    return {
      isBlockedByYou: data.is_blocked_by_you,
      hasBlockedYou: data.has_blocked_you
    };
  })
  .catch(error => {
    console.error('Error checking block status:', error);
    return { isBlockedByYou: false, hasBlockedYou: false };
  });
}

/**
 * Block a user
 */
function blockUser(userId) {
  return fetch('/block_user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_id: userId })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to block user');
    return response.json();
  });
}

/**
 * Unblock a user
 */
function unblockUser(userId) {
  return fetch('/unblock_user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_id: userId })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to unblock user');
    return response.json();
  });
}

/**
 * Search users by query
 */
function searchUsers(query) {
  return fetch(`/search_users?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  });
}

/**
 * Load message history
 */
function fetchMessages(userId) {
  return fetch(`/get_messages?user_id=${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to load messages');
    return response.json();
  });
}

/**
 * Send a message
 */
function sendMessage(recipientId, content) {
  return fetch('/send_message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient_id: recipientId,
      content: content
    })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  });
}

/**
 * Edit a message
 */
function editMessage(messageId, content) {
  return fetch('/edit_message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message_id: messageId,
      content: content
    })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to edit message');
    return response.json();
  });
}

/**
 * Get recent conversations
 */
function fetchRecentConversations() {
  return fetch('/get_recent_conversations', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to load conversations');
    return response.json();
  });
}

/**
 * Get chat list
 */
function fetchChatList() {
  console.log('REQUESTING: GET /get_chat_list');
  
  return fetch('/get_chat_list', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    console.log(`Response status: ${response.status}`);
    if (!response.ok) {
      console.error(`Chat list request failed with status: ${response.status}`);
      throw new Error('Failed to load chats');
    }
    return response.json();
  })
  .then(data => {
    // Log the entire response data
    console.log('RECEIVED CHATS DATA:', JSON.stringify(data, null, 2));
    
    // Inspect each chat to see if timestamps exist
    if (data.chats && Array.isArray(data.chats)) {
      data.chats.forEach((chat, index) => {
        console.log(`Chat ${index + 1} - ${chat.name}:`);
        console.log(`  has last_message_timestamp: ${!!chat.last_message_timestamp}`);
        console.log(`  has last_message object: ${typeof chat.last_message === 'object' && chat.last_message !== null}`);
        if (chat.last_message && typeof chat.last_message === 'object') {
          console.log(`  has last_message.timestamp: ${!!chat.last_message.timestamp}`);
        }
        console.log(`  has timestamp: ${!!chat.timestamp}`);
      });
    }
    
    return data;
  })
  .catch(error => {
    console.error('Error fetching chat list:', error);
    throw error;
  });
}

/**
 * Update user profile
 */
function updateProfile(formData) {
  return fetch('/update_profile', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
  });
}

/**
 * Upload avatar
 */
function uploadAvatar(file) {
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error('File size exceeds 5MB limit'));
  }
  
  // Create form data
  const formData = new FormData();
  formData.append('avatar', file);
  
  // Send to server
  return fetch('/upload_avatar', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to upload avatar');
    return response.json();
  });
}

/**
 * Add a user to contacts
 */
function addToContacts(userId) {
  return fetch('/add_contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contact_id: userId })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to add contact');
    return response.json();
  });
}

/**
 * Remove a user from contacts
 */
function removeFromContacts(userId) {
  return fetch('/remove_contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contact_id: userId })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to remove contact');
    return response.json();
  });
}

/**
 * Get user's groups
 */
function fetchUserGroups() {
  return fetch('/get_user_groups', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    if (!response.ok) {
      console.error(`User groups request failed with status: ${response.status}`);
      throw new Error('Failed to load groups');
    }
    return response.json();
  })
  .catch(error => {
    console.error('Error fetching user groups:', error);
    throw error;
  });
}

/**
 * Get group information
 */
function getGroupInfo(groupId) {
  return fetch(`/get_group_info?group_id=${groupId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error fetching group info:', error);
      return { success: false, error: 'Failed to get group information' };
    });
}

/**
 * Fetch messages for a group
 */
function fetchGroupMessages(groupId) {
  return fetch(`/get_group_messages?group_id=${groupId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error fetching group messages:', error);
      return { success: false, error: 'Failed to load group messages' };
    });
}

/**
 * Send a message to a group
 */
function sendGroupMessage(groupId, text) {
  return fetch('/send_group_message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      group_id: groupId,
      content: text
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .catch(error => {
    console.error('Error sending group message:', error);
    return { success: false, error: 'Failed to send message' };
  });
}

/**
 * Edit a group message
 */
function editGroupMessage(messageId, content) {
  return fetch('/edit_group_message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message_id: messageId,
      content: content
    })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to edit message');
    return response.json();
  });
}

/**
 * Fetch contacts list
 */
function fetchContacts() {
  return fetch('/get_contacts', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    if (!response.ok) {
      console.error(`Contacts request failed with status: ${response.status}`);
      throw new Error('Failed to load contacts');
    }
    return response.json();
  })
  .catch(error => {
    console.error('Error fetching contacts:', error);
    throw error;
  });
}

/**
 * Delete all messages in a chat between current user and another user
 */
function deleteChat(userId) {
  return fetch('/delete_chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  }).then(r => r.json());
}
