/**
 * Sidebar functionality for ShrekChat
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize sidebar
    setupProfileSidebar();
    setupThemeToggle();

    // Listen for avatar updates from WebSocket
    window.addEventListener('websocket_message', function(event) {
        const data = event.detail;
        if (data.type === "own_avatar_update") {
            // Update all instances of the current user's avatar
            updateCurrentUserAvatar(data.avatar_url);
        }
    });
});

// Setup profile sidebar functionality
function setupProfileSidebar() {
    const profileButton = document.getElementById('profileButton');
    const profileSidebar = document.getElementById('profileSidebar');
    const closeProfileSidebar = document.getElementById('closeProfileSidebar');
    const overlay = document.getElementById('overlay');
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    const editProfileMenuItem = document.getElementById('editProfileMenuItem');
    const editProfilePopup = document.getElementById('editProfilePopup');
    const closeEditProfilePopup = document.getElementById('closeEditProfilePopup');
    const editProfileForm = document.getElementById('editProfileForm');
    
    // Profile button click event
    if (profileButton) {
        profileButton.addEventListener('click', function() {
            profileSidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }
    
    // Close button click event
    if (closeProfileSidebar) {
        closeProfileSidebar.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Handle logout
    if (logoutMenuItem) {
        logoutMenuItem.addEventListener('click', function() {
            window.location.href = '/logout';
        });
    }

    // Toggle edit profile popup
    if (editProfileMenuItem) {
        editProfileMenuItem.addEventListener('click', function() {
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            
            if (editProfilePopup) {
                editProfilePopup.classList.add('open');
                overlay.classList.add('active');
                
                // Load current profile data
                loadProfileData();
            }
        });
    }

    if (closeEditProfilePopup) {
        closeEditProfilePopup.addEventListener('click', function() {
            editProfilePopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // Handle overlay clicks to close popups
    if (overlay) {
        overlay.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            
            // Close all popups
            const popups = document.querySelectorAll('.popup');
            popups.forEach(popup => {
                popup.classList.remove('open');
            });
            
            overlay.classList.remove('active');
        });
    }

    // Setup avatar upload handling
    const uploadAvatarInput = document.getElementById('uploadAvatarInput');
    const profileAvatarContainer = document.querySelector('.profile-avatar-large');
    
    if (uploadAvatarInput && profileAvatarContainer) {
        // Make the entire avatar area clickable for upload
        profileAvatarContainer.addEventListener('click', function(e) {
            // Only trigger if they clicked on the avatar or the overlay
            if (e.target.closest('.edit-avatar-overlay') || e.target.id === 'profileAvatar') {
                uploadAvatarInput.click();
            }
        });
        
        uploadAvatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                // Show loading indicator
                Swal.fire({
                    title: 'Uploading...',
                    text: 'Please wait while we upload your avatar',
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    willOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                uploadAvatar(this.files[0]);
            }
        });
    }

    // Load profile data from API
    function loadProfileData() {
        fetch('/api/profile')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load profile data');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Populate form fields with current profile data
                    document.getElementById('profileNickname').value = data.data.username || '';
                    document.getElementById('profileEmail').value = data.data.email || '';
                    document.getElementById('profilePhone').value = data.data.phone_number || '';
                    document.getElementById('profileCountry').value = data.data.country || '';
                    
                    // Set bio field if available
                    const bioField = document.getElementById('profileBio');
                    if (bioField) {
                        bioField.value = data.data.bio || '';
                        // Update character count
                        updateBioCharCount(bioField.value.length);
                    }
                } else {
                    console.error('Error loading profile:', data.message);
                }
            })
            .catch(error => {
                console.error('Error loading profile data:', error);
            });
    }

    // Handle profile form submission
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Create FormData object from the form
            const formData = new FormData();
            
            // Add all form fields
            formData.append('username', document.getElementById('profileNickname').value);
            formData.append('email', document.getElementById('profileEmail').value);
            formData.append('phone_number', document.getElementById('profilePhone').value);
            formData.append('country', document.getElementById('profileCountry').value);
            
            // Add bio field
            const bioField = document.getElementById('profileBio');
            if (bioField) {
                formData.append('bio', bioField.value.trim());
            }
            
            fetch('/api/profile/update', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to update profile');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Update profile name in the sidebar if username was changed
                    if (formData.username) {
                        document.querySelector('.profile-name').textContent = formData.username;
                    }
                    
                    // Close popup
                    editProfilePopup.classList.remove('open');
                    overlay.classList.remove('active');
                    
                    // Show success notification
                    Swal.fire({
                        icon: 'success',
                        title: 'Profile Updated',
                        text: 'Your profile has been updated successfully!',
                        confirmButtonText: 'OK'
                    });
                    
                    // Reload page if username was changed
                    if (formData.username) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Update Failed',
                        text: 'Failed to update profile: ' + data.message,
                        confirmButtonText: 'OK'
                    });
                }
            })
            .catch(error => {
                console.error('Error updating profile:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while updating your profile',
                    confirmButtonText: 'OK'
                });
            });
        });
    }
}

// Upload avatar function
function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('Uploading avatar file:', file.name);
    
    fetch('/upload-avatar', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log('Avatar upload response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Avatar upload response data:', data);
        
        if (data.success === false) {
            throw new Error(data.message || 'Failed to upload avatar');
        }
        
        if (data.avatar_url) {
            // Close any existing Swal popups
            Swal.close();
            
            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Avatar Updated',
                text: 'Your profile picture has been updated successfully!'
            });
            
            // Update avatar in UI
            updateCurrentUserAvatar(data.avatar_url);
        } else {
            throw new Error('No avatar URL in response');
        }
    })
    .catch(error => {
        console.error('Error uploading avatar:', error);
        
        // Close any existing Swal popups
        Swal.close();
        
        // Show error message
        Swal.fire({
            icon: 'error',
            title: 'Upload Failed',
            text: 'Failed to upload avatar: ' + error.message
        });
    });
}

// Update all instances of the current user's avatar
function updateCurrentUserAvatar(avatarUrl) {
    // Update avatar in profile sidebar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = avatarUrl;
    }
    
    // Update avatar in sidebar header
    const sidebarAvatar = document.querySelector('.profile-btn .profile-picture img');
    if (sidebarAvatar) {
        sidebarAvatar.src = avatarUrl;
    }
    
    // Update avatar in profile edit popup
    const editProfileAvatar = document.querySelector('.profile-avatar-circle img');
    if (editProfileAvatar) {
        editProfileAvatar.src = avatarUrl;
    }
    
    // Update avatar in group pages where current user is listed
    const userId = document.body.getAttribute('data-user-id');
    if (userId) {
        document.querySelectorAll(`.group-member[data-user-id="${userId}"] .member-avatar img`).forEach(img => {
            img.src = avatarUrl;
        });
    }
    
    console.log('Avatar updated successfully across all UI elements');
}

// Toggle between light and dark theme
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    // Check saved theme preference
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        body.classList.add('dark-theme');
        if (themeToggle) themeToggle.checked = true;
    }
    
    // Listen for theme toggle changes
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }
}