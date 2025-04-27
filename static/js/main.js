/**
 * Main JavaScript entry point that imports all other modules
 */

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the application
  initializeChat();
  
  // Setup create group button (now in the side menu)
  setupCreateGroupButton();
});

/**
 * Initialize the chat application
 */
function initializeChat() {
  console.log('Initializing chat application...');
  
  // Fetch current user information first
  fetchCurrentUser()
    .then(() => {
      // Load sidebar with contacts and chats
      loadSidebar();
      
      // Setup event listeners
      setupEventListeners();
    })
    .catch(error => {
      console.error('Failed to initialize chat:', error);
      showErrorNotification('Failed to initialize chat. Please refresh the page.');
    });
}

/**
 * Setup create group button functionality
 */
function setupCreateGroupButton() {
  const createGroupBtn = document.getElementById('createGroupBtn');
  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Show the create group modal instead of redirecting
      showCreateGroupModal();
    });
  }
}

/**
 * Show the create group modal and load contacts
 */
function showCreateGroupModal() {
  const modal = document.getElementById('createGroupModal');
  const overlay = document.getElementById('overlay');
  
  if (!modal || !overlay) return;
  
  // Show modal and overlay
  modal.classList.add('active');
  overlay.classList.add('active');
  
  // Setup avatar upload functionality
  setupGroupAvatarUpload();
  
  // Load contacts for group members
  loadContactsForGroup();
  
  // Setup cancel button
  const cancelBtn = document.getElementById('cancelGroupCreate');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
  
  // Setup form submission
  const form = document.getElementById('createGroupForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      createGroupHandler(form);
    });
  }
  
  // Setup search functionality
  const searchInput = document.getElementById('searchMembers');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchValue = this.value.toLowerCase();
      const memberItems = document.querySelectorAll('.member-item');
      
      memberItems.forEach(item => {
        const memberName = item.querySelector('.member-name').textContent.toLowerCase();
        if (memberName.includes(searchValue)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }
}

/**
 * Load contacts for adding to a group
 */
function loadContactsForGroup() {
  const membersList = document.getElementById('membersList');
  if (!membersList) return;
  
  fetch('/get_users_for_group')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.users) {
        displayGroupMembers(data.users);
      } else {
        showGroupMembersError('Failed to load contacts');
      }
    })
    .catch(error => {
      console.error('Error loading contacts for group:', error);
      showGroupMembersError('Failed to load contacts');
    });
}

/**
 * Display contacts for adding to a group
 */
function displayGroupMembers(users) {
  const membersList = document.getElementById('membersList');
  if (!membersList) return;
  
  if (users.length === 0) {
    membersList.innerHTML = '<div class="no-contacts">Контакты не найдены</div>';
    return;
  }
  
  membersList.innerHTML = '';
  
  users.forEach(user => {
    const memberItem = document.createElement('div');
    memberItem.className = 'member-item';
    memberItem.dataset.userId = user.id;
    
    let avatarContent;
    if (user.avatar_path) {
      avatarContent = `<img src="${user.avatar_path}" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      avatarContent = user.name.charAt(0);
    }
    
    memberItem.innerHTML = `
      <div class="member-avatar">${avatarContent}</div>
      <div class="member-name">${user.name}</div>
      <input type="checkbox" name="members" value="${user.id}" style="display: none;">
    `;
    
    memberItem.addEventListener('click', function() {
      this.classList.toggle('selected');
      const checkbox = this.querySelector('input[type="checkbox"]');
      checkbox.checked = this.classList.contains('selected');
      updateMembersCount();
    });
    
    membersList.appendChild(memberItem);
  });
}

/**
 * Update the count of selected members
 */
function updateMembersCount() {
  const selectedMembers = document.querySelectorAll('.member-item.selected').length;
  const membersCount = document.getElementById('membersCount');
  if (membersCount) {
    membersCount.textContent = `${selectedMembers} выбрано`;
  }
}

/**
 * Show error when loading contacts fails
 */
function showGroupMembersError(message) {
  const membersList = document.getElementById('membersList');
  if (membersList) {
    membersList.innerHTML = `<div class="no-contacts" style="color: #e57373;">${message}</div>`;
  }
}

/**
 * Setup group avatar upload
 */
function setupGroupAvatarUpload() {
  const avatarPreview = document.getElementById('groupAvatarPreview');
  const avatarInput = document.getElementById('groupAvatarInput');
  
  if (avatarPreview && avatarInput) {
    avatarPreview.addEventListener('click', () => {
      avatarInput.click();
    });
    
    avatarInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
          // Update preview with the selected image
          avatarPreview.innerHTML = `
            <img src="${e.target.result}" alt="Group Avatar" class="avatar-image">
            <div class="avatar-upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5V19" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M5 12H19" stroke="white" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
          `;
        };
        
        reader.readAsDataURL(file);
      }
    });
  }
}

/**
 * Handle group creation form submission
 */
function createGroupHandler(form) {
  // Create form data with file support
  const formData = new FormData(form);
  
  // Send request
  fetch('/create_group', {
    method: 'POST',
    body: formData
  })
  .then(response => response.redirected ? window.location.href = response.url : response.json())
  .then(data => {
    if (data && !data.success) {
      showErrorNotification(data.error || 'Failed to create group');
    } else {
      // Close modal
      const modal = document.getElementById('createGroupModal');
      const overlay = document.getElementById('overlay');
      
      if (modal) modal.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
      
      // Show success notification
      showSuccessNotification('Group created successfully');
      
      // Reload sidebar to show new group
      loadSidebar();
    }
  })
  .catch(error => {
    console.error('Error creating group:', error);
    showErrorNotification('Failed to create group');
  });
}
