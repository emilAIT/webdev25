document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const photoContainer = document.getElementById('profile-photo-container');
    const photoInput = document.getElementById('photo-input');
    const photoImage = document.getElementById('profile-photo');
    const defaultAvatar = document.getElementById('default-avatar');
    const uploadIndicator = document.getElementById('photo-upload-indicator');
    const saveChangesBtn = document.getElementById('saveChanges');
    const notificationElement = document.getElementById('notification');
    const darkModeToggle = document.getElementById('darkMode');
    
    // Form inputs
    const nicknameInput = document.getElementById('nickname');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    
    // Load user data on page load
    loadUserData();
    
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        darkModeToggle.checked = savedTheme === 'dark';
    }
    
    // Handle theme toggle
    darkModeToggle.addEventListener('change', function() {
        const theme = this.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });
    
    // Handle photo container click
    photoContainer.addEventListener('click', function() {
        photoInput.click();
    });
    
    // Handle photo input change
    photoInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            // Check file type
            if (!file.type.match('image.*')) {
                showNotification('Please select an image file', 'error');
                return;
            }
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('File is too large. Maximum size is 5MB', 'error');
                return;
            }
            
            // Display selected image
            const reader = new FileReader();
            reader.onload = function(e) {
                photoImage.src = e.target.result;
                photoImage.style.display = 'block';
                defaultAvatar.style.display = 'none';
                uploadIndicator.classList.add('show');
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Handle save changes button
    saveChangesBtn.addEventListener('click', async function() {
        const formData = new FormData();
        
        // Add user data
        formData.append('nickname', nicknameInput.value);
        formData.append('email', emailInput.value);
        formData.append('phone', phoneInput.value);
        
        // Add photo if selected
        if (photoInput.files && photoInput.files[0]) {
            formData.append('profile_photo', photoInput.files[0]);
        }
        
        try {
            const response = await fetch('/api/users/profile', {
                method: 'PUT',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update profile');
            }
            
            const data = await response.json();
            
            // Update user nickname in UI
            const userNickname = document.getElementById('user-nickname');
            if (userNickname && data.nickname) {
                userNickname.textContent = data.nickname;
            }
            
            // Save theme preference
            const theme = darkModeToggle.checked ? 'dark' : 'light';
            localStorage.setItem('theme', theme);
            
            showNotification('Profile updated successfully', 'success');
            uploadIndicator.classList.remove('show');
            
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification(error.message, 'error');
        }
    });
    
    // Handle delete account
    const deleteAccountBtn = document.getElementById('deleteAccount');
    
    deleteAccountBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            try {
                const response = await fetch('/api/profile', {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    localStorage.removeItem('access_token');
                    window.location.href = '/';
                } else {
                    throw new Error('Failed to delete account');
                }
            } catch (error) {
                console.error('Error deleting account:', error);
                showNotification('Failed to delete account. Please try again.', 'error');
            }
        }
    });
    
    // Load user data from server
    async function loadUserData() {
        try {
            const response = await fetch('/api/users/me');
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            
            const userData = await response.json();
            
            // Fill form fields
            nicknameInput.value = userData.nickname || '';
            emailInput.value = userData.email || '';
            phoneInput.value = userData.phone || '';
            
            // Display profile photo if exists
            if (userData.profile_photo && userData.profile_photo !== 'None' && userData.profile_photo !== '') {
                photoImage.src = userData.profile_photo;
                photoImage.style.display = 'block';
                defaultAvatar.style.display = 'none';
                
                // Add photo load error handling
                photoImage.onerror = function() {
                    photoImage.style.display = 'none';
                    defaultAvatar.style.display = 'flex';
                    if (userData.nickname) {
                        defaultAvatar.textContent = userData.nickname.charAt(0).toUpperCase();
                    }
                    console.log('Failed to load profile photo, using default avatar');
                };
            } else {
                photoImage.style.display = 'none';
                defaultAvatar.style.display = 'flex';
                if (userData.nickname) {
                    defaultAvatar.textContent = userData.nickname.charAt(0).toUpperCase();
                }
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Failed to load user data', 'error');
        }
    }
    
    // Show notification function
    function showNotification(message, type) {
        notificationElement.textContent = message;
        notificationElement.className = `notification ${type}`;
        notificationElement.classList.add('show');
        
        setTimeout(() => {
            notificationElement.classList.remove('show');
        }, 3000);
    }
});
