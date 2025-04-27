/**
 * Sidebar functionality for Blink
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - Sidebar
    const profileButton = document.getElementById('profileButton');
    const profileSidebar = document.getElementById('profileSidebar');
    const closeProfileSidebar = document.getElementById('closeProfileSidebar');
    const overlay = document.getElementById('overlay');
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    const editProfileMenuItem = document.getElementById('editProfileMenuItem');
    const editProfilePopup = document.getElementById('editProfilePopup');
    const closeEditProfilePopup = document.getElementById('closeEditProfilePopup');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const editProfileForm = document.getElementById('editProfileForm');
    const plusButton = document.getElementById('plusButton');
    const chatContent = document.getElementById('chatContent');
    const welcomeContainer = document.getElementById('welcomeContainer');

    // Toggle profile sidebar
    if (profileButton) {
        profileButton.addEventListener('click', function() {
            profileSidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }
    
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
    
    // Add event listener for the Cancel button in Edit Profile popup
    if (cancelProfileEdit) {
        cancelProfileEdit.addEventListener('click', function() {
            editProfilePopup.classList.remove('open');
            editProfileForm.reset(); 
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
            
            const formData = {
                username: document.getElementById('profileNickname').value,
                email: document.getElementById('profileEmail').value,
                phone_number: document.getElementById('profilePhone').value,
                country: document.getElementById('profileCountry').value
            };

            // Only include fields that are not empty
            Object.keys(formData).forEach(key => {
                if (!formData[key]) delete formData[key];
            });
            
            fetch('/api/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
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
                    alert('Profile updated successfully!');
                    
                    // Reload page if username was changed
                    if (formData.username) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }
                } else {
                    alert('Failed to update profile: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error updating profile:', error);
                alert('An error occurred while updating your profile');
            });
        });
    }

    // Get current user data
    async function getCurrentUserData() {
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }
            const data = await response.json();
            if (data.success) {
                return data.data;
            } else {
                console.error('Error loading profile:', data.message);
                return null;
            }
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    // Check friendship status between two users
    async function checkFriendshipStatus(userId, friendId) {
        try {
            const response = await fetch(`/api/friends/status/${userId}/${friendId}`);
            if (!response.ok) {
                throw new Error('Failed to check friendship status');
            }
            const data = await response.json();
            return data.status;  // Returns: "none", "pending", "incoming", or "accepted"
        } catch (error) {
            console.error('Error checking friendship status:', error);
            return 'none';  // Default to no friendship
        }
    }

    // Update the friend action button based on current status
    async function updateFriendActionButton(button, userId, friendId, friendName) {
        try {
            const status = await checkFriendshipStatus(userId, friendId);
            
            if (status === 'accepted') {
                button.textContent = 'Remove Friend';
                button.classList.add('remove-friend');
                button.classList.remove('add-friend', 'accept-request');
            } else if (status === 'pending') {
                button.textContent = 'Cancel Request';
                button.classList.add('cancel-request');
                button.classList.remove('add-friend', 'accept-request', 'remove-friend');
            } else if (status === 'incoming') {
                button.textContent = 'Accept Request';
                button.classList.add('accept-request');
                button.classList.remove('add-friend', 'cancel-request', 'remove-friend');
            } else {
                button.textContent = 'Add as Friend';
                button.classList.add('add-friend');
                button.classList.remove('accept-request', 'cancel-request', 'remove-friend');
            }
            
            return status;
        } catch (error) {
            console.error('Error updating friend action button:', error);
            button.textContent = 'Add as Friend';
            button.classList.add('add-friend');
            button.classList.remove('accept-request', 'cancel-request', 'remove-friend');
            return 'none';
        }
    }

    // Plus button functionality for creating new group
    if (plusButton && chatContent) {
        plusButton.addEventListener('click', async () => {
            // Hide welcome container and show chat content
            if (welcomeContainer) welcomeContainer.style.display = 'none';
            chatContent.style.display = 'block';
            
            // Initial UI with new design matching the image
            chatContent.innerHTML = `
                <div class="group-header">
                    <h2>New Group</h2>
                    <button class="create-group-btn" id="createGroupButton">Create</button>
                </div>
                <div class="group-body">
                    <div class="group-avatar-section">
                        <div class="camera-icon">
                            <img src="static/images/like.png" alt="Camera">
                        </div>
                        <input type="text" placeholder="Group name" class="group-name-input">
                    </div>
                    <div class="group-search-section">
                        <div class="search-wrapper">
                            <span class="search-icon">🔍</span>
                            <input type="text" placeholder="Search User" class="group-search-input">
                        </div>
                    </div>
                    <div class="group-friends-section">
                        <h3>Select friends</h3>
                        <ul class="friends-list" id="groupFriendsList">
                            <li class="loading">Loading friends...</li>
                        </ul>
                    </div>
                </div>
            `;
            
            try {
                // Fetch friends using the better API endpoint
                const friendsResponse = await fetch('/api/friends/list', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!friendsResponse || !friendsResponse.ok) {
                    throw new Error('Failed to fetch friends');
                }
                
                // Parse friends data
                const friendsData = await friendsResponse.json();
                const friends = friendsData.friends || [];
                
                // Update the friends list in UI
                const friendsList = chatContent.querySelector('.friends-list');
                friendsList.innerHTML = '';
                
                if (friends.length === 0) {
                    friendsList.innerHTML = '<li class="empty-message">No friends to add to group</li>';
                } else {
                    // Add each friend to the list
                    friends.forEach(friend => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <div class="friend-item">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=${generateAvatarColor(friend.username)}&color=fff&size=40" alt="${friend.username}">
                                <span>${friend.username}</span>
                            </div>
                            <div class="radio-select">
                                <div class="radio-outer">
                                    <div class="radio-inner"></div>
                                </div>
                            </div>
                        `;
                        
                        // Add click event to toggle selection
                        li.addEventListener('click', () => {
                            const radioSelect = li.querySelector('.radio-outer');
                            radioSelect.classList.toggle('selected');
                        });
                        
                        friendsList.appendChild(li);
                    });
                }
                
                // Handle search functionality
                const searchInput = chatContent.querySelector('.group-search-input');
                searchInput.addEventListener('input', () => {
                    const query = searchInput.value.toLowerCase();
                    const friendItems = friendsList.querySelectorAll('li');
                    
                    friendItems.forEach(item => {
                        const friendName = item.querySelector('span')?.textContent.toLowerCase();
                        if (!friendName) return;
                        
                        if (friendName.includes(query)) {
                            item.style.display = '';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
                
                // Handle create button
                const createBtn = chatContent.querySelector('.create-group-btn');
                createBtn.addEventListener('click', async () => {
                    const groupName = chatContent.querySelector('.group-name-input').value.trim();
                    const selectedFriends = Array.from(chatContent.querySelectorAll('.radio-outer.selected')).map(
                        radio => {
                            const li = radio.closest('li');
                            const friendName = li.querySelector('span').textContent;
                            const friend = friends.find(f => f.username === friendName);
                            return friend ? friend.id : null; // Return the friend's ID
                        }
                    ).filter(id => id !== null); // Filter out any null values
                    
                    if (!groupName) {
                        showAlert('Please enter a group name');
                        return;
                    }
                    
                    if (selectedFriends.length === 0) {
                        showAlert('Please select at least one friend');
                        return;
                    }
                    
                    try {
                        // Prepare group data - we can skip description as it's optional
                        const groupData = {
                            name: groupName,
                            member_ids: selectedFriends // Friend IDs
                        };

                        const formData = new FormData();
                        formData.append('name', groupName);
                        formData.append('member_ids', selectedFriends.join(','));
                        formData.append('description', ''); 
                        
                        // Send API request to create group
                        const response = await fetch('/api/rooms/group', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (!response || !response.ok) {
                            throw new Error('Failed to create group');
                        }
                        
                        // Get the created group data
                        const createdGroup = await response.json();

                        if (window.refreshRoomsList) {
                            window.refreshRoomsList();
                        } else {
                            // Use the room data to add a new room item to the list
                            const roomData = {
                                id: data.id,
                                name: data.name,
                                avatar: data.avatar || '/static/images/profile_photo.jpg',
                                is_group: true,
                                last_message: 'Group created. Click to start chatting!',
                                last_message_time: 'Now'
                            };
                            
                            if (window.addRoomToList) {
                                window.addRoomToList(roomData);
                                alert('Group created successfully!');
                            }
                        }
                        window.location.reload();
                        
                        // Optionally refresh the chat list to show the new group
                        if (typeof loadAllUsers === 'function') {
                            loadAllUsers(); // If you have a function to refresh the chat list
                        }
                        
                    } catch (error) {
                        console.error('Error creating group:', error);
                        showAlert('Failed to create group. Please try again.');
                    }
                });
                
            } catch (error) {
                console.error('Error loading friends:', error);
                const friendsList = chatContent.querySelector('.friends-list');
                friendsList.innerHTML = '<li class="error-message">Failed to load friends</li>';
            }
        });
    }

    // Helper function to generate an avatar color from a username
    function generateAvatarColor(username) {
        // Simple hash function for the username to create a color
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Generate color based on hash
        const colors = ['1abc9c', '2ecc71', '3498db', '9b59b6', '34495e', 'f1c40f', 'e67e22', 'e74c3c', 'd35400', 'c0392b'];
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    // Context menu for contact items
    // Add event listeners to contact items for right-click
    function addRightClickToContacts() {
        const contactItems = document.querySelectorAll('.contact-item');
        
        contactItems.forEach(contact => {
            contact.addEventListener('contextmenu', function(e) {
                e.preventDefault(); // Prevent default context menu
                
                // Get contact info
                const contactName = contact.querySelector('.contact-info h4').textContent;
                const isGroup = contact.hasAttribute('data-is-group');
                const roomId = contact.getAttribute('data-room-id');
                const userId = contact.getAttribute('data-user-id');
                
                // Create context menu
                const menu = document.createElement('div');
                menu.classList.add('user-context-menu');
                menu.style.position = 'absolute';
                menu.style.left = `${e.pageX}px`;
                menu.style.top = `${e.pageY}px`;
                menu.style.zIndex = '1000';

                // Different options based on whether it's a group or a user
                if (isGroup) {
                    menu.innerHTML = `
                        <button class="menu-button delete-chat">
                            <img src="static/images/trashbin.png">
                            Delete Chat
                        </button>
                    `;
                } else {
                    menu.innerHTML = `
                        <button class="menu-button delete-chat">
                            <img src="static/images/trashbin.png">
                            Delete Chat
                        </button>
                        <button class="menu-button friend-action">
                            <img src="static/images/profile.png">
                            Add as Friend
                        </button>
                    `;
                }
                
                // Remove existing menus
                document.querySelectorAll('.user-context-menu').forEach(m => m.remove());
                document.body.appendChild(menu);

                // Add click events to buttons
                const deleteButton = menu.querySelector('.delete-chat');
                if (deleteButton) {
                    deleteButton.addEventListener('click', function() {
                        if (confirm(`Are you sure you want to delete this chat with ${contactName}?`)) {
                            // Handle delete chat logic here
                            fetch(`/api/rooms/${roomId}`, {
                                method: 'DELETE'
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    // Remove the contact from the list
                                    contact.remove();
                                    showAlert('Chat deleted successfully');
                                }
                            })
                            .catch(err => {
                                console.error('Error deleting chat:', err);
                                showAlert('Failed to delete chat');
                            });
                        }
                        menu.remove();
                    });
                }

                const friendButton = menu.querySelector('.friend-action');
                if (friendButton && userId) {
                    // Set up the dynamic friendly button
                    (async function() {
                        try {
                            const userData = await getCurrentUserData();
                            if (!userData) return;
                            
                            // Update button text based on current status
                            const status = await updateFriendActionButton(friendButton, userData.id, userId, contactName);
                            
                            // Set up click handler for the button
                            friendButton.addEventListener('click', async function() {
                                try {
                                    const loggedInUserId = userData.id;
                                    
                                    // Perform the appropriate action based on status
                                    if (status === 'accepted') {
                                        // Remove friend
                                        if (confirm(`Are you sure you want to remove ${contactName} from your friends?`)) {
                                            const response = await fetch(`/api/friends/remove/${loggedInUserId}/${userId}`, {
                                                method: 'POST'
                                            });
                                            
                                            if (response.ok) {
                                                showAlert(`${contactName} has been removed from your friends list.`);
                                            } else {
                                                const error = await response.json();
                                                showAlert(`Error: ${error.detail || 'Failed to remove friend'}`);
                                            }
                                        }
                                    } else if (status === 'pending') {
                                        // Cancel friend request
                                        if (confirm(`Are you sure you want to cancel your friend request to ${contactName}?`)) {
                                            const response = await fetch(`/api/friends/remove/${loggedInUserId}/${userId}`, {
                                                method: 'POST'
                                            });
                                            
                                            if (response.ok) {
                                                showAlert(`Friend request to ${contactName} has been canceled.`);
                                            } else {
                                                const error = await response.json();
                                                showAlert(`Error: ${error.detail || 'Failed to cancel request'}`);
                                            }
                                        }
                                    } else if (status === 'incoming') {
                                        // Accept friend request
                                        const response = await fetch(`/api/friends/accept/${loggedInUserId}/${userId}`, {
                                            method: 'POST'
                                        });
                                        
                                        if (response.ok) {
                                            showAlert(`You accepted ${contactName}'s friend request!`);
                                        } else {
                                            const error = await response.json();
                                            showAlert(`Error: ${error.detail || 'Failed to accept request'}`);
                                        }
                                    } else {
                                        // Send new friend request
                                        const response = await fetch(`/api/friends/add/${loggedInUserId}/${userId}`, {
                                            method: 'POST'
                                        });
                                        
                                        if (response.ok) {
                                            showAlert(`Friend request sent to ${contactName}!`);
                                        } else {
                                            const error = await response.json();
                                            showAlert(`Error: ${error.detail || 'Failed to send request'}`);
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error processing friend action:', error);
                                    showAlert('An error occurred while processing your request.');
                                } finally {
                                    menu.remove(); // Close the context menu
                                }
                            });
                        } catch (error) {
                            console.error('Error setting up friend button:', error);
                        }
                    })();
                }

                // Close menu when clicking outside
                document.addEventListener('click', function closeMenu(e) {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                });
            });
        });
    }

    // Initially add event listeners
    addRightClickToContacts();

    // Re-apply event listeners when contacts list changes
    const contactsList = document.getElementById('contactsList');
    if (contactsList) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    addRightClickToContacts();
                }
            });
        });
        
        observer.observe(contactsList, { childList: true });
    }

    // Helper function to show alerts
    function showAlert(message) {
        const alertPopup = document.getElementById('alertPopup');
        const alertMessage = document.getElementById('alertMessage');
        const alertOverlay = document.getElementById('alertOverlay');
        
        if (alertPopup && alertMessage) {
            alertMessage.textContent = message;
            alertPopup.classList.add('active');
            alertOverlay.classList.add('active');
            
            setTimeout(function() {
                alertPopup.classList.remove('active');
                alertOverlay.classList.remove('active');
            }, 2000);
        } else {
            alert(message);
        }
    }
});