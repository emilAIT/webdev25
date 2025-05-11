/**
 * Group Chat functionality for Blink
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - Group Creation
    const createGroupMenuItem = document.getElementById('createGroupMenuItem');
    const createGroupPopup = document.getElementById('createGroupPopup');
    const closeCreateGroupPopup = document.getElementById('closeCreateGroupPopup');
    const selectableContacts = document.getElementById('selectableContacts');
    const cancelGroupCreation = document.getElementById('cancelGroupCreation');
    const proceedToGroupDetails = document.getElementById('proceedToGroupDetails');
    const groupMemberSearch = document.getElementById('groupMemberSearch');
    
    // DOM Elements - Group Details
    const groupDetailsPopup = document.getElementById('groupDetailsPopup');
    const closeGroupDetailsPopup = document.getElementById('closeGroupDetailsPopup');
    const groupAvatarPreview = document.getElementById('groupAvatarPreview');
    const groupAvatarInput = document.getElementById('groupAvatarInput');
    const avatarUploadOverlay = document.querySelector('.avatar-upload-overlay');
    const groupNameInput = document.getElementById('groupNameInput');
    const groupDescriptionInput = document.getElementById('groupDescriptionInput');
    const selectedMembersCount = document.getElementById('selectedMembersCount');
    const selectedMembersAvatars = document.getElementById('selectedMembersAvatars');
    const backToMemberSelection = document.getElementById('backToMemberSelection');
    const createGroupButton = document.getElementById('createGroupButton');
    
    // DOM Elements - Group Management
    const groupManagementPopup = document.getElementById('groupManagementPopup');
    const closeGroupManagementPopup = document.getElementById('closeGroupManagementPopup');
    const groupManagementAvatar = document.getElementById('groupManagementAvatar');
    const groupManagementName = document.getElementById('groupManagementName');
    const groupManagementDescription = document.getElementById('groupManagementDescription');
    const groupMembersCount = document.getElementById('groupMembersCount');
    const groupMembersList = document.getElementById('groupMembersList');
    const addGroupMemberLink = document.getElementById('addGroupMemberLink');
    const backToGroupChat = document.getElementById('backToGroupChat');
    const editGroupButton = document.getElementById('editGroupButton');
    const leaveGroupButton = document.getElementById('leaveGroupButton');
    const deleteGroupButton = document.getElementById('deleteGroupButton');
    
    // DOM Elements - Add Group Member
    const addGroupMemberPopup = document.getElementById('addGroupMemberPopup');
    const closeAddGroupMemberPopup = document.getElementById('closeAddGroupMemberPopup');
    const addMemberSearch = document.getElementById('addMemberSearch');
    const addMemberContacts = document.getElementById('addMemberContacts');
    const cancelAddMember = document.getElementById('cancelAddMember');
    const confirmAddMember = document.getElementById('confirmAddMember');
    
    // General elements
    const contactsList = document.getElementById('contactsList');
    const overlay = document.getElementById('overlay');
    
    // State
    let selectedContacts = [];
    let currentGroupId = null;
    let groupAvatarFile = null;
    let selectedContactsForAdd = [];
    
    // Templates
    const selectableContactTemplate = document.getElementById('selectableContactTemplate');
    const selectedMemberAvatarTemplate = document.getElementById('selectedMemberAvatarTemplate');
    const groupMemberTemplate = document.getElementById('groupMemberTemplate');
    
    // Close Create Group popup
    if (closeCreateGroupPopup) {
        closeCreateGroupPopup.addEventListener('click', function() {
            createGroupPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Cancel Group Creation
    if (cancelGroupCreation) {
        cancelGroupCreation.addEventListener('click', function() {
            createGroupPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Proceed to Group Details
    if (proceedToGroupDetails) {
        proceedToGroupDetails.addEventListener('click', function() {
            if (selectedContacts.length > 0) {
                createGroupPopup.classList.remove('open');
                groupDetailsPopup.classList.add('open');
                
                // Reset group details form
                groupNameInput.value = '';
                groupDescriptionInput.value = '';
                groupAvatarPreview.src = '/static/images/profile_photo.jpg';
                groupAvatarFile = null;
                
                // Update selected members count
                selectedMembersCount.textContent = selectedContacts.length;
                
                // Clear and populate selected members avatars
                selectedMembersAvatars.innerHTML = '';
                selectedContacts.forEach(function(contact) {
                    const memberAvatarElement = selectedMemberAvatarTemplate.content.cloneNode(true);
                    const avatarImg = memberAvatarElement.querySelector('img');
                    avatarImg.src = contact.avatar;
                    avatarImg.alt = contact.name;
                    selectedMembersAvatars.appendChild(memberAvatarElement);
                });
            }
        });
    }
    
    // Back to Member Selection
    if (backToMemberSelection) {
        backToMemberSelection.addEventListener('click', function() {
            groupDetailsPopup.classList.remove('open');
            createGroupPopup.classList.add('open');
        });
    }
    
    // Close Group Details popup
    if (closeGroupDetailsPopup) {
        closeGroupDetailsPopup.addEventListener('click', function() {
            groupDetailsPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Group avatar upload
    if (avatarUploadOverlay && groupAvatarInput) {
        avatarUploadOverlay.addEventListener('click', function() {
            groupAvatarInput.click();
        });
        
        groupAvatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                groupAvatarFile = file;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    groupAvatarPreview.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Toggle create group popup
    if (createGroupMenuItem) {
        createGroupMenuItem.addEventListener('click', function() {
            const profileSidebar = document.getElementById('profileSidebar');
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            
            if (createGroupPopup) {
                createGroupPopup.classList.add('open');
                overlay.classList.add('active');
                
                // Reset selected contacts
                selectedContacts = [];
                
                // Disable next button
                proceedToGroupDetails.disabled = true;
                
                // Load contacts for selection
                loadContactsForSelection();
            }
        });
    }
    
    // Create Group
    if (createGroupButton) {
        createGroupButton.addEventListener('click', function() {
            const groupName = groupNameInput.value.trim();
            const groupDescription = groupDescriptionInput.value.trim();
            
            if (!groupName) {
                alert('Please enter a group name.');
                return;
            }
            
            if (selectedContacts.length === 0) {
                alert('Please select at least one contact.');
                return;
            }
            
            // Create FormData object to send the group data
            const formData = new FormData();
            formData.append('name', groupName);
            formData.append('description', groupDescription);
            
            // Convert selected contacts to comma-separated IDs string
            const memberIds = selectedContacts.map(contact => contact.id).join(',');
            formData.append('member_ids', memberIds);
            
            // Add group avatar if selected
            if (groupAvatarFile) {
                formData.append('avatar', groupAvatarFile);
            }
            
            // Create the group using API
            fetch('/api/rooms/group', {
                method: 'POST',
                body: formData
            })
            .then(data => {
                console.log('Group created:', data);
                
                // Add the new group to the contacts list
                if (window.refreshRoomsList) {
                    window.refreshRoomsList();
                } else {
                    // Use the room data to add a new room item to the list
                    const roomData = {
                        id: data.id,
                        name: data.name,
                        avatar: data.avatar || '/static/images/profile_photo.jpg',
                        is_group: true,
                        last_message: 'Start to chat together!',
                        last_message_time: 'Now'
                    };
                    
                    if (window.addRoomToList) {
                        window.addRoomToList(roomData);
                    }
                }
                
                // Close popup
                groupDetailsPopup.classList.remove('open');
                overlay.classList.remove('active');
                
                // Reset selected contacts
                selectedContacts = [];
            })
            .catch(error => {
                console.error('Error creating group:', error);
                alert('Failed to create group. Please try again.');
            });
        });
    }
    
    // Set up add member popup event listeners
    if (closeAddGroupMemberPopup) {
        closeAddGroupMemberPopup.addEventListener('click', function() {
            addGroupMemberPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    if (cancelAddMember) {
        cancelAddMember.addEventListener('click', function() {
            addGroupMemberPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
      if (confirmAddMember) {
        confirmAddMember.addEventListener('click', function() {
            if (selectedContactsForAdd.length === 0) {
                alert('Please select at least one contact to add to the group.');
                return;
            }
            
            // Extract the IDs as an array of integers
            const memberIds = selectedContactsForAdd.map(contact => parseInt(contact.id));
            
            // Add members to the group using API - using JSON format instead of FormData
            fetch(`/api/rooms/${currentGroupId}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ members: memberIds })
            })            .then(response => {
                if (!response.ok) {
                    if (response.status === 403) {
                        alert('Only group admins can add members to the group.');
                    } else {
                        throw new Error('Failed to add members');
                    }
                    throw new Error(response.status === 403 ? 'Permission denied' : 'Failed to add members');
                }
                return response.json();
            })
            .then(data => {
                console.log('Members added:', data);
                
                // Close popup
                addGroupMemberPopup.classList.remove('open');
                overlay.classList.remove('active');
                
                // Reset selected contacts for add
                selectedContactsForAdd = [];
                
                // Refresh group details to show new members
                loadGroupDetails(currentGroupId);
            })
            .catch(error => {
                console.error('Error adding members:', error);
                alert('Failed to add members. Please try again.');
            });
        });
    }
    
    // Add member search functionality
    if (addMemberSearch) {
        addMemberSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const contacts = addMemberContacts.querySelectorAll('.selectable-contact');
            
            contacts.forEach(function(contact) {
                const name = contact.querySelector('.contact-name').textContent.toLowerCase();
                if (name.includes(searchTerm)) {
                    contact.style.display = 'flex';
                } else {
                    contact.style.display = 'none';
                }
            });
        });
    }
    
    // Load contacts for selection
    function loadContactsForSelection() {
        if (selectableContacts) {
            selectableContacts.innerHTML = '<div class="loading">Loading contacts...</div>';
            
            fetch('/api/rooms')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load rooms');
                    }
                    return response.json();
                })
                .then(rooms => {
                    selectableContacts.innerHTML = '';
                    
                    // Filter to get only direct chat rooms
                    const directRooms = rooms.filter(room => !room.is_group);
                    
                    if (directRooms.length === 0) {
                        selectableContacts.innerHTML = '<div class="no-contacts-message">No contacts found. Add friends first!</div>';
                        return;
                    }
                    
                    directRooms.forEach(function(room) {
                        const contactElement = document.createElement('div');
                        contactElement.className = 'selectable-contact';
                        contactElement.setAttribute('data-contact-id', room.user_id);
                        
                        // Create contact HTML with visible checkbox
                        contactElement.innerHTML = `
                            <input type="checkbox" id="contact_${room.user_id}" class="contact-select">
                            <div class="contact-avatar">
                                <img src="${room.avatar || '/static/images/profile_photo.jpg'}" alt="${room.name}">
                            </div>
                            <div class="contact-name">${room.name}</div>
                        `;
                        
                        const contactSelect = contactElement.querySelector('.contact-select');
                        
                        // Handle checkbox click
                        contactSelect.addEventListener('change', function() {
                            if (this.checked) {
                                selectedContacts.push({
                                    id: room.user_id,
                                    name: room.name,
                                    avatar: room.avatar || '/static/images/profile_photo.jpg'
                                });
                            } else {
                                selectedContacts = selectedContacts.filter(c => c.id !== room.user_id);
                            }
                            
                            // Enable/disable next button - require at least one member
                            proceedToGroupDetails.disabled = selectedContacts.length === 0;
                        });
                        
                        // Handle clicking on the contact row
                        contactElement.addEventListener('click', function(event) {
                            if (event.target !== contactSelect) {
                                contactSelect.checked = !contactSelect.checked;
                                
                                // Trigger the change event
                                const changeEvent = new Event('change');
                                contactSelect.dispatchEvent(changeEvent);
                            }
                        });
                        
                        selectableContacts.appendChild(contactElement);
                    });
                })
                .catch(error => {
                    console.error('Error loading rooms:', error);
                    selectableContacts.innerHTML = '<div class="error">Failed to load contacts. Please try again.</div>';
                });
        }
    }
    
    // Load group details - Replace with new implementation that uses in-chat UI
    function loadGroupDetails(roomId) {
        // Store current group ID for other functions that might need it
        currentGroupId = roomId;
        
        // Close any existing popups/overlays that might be open
        overlay.classList.remove('active');
        if (groupManagementPopup) {
            groupManagementPopup.classList.remove('open');
        }
        
        const chatContent = document.getElementById('chatContent');
        if (!chatContent) {
            console.error('Chat content element not found');
            return;
        }
        
        // Helper function to generate avatar color
        const generateAvatarColor = (name) => {
            // Simple hash function for consistent colors
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const color = Math.abs(hash % 360);
            return `hsl(${color}, 70%, 40%)`.replace('#', '');
        };
        
        // Helper function for authenticated fetch (matches the format used in the prompt)
        const authenticatedFetch = (url, options = {}) => {
            // Replace external URL with local API path if needed
            const apiUrl = url.includes('http://127.0.0.1:8000') ? 
                url.replace('http://127.0.0.1:8000', '') : url;
            return fetch(apiUrl, options);
        };          // Fetch group details first, then fetch members separately
        let groupDetailsData = null;
        
        // Fetch from the correct endpoint
        authenticatedFetch(`http://127.0.0.1:8000/api/rooms/${roomId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch group details');
            }
            return response.json();
        })
        .then(groupDetails => {
            console.log('Group details loaded:', groupDetails);
            groupDetailsData = groupDetails;
            
            // Now fetch the members list
            return authenticatedFetch(`http://127.0.0.1:8000/api/rooms/${roomId}/members`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
        })        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch group members');
            }
            return response.json();
        })        .then(members => {
            console.log('Group members loaded:', members);            // Get the current user ID from API response with multiple fallback strategies
            let isAdmin = false;
            
            // Method 1: Try to get current user ID from groupDetailsData (most reliable)
            const currentUserId = groupDetailsData.current_user_id;
            console.log('Method 1 - Current user ID from API:', currentUserId);
            
            if (currentUserId) {
                // Use the current user ID to find yourself in the members list
                const currentUserData = members.find(member => member.id === currentUserId);
                isAdmin = currentUserData ? currentUserData.is_admin : false;
                console.log('Method 1 - Current user data:', currentUserData);
                console.log('Method 1 - Admin check result:', isAdmin);
            }
            
            // Method 2: Try getting username from editProfileMenuItem which contains the real username
            if (!isAdmin) {
                const editProfileMenuItem = document.getElementById('editProfileMenuItem');
                const realUsername = editProfileMenuItem ? editProfileMenuItem.textContent.trim() : '';
                console.log('Method 2 - Username from editProfileMenuItem:', realUsername);
                
                if (realUsername) {
                    const currentUserData = members.find(member => member.username === realUsername);
                    if (currentUserData) {
                        isAdmin = currentUserData.is_admin;
                        console.log('Method 2 - Current user data:', currentUserData);
                        console.log('Method 2 - Admin check result:', isAdmin);
                    }
                }
            }
            
            // Method 3: Last resort - try getting username from profile-name element
            if (!isAdmin) {
                const currentUsername = document.querySelector('.profile-name')?.textContent.trim() || '';
                console.log('Method 3 - Username from profile-name:', currentUsername);
                
                if (currentUsername && currentUsername !== 'Chat') {
                    const currentUserData = members.find(member => member.username === currentUsername);
                    if (currentUserData) {
                        isAdmin = currentUserData.is_admin;
                        console.log('Method 3 - Current user data:', currentUserData);
                        console.log('Method 3 - Admin check result:', isAdmin);
                    }
                }
            }
            
            // Method 4: If all else fails and we're in debug mode, look for any admin in the list
            if (!isAdmin && members.some(m => m.is_admin)) {
                // Find and log all admins to help with debugging
                const admins = members.filter(m => m.is_admin);
                console.log('Method 4 - All admins in group:', admins);
                
                // Don't automatically set isAdmin to true, just log the information
                console.log('Note: Found admin users but could not confirm if current user is one of them');
            }
            
            console.log('Final admin status determination:', isAdmin);
                
            // Show the chat content
            if (chatContent.style.display !== 'flex') {
                chatContent.style.display = 'flex';
            }
            
            // Welcome container might be showing - hide it
            const welcomeContainer = document.getElementById('welcomeContainer');
            if (welcomeContainer) {
                welcomeContainer.style.display = 'none';
            }
              // Render group details in the chat content area
            chatContent.innerHTML = `
                <div class="group-details-container">
                    <div class="group-details-header">
                        <div class="back-button-container">
                            <img src="static/images/back.png" alt="Back" class="back-button">
                        </div>
                        <div class="menu-button-container">
                            <img src="static/images/menu.png" alt="Menu" class="group-menu-button">
                        </div>
                        <img src="${groupDetailsData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(groupDetailsData.name)}&background=${generateAvatarColor(groupDetailsData.name)}&color=fff&size=80`}"
                             alt="${groupDetailsData.name}" 
                             class="group-details-avatar">
                        <h2 class="group-details-name">${groupDetailsData.name}</h2>
                        <p class="group-details-members-count">${members.length} members</p>
                    </div>
                    <ul class="group-details-members-list">
                        ${members.map(member => `
                            <li class="group-details-member" data-member-id="${member.id}">
                                <div class="member-info">                                    <img src="${member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.username)}&background=${generateAvatarColor(member.username)}&color=fff&size=40`}"
                                         alt="${member.username}" 
                                         class="member-avatar">
                                    <span class="member-name" style="color: #FFFFFF;">${member.username}</span>
                                </div>
                                <span class="member-role">${member.is_admin ? 'Admin' : ''}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
              // Setup back button
            const backButton = document.querySelector('.back-button');
            if (backButton) {
                backButton.addEventListener('click', () => {
                    // Use direct API call and openChat instead of simulating click
                    fetch(`/api/rooms/${roomId}`)
                        .then(response => response.json())
                        .then(roomData => {
                            // First - reset the chat content to empty
                            chatContent.innerHTML = '';
                            
                            // Set display to none so that openChat will correctly reinitialize it
                            chatContent.style.display = 'none';
                            
                            // Then call openChat which will properly initialize everything
                            if (window.openChat) {
                                window.openChat(roomData);
                            }
                        })
                        .catch(error => {
                            console.error('Failed to fetch room data:', error);
                        });
                });
            }
            
            // Setup group menu button functionality
            const groupMenuButton = document.querySelector('.group-menu-button');
            if (groupMenuButton) {
                groupMenuButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // Remove any existing group menus
                    document.querySelectorAll('.group-details-context-menu').forEach(menu => menu.remove());
                    
                    // Create context menu
                    const groupContextMenu = document.createElement('div');
                    groupContextMenu.classList.add('group-details-context-menu');
                    groupContextMenu.id = 'group-details-action-menu';
                    
                    // Position menu
                    const buttonRect = groupMenuButton.getBoundingClientRect();
                    groupContextMenu.style.position = 'absolute';
                    groupContextMenu.style.top = `${buttonRect.bottom + 5}px`;
                    groupContextMenu.style.right = `${window.innerWidth - buttonRect.right}px`;                    // Add menu items
                    groupContextMenu.innerHTML = `
                        ${isAdmin ? `
                        <div class="group-menu-item group-add-user-btn">
                            <img src="static/images/profile.png" alt="Add" style="width: 20px; height: 20px; margin-right: 5px;">
                            Add User
                        </div>
                        <div class="group-menu-item group-delete-btn">
                            <img src="static/images/trashbin.png" alt="Delete" style="width: 20px; height: 20px; margin-right: 5px;">
                            Delete Group
                        </div>
                        ` : `
                        <div class="group-menu-item group-leave-btn">
                            <img src="static/images/back.png" alt="Leave" style="width: 20px; height: 20px; margin-right: 5px;">
                            Leave Group
                        </div>
                        `}
                    `;
                    
                    // Style the menu
                    Object.assign(groupContextMenu.style, {
                        background: '#353C46',
                        borderRadius: '8px', 
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                        zIndex: '1000',
                        overflow: 'hidden',
                        minWidth: '150px'
                    });
                    
                    // Style menu items
                    groupContextMenu.querySelectorAll('.group-menu-item').forEach(item => {
                        Object.assign(item.style, {
                            padding: '10px',
                            borderBottom: '1px solid #444',
                            background: '#353C46',
                            color: item.classList.contains('group-delete-btn') ? '#CF5656' : '#FFFFFF',
                            fontWeight: '400',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        });
                    });
                    
                    // Remove border from last item
                    const lastItem = groupContextMenu.querySelector('.group-menu-item:last-child');
                    if (lastItem) lastItem.style.borderBottom = 'none';
                      document.body.appendChild(groupContextMenu);
                    
                    // Add event listeners for the menu items
                    const addUserBtn = groupContextMenu.querySelector('.group-add-user-btn');
                    if (addUserBtn) {
                        addUserBtn.addEventListener('click', () => {
                            // Hide the menu
                            groupContextMenu.remove();
                            
                            // Show the add member popup
                            if (addGroupMemberPopup) {
                                addGroupMemberPopup.classList.add('open');
                                overlay.classList.add('active');
                                
                                // Load contacts for adding to the group
                                loadContactsForAddMember();
                                
                                // Disable confirm button initially
                                if (confirmAddMember) {
                                    confirmAddMember.disabled = true;
                                }
                            }
                        });
                    }
                      // Setup delete group button
                    const deleteGroupBtn = groupContextMenu.querySelector('.group-delete-btn');
                    if (deleteGroupBtn) {
                        deleteGroupBtn.addEventListener('click', () => {
                            // Hide the menu
                            groupContextMenu.remove();
                            
                            // Confirm before deletion
                            if (confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
                                // Delete the group using API
                                fetch(`/api/rooms/${roomId}`, {
                                    method: 'DELETE'
                                })
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Failed to delete group');
                                    }
                                    return response.json();
                                })
                                .then(data => {
                                    console.log('Group deleted:', data);
                                    
                                    // Return to the main chat screen or refresh the rooms list
                                    if (window.refreshRoomsList) {
                                        window.refreshRoomsList();
                                    }
                                    
                                    // Clear the chat content
                                    chatContent.innerHTML = '';
                                    chatContent.style.display = 'none';
                                    
                                    // Show the welcome container if it exists
                                    const welcomeContainer = document.getElementById('welcomeContainer');
                                    if (welcomeContainer) {
                                        welcomeContainer.style.display = 'flex';
                                    }
                                })
                                .catch(error => {
                                    console.error('Error deleting group:', error);
                                    alert('Failed to delete group. Please try again.');
                                });
                            }
                        });
                    }
                    
                    // Setup leave group button
                    const leaveGroupBtn = groupContextMenu.querySelector('.group-leave-btn');
                    if (leaveGroupBtn) {
                        leaveGroupBtn.addEventListener('click', () => {
                            // Hide the menu
                            groupContextMenu.remove();
                            
                            // Confirm before leaving
                            if (confirm('Are you sure you want to leave this group?')) {
                                // Leave the group using API
                                fetch(`/api/rooms/${roomId}/leave`, {
                                    method: 'POST'
                                })
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Failed to leave group');
                                    }
                                    return response.json();
                                })
                                .then(data => {
                                    console.log('Left group:', data);
                                    
                                    // Return to the main chat screen or refresh the rooms list
                                    if (window.refreshRoomsList) {
                                        window.refreshRoomsList();
                                    }
                                    
                                    // Clear the chat content
                                    chatContent.innerHTML = '';
                                    chatContent.style.display = 'none';
                                    
                                    // Show the welcome container if it exists
                                    const welcomeContainer = document.getElementById('welcomeContainer');
                                    if (welcomeContainer) {
                                        welcomeContainer.style.display = 'flex';
                                    }
                                })
                                .catch(error => {
                                    console.error('Error leaving group:', error);
                                    alert('Failed to leave group. Please try again.');
                                });
                            }
                        });
                    }
                    
                    // Close menu when clicking elsewhere
                    document.addEventListener('click', function closeGroupContextMenu(event) {
                        const menu = document.getElementById('group-details-action-menu');
                        if (menu && !menu.contains(event.target) && event.target !== groupMenuButton) {
                            menu.remove();
                            document.removeEventListener('click', closeGroupContextMenu);
                        }
                    });
                });
            }
              // Setup member context menu functionality
            const groupMembers = document.querySelectorAll('.group-details-member');
            groupMembers.forEach(member => {
                member.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    
                    const memberId = member.getAttribute('data-member-id');
                    const memberName = member.querySelector('.member-name').textContent;
                    
                    if (!memberId) {
                        console.error('Member ID not found');
                        return;
                    }
                    
                    // Remove any existing context menus
                    document.querySelectorAll('.message-context-menu').forEach(menu => menu.remove());
                    
                    // Create context menu
                    const menu = document.createElement('div');
                    menu.classList.add('message-context-menu');
                    menu.style.position = 'absolute';
                    menu.style.left = `${e.pageX}px`;
                    menu.style.top = `${e.pageY}px`;
                    
                    menu.innerHTML = `
                        <button class="menu-button delete-member">
                            Delete
                        </button>
                        <button class="menu-button make-admin">
                            Make Admin
                        </button>
                    `;
                    
                    document.body.appendChild(menu);
                    
                    // Close menu when clicking outside
                    document.addEventListener('click', function closeMenu(event) {
                        if (!menu.contains(event.target)) {
                            menu.remove();
                            document.removeEventListener('click', closeMenu);
                        }
                    });
                });
            });        })
        .catch(error => {
            console.error('Error loading group details or members:', error);
            
            if (chatContent) {
                chatContent.innerHTML = '<div class="error-message">Failed to load group details. Please try again.</div>';
            }
        });
    }
    
    // Expose loadGroupDetails globally to be accessed from chat.js
    window.loadGroupDetails = loadGroupDetails;

    // Function to load contacts for adding to a group
    function loadContactsForAddMember() {
        if (addMemberContacts) {
            addMemberContacts.innerHTML = '<div class="loading">Loading contacts...</div>';
            
            // Fetch all direct chat rooms (contacts)
            fetch('/api/rooms')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load rooms');
                    }
                    return response.json();
                })
                .then(rooms => {
                    addMemberContacts.innerHTML = '';
                    
                    // Filter to get only direct chat rooms
                    const directRooms = rooms.filter(room => !room.is_group);
                    
                    if (directRooms.length === 0) {
                        addMemberContacts.innerHTML = '<div class="no-contacts-message">No contacts found. Add friends first!</div>';
                        return;
                    }
                    
                    // Once we have a list of contacts, fetch the current group members to exclude them
                    fetch(`/api/rooms/${currentGroupId}/members`)
                        .then(response => response.json())
                        .then(members => {
                            // Get IDs of existing members
                            const existingMemberIds = members.map(member => member.id);
                            
                            // Filter out contacts who are already in the group
                            const availableContacts = directRooms.filter(room => 
                                !existingMemberIds.includes(room.user_id)
                            );
                            
                            if (availableContacts.length === 0) {
                                addMemberContacts.innerHTML = '<div class="no-contacts-message">All your contacts are already in this group.</div>';
                                return;
                            }
                            
                            // Reset selected contacts for add
                            selectedContactsForAdd = [];
                            
                            // Add each available contact to the list
                            availableContacts.forEach(function(room) {
                                const contactElement = document.createElement('div');
                                contactElement.className = 'selectable-contact';
                                contactElement.setAttribute('data-contact-id', room.user_id);
                                
                                // Create contact HTML with visible checkbox
                                contactElement.innerHTML = `
                                    <input type="checkbox" id="add_contact_${room.user_id}" class="contact-select">
                                    <div class="contact-avatar">
                                        <img src="${room.avatar || '/static/images/profile_photo.jpg'}" alt="${room.name}">
                                    </div>
                                    <div class="contact-name">${room.name}</div>
                                `;
                                
                                const contactSelect = contactElement.querySelector('.contact-select');
                                  // Handle checkbox click
                                contactSelect.addEventListener('change', function() {
                                    if (this.checked) {
                                        selectedContactsForAdd.push({
                                            id: parseInt(room.user_id),  // Ensure ID is an integer
                                            name: room.name,
                                            avatar: room.avatar || '/static/images/profile_photo.jpg'
                                        });
                                    } else {
                                        selectedContactsForAdd = selectedContactsForAdd.filter(c => c.id !== parseInt(room.user_id));
                                    }
                                    
                                    // Enable/disable confirm button based on selection
                                    if (confirmAddMember) {
                                        confirmAddMember.disabled = selectedContactsForAdd.length === 0;
                                    }
                                });
                                
                                // Handle clicking on the contact row
                                contactElement.addEventListener('click', function(event) {
                                    if (event.target !== contactSelect) {
                                        contactSelect.checked = !contactSelect.checked;
                                        
                                        // Trigger the change event
                                        const changeEvent = new Event('change');
                                        contactSelect.dispatchEvent(changeEvent);
                                    }
                                });
                                
                                addMemberContacts.appendChild(contactElement);
                            });
                        })
                        .catch(error => {
                            console.error('Error loading group members:', error);
                            addMemberContacts.innerHTML = '<div class="error">Failed to load group members. Please try again.</div>';
                        });
                })
                .catch(error => {
                    console.error('Error loading rooms:', error);
                    addMemberContacts.innerHTML = '<div class="error">Failed to load contacts. Please try again.</div>';
                });
        }
    }
});