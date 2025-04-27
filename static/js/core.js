/**
 * Core functionality and application state management
 */

// Global application state
const ChatApp = {
  currentUser: null,
  activeChat: null,
  conversations: [],
  contacts: []
};

/**
 * Initialize the Chat Application
 */
function initializeChat() {
  console.log('Initializing chat application...');
  
  // Fetch current user information first
  fetchCurrentUser()
    .then(() => {
      loadContacts();
      loadRecentConversations();
      setupEventListeners();
    })
    .catch(error => {
      console.error('Failed to initialize chat:', error);
      showErrorNotification('Failed to initialize chat. Please refresh the page.');
    });
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
  // Setup search functionality
  setupSearch();
  
  // Setup UI menu buttons
  setupMenuButtons();
  
  // Setup avatar upload
  setupAvatarUpload();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}
