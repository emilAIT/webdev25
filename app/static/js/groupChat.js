/**
 * Group Chat functionality for ShrekChat
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
                groupAvatarPreview.src = '/static/images/shrek.jpg';
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
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Group Name',
                    text: 'Please enter a group name.',
                    confirmButtonText: 'OK'
                });
                return;
            }
            
            if (selectedContacts.length === 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Please select at least one contact.',
                    confirmButtonText: 'OK'
                });
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
                        avatar: data.avatar || '/static/images/shrek-logo.png',
                        is_group: true,
                        last_message: 'Group created. Click to start chatting!',
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
                Swal.fire({
                    icon: 'error',
                    title: 'Failed to Create Group',
                    text: 'An error occurred while creating the group. Please try again.',
                    confirmButtonText: 'OK'
                });
            });
        });
    }
    
    // Close Group Management popup
    if (closeGroupManagementPopup) {
        closeGroupManagementPopup.addEventListener('click', function() {
            groupManagementPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Back to Group Chat
    if (backToGroupChat) {
        backToGroupChat.addEventListener('click', function() {
            groupManagementPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Open Add Group Member popup
    if (addGroupMemberLink) {
        addGroupMemberLink.addEventListener('click', function() {
            groupManagementPopup.classList.remove('open');
            addGroupMemberPopup.classList.add('open');
            
            // Reset selected contacts
            selectedContactsForAdd = [];
            confirmAddMember.disabled = true;
            
            // Load contacts not in the group
            loadContactsForAddingToGroup();
        });
    }
    
    // Close Add Group Member popup
    if (closeAddGroupMemberPopup) {
        closeAddGroupMemberPopup.addEventListener('click', function() {
            addGroupMemberPopup.classList.remove('open');
            groupManagementPopup.classList.add('open');
        });
    }
    
    // Cancel Add Member
    if (cancelAddMember) {
        cancelAddMember.addEventListener('click', function() {
            addGroupMemberPopup.classList.remove('open');
            groupManagementPopup.classList.add('open');
        });
    }
    
    // Confirm Add Member
    if (confirmAddMember) {
        confirmAddMember.addEventListener('click', function() {
            if (selectedContactsForAdd.length > 0 && currentGroupId) {
                // Add members to group using API
                const memberIds = selectedContactsForAdd.map(contact => contact.id);
                
                fetch(`/api/rooms/${currentGroupId}/members`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ members: memberIds })
                })
                .then(response => {
                    // if (!response.ok) {
                    //     throw new Error('Failed to add members');
                    // }
                    return response.json();
                })
                .then(data => {
                    console.log('Members added:', data);
                    
                    // Close popup
                    addGroupMemberPopup.classList.remove('open');
                    
                    // Reload group management popup
                    loadGroupDetails(currentGroupId);
                    groupManagementPopup.classList.add('open');
                    
                    // Reset selected contacts
                    selectedContactsForAdd = [];
                })
                .catch(error => {
                    console.error('Error adding members:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Failed to add members. Please try again.',
                        confirmButtonText: 'OK'
                    });
                });
            }
        });
    }
    
    // Leave Group
    if (leaveGroupButton) {
        leaveGroupButton.addEventListener('click', function() {
            if (currentGroupId) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Are you sure?',
                    text: 'You will leave this group and lose access to its messages.',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, leave it!',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed) {
                        // Proceed with leaving the group
                        fetch(`/api/rooms/${currentGroupId}/leave`, {
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
                            
                            // Remove group from contacts list
                            const groupElement = document.querySelector(`.contact-item[data-room-id="${currentGroupId}"]`);
                            if (groupElement) {
                                groupElement.remove();
                            }
                            
                            // Close popup
                            groupManagementPopup.classList.remove('open');
                            overlay.classList.remove('active');
                            
                            // Show welcome screen
                            const welcomeContainer = document.getElementById('welcomeContainer');
                            const chatContent = document.getElementById('chatContent');
                            if (welcomeContainer && chatContent) {
                                welcomeContainer.style.display = 'flex';
                                chatContent.style.display = 'none';
                            }
                        })
                        .catch(error => {
                            console.error('Error leaving group:', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Failed to leave group. Please try again.',
                                confirmButtonText: 'OK'
                            });
                        });
                    }
                });
            }
        });
    }
    
    // Delete Group
    if (deleteGroupButton) {
        deleteGroupButton.addEventListener('click', function() {
            if (currentGroupId) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Are you sure?',
                    text: 'This action cannot be undone.',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, delete it!',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed) {
                        // Proceed with group deletion
                        fetch(`/api/rooms/${currentGroupId}/delete`, {
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
                            
                            // Remove group from contacts list
                            const groupElement = document.querySelector(`.contact-item[data-room-id="${currentGroupId}"]`);
                            if (groupElement) {
                                groupElement.remove();
                            }
                            
                            // Close popup
                            groupManagementPopup.classList.remove('open');
                            overlay.classList.remove('active');
                            
                            // Show welcome screen
                            const welcomeContainer = document.getElementById('welcomeContainer');
                            const chatContent = document.getElementById('chatContent');
                            if (welcomeContainer && chatContent) {
                                welcomeContainer.style.display = 'flex';
                                chatContent.style.display = 'none';
                            }
                        })
                        .catch(error => {
                            console.error('Error deleting group:', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Failed to delete group. Please try again.',
                                confirmButtonText: 'OK'
                            });
                        });
                    }
                });
            }
        });
    }
    
    // Edit Group
    if (editGroupButton) {
        editGroupButton.addEventListener('click', function() {
            if (currentGroupId) {
                // Create edit group popup on the fly if it doesn't exist
                let editGroupPopup = document.getElementById('editGroupPopup');
                if (!editGroupPopup) {
                    // Create the popup element
                    editGroupPopup = document.createElement('div');
                    editGroupPopup.id = 'editGroupPopup';
                    editGroupPopup.className = 'popup';
                    
                    // Create popup content
                    editGroupPopup.innerHTML = `
                        <div class="popup-header">
                            <h3>Edit Group</h3>
                            <button id="closeEditGroupPopup" class="popup-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="popup-content">
                            <div class="group-avatar-container">
                                <div class="group-avatar">
                                    <img id="editGroupAvatarPreview" src="${groupManagementAvatar.src}" alt="Group Avatar">
                                    <div class="avatar-upload-overlay">
                                        <i class="fas fa-camera"></i>
                                    </div>
                                </div>
                                <input type="file" id="editGroupAvatarInput" accept="image/*" style="display: none;">
                            </div>
                            
                            <div class="form-group">
                                <label for="editGroupNameInput">Group Name</label>
                                <input type="text" id="editGroupNameInput" value="${groupManagementName.textContent}">
                            </div>
                            
                            <div class="form-group">
                                <label for="editGroupDescriptionInput">Group Description</label>
                                <textarea id="editGroupDescriptionInput">${groupManagementDescription.textContent}</textarea>
                            </div>
                            
                            <div class="popup-actions">
                                <button id="cancelEditGroup" class="btn-secondary">Cancel</button>
                                <button id="saveGroupChanges" class="btn-primary">Save Changes</button>
                            </div>
                        </div>
                    `;
                    
                    // Add to document
                    document.body.appendChild(editGroupPopup);
                    
                    // Setup avatar upload functionality
                    const editAvatarInput = document.getElementById('editGroupAvatarInput');
                    const editAvatarPreview = document.getElementById('editGroupAvatarPreview');
                    const avatarOverlay = editGroupPopup.querySelector('.avatar-upload-overlay');
                    
                    if (avatarOverlay && editAvatarInput) {
                        avatarOverlay.addEventListener('click', function() {
                            editAvatarInput.click();
                        });
                        
                        editAvatarInput.addEventListener('change', function() {
                            if (this.files && this.files[0]) {
                                const file = this.files[0];
                                const reader = new FileReader();
                                
                                reader.onload = function(e) {
                                    editAvatarPreview.src = e.target.result;
                                };
                                
                                reader.readAsDataURL(file);
                            }
                        });
                    }
                    
                    // Setup close button
                    const closeEditGroupBtn = document.getElementById('closeEditGroupPopup');
                    if (closeEditGroupBtn) {
                        closeEditGroupBtn.addEventListener('click', function() {
                            editGroupPopup.classList.remove('open');
                            overlay.classList.remove('active');
                        });
                    }
                    
                    // Setup cancel button
                    const cancelEditGroupBtn = document.getElementById('cancelEditGroup');
                    if (cancelEditGroupBtn) {
                        cancelEditGroupBtn.addEventListener('click', function() {
                            editGroupPopup.classList.remove('open');
                            overlay.classList.remove('active');
                            groupManagementPopup.classList.add('open');
                        });
                    }
                    
                    // Setup save button
                    const saveGroupChangesBtn = document.getElementById('saveGroupChanges');
                    if (saveGroupChangesBtn) {
                        saveGroupChangesBtn.addEventListener('click', function() {
                            const editGroupNameInput = document.getElementById('editGroupNameInput');
                            const editGroupDescInput = document.getElementById('editGroupDescriptionInput');
                            
                            if (!editGroupNameInput.value.trim()) {
                                Swal.fire({
                                    icon: 'warning',
                                    title: 'Validation Error',
                                    text: 'Group name cannot be empty.',
                                    confirmButtonText: 'OK'
                                });
                                return;
                            }
                            
                            // Create FormData to send updated info
                            const formData = new FormData();
                            formData.append('name', editGroupNameInput.value);
                            formData.append('description', editGroupDescInput.value || '');
                            
                            // Add avatar if changed
                            if (editAvatarInput.files && editAvatarInput.files[0]) {
                                formData.append('avatar', editAvatarInput.files[0]);
                            }
                            
                            // Send update request
                            fetch(`/api/rooms/${currentGroupId}/update`, {
                                method: 'POST',
                                body: formData
                            })
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Failed to update group');
                                }
                                return response.json();
                            })
                            .then(data => {
                                console.log('Group updated:', data);
                                
                                // Update group management screen with new data
                                groupManagementName.textContent = data.name;
                                groupManagementDescription.textContent = data.description || 'No description';
                                if (data.avatar) {
                                    groupManagementAvatar.src = data.avatar;
                                }
                                
                                // Update the room in contacts list if it exists
                                const roomElement = document.querySelector(`.contact-item[data-room-id="${currentGroupId}"]`);
                                if (roomElement) {
                                    const roomNameEl = roomElement.querySelector('.contact-name-time h4');
                                    const roomAvatarEl = roomElement.querySelector('.contact-avatar img');
                                    if (roomNameEl) roomNameEl.textContent = data.name;
                                    if (roomAvatarEl && data.avatar) roomAvatarEl.src = data.avatar;
                                }
                                
                                // Also update the chat header if this group is currently open
                                const chatContent = document.getElementById('chatContent');
                                if (chatContent && chatContent.getAttribute('data-current-room-id') === currentGroupId.toString()) {
                                    const chatContactName = document.getElementById('chatContactName');
                                    const chatContactAvatar = document.getElementById('chatContactAvatar');
                                    
                                    if (chatContactName) chatContactName.textContent = data.name;
                                    if (chatContactAvatar && data.avatar) chatContactAvatar.src = data.avatar;
                                }
                                
                                // Close edit popup and show group management
                                editGroupPopup.classList.remove('open');
                                overlay.classList.add('active');
                                groupManagementPopup.classList.add('open');
                            })
                            .catch(error => {
                                console.error('Error updating group:', error);
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error',
                                    text: 'Failed to update group. Please try again.',
                                    confirmButtonText: 'OK'
                                });
                            });
                        });
                    }
                } else {
                    // If popup already exists, update its contents
                    const editAvatarPreview = document.getElementById('editGroupAvatarPreview');
                    const editGroupNameInput = document.getElementById('editGroupNameInput');
                    const editGroupDescInput = document.getElementById('editGroupDescriptionInput');
                    
                    if (editAvatarPreview) editAvatarPreview.src = groupManagementAvatar.src;
                    if (editGroupNameInput) editGroupNameInput.value = groupManagementName.textContent;
                    if (editGroupDescInput) editGroupDescInput.value = groupManagementDescription.textContent;
                }
                
                // Hide group management popup and show edit popup
                groupManagementPopup.classList.remove('open');
                editGroupPopup.classList.add('open');
                overlay.classList.add('active');
            }
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
                                <img src="${room.avatar || '/static/images/shrek.jpg'}" alt="${room.name}">
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
                                    avatar: room.avatar || '/static/images/shrek.jpg'
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
    
    // Load contacts for adding to group
    function loadContactsForAddingToGroup() {
        if (addMemberContacts && currentGroupId) {
            addMemberContacts.innerHTML = '<div class="loading">Loading contacts...</div>';
            
            // Get group members
            fetch(`/api/rooms/${currentGroupId}/members`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load group members');
                    }
                    return response.json();
                })
                .then(groupMembers => {
                    // Get all rooms/contacts
                    return fetch('/api/rooms')
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to load rooms');
                            }
                            return response.json();
                        })
                        .then(rooms => {
                            // Filter out group chats and contacts already in the group
                            const groupMemberIds = groupMembers.map(member => member.id);
                            return rooms.filter(room => 
                                !room.is_group && !groupMemberIds.includes(room.user_id)
                            );
                        });
                })
                .then(availableContacts => {
                    addMemberContacts.innerHTML = '';
                    
                    if (availableContacts.length === 0) {
                        addMemberContacts.innerHTML = '<div class="no-contacts-message">All contacts are already in the group</div>';
                        return;
                    }
                    
                    availableContacts.forEach(function(room) {
                        const contactElement = selectableContactTemplate.content.cloneNode(true);
                        const contactDiv = contactElement.querySelector('.selectable-contact');
                        const contactAvatar = contactElement.querySelector('img');
                        const contactName = contactElement.querySelector('.contact-name');
                        const contactSelect = contactElement.querySelector('.contact-select');
                        
                        // Set contact data
                        contactAvatar.src = room.avatar || '/static/images/shrek.jpg';
                        contactName.textContent = room.name;
                        contactDiv.setAttribute('data-contact-id', room.user_id);
                        
                        // Handle checkbox click
                        contactSelect.addEventListener('change', function() {
                            if (this.checked) {
                                selectedContactsForAdd.push({
                                    id: room.user_id,
                                    name: room.name,
                                    avatar: room.avatar || '/static/images/shrek.jpg'
                                });
                            } else {
                                selectedContactsForAdd = selectedContactsForAdd.filter(c => c.id !== room.user_id);
                            }
                            
                            // Enable/disable add button
                            confirmAddMember.disabled = selectedContactsForAdd.length === 0;
                        });
                        
                        // Handle clicking on the contact row
                        contactDiv.addEventListener('click', function(event) {
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
                    console.error('Error loading contacts:', error);
                    addMemberContacts.innerHTML = '<div class="error">Failed to load contacts. Please try again.</div>';
                });
        }
    }
    
    // Load group details
    function loadGroupDetails(roomId) {
        if (groupManagementPopup && roomId) {
            currentGroupId = roomId;
            
            // Get group details
            fetch(`/api/rooms/${roomId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load group details');
                    }
                    return response.json();
                })
                .then(room => {
                    // Update group management popup
                    groupManagementAvatar.src = room.avatar || '/static/images/shrek-logo.png';
                    groupManagementName.textContent = room.name;
                    groupManagementDescription.textContent = room.description || 'No description';
                    
                    // Load group members
                    return fetch(`/api/rooms/${roomId}/members`)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to load group members');
                            }
                            return response.json();
                        })
                        .then(members => {
                            // Update members count
                            groupMembersCount.textContent = `(${members.length})`;
                            
                            // Clear and populate members list
                            groupMembersList.innerHTML = '';
                            
                            // Check if current user is an admin
                            const currentUsername = document.querySelector('.profile-name')?.textContent.trim();
                            const currentUser = members.find(member => member.username === currentUsername);
                            const isCurrentUserAdmin = currentUser?.is_admin || false;
                            
                            // Show or hide admin-specific UI elements
                            if (addGroupMemberLink) {
                                addGroupMemberLink.style.display = isCurrentUserAdmin ? 'flex' : 'none';
                            }
                            
                            // Only show delete button for admins
                            if (deleteGroupButton) {
                                deleteGroupButton.style.display = isCurrentUserAdmin ? 'block' : 'none';
                            }
                            
                            members.forEach(function(member) {
                                const memberElement = groupMemberTemplate.content.cloneNode(true);
                                const memberAvatar = memberElement.querySelector('.member-avatar img');
                                const memberName = memberElement.querySelector('.member-name');
                                const memberRole = memberElement.querySelector('.member-role');
                                const memberActionsToggle = memberElement.querySelector('.member-actions-toggle');
                                const makeAdminAction = memberElement.querySelector('.dropdown-item.make-admin');
                                const removeMemberAction = memberElement.querySelector('.dropdown-item.remove-member');
                                
                                // Set member data
                                memberAvatar.src = member.avatar || '/static/images/shrek.jpg';
                                memberName.textContent = member.name;
                                memberRole.textContent = member.is_admin ? 'Admin' : 'Participant';
                                
                                // Hide action toggle button for non-admins or when current user is viewing themselves
                                const isSelf = member.username === currentUsername;
                                if (memberActionsToggle) {
                                    // Only show actions toggle if user is admin AND not looking at themselves
                                    memberActionsToggle.style.display = (isCurrentUserAdmin && !isSelf) ? 'block' : 'none';
                                }
                                
                                // Handle member actions toggle
                                if (memberActionsToggle) {
                                    memberActionsToggle.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        const dropdownMenu = this.nextElementSibling;
                                        dropdownMenu.classList.toggle('active');
                                        
                                        // Close other open dropdowns
                                        document.querySelectorAll('.group-member .dropdown-menu.active').forEach(function(menu) {
                                            if (menu !== dropdownMenu) {
                                                menu.classList.remove('active');
                                            }
                                        });
                                        
                                        // Close dropdown when clicking outside
                                        document.addEventListener('click', function closeDropdown() {
                                            dropdownMenu.classList.remove('active');
                                            document.removeEventListener('click', closeDropdown);
                                        });
                                    });
                                }
                                
                                // Handle make admin action - only shown to admins, and only for non-admin members
                                if (makeAdminAction) {
                                    // Hide make admin option for existing admins
                                    if (member.is_admin) {
                                        makeAdminAction.style.display = 'none';
                                    }
                                    
                                    makeAdminAction.addEventListener('click', function() {
                                        Swal.fire({
                                            icon: 'question',
                                            title: `Make ${member.name} an admin of this group?`,
                                            showCancelButton: true,
                                            confirmButtonText: 'Yes',
                                            cancelButtonText: 'No'
                                        }).then((result) => {
                                            if (result.isConfirmed) {
                                                // Make admin using API
                                                fetch(`/api/rooms/${roomId}/members/${member.id}/make-admin`, {
                                                    method: 'POST'
                                                })
                                                .then(response => {
                                                    if (!response.ok) {
                                                        throw new Error('Failed to make admin');
                                                    }
                                                    return response.json();
                                                })
                                                .then(data => {
                                                    console.log('Made admin:', data);

                                                    // Update member role
                                                    memberRole.textContent = 'Admin';
                                                    makeAdminAction.style.display = 'none'; // Hide make admin option
                                                })
                                                .catch(error => {
                                                    console.error('Error making admin:', error);
                                                    Swal.fire({
                                                        icon: 'error',
                                                        title: 'Error',
                                                        text: 'Failed to make admin. Please try again.',
                                                        confirmButtonText: 'OK'
                                                    });
                                                });
                                            }
                                        });
                                    });
                                }
                                
                                // Handle remove member action - only shown to admins
                                if (removeMemberAction) {
                                    removeMemberAction.addEventListener('click', function() {
                                        Swal.fire({
                                            icon: 'warning',
                                            title: `Remove ${member.name} from this group?`,
                                            text: 'This action cannot be undone.',
                                            showCancelButton: true,
                                            confirmButtonText: 'Yes, remove',
                                            cancelButtonText: 'Cancel'
                                        }).then((result) => {
                                            if (result.isConfirmed) {
                                                // Remove member using API
                                                fetch(`/api/rooms/${roomId}/members/${member.id}`, {
                                                    method: 'DELETE'
                                                })
                                                .then(response => {
                                                    if (!response.ok) {
                                                        throw new Error('Failed to remove member');
                                                    }
                                                    return response.json();
                                                })
                                                .then(data => {
                                                    console.log('Removed member:', data);

                                                    // Remove member from list
                                                    const memberDiv = this.closest('.group-member');
                                                    memberDiv.remove();

                                                    // Update members count
                                                    const currentCount = parseInt(groupMembersCount.textContent.match(/\d+/)[0]);
                                                    groupMembersCount.textContent = `(${currentCount - 1})`;
                                                })
                                                .catch(error => {
                                                    console.error('Error removing member:', error);
                                                    Swal.fire({
                                                        icon: 'error',
                                                        title: 'Error',
                                                        text: 'Failed to remove member. Please try again.',
                                                        confirmButtonText: 'OK'
                                                    });
                                                });
                                            }
                                        });
                                    });
                                }
                                
                                groupMembersList.appendChild(memberElement);
                            });
                        });
                })
                .catch(error => {
                    console.error('Error loading group details:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Failed to load group details. Please try again.',
                        confirmButtonText: 'OK'
                    });
                });
        }
    }
    
    // Search functionality for group member selection
    if (groupMemberSearch) {
        groupMemberSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const contacts = selectableContacts.querySelectorAll('.selectable-contact');
            
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
    
    // Search functionality for add member
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
    
    // Expose loadGroupDetails globally to be accessed from chat.js
    window.loadGroupDetails = loadGroupDetails;
});
// Example function to append a group message
function appendGroupMessage(message) {
    const template = document.getElementById('groupMessageTemplate').content.cloneNode(true);
    template.querySelector('.message').classList.add(message.isOutgoing ? 'outgoing' : 'incoming');
    template.querySelector('.message-sender').textContent = message.senderName;
    template.querySelector('.message-content').textContent = message.content;
    template.querySelector('.message-time').textContent = message.time;
    template.querySelector('.message-avatar img').src = message.senderAvatar; // Set the avatar URL
    document.getElementById('chatMessages').appendChild(template);
}