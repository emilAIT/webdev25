/**
 * Chat functionality for direct messaging
 */

/**
 * Open chat with a user
 */
function openChatWithUser(userId, userName) {
  // Store active chat info
  ChatApp.activeChat = { id: userId, name: userName, type: 'user' };
  
  console.log(`Opening chat with user: ${userName} (${userId})`);
  
  // Check if user is blocked first
  checkBlockStatus(userId)
    .then(blockData => {
      if (blockData.isBlockedByYou) {
        // Show blocked by you interface
        createBlockedByYouInterface(userId, userName);
        highlightActiveItem(userId);
        return Promise.reject({ handled: true });
      } else if (blockData.hasBlockedYou) {
        // Show blocked by them interface
        createBlockedByThemInterface(userId, userName);
        highlightActiveItem(userId);
        return Promise.reject({ handled: true });
      } else {
        // Get user info
        return getUserInfo(userId);
      }
    })
    .then(userData => {
      // Create chat interface
      createChatInterface(userData);
      
      // Load messages
      return loadMessages(userId);
    })
    .then(() => {
      // Highlight active chat in sidebar
      highlightActiveItem(userId);
    })
    .catch(error => {
      if (!error.handled) {
        console.error('Error opening chat:', error);
        showErrorNotification('Failed to open chat. Please try again.');
      }
    });
}

/**
 * Create the chat interface
 */
function createChatInterface(user) {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) {
    console.error('Main content container not found');
    return;
  }
  
  // Clear existing content
  mainContent.innerHTML = '';
  
  // Create header
  const chatHeader = document.createElement('div');
  chatHeader.className = 'chat-header';
  
  // User info section
  const userInfo = document.createElement('div');
  userInfo.className = 'chat-user-info';
  
  // User avatar
  const userAvatar = document.createElement('div');
  userAvatar.className = 'chat-user-avatar';
  
  if (user.avatar_path) {
    userAvatar.innerHTML = `<img src="${user.avatar_path}" alt="${user.name}">`;
  } else {
    userAvatar.innerHTML = `<div class="avatar-initials">${user.name.charAt(0)}</div>`;
  }
  
  // User name
  const userName = document.createElement('div');
  userName.className = 'chat-user-name';
  userName.textContent = user.name;
  
  // Menu button
  const menuButton = document.createElement('button');
  menuButton.className = 'chat-menu-btn';
  menuButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="5" r="1"></circle>
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="12" cy="19" r="1"></circle>
    </svg>
  `;
  
  // Menu button click handler
  menuButton.addEventListener('click', function(e) {
    e.stopPropagation();
    showContactMenu(menuButton, user.id, user.name);
  });
  
  // Messages area
  const chatMessages = document.createElement('div');
  chatMessages.className = 'chat-messages';
  
  // Message input area
  const messageInputContainer = document.createElement('div');
  messageInputContainer.className = 'message-input-container';
  
  // Create input wrapper
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'input-wrapper';
  
  // Clip button
  const clipButtonContainer = document.createElement('div');
  clipButtonContainer.className = 'clip-button-container';
  
  const paperclipButton = document.createElement('button');
  paperclipButton.className = 'paperclip-button';
  paperclipButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
  `;
  
  // Add click handler to paperclip button
  paperclipButton.addEventListener('click', function(e) {
    e.preventDefault();
    showFileUploadMenu(paperclipButton, user);
  });
  
  // Input field
  const messageInputField = document.createElement('div');
  messageInputField.className = 'message-input-field';
  
  const inputField = document.createElement('input');
  inputField.type = 'text';
  inputField.placeholder = 'Message';
  
  // Send button
  const sendButton = document.createElement('button');
  sendButton.className = 'send-button';
  sendButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  `;
  
  // Add input event handlers
  inputField.addEventListener('input', function() {
    if (this.value.trim()) {
      sendButton.classList.add('active');
    } else {
      sendButton.classList.remove('active');
    }
  });
  
  // Add send handlers
  sendButton.addEventListener('click', function() {
    const text = inputField.value.trim();
    if (text) {
      sendMessageHandler(text, user.id, chatMessages);
    }
  });
  
  // Add enter key handler
  inputField.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = this.value.trim();
      if (text) {
        sendMessageHandler(text, user.id, chatMessages);
      }
    }
  });
  
  // Assemble everything
  userInfo.appendChild(userAvatar);
  userInfo.appendChild(userName);
  
  chatHeader.appendChild(userInfo);
  chatHeader.appendChild(menuButton);
  
  clipButtonContainer.appendChild(paperclipButton);
  messageInputField.appendChild(inputField);
  
  inputWrapper.appendChild(clipButtonContainer);
  inputWrapper.appendChild(messageInputField);
  inputWrapper.appendChild(sendButton);
  
  messageInputContainer.appendChild(inputWrapper);
  
  mainContent.appendChild(chatHeader);
  mainContent.appendChild(chatMessages);
  mainContent.appendChild(messageInputContainer);
  
  // Show chat content
  mainContent.style.display = 'flex';
  
  // Focus input field
  inputField.focus();
}

/**
 * Show contact menu
 */
function showContactMenu(menuButton, userId, userName) {
  // Check contact status
  checkContactStatus(userId)
    .then(isContact => {
      // Create menu if it doesn't exist
      let contactMenu = document.getElementById('contactDropdownMenu');
      if (!contactMenu) {
        contactMenu = document.createElement('div');
        contactMenu.id = 'contactDropdownMenu';
        contactMenu.className = 'dropdown-menu';
        document.body.appendChild(contactMenu);
      }
      
      // Clear any existing content
      contactMenu.innerHTML = '';
      
      // Get the button position
      const buttonRect = menuButton.getBoundingClientRect();
      
      // Check if the user is blocked
      checkBlockStatus(userId)
        .then(blockData => {
          let menuItems = '';
          
          // Show unblock option if user is blocked by you
          if (blockData.isBlockedByYou) {
            menuItems = `
              <div class="dropdown-menu-options">
                <div class="dropdown-option" id="unblockUserOption">
                  <div class="dropdown-option-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                  </div>
                  <div class="dropdown-option-label" style="color: #4CAF50;">Unblock User</div>
                </div>
              </div>
            `;
          } else {
            // Add "User Information" option at the top of the menu
            menuItems += `
              <div class="dropdown-option" id="userInfoOption">
                <div class="dropdown-option-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <div class="dropdown-option-label">User Information</div>
              </div>
            `;
            
            // Add to contacts option if not a contact
            if (!isContact) {
              menuItems += `
                <div class="dropdown-option" id="addContactOption">
                  <div class="dropdown-option-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14"></path>
                      <path d="M5 12h14"></path>
                    </svg>
                  </div>
                  <div class="dropdown-option-label">Add to contacts</div>
                </div>
              `;
            } 
            // Remove from contacts option if is a contact
            else {
              menuItems += `
                <div class="dropdown-option" id="removeContactOption">
                  <div class="dropdown-option-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 7l-10 10"></path>
                      <path d="M7 7l10 10"></path>
                    </svg>
                  </div>
                  <div class="dropdown-option-label">Remove from contacts</div>
                </div>
              `;
            }
            
            // Block option
            menuItems += `
              <div class="dropdown-option" id="blockUserOption">
                <div class="dropdown-option-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                </div>
                <div class="dropdown-option-label" style="color: #e74c3c;">Block User</div>
              </div>
              <div class="dropdown-option" id="deleteChatOption">
                <div class="dropdown-option-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                  </svg>
                </div>
                <div class="dropdown-option-label" style="color: #e74c3c;">Delete Chat</div>
              </div>
            `;
          }
          
          contactMenu.innerHTML = `<div class="dropdown-menu-options">${menuItems}</div>`;
          
          // Position the menu
          contactMenu.style.display = 'block';
          contactMenu.style.position = 'absolute';
          contactMenu.style.left = `${buttonRect.left - 180}px`;
          contactMenu.style.top = `${buttonRect.bottom + 5}px`;
          
          // Add event listeners to options
          if (blockData.isBlockedByYou) {
            document.getElementById('unblockUserOption').addEventListener('click', function() {
              unblockUserHandler(userId, userName);
              contactMenu.style.display = 'none';
            });
          } else {
            // Add event listener for User Information option
            document.getElementById('userInfoOption').addEventListener('click', function() {
              showUserInformation(userId, userName);
              contactMenu.style.display = 'none';
            });
            
            if (!isContact) {
              document.getElementById('addContactOption').addEventListener('click', function() {
                addContactHandler(userId, userName);
                contactMenu.style.display = 'none';
              });
            } else {
              document.getElementById('removeContactOption').addEventListener('click', function() {
                removeContactHandler(userId);
                contactMenu.style.display = 'none';
              });
            }
            
            document.getElementById('blockUserOption').addEventListener('click', function() {
              blockUserHandler(userId, userName);
              contactMenu.style.display = 'none';
            });
            // Delete chat option
            document.getElementById('deleteChatOption').addEventListener('click', function() {
              showDeleteChatConfirmation(userId, userName);
              contactMenu.style.display = 'none';
            });
          }
          
          // Close menu when clicking anywhere else
          document.addEventListener('click', function closeMenu(e) {
            if (!contactMenu.contains(e.target) && !menuButton.contains(e.target)) {
              contactMenu.style.display = 'none';
              document.removeEventListener('click', closeMenu);
            }
          });
        });
    })
    .catch(error => {
      console.error('Error showing contact menu:', error);
    });
}

// New function to show user information modal
function showUserInformation(userId, userName) {
  // Remove any existing user info modal
  const existingModal = document.getElementById('userInfoModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create loading modal first
  const modal = document.createElement('div');
  modal.id = 'userInfoModal';
  modal.className = 'user-info-modal';
  modal.innerHTML = `
    <div class="user-info-content">
      <div class="user-info-header">
        <h3>User Information</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="user-info-body">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Loading user information...</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Add close button functionality
  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.remove();
  });
  
  // Close when clicking outside the modal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Fetch user information
  getUserInfo(userId)
    .then(userData => {
      // Update modal with user data
      const userInfoBody = modal.querySelector('.user-info-body');
      userInfoBody.innerHTML = `
        <div class="user-info-avatar">
          ${userData.avatar_path 
            ? `<img src="${userData.avatar_path}" alt="${userData.name}">`
            : `<div class="avatar-initials">${userData.name.charAt(0)}</div>`
          }
        </div>
        <div class="user-info-details">
          <h2 class="user-info-name">${userData.name}</h2>
          <div class="user-info-bio">
            <h4>About</h4>
            <p>${userData.bio || 'No information provided'}</p>
          </div>
        </div>
      `;
    })
    .catch(error => {
      console.error('Error fetching user information:', error);
      // Show error in modal
      const userInfoBody = modal.querySelector('.user-info-body');
      userInfoBody.innerHTML = `
        <div class="error-message">
          <p>Failed to load user information. Please try again.</p>
        </div>
      `;
    });
}

/**
 * Show file upload menu
 */
function showFileUploadMenu(button, user) {
  // Create menu if it doesn't exist
  let fileMenu = document.getElementById('fileUploadMenu');
  if (!fileMenu) {
    fileMenu = document.createElement('div');
    fileMenu.id = 'fileUploadMenu';
    fileMenu.className = 'file-upload-menu';
    document.body.appendChild(fileMenu);
  }
  
  // Clear any existing content
  fileMenu.innerHTML = '';
  
  // Get the button position
  const buttonRect = button.getBoundingClientRect();
  
  // Create file input to be used by the menu options
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'fileInput';
  fileInput.style.display = 'none';
  fileInput.multiple = false;
  document.body.appendChild(fileInput);
  
  // Create photo/video input 
  const mediaInput = document.createElement('input');
  mediaInput.type = 'file';
  mediaInput.id = 'mediaInput';
  mediaInput.style.display = 'none';
  mediaInput.accept = 'image/*,video/*';
  mediaInput.multiple = false;
  document.body.appendChild(mediaInput);
  
  // Add menu options
  fileMenu.innerHTML = `
    <div class="file-menu-options">
      <div class="file-option" id="photoVideoOption">
        <div class="file-option-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
        <div class="file-option-label">Photo or Video</div>
      </div>
      
      <div class="file-option" id="documentOption">
        <div class="file-option-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <div class="file-option-label">Document</div>
      </div>
    </div>
  `;
  
  // Position the menu
  fileMenu.style.display = 'block';
  fileMenu.style.position = 'absolute';
  fileMenu.style.left = `${buttonRect.left}px`;
  fileMenu.style.top = `${buttonRect.top - fileMenu.offsetHeight - 10}px`;
  
  // Add event listeners to options
  document.getElementById('photoVideoOption').addEventListener('click', function() {
    mediaInput.onchange = function() {
      if (this.files.length > 0) {
        handleFileSelection(this.files, user);
      }
      // Remove the input element after use
      document.body.removeChild(mediaInput);
    };
    mediaInput.click();
    fileMenu.style.display = 'none';
  });
  
  document.getElementById('documentOption').addEventListener('click', function() {
    fileInput.onchange = function() {
      if (this.files.length > 0) {
        handleFileSelection(this.files, user);
      }
      // Remove the input element after use
      document.body.removeChild(fileInput);
    };
    fileInput.click();
    fileMenu.style.display = 'none';
  });
  
  // Close menu when clicking anywhere else
  document.addEventListener('click', function closeMenu(e) {
    if (!fileMenu.contains(e.target) && !button.contains(e.target)) {
      fileMenu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
      // Clean up input elements if menu is closed without selecting
      if (document.body.contains(fileInput)) document.body.removeChild(fileInput);
      if (document.body.contains(mediaInput)) document.body.removeChild(mediaInput);
    }
  });
}

/**
 * Create interface for when you've blocked a user
 */
function createBlockedByYouInterface(userId, userName) {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;
  
  // Clear existing content
  mainContent.innerHTML = '';
  
  // Create header
  const chatHeader = document.createElement('div');
  chatHeader.className = 'chat-header';
  
  // User info section
  const userInfo = document.createElement('div');
  userInfo.className = 'chat-user-info';
  
  // User avatar
  const userAvatar = document.createElement('div');
  userAvatar.className = 'chat-user-avatar';
  userAvatar.innerHTML = `<div class="avatar-initials">${userName.charAt(0)}</div>`;
  
  // User name
  const userNameEl = document.createElement('div');
  userNameEl.className = 'chat-user-name';
  userNameEl.textContent = userName;
  
  // Menu button
  const menuButton = document.createElement('button');
  menuButton.className = 'chat-menu-btn';
  menuButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="5" r="1"></circle>
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="12" cy="19" r="1"></circle>
    </svg>
  `;
  
  // Menu button click handler
  menuButton.addEventListener('click', function(e) {
    e.stopPropagation();
    showContactMenu(menuButton, userId, userName);
  });
  
  // Block message area
  const blockMessageArea = document.createElement('div');
  blockMessageArea.className = 'block-message';
  
  // Block icon
  const blockIcon = document.createElement('div');
  blockIcon.className = 'block-icon';
  blockIcon.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="1">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
    </svg>
  `;
  
  // Block message
  const blockText = document.createElement('div');
  blockText.textContent = `You've blocked ${userName}`;
  
  // Unblock button
  const unblockButton = document.createElement('button');
  unblockButton.className = 'unblock-button';
  unblockButton.textContent = 'Unblock';
  unblockButton.addEventListener('click', function() {
    unblockUserHandler(userId, userName);
  });
  
  // Assemble everything
  userInfo.appendChild(userAvatar);
  userInfo.appendChild(userNameEl);
  
  chatHeader.appendChild(userInfo);
  chatHeader.appendChild(menuButton);
  
  blockMessageArea.appendChild(blockIcon);
  blockMessageArea.appendChild(blockText);
  blockMessageArea.appendChild(unblockButton);
  
  mainContent.appendChild(chatHeader);
  mainContent.appendChild(blockMessageArea);
  
  // Show content
  mainContent.style.display = 'flex';
}

/**
 * Create interface for when you've been blocked by a user
 */
function createBlockedByThemInterface(userId, userName) {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;
  
  // Clear existing content
  mainContent.innerHTML = '';
  
  // Create header
  const chatHeader = document.createElement('div');
  chatHeader.className = 'chat-header';
  
  // User info section
  const userInfo = document.createElement('div');
  userInfo.className = 'chat-user-info';
  
  // User avatar
  const userAvatar = document.createElement('div');
  userAvatar.className = 'chat-user-avatar';
  userAvatar.innerHTML = `<div class="avatar-initials">${userName.charAt(0)}</div>`;
  
  // User name
  const userNameEl = document.createElement('div');
  userNameEl.className = 'chat-user-name';
  userNameEl.textContent = userName;
  
  // Menu button
  const menuButton = document.createElement('button');
  menuButton.className = 'chat-menu-btn';
  menuButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="5" r="1"></circle>
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="12" cy="19" r="1"></circle>
    </svg>
  `;
  
  // Menu button click handler
  menuButton.addEventListener('click', function(e) {
    e.stopPropagation();
    showContactMenu(menuButton, userId, userName);
  });
  
  // Block message area
  const blockMessageArea = document.createElement('div');
  blockMessageArea.className = 'block-message';
  
  // Block icon
  const blockIcon = document.createElement('div');
  blockIcon.className = 'block-icon';
  blockIcon.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="1">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
    </svg>
  `;
  
  // Block message
  const blockText = document.createElement('div');
  blockText.textContent = `${userName} has blocked you`;
  
  // Assemble everything
  userInfo.appendChild(userAvatar);
  userInfo.appendChild(userNameEl);
  
  chatHeader.appendChild(userInfo);
  chatHeader.appendChild(menuButton);
  
  blockMessageArea.appendChild(blockIcon);
  blockMessageArea.appendChild(blockText);
  
  mainContent.appendChild(chatHeader);
  mainContent.appendChild(blockMessageArea);
  
  // Show content
  mainContent.style.display = 'flex';
}

// Добавляю функцию показа модального окна подтверждения удаления чата
function showDeleteChatConfirmation(userId, userName) {
  // Удаляем старую модалку, если есть
  const oldModal = document.getElementById('deleteChatModal');
  if (oldModal) oldModal.remove();
  const modal = document.createElement('div');
  modal.id = 'deleteChatModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-dialog" style="max-width:340px;">
      <div class="modal-title" style="margin-bottom:18px;">Are you sure you want to delete this chat with <b>${escapeHtml(userName)}</b>?</div>
      <div style="color:#e57373;margin-bottom:18px;">This will remove all messages for both users. This action cannot be undone.</div>
      <div class="modal-actions" style="flex-direction:row;gap:12px;justify-content:center;">
        <button class="btn btn-secondary" id="cancelDeleteChatBtn">Cancel</button>
        <button class="btn btn-danger" id="confirmDeleteChatBtn">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelDeleteChatBtn').onclick = function() {
    modal.remove();
  };
  document.getElementById('confirmDeleteChatBtn').onclick = function() {
    deleteChat(userId)
      .then(res => {
        if (res.success) {
          showSuccessNotification('Chat deleted');
          modal.remove();
          // UI: закрыть чат, обновить сайдбар
          if (typeof loadSidebar === 'function') loadSidebar();
          const mainContent = document.querySelector('.main-content');
          if (mainContent) mainContent.innerHTML = '<div class="empty-chat">Select a chat to start messaging</div>';
        } else {
          showErrorNotification(res.error || 'Failed to delete chat');
        }
      })
      .catch(() => {
        showErrorNotification('Failed to delete chat');
      });
  };
}
