/**
 * Friends handling functionality 
 * This module handles fetching and displaying friends list
 */

// DOM Elements
const friendsModal = document.getElementById('friendsModal');
const closeFriendsModal = document.getElementById('closeFriendsModal');
const friendsDisplay = document.getElementById('friendsDisplay');
const friendsList = document.getElementById('friendsList');
const friendSearchInput = document.getElementById('addFriendInput');

// Friends data store
let allFriends = [];
let selectedFriendId = null;

// Show/hide modal
if (friendsDisplay) {
    friendsDisplay.addEventListener('click', () => {
        fetchFriends();
        friendsModal.style.display = 'flex';
        document.getElementById('contextMenu').style.display = 'none';
    });
}

if (closeFriendsModal) {
    closeFriendsModal.addEventListener('click', () => {
        friendsModal.style.display = 'none';
    });
}

// Helper function to generate a consistent avatar color based on username
function generateAvatarColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.abs(hash).toString(16).substring(0, 6);
    return color.padEnd(6, '0');
}

// Fetch friends from the API
async function fetchFriends() {
    try {
        const response = await fetch('/api/friends/list');
        if (!response.ok) {
            throw new Error('Failed to fetch friends');
        }
        
        const data = await response.json();
        allFriends = data.friends;
        renderFriendsList(allFriends);
    } catch (error) {
        console.error('Error fetching friends:', error);
        // Display error message to user
        showAlert('Error', 'Failed to load friends list. Please try again later.');
    }
}

// Render the friends list to the DOM
function renderFriendsList(friends) {
    // Clear current list
    friendsList.innerHTML = '';
    
    if (friends.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.textContent = 'No friends found. Add some friends to get started!';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.color = '#8a9ab0';
        friendsList.appendChild(emptyMessage);
        return;
    }
    
    // Add each friend to the list
    friends.forEach(friend => {
        const listItem = document.createElement('li');
        listItem.dataset.userId = friend.id;
        
        // Add click handler to each friend item
        listItem.addEventListener('click', () => {
            // Toggle selection of this friend
            const wasSelected = listItem.querySelector('.radio-outer').classList.contains('selected');
            
            // Remove selection from all friends
            document.querySelectorAll('.friends-list .radio-outer').forEach(radio => {
                radio.classList.remove('selected');
            });
            
            // If the item wasn't previously selected, select it now
            if (!wasSelected) {
                listItem.querySelector('.radio-outer').classList.add('selected');
                selectedFriendId = friend.id;
            } else {
                selectedFriendId = null;
            }
        });
        
        // Create the HTML for the friend item
        listItem.innerHTML = `
            <div class="friend-item">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=${generateAvatarColor(friend.username)}&color=fff&size=40" alt="${friend.username}">
                <span>${friend.username}</span>
            </div>
        `;
        
        friendsList.appendChild(listItem);
    });
}

// Filter friends based on search input
if (friendSearchInput) {
    friendSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!searchTerm) {
            renderFriendsList(allFriends);
        } else {
            const filteredFriends = allFriends.filter(friend => 
                friend.username.toLowerCase().includes(searchTerm) || 
                (friend.full_name && friend.full_name.toLowerCase().includes(searchTerm))
            );
            renderFriendsList(filteredFriends);
        }
    });
}

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    if (e.target === friendsModal) {
        friendsModal.style.display = 'none';
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Don't automatically fetch friends on load to avoid unnecessary API calls
    // They will be fetched when the modal is opened
});

// Export functions for use in other modules
export { fetchFriends, selectedFriendId };