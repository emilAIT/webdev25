/**
 * UI components and interface management
 */

/**
 * Update the user interface with user data
 */
function updateUserInterface(userData) {
  // Update profile section
  const userNameElements = document.querySelectorAll('.user-info h3');
  userNameElements.forEach(el => {
    el.textContent = userData.user_name;
  });
  
  // Update user status
  const userStatusElements = document.querySelectorAll('.side-menu .user-status');
  userStatusElements.forEach(el => {
    el.textContent = userData.bio || 'No status';
    el.style.display = 'block';
    el.style.visibility = 'visible';
  });
  
  // Only update avatar if there's avatar data
  // This prevents clearing the avatar when only updating the status
  if (userData.avatar_path) {
    updateAvatar(userData);
  }
}

/**
 * Update avatar display
 */
function updateAvatar(userData) {
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  if (!avatarPlaceholder) return;
  
  // Clear existing content
  avatarPlaceholder.innerHTML = '';
  
  if (userData.avatar_path) {
    // Create and add image
    const img = document.createElement('img');
    img.src = userData.avatar_path;
    img.alt = userData.user_name;
    img.className = 'avatar-image';
    avatarPlaceholder.appendChild(img);
  } else {
    // Create initials avatar
    const initialsDiv = document.createElement('div');
    initialsDiv.className = 'avatar-initials';
    initialsDiv.textContent = userData.user_name.charAt(0);
    avatarPlaceholder.appendChild(initialsDiv);
  }
  
  // Add upload icon
  const uploadIcon = document.createElement('div');
  uploadIcon.className = 'avatar-upload-icon';
  uploadIcon.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 5V19" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M5 12H19" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
  avatarPlaceholder.appendChild(uploadIcon);
}

/**
 * Setup menu buttons
 */
function setupMenuButtons() {
  const menuBtn = document.getElementById('menuBtn');
  const sideMenu = document.getElementById('sideMenu');
  const overlay = document.getElementById('overlay');
  const closeMenuBtn = document.getElementById('closeMenuBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModal = document.getElementById('logoutModal');
  const cancelLogout = document.getElementById('cancelLogout');
  const editProfileBtn = document.getElementById('editProfileBtn');
  const editProfileSidebar = document.getElementById('editProfileSidebar');
  const backToMainMenu = document.getElementById('backToMainMenu');
  const editProfileForm = document.getElementById('editProfileForm');
  
  // Menu button click
  if (menuBtn && sideMenu && overlay) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sideMenu.classList.toggle('active');
      overlay.classList.toggle('active');
    });
  }
  
  // Close menu button
  if (closeMenuBtn && sideMenu && overlay) {
    closeMenuBtn.addEventListener('click', () => {
      sideMenu.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
  
  // Overlay click
  if (overlay && sideMenu) {
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      sideMenu.classList.remove('active');
      if (editProfileSidebar) editProfileSidebar.classList.remove('active');
      if (logoutModal) logoutModal.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
  
  // Logout button
  if (logoutBtn && logoutModal && overlay) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutModal.classList.add('active');
      overlay.classList.add('active');
    });
  }
  
  // Cancel logout
  if (cancelLogout && logoutModal && overlay) {
    cancelLogout.addEventListener('click', () => {
      logoutModal.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
  
  // Edit profile button
  if (editProfileBtn && editProfileSidebar && sideMenu && overlay) {
    editProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sideMenu.classList.remove('active');
      editProfileSidebar.classList.add('active');
      overlay.classList.add('active');
    });
  }
  
  // Back to main menu
  if (backToMainMenu && editProfileSidebar && sideMenu) {
    backToMainMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      editProfileSidebar.classList.remove('active');
      sideMenu.classList.add('active');
    });
  }
  
  // Profile form submission
  if (editProfileForm) {
    editProfileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      updateProfile(new FormData(editProfileForm))
        .then(data => {
          if (data.success) {
            updateUserInterface(data);
            editProfileSidebar.classList.remove('active');
            overlay.classList.remove('active');
            showSuccessNotification('Profile updated successfully');
          }
        })
        .catch(error => {
          showErrorNotification('Failed to update profile');
        });
    });
  }
  
  // Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sideMenu && sideMenu.classList.contains('active')) {
        sideMenu.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
      if (editProfileSidebar && editProfileSidebar.classList.contains('active')) {
        editProfileSidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
      if (logoutModal && logoutModal.classList.contains('active')) {
        logoutModal.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    }
  });
  
  // Stop propagation for menu content
  if (sideMenu) {
    sideMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  if (editProfileSidebar) {
    editProfileSidebar.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

/**
 * Setup avatar upload
 */
function setupAvatarUpload() {
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const avatarInput = document.getElementById('avatarInput');
  
  if (avatarPlaceholder && avatarInput) {
    avatarPlaceholder.addEventListener('click', () => {
      avatarInput.click();
    });
    
    avatarInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        uploadAvatar(this.files[0])
          .then(data => {
            if (data.success) {
              // Refresh current user info
              fetchCurrentUser()
                .then(userData => {
                  // Directly update sidebar avatar
                  updateSidebarAvatar(userData.avatar_path);
                });
              showSuccessNotification('Avatar updated successfully');
            }
          })
          .catch(error => {
            showErrorNotification('Failed to upload avatar');
          });
      }
    });
  }
}

/**
 * Update sidebar avatar directly after upload
 */
function updateSidebarAvatar(avatarPath) {
  const sidebarAvatar = document.getElementById('avatarPlaceholder');
  if (sidebarAvatar) {
    // Clear existing avatar content
    sidebarAvatar.innerHTML = '';
    
    if (avatarPath) {
      // Create and set the new avatar image
      const img = document.createElement('img');
      img.src = avatarPath;
      img.alt = 'User Avatar';
      img.className = 'avatar-image';
      sidebarAvatar.appendChild(img);
    } else {
      // Create initials avatar if no avatar path
      const initialsDiv = document.createElement('div');
      initialsDiv.className = 'avatar-initials';
      initialsDiv.textContent = ChatApp.currentUser.user_name.charAt(0);
      sidebarAvatar.appendChild(initialsDiv);
    }
    
    // Re-add the upload icon
    const uploadIcon = document.createElement('div');
    uploadIcon.className = 'avatar-upload-icon';
    uploadIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 5V19" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <path d="M5 12H19" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    sidebarAvatar.appendChild(uploadIcon);
  }
}
