let currentUser = null;
let currentChatTarget = null;
let currentChatIsGroup = false;
let allUsers = {}; // Cache for user details { id: { username, is_online, last_seen, unread_count } }
let allGroups = {}; // Cache for group details { id: { group_name, description, unread_count, avatar_url } }
let groupTypingUsers = {}; // { groupId: { userId: { username, timeoutId } } }
let typingTimeout = null; // For user's own typing debounce

// --- NEW: Unified Chat List State --- 
let combinedChatList = []; // Array of { id, type: 'user'|'group', name, avatarUrl, lastMessageTimestamp, lastMessagePreview, unreadCount, isOnline (for users), lastSeen (for users) }

// --- User State ---
export function setCurrentUser(user) {
  currentUser = user;
}
export function getCurrentUser() {
  return currentUser;
}
export function getCurrentUserId() {
    return currentUser ? currentUser.id : null;
}
export function getCurrentUsername() {
    return currentUser ? currentUser.username : 'Me';
}

// --- Chat Target State ---
export function setCurrentChatTarget(targetId, isGroup) {
  currentChatTarget = targetId;
  currentChatIsGroup = isGroup;
}
export function getCurrentChatTarget() {
  return currentChatTarget;
}
export function isGroupChat() {
  return currentChatIsGroup;
}

// --- User Cache (Keep for user details lookup) ---
export function setContacts(contacts) {
    allUsers = contacts.reduce((acc, user) => {
        // Ensure essential fields exist even if API doesn't send them initially
        acc[user.id] = {
            id: user.id,
            username: user.username,
            is_online: user.is_online || false,
            last_seen: user.last_seen || null,
            unread_count: user.unread_count || 0,
            ...user // Include any other properties from the API
        };
        return acc;
    }, {});
}
export function getContacts() {
    return Object.values(allUsers);
}
export function getUser(userId) {
    return allUsers[userId];
}
export function getUsername(userId) {
    return allUsers[userId]?.username;
}
export function updateUserState(userId, isOnline, lastSeen) {
    if (allUsers[userId]) {
        allUsers[userId].is_online = isOnline;
        allUsers[userId].last_seen = lastSeen;
    } else {
        console.warn(`Tried to update status for unknown user ID: ${userId}`);
        // Optionally fetch user details if unknown?
    }
}
export function incrementUserUnreadCount(userId) {
    if (allUsers[userId]) {
        allUsers[userId].unread_count = (allUsers[userId].unread_count || 0) + 1;
    }
}
export function resetUserUnreadCount(userId) {
    if (allUsers[userId]) {
        allUsers[userId].unread_count = 0;
    }
}
export function getUserUnreadCount(userId) {
    return allUsers[userId]?.unread_count || 0;
}
export function addContactToState(contact) {
     if (!allUsers[contact.id]) {
         allUsers[contact.id] = {
             id: contact.id,
             username: contact.username,
             is_online: contact.is_online || false,
             last_seen: contact.last_seen || null,
             unread_count: contact.unread_count || 0,
             ...contact
         };
     }
}

// --- Group Cache (Keep for group details lookup) ---
export function setGroups(groups) {
    allGroups = groups.reduce((acc, group) => {
        acc[group.id] = {
            id: group.id,
            group_name: group.group_name,
            description: group.description || '',
            unread_count: group.unread_count || 0, // Initialize if needed
            avatar_url: group.avatar_url || '',
             ...group
        };
        return acc;
    }, {});
}
export function getGroups() {
    return Object.values(allGroups);
}
export function getGroup(groupId) {
    return allGroups[groupId];
}
export function getGroupName(groupId) {
    return allGroups[groupId]?.group_name;
}
export function incrementGroupUnreadCount(groupId) {
    if (allGroups[groupId]) {
        allGroups[groupId].unread_count = (allGroups[groupId].unread_count || 0) + 1;
    }
}
export function resetGroupUnreadCount(groupId) {
    if (allGroups[groupId]) {
        allGroups[groupId].unread_count = 0;
    }
}
export function getGroupUnreadCount(groupId) {
    return allGroups[groupId]?.unread_count || 0;
}
export function addGroupToState(group) {
    if (!allGroups[group.id]) {
        allGroups[group.id] = {
             id: group.id,
             group_name: group.group_name,
             description: group.description || '',
             unread_count: 0,
             avatar_url: group.avatar_url || '',
              ...group
        };
    }
}

// --- NEW: Unified Chat List Management ---

// Initialize or update the combined list from fetched contacts and groups
// This won't have last message data initially, sorting will happen dynamically
export function initializeCombinedList(contacts, groups) {
    const userItems = (contacts || []).map(user => ({
        id: user.id,
        type: 'user',
        name: user.username,
        avatarUrl: user.avatar_url || 'assets/images/default-avatar.png',
        lastMessageTimestamp: null, // Will be updated by WS
        lastMessagePreview: 'No messages yet',
        unreadCount: user.unread_count || 0,
        isOnline: user.is_online || false,
        lastSeen: user.last_seen || null
    }));

    const groupItems = (groups || []).map(group => ({
        id: group.id,
        type: 'group',
        name: group.group_name,
        avatarUrl: group.avatar_url || 'assets/svg/group-avatar.svg',
        lastMessageTimestamp: null, // Will be updated by WS
        lastMessagePreview: 'No messages yet',
        unreadCount: group.unread_count || 0,
        // Group specific fields if any
    }));

    combinedChatList = [...userItems, ...groupItems];
    // Initial sort (e.g., alphabetically) might be helpful before first message
    combinedChatList.sort((a, b) => a.name.localeCompare(b.name)); 
    console.log("Initialized combined chat list:", combinedChatList);
}

// Update an item in the list when a message arrives
export function updateChatItemOnMessage(targetId, isGroup, message) {
    const itemIndex = combinedChatList.findIndex(item => 
        item.id === targetId && item.type === (isGroup ? 'group' : 'user')
    );
    
    if (itemIndex === -1) {
        console.warn(`Chat item not found in combined list for ID: ${targetId}, isGroup: ${isGroup}`);
        // TODO: Potentially add the item if it's a new contact/group?
        return;
    }

    const item = combinedChatList[itemIndex];
    item.lastMessageTimestamp = message.timestamp; // Use the message timestamp
    
    // Create preview text
    let previewText = '';
    const senderName = message.sender_id === getCurrentUserId() ? 'You:' : (getUser(message.sender_id)?.username || 'Someone') + ':';
    
    if (message.media_type === 'image') {
        previewText = `${senderName} [Image]`;
    } else if (message.media_type === 'video') {
        previewText = `${senderName} [Video]`;
    } else if (message.media_type === 'audio') {
        previewText = `${senderName} [Audio]`;
    } else if (message.media_type === 'document' || message.media_filename) {
        previewText = `${senderName} ${message.media_filename || '[File]'}`;
    } else if (message.content) {
        previewText = `${senderName} ${message.content}`;
    } else {
        previewText = '[Empty Message]'; // Fallback for empty content and no media
    }
    item.lastMessagePreview = previewText.substring(0, 50); // Limit preview length

    // Update unread count if message is *not* for the currently active chat
    const isActiveChat = getCurrentChatTarget() === targetId && isGroupChat() === isGroup;
    if (!isActiveChat && message.sender_id !== getCurrentUserId()) { // Don't increment for own messages
        item.unreadCount = (item.unreadCount || 0) + 1;
    }

    console.log(`Updated chat item [${item.type}-${item.id}]:`, item);
}

// NEW: Update only the preview text for a chat item
export function updateChatItemPreview(targetId, isGroup, previewText) {
    const item = combinedChatList.find(item => 
        item.id === targetId && item.type === (isGroup ? 'group' : 'user')
    );
    if (item) {
        item.lastMessagePreview = previewText.substring(0, 50); // Limit length
        // Optionally update timestamp to now to bump it in the list?
        // item.lastMessageTimestamp = new Date().toISOString(); 
    }
}

// Reset unread count for a specific chat item
export function resetChatItemUnreadCount(targetId, isGroup) {
    const item = combinedChatList.find(item => 
        item.id === targetId && item.type === (isGroup ? 'group' : 'user')
    );
    if (item) {
        item.unreadCount = 0;
    }
}

// Update user status within the combined list item
export function updateChatItemUserStatus(userId, isOnline, lastSeen) {
    const item = combinedChatList.find(item => item.id === userId && item.type === 'user');
    if (item) {
        item.isOnline = isOnline;
        item.lastSeen = lastSeen;
    } else {
        // User might not be in the chat list (not a contact)
        console.log(`User ${userId} status update ignored, not in combined list.`);
    }
}

// Get the combined list, sorted by last message timestamp (most recent first)
export function getCombinedSortedChatList() {
    // Filter out items with no last message timestamp for initial sort stability
    // Or assign a very old default timestamp if needed
    combinedChatList.sort((a, b) => {
        const timeA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
        const timeB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
        return timeB - timeA; // Descending order (newest first)
    });
    return combinedChatList;
}

// Function to update group details (name, avatar) in the combined list
export function updateGroupInCombinedList(updatedGroup) {
    const itemIndex = combinedChatList.findIndex(item => item.id === updatedGroup.id && item.type === 'group');
    if (itemIndex !== -1) {
        combinedChatList[itemIndex].name = updatedGroup.group_name;
        combinedChatList[itemIndex].avatarUrl = updatedGroup.avatar_url || 'assets/svg/group-avatar.svg';
        // Note: Description isn't stored in the list item directly
    }
}

// Remove group from the main group cache
export function removeGroupFromState(groupId) {
    if (allGroups[groupId]) {
        delete allGroups[groupId];
        console.log(`Removed group ${groupId} from main state cache.`);
    }
}

// Remove group from the combined list
export function removeGroupFromCombinedList(groupId) {
    const initialLength = combinedChatList.length;
    combinedChatList = combinedChatList.filter(item => !(item.type === 'group' && item.id === groupId));
    if (combinedChatList.length < initialLength) {
         console.log(`Removed group ${groupId} from combined chat list.`);
    }
}

// --- Typing State ---
export function setTypingTimeout(timeoutId) {
    typingTimeout = timeoutId;
}
export function getTypingTimeout() {
    return typingTimeout;
}
export function clearTypingTimeout() {
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
}

export function updateGroupTypingUser(groupId, userId, username) {
     if (!groupTypingUsers[groupId]) groupTypingUsers[groupId] = {};

     const existingUserTyping = groupTypingUsers[groupId][userId];
     if (existingUserTyping) {
         clearTimeout(existingUserTyping.timeoutId); // Clear previous timeout
     }
     // Add/update user typing status with a new timeout
     groupTypingUsers[groupId][userId] = {
         username: username,
         timeoutId: setTimeout(() => {
             removeGroupTypingUser(groupId, userId);
             // Need to notify main.js/uiService to update the indicator
             // This might require an event emitter or callback mechanism later
         }, 3000) // Clear after 3 seconds of inactivity
     };
}

export function removeGroupTypingUser(groupId, userId) {
    if (groupTypingUsers[groupId]?.[userId]) {
        clearTimeout(groupTypingUsers[groupId][userId].timeoutId);
        delete groupTypingUsers[groupId][userId];
    }
}

export function getGroupTypingUsers(groupId) {
    return groupTypingUsers[groupId] ? Object.values(groupTypingUsers[groupId]) : [];
}

export function clearTypingUserFromGroupOnMessage(groupId, userId) {
    if (groupTypingUsers[groupId]?.[userId]) {
        clearTimeout(groupTypingUsers[groupId][userId].timeoutId);
        delete groupTypingUsers[groupId][userId];
    }
}