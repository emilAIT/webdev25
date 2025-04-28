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
        };
        
        // Fetch from the correct endpoint as shown in the provided code
        authenticatedFetch(`http://127.0.0.1:8000/groups/${roomId}`, {
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
            
            // Make sure members exists, default to empty array if not
            const members = groupDetails.members || [];
                
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
                        <img src="${groupDetails.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(groupDetails.name)}&background=${generateAvatarColor(groupDetails.name)}&color=fff&size=80`}"
                             alt="${groupDetails.name}" 
                             class="group-details-avatar">
                        <h2 class="group-details-name">${groupDetails.name}</h2>
                        <p class="group-details-members-count">${members.length} members</p>
                    </div>
                    <ul class="group-details-members-list">
                        ${members.map(member => `
                            <li class="group-details-member" data-member-id="${member.user_id || member.id}">
                                <div class="member-info">
                                    <img src="${member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.username)}&background=${generateAvatarColor(member.username)}&color=fff&size=40`}"
                                         alt="${member.username}" 
                                         class="member-avatar">
                                    <span class="member-name">${member.username}</span>
                                </div>
                                <span class="member-role">${member.role === 'ADMIN' || member.role === 'admin' ? 'Admin' : 
                                    member.role === 'OWNER' || member.role === 'owner' ? 'Owner' : ''}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
            
            // Setup back button
            const backButton = document.querySelector('.back-button');
            if (backButton) {
                backButton.addEventListener('click', () => {
                    // Return to the group chat using the provided openGroupChat function
                    const openGroupChat = (groupId, groupName) => {
                        if (window.openChat) {
                            fetch(`/api/rooms/${groupId}`)
                                .then(response => response.json())
                                .then(roomData => {
                                    window.openChat(roomData);
                                })
                                .catch(error => {
                                    console.error('Failed to fetch room data:', error);
                                });
                        }
                    };
                    
                    openGroupChat(roomId, groupDetails.name);
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
                    groupContextMenu.style.right = `${window.innerWidth - buttonRect.right}px`;
                    
                    // Add menu items
                    groupContextMenu.innerHTML = `
                        <div class="group-menu-item group-add-user-btn">
                            <img src="static/images/profile.png" alt="Add" style="width: 20px; height: 20px; margin-right: 5px;">
                            Add User
                        </div>
                        <div class="group-menu-item group-delete-btn">
                            <img src="static/images/trashbin.png" alt="Delete" style="width: 20px; height: 20px; margin-right: 5px;">
                            Delete Group
                        </div>
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
            });
        })
        .catch(error => {
            console.error('Error loading group details:', error);
            
            if (chatContent) {
                chatContent.innerHTML = '<div class="error-message">Failed to load group details. Please try again.</div>';
            }
        });
    }
    
    // Expose loadGroupDetails globally to be accessed from chat.js
    window.loadGroupDetails = loadGroupDetails;
});