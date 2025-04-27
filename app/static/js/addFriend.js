console.log("addFriend.js loaded successfully");

import { showAlertPopup } from './alertPopups.js';

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const addFriendButton = document.getElementById('addFriendButton');
    const addFriendInput = document.getElementById('addFriendInput');
    const searchResults = document.getElementById('searchResults');
    const addFriendPopup = document.getElementById('addFriendPopup');
    const overlay = document.getElementById('overlay');
    const closeAddFriendPopup = document.getElementById('closeAddFriendPopup');
    const addFriendMenuItem = document.getElementById('addContactMenuItem');
    const contactsList = document.getElementById('contactsList');
    
    let selectedUsername = null;

    // Define currentUsername from the DOM
    const currentUsername = document.querySelector('.profile-name')?.textContent.trim();
    if (!currentUsername) {
        console.error('currentUsername is not defined. Ensure the profile name is available in the DOM.');
    }

    // Show add friend popup
    function showAddFriendPopup() {
        if (addFriendPopup) {
            addFriendPopup.classList.add('open');
            if (overlay) overlay.classList.add('active');
            if (addFriendInput) {
                addFriendInput.focus();
                addFriendInput.value = '';
            }
            if (searchResults) {
                searchResults.innerHTML = '';
            }
            selectedUsername = null;
        }
    }

    // Close add friend popup
    function closePopup() {
        if (addFriendPopup) {
            addFriendPopup.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
            if (addFriendInput) {
                addFriendInput.value = '';
            }
            if (searchResults) {
                searchResults.innerHTML = '';
            }
            selectedUsername = null;
        }
    }

    // Event listeners for opening popup
    if (addFriendMenuItem) {
        addFriendMenuItem.addEventListener('click', function() {
            const profileSidebar = document.getElementById('profileSidebar');
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            showAddFriendPopup();
        });
    }

    // Event listeners for closing popup
    if (closeAddFriendPopup) {
        closeAddFriendPopup.addEventListener('click', closePopup);
    }

    if (overlay) {
        overlay.addEventListener('click', function(e) {
            // Only close if clicking directly on overlay, not on popup content
            if (e.target === overlay) {
                closePopup();
            }
        });
    }

    // Search for users as the user types
    if (addFriendInput) {
        addFriendInput.addEventListener('input', debounce(function() {
            const query = addFriendInput.value.trim();
            
            if (query.length < 2) {
                searchResults.innerHTML = '';
                return;
            }
            
            console.log('Searching for users with query:', query);
            
            fetch(`/api/users/search?query=${encodeURIComponent(query)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Search failed');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Search results:', data);
                    searchResults.innerHTML = '';
                    
                    if (data.length === 0) {
                        const noResults = document.createElement('div');
                        noResults.className = 'no-results';
                        noResults.textContent = 'No users found';
                        searchResults.appendChild(noResults);
                        return;
                    }
                    
                    // Make sure the search results container is properly styled
                    searchResults.style.display = 'block';
                    
                    data.forEach(user => {
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        
                        // Add a visual indicator if chat already exists
                        let chatIndicator = '';
                        if (user.has_chat) {
                            chatIndicator = '<span class="already-friend">Already a friend</span>';
                        }
                        
                        div.innerHTML = `
                            <div class="search-result-avatar">
                                <img src="${user.avatar || '/static/images/shrek.jpg'}" alt="${user.full_name || user.username}">
                            </div>
                            <div class="search-result-info">
                                <div class="search-result-name">${user.full_name || user.username}</div>
                                <div class="search-result-username">@${user.username}</div>
                                ${chatIndicator}
                            </div>
                        `;
                        
                        div.addEventListener('click', function() {
                            console.log('Selected user:', user.username);
                            addFriendInput.value = user.username;
                            selectedUsername = user.username;
                            searchResults.innerHTML = '';
                        });
                        
                        searchResults.appendChild(div);
                    });
                })
                .catch(error => {
                    console.error('Error searching for users:', error);
                    searchResults.innerHTML = '<div class="error">Error searching for users</div>';
                });
        }, 300));
    }

    // Ensure dialog windows appear for all relevant messages
    if (addFriendButton) {
        addFriendButton.addEventListener('click', function() {
            console.log('Add Friend button clicked');
            const username = selectedUsername || addFriendInput.value.trim();
            console.log('Username entered:', username);

            if (!username) {
                showAlertPopup('Error', 'Please enter or select a username', 'error');
                return;
            }

            if (username === currentUsername) {
                console.log('Attempted to add yourself as a friend');
                showAlertPopup('Error', 'You cannot add yourself as a friend.', 'error');
                return;
            }

            const existingFriend = Array.from(contactsList.children).find(contact => {
                const contactUsername = contact.querySelector('.contact-info h4')?.textContent;
                return contactUsername === username;
            });

            if (existingFriend) {
                console.log('User is already a friend:', username);
                showAlertPopup('Info', 'This user is already your friend.', 'info');
                return;
            }

            console.log('Sending request to add friend:', username);
            fetch('/api/rooms/direct', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username_to_add: username
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        console.error('Error response from server:', data);
                        throw new Error(data.detail || 'Failed to add contact');
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Friend added successfully:', data);
                if (window.addRoomToList) {
                    window.addRoomToList(data);
                }

                if (window.shrekChatWebSocket && window.shrekChatWebSocket.connectPresenceWebSocket) {
                    window.shrekChatWebSocket.connectPresenceWebSocket();
                }

                showAlertPopup('Success', 'Contact added successfully!', 'info');
                closePopup();
            })
            .catch(error => {
                console.error('Error adding contact:', error);
                showAlertPopup('Error', error.message, 'error');
            });
        });
    }

    // Helper function to debounce search input
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});