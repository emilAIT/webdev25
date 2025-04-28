// REMOVED: Transformer.js imports
// import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2';
// env.allowLocalModels = false;

// Use a simple function for showing toasts or ensure utils.js defines showToast correctly
const showToast = (message, type = 'info') => {
    if (typeof Toastify !== 'function') {
        console.warn("Toastify is not loaded. Cannot show toast:", message);
        return;
    }
    const backgroundColor = {
        info: "#3B82F6",    // Blue-500
        success: "#10B981", // Emerald-500
        error: "#EF4444",   // Red-500
        warning: "#F59E0B", // Amber-500
    }[type] || "#6B7280"; // Gray-500 for default

    Toastify({
        text: message,
        duration: 3000,
        gravity: "top", // `top` or `bottom`
        position: "right", // `left`, `center` or `right`
        style: { background: backgroundColor },
        stopOnFocus: true, // Prevents dismissing of toast on hover
    }).showToast();
};


import { setupMessageHandlers, setupReplyUI, hideReplyUI, handleMessageClick, clearMessageSelection } from './messageHandlers.js';
import { initializeSocket, joinConversation, socket } from './socket.js'; // Import socket instance
import { showProfile } from './profile.js';
import { initMessageInteractions, getReplyData } from './messageInteractions.js'; // Removed startReply import


let currentConversationId = null;
let currentUserId = null;
let conversations = [];

// --- AI Feature Integration (Now uses Backend API) ---
const fixGrammarBtn = document.getElementById('fix-grammar-btn');
const completeSentenceBtn = document.getElementById('complete-sentence-btn');
const translateBtn = document.getElementById('translate-btn'); // Added translate button
const messageInput = document.getElementById('message-input');

// REMOVED: AI Model variables (grammarFixer, textCompleter)
// REMOVED: initializeAIModels function

// --- Helper function for AI API calls ---
async function callAIApi(endpoint, payload, buttonElement) {
    const text = payload.text; // Extract text for validation
    if (!text || !text.trim()) {
        showToast('Please enter some text first.', 'warning');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Authentication error. Please log in again.', 'error');
        return;
    }

    // Disable button and show loading state
    buttonElement.disabled = true;
    const originalButtonContent = buttonElement.innerHTML; // Store original icon
    buttonElement.innerHTML = `
        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    `; // Spinner
    showToast('Processing with AI...', 'info'); // Show loading toast

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload) // Send the full payload
        });

        const responseData = await response.json().catch(() => null); // Attempt to parse JSON always

        if (!response.ok) {
            const errorMsg = responseData?.error || `API Error (${response.status})`;
            console.error(`AI API Error (${response.status}):`, responseData || response.statusText);
            showToast(`AI Error: ${errorMsg}`, 'error');
            return; // Don't clear input on error
        }

        if (responseData && responseData.result) {
            messageInput.value = responseData.result;
            showToast('AI processing complete!', 'success');
        } else {
            showToast('AI returned no result or an unexpected response.', 'warning');
            console.warn("Unexpected AI response:", responseData);
        }

    } catch (error) {
        console.error('Failed to call AI API:', error);
        showToast('Network error during AI request. Please check your connection.', 'error');
    } finally {
        // Re-enable button and restore icon
        buttonElement.disabled = false; // Re-enable regardless of success/failure
        buttonElement.innerHTML = originalButtonContent;
        // Re-evaluate button states based on potentially changed input
        messageInput.dispatchEvent(new Event('input'));
    }
}

// Event listener for Fix Grammar button
fixGrammarBtn.addEventListener('click', () => {
    console.log('Fix Grammar button clicked.');
    const text = messageInput.value.trim();
    callAIApi('/ai/fix-grammar', { text }, fixGrammarBtn);
});

// Event listener for Complete Sentence button
completeSentenceBtn.addEventListener('click', () => {
    console.log('Complete Sentence button clicked.');
    const text = messageInput.value; // Send potentially incomplete text
    callAIApi('/ai/complete-sentence', { text }, completeSentenceBtn);
});

// Event listener for Translate button
translateBtn.addEventListener('click', () => {
    console.log('Translate button clicked.');
    const text = messageInput.value.trim();
    // Example: Translate to Spanish. You can add UI to select target language.
    const targetLanguage = 'Spanish'; // Make this dynamic later
    showToast(`Translating to ${targetLanguage}...`, 'info');
    callAIApi('/ai/translate', { text, target_language: targetLanguage }, translateBtn);
});

// Enable/disable AI buttons based on input content
messageInput.addEventListener('input', () => {
    const hasText = messageInput.value.trim().length > 0;
    // Enable all AI buttons if there's text, disable otherwise
    // Actual API availability is checked server-side, but this provides immediate UI feedback.
    fixGrammarBtn.disabled = !hasText;
    completeSentenceBtn.disabled = !hasText;
    translateBtn.disabled = !hasText;
});


document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    console.log('Token found in localStorage:', token ? 'Yes' : 'No');

    // Get references to all sections
    const welcomeSection = document.getElementById('welcome');
    const signinSection = document.getElementById('signin');
    const signupSection = document.getElementById('signup');
    const chatSection = document.getElementById('chat');
    const profileSection = document.getElementById('profile');

    // Function to hide all main sections
    const hideAllSections = () => {
        welcomeSection.classList.add('hidden');
        signinSection.classList.add('hidden');
        signupSection.classList.add('hidden');
        chatSection.classList.add('hidden');
        profileSection.classList.add('hidden');
    };

    // Welcome screen button handlers
    const welcomeSigninBtn = document.getElementById('welcome-signin-btn');
    const welcomeSignupBtn = document.getElementById('welcome-signup-btn');

    if (welcomeSigninBtn) {
        welcomeSigninBtn.addEventListener('click', () => {
            hideAllSections();
            signinSection.classList.remove('hidden');
        });
    }

    if (welcomeSignupBtn) {
        welcomeSignupBtn.addEventListener('click', () => {
            hideAllSections();
            signupSection.classList.remove('hidden');
        });
    }

    // --- Token Validation and Initialization ---
    if (!token) {
        hideAllSections();
        welcomeSection.classList.remove('hidden');
        console.log('No token found, showing welcome page');
        return; // Stop further execution if no token
    }

    try {
        console.log('Validating token...');
        const userResponse = await fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!userResponse.ok) {
            console.error('Token validation failed:', userResponse.status, userResponse.statusText);
            localStorage.removeItem('token'); // Remove invalid token
            hideAllSections();
            welcomeSection.classList.remove('hidden');
            showToast('Session expired or invalid. Please sign in again.', 'error');
            return; // Stop execution
        }

        const userData = await userResponse.json();
        currentUserId = userData.id;
        console.log('Current user:', userData);

        // --- Show chat section and Initialize ---
        hideAllSections();
        chatSection.classList.remove('hidden');

        // Initialize socket connection (ensure it handles token)
        if (typeof initializeSocket === 'function') {
            initializeSocket(); // Socket should connect using the token
        } else {
            console.error("initializeSocket function not found!");
            // Handle error appropriately, maybe show error toast
        }

        // Load initial conversations
        await loadConversations();

        // Setup message handlers and interactions now that chat UI is visible
        if (typeof setupMessageHandlers === 'function') {
            setupMessageHandlers();
        } else {
            console.error("setupMessageHandlers function not found!");
        }
        if (typeof initMessageInteractions === 'function') {
            initMessageInteractions(); // Initialize double-click reply etc.
        } else {
            console.error("initMessageInteractions function not found!");
        }

        // Check initial input state for AI buttons (they are disabled by default in HTML)
        messageInput.dispatchEvent(new Event('input'));

        console.log('Chat initialized successfully.');

    } catch (error) {
        console.error('Initialization error:', error);
        localStorage.removeItem('token'); // Clear token on error
        hideAllSections();
        welcomeSection.classList.remove('hidden');
        showToast('An error occurred during initialization. Please try again.', 'error');
        return;
    }

    // --- Event Listeners Setup (Modal toggles, Search, Profile, etc.) ---

    const searchInput = document.getElementById('chat-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        // Filter based on the 'conversations' array
        const filteredConversations = conversations.filter(conv =>
            conv.name.toLowerCase().includes(query) || // Check conversation name
            (conv.participants || []).some(p => p.toLowerCase().includes(query)) // Check participant names if available
        );
        renderChatList(filteredConversations); // Re-render the list with filtered results
    });

    // Modals
    const newConversationModal = document.getElementById('new-conversation-modal');
    const newConversationBtn = document.getElementById('new-conversation-btn');
    const menuModal = document.getElementById('menu-modal');
    const menuBtn = document.getElementById('menu-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const myProfileBtn = document.getElementById('my-profile-btn');
    const newChatModal = document.getElementById('new-chat-modal');
    const newChatBtn = document.getElementById('new-chat-btn');
    const newGroupModal = document.getElementById('new-group-modal');
    const newGroupBtn = document.getElementById('new-group-btn');

    // Generic outside click handler for modals
    document.addEventListener('click', (e) => {
        // Close New Conversation Options Modal
        if (newConversationModal && !newConversationModal.classList.contains('hidden') && !newConversationModal.contains(e.target) && e.target !== newConversationBtn) {
            newConversationModal.classList.add('hidden');
        }
        // Close Main Menu Modal
        if (menuModal && !menuModal.classList.contains('hidden') && !menuModal.contains(e.target) && e.target !== menuBtn && !menuBtn.contains(e.target) /* handle click on SVG inside button */) {
            menuModal.classList.add('hidden');
        }
        // Close New Chat Modal
        if (newChatModal && !newChatModal.classList.contains('hidden') && !newChatModal.querySelector('.bg-white').contains(e.target)) {
            // newChatModal.classList.add('hidden'); // Optionally close on outside click
        }
        // Close New Group Modal
        if (newGroupModal && !newGroupModal.classList.contains('hidden') && !newGroupModal.querySelector('.bg-white').contains(e.target)) {
            // newGroupModal.classList.add('hidden'); // Optionally close on outside click
        }
    });

    // Toggle Buttons
    if (newConversationBtn && newConversationModal) {
        newConversationBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click listener from closing it immediately
            menuModal?.classList.add('hidden'); // Close other modal if open
            newConversationModal.classList.toggle('hidden');
        });
    }

    if (menuBtn && menuModal) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            newConversationModal?.classList.add('hidden'); // Close other modal
            menuModal.classList.toggle('hidden');
            // Position menu modal near the button
            const rect = menuBtn.getBoundingClientRect();
            menuModal.style.position = 'fixed'; // Use fixed to position relative to viewport
            menuModal.style.top = `${rect.bottom + 5}px`; // Below the button
            menuModal.style.left = `${rect.left}px`; // Align left edge
        });
    }

    // Menu Actions
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            if (socket && socket.connected) {
                socket.disconnect(); // Disconnect socket on logout
            }
            hideAllSections();
            welcomeSection.classList.remove('hidden');
            menuModal.classList.add('hidden'); // Close modal
            showToast("You have been logged out.", "success");
            console.log("Logged out successfully.");
            // Reset state variables
            currentUserId = null;
            currentConversationId = null;
            conversations = [];
            document.getElementById('chat-list').innerHTML = '';
            document.getElementById('message-list').innerHTML = '';
            document.getElementById('conversation-name').textContent = 'Chat';

        });
    }

    if (myProfileBtn && menuModal) {
        myProfileBtn.addEventListener('click', () => {
            menuModal.classList.add('hidden');
            if (typeof showProfile === 'function') {
                console.log('Showing profile for current user:', currentUserId);
                showProfile(currentUserId); // showProfile should handle hiding chat and showing profile
            } else {
                console.warn('showProfile function not found.');
            }
        });
    }

    // Profile loading from conversation header
    const conversationHeader = document.getElementById('conversation-header');
    if (conversationHeader) {
        conversationHeader.addEventListener('click', async () => {
            if (!currentConversationId) return;
            const conversation = conversations.find(conv => conv.id === currentConversationId);
            if (!conversation || !conversation.participants) return;

            const token = localStorage.getItem('token'); // Needed for API calls
            if (!token) return; // Should not happen if already logged in

            // Get current user's username (needed to find the *other* participant)
            let currentUsername = null;
            try {
                const meResponse = await fetch('/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
                if (!meResponse.ok) throw new Error('Failed to get current user info');
                const meData = await meResponse.json();
                currentUsername = meData.username;
            } catch (error) {
                console.error("Error fetching current username:", error);
                return;
            }

            // Find the *other* participant in a 1-on-1 chat
            if (conversation.participants.length === 2) {
                const otherParticipantUsername = conversation.participants.find(username => username !== currentUsername);
                if (otherParticipantUsername) {
                    try {
                        // Fetch the other user's ID by username
                        const userResponse = await fetch(`/auth/user/${otherParticipantUsername}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!userResponse.ok) throw new Error(`Could not find user: ${otherParticipantUsername}`);
                        const userData = await userResponse.json();

                        // Show the other user's profile
                        if (typeof showProfile === 'function') {
                            console.log('Showing profile for other user:', userData.id);
                            showProfile(userData.id); // showProfile handles UI changes
                        } else {
                            console.warn('showProfile function not found.');
                        }

                    } catch (error) {
                        console.error('Error fetching/showing other user profile:', error);
                        showToast(`Could not load profile for ${otherParticipantUsername}.`, 'error');
                    }
                }
            } else {
                console.log('Clicked header of a group chat or self-chat. No profile to show.');
                // Optionally show group info modal here later
            }
        });
    }


    // --- New Chat / Group Modals ---
    const newChatCancel = document.getElementById('new-chat-cancel');
    const newChatCreate = document.getElementById('new-chat-create');
    const newChatUsernameInput = document.getElementById('new-chat-username');
    const userSuggestions = document.getElementById('user-suggestions');
    let selectedUserIdForNewChat = null;
    let searchTimeout;

    if (newChatBtn && newChatModal) {
        newChatBtn.addEventListener('click', () => {
            newConversationModal.classList.add('hidden'); // Close options modal
            newChatModal.classList.remove('hidden');
            newChatUsernameInput.value = ''; // Clear input
            userSuggestions.innerHTML = ''; // Clear suggestions
            userSuggestions.classList.add('hidden'); // Hide suggestions box
            selectedUserIdForNewChat = null; // Reset selected user
            newChatUsernameInput.focus();
        });
    }

    if (newChatCancel) {
        newChatCancel.addEventListener('click', () => newChatModal.classList.add('hidden'));
    }

    newChatUsernameInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = newChatUsernameInput.value.trim();
        userSuggestions.innerHTML = ''; // Clear previous
        userSuggestions.classList.add('hidden');
        selectedUserIdForNewChat = null; // Reset selection if user types again

        if (query.length < 2) return; // Only search if query is long enough

        userSuggestions.innerHTML = '<div class="p-2 text-gray-500 text-sm">Searching...</div>';
        userSuggestions.classList.remove('hidden');

        searchTimeout = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/auth/users/search?query=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('User search failed');

                const users = await response.json();
                userSuggestions.innerHTML = ''; // Clear "Searching..."

                const currentUsername = document.getElementById('profile-username')?.textContent; // Get own username if profile was loaded

                const filteredUsers = users.filter(user => user.id !== currentUserId); // Exclude self

                if (filteredUsers.length === 0) {
                    userSuggestions.innerHTML = '<div class="p-2 text-gray-500 text-sm">No users found.</div>';
                } else {
                    filteredUsers.forEach(user => {
                        const suggestionDiv = document.createElement('div');
                        // Added more padding, hover effect
                        suggestionDiv.className = 'p-2 hover:bg-gray-100 cursor-pointer text-sm';
                        suggestionDiv.textContent = user.username;
                        suggestionDiv.addEventListener('click', () => {
                            newChatUsernameInput.value = user.username; // Set input to selected user
                            selectedUserIdForNewChat = user.id; // Store the ID
                            userSuggestions.innerHTML = ''; // Clear suggestions
                            userSuggestions.classList.add('hidden'); // Hide box
                        });
                        userSuggestions.appendChild(suggestionDiv);
                    });
                }
            } catch (error) {
                console.error('Error searching users:', error);
                userSuggestions.innerHTML = '<div class="p-2 text-red-500 text-sm">Error searching.</div>';
            }
        }, 300); // Debounce API call
    });

    // Create New Chat Action
    if (newChatCreate) {
        newChatCreate.addEventListener('click', async () => {
            if (!selectedUserIdForNewChat) {
                showToast("Please select a user from the suggestions.", "warning");
                return;
            }

            // Prevent creating chat with self
            if (selectedUserIdForNewChat === currentUserId) {
                showToast("You cannot create a chat with yourself.", "warning");
                return;
            }

            newChatCreate.disabled = true; // Prevent double clicks
            showToast("Creating chat...", "info");

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/chat/conversations', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: null, // Backend determines name for 1-on-1 chats
                        participant_ids: [currentUserId, selectedUserIdForNewChat]
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => null);
                    // Check if it's a duplicate chat error (adjust status code if needed)
                    if (response.status === 409 || errorData?.detail?.includes("already exists")) {
                        showToast("A chat with this user already exists.", "warning");
                        // Optionally find and load the existing chat
                    } else {
                        throw new Error(errorData?.error || 'Failed to create chat');
                    }
                } else {
                    const data = await response.json();
                    newChatModal.classList.add('hidden'); // Close modal on success
                    await loadConversations(); // Refresh list to show the new chat
                    if (data.conversation_id) {
                        await loadConversation(data.conversation_id); // Load the newly created chat
                    }
                    showToast("Chat created successfully!", "success");
                }

            } catch (error) {
                console.error('Error creating chat:', error);
                showToast(`Error: ${error.message}`, "error");
            } finally {
                newChatCreate.disabled = false; // Re-enable button
            }
        });
    }

    // --- New Group Modal Logic ---
    const newGroupCancel = document.getElementById('new-group-cancel');
    const newGroupCreate = document.getElementById('new-group-create');
    const newGroupUserSearchInput = document.getElementById('new-group-user-search');
    const newGroupUserSuggestions = document.getElementById('new-group-user-suggestions');
    const newGroupAddedUsersContainer = document.getElementById('new-group-added-users');
    let newGroupSelectedUsers = []; // Array to store {id, username}
    let groupSearchTimeout;

    if (newGroupBtn && newGroupModal) {
        newGroupBtn.addEventListener('click', () => {
            newConversationModal.classList.add('hidden'); // Close options
            newGroupModal.classList.remove('hidden');
            // Reset group modal state
            document.getElementById('new-group-name').value = '';
            newGroupUserSearchInput.value = '';
            newGroupUserSuggestions.innerHTML = '';
            newGroupUserSuggestions.classList.add('hidden');
            newGroupSelectedUsers = [];
            renderGroupUserChips(); // Clear chips
            document.getElementById('new-group-name').focus();
        });
    }

    if (newGroupCancel) {
        newGroupCancel.addEventListener('click', () => newGroupModal.classList.add('hidden'));
    }

    // User search within New Group Modal
    if (newGroupUserSearchInput) {
        newGroupUserSearchInput.addEventListener('input', () => {
            clearTimeout(groupSearchTimeout);
            const query = newGroupUserSearchInput.value.trim();
            newGroupUserSuggestions.innerHTML = '';
            newGroupUserSuggestions.classList.add('hidden');

            if (query.length < 2) return;

            newGroupUserSuggestions.innerHTML = '<div class="p-2 text-gray-500 text-sm">Searching...</div>';
            newGroupUserSuggestions.classList.remove('hidden');

            groupSearchTimeout = setTimeout(async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/auth/users/search?query=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('User search failed');

                    const users = await response.json();
                    newGroupUserSuggestions.innerHTML = ''; // Clear "Searching..."

                    // Filter out self and already added users
                    const availableUsers = users.filter(user =>
                        user.id !== currentUserId &&
                        !newGroupSelectedUsers.some(selected => selected.id === user.id)
                    );

                    if (availableUsers.length === 0) {
                        newGroupUserSuggestions.innerHTML = '<div class="p-2 text-gray-500 text-sm">No more users found.</div>';
                    } else {
                        availableUsers.forEach(user => {
                            const suggestionDiv = document.createElement('div');
                            suggestionDiv.className = 'p-2 hover:bg-gray-100 cursor-pointer text-sm';
                            suggestionDiv.textContent = user.username;
                            suggestionDiv.addEventListener('click', () => {
                                addUserToGroupSelection(user.id, user.username); // Add user to chip list
                                newGroupUserSearchInput.value = ''; // Clear search input
                                newGroupUserSuggestions.innerHTML = ''; // Clear suggestions
                                newGroupUserSuggestions.classList.add('hidden'); // Hide box
                                newGroupUserSearchInput.focus(); // Refocus search input
                            });
                            newGroupUserSuggestions.appendChild(suggestionDiv);
                        });
                    }
                    // Ensure suggestions are visible if there's content
                    if (newGroupUserSuggestions.children.length > 0) {
                        newGroupUserSuggestions.classList.remove('hidden');
                    }

                } catch (error) {
                    console.error('Error searching users for group:', error);
                    newGroupUserSuggestions.innerHTML = '<div class="p-2 text-red-500 text-sm">Error searching.</div>';
                    newGroupUserSuggestions.classList.remove('hidden');
                }
            }, 300); // Debounce
        });

        // Hide suggestions when clicking outside the search input/suggestions list
        document.addEventListener('click', (e) => {
            if (newGroupUserSuggestions && !newGroupUserSuggestions.classList.contains('hidden') && !newGroupUserSearchInput.contains(e.target) && !newGroupUserSuggestions.contains(e.target)) {
                newGroupUserSuggestions.classList.add('hidden');
            }
        });
    }

    function addUserToGroupSelection(userId, username) {
        // Prevent adding duplicates
        if (!newGroupSelectedUsers.some(u => u.id === userId)) {
            newGroupSelectedUsers.push({ id: userId, username: username });
            renderGroupUserChips(); // Update the UI
        }
    }

    function removeUserFromGroupSelection(userIdToRemove) {
        newGroupSelectedUsers = newGroupSelectedUsers.filter(user => user.id !== userIdToRemove);
        renderGroupUserChips(); // Update the UI
    }

    function renderGroupUserChips() {
        newGroupAddedUsersContainer.innerHTML = ''; // Clear existing chips
        newGroupSelectedUsers.forEach(user => {
            const chip = document.createElement('span');
            chip.className = 'inline-flex items-center bg-indigo-100 text-indigo-700 text-sm font-medium px-3 py-1 rounded-full mr-2 mb-2 shadow-sm';
            chip.innerHTML = `
              <span class="mr-1">${user.username}</span>
              <button type="button" class="ml-1 flex-shrink-0 bg-indigo-200 text-indigo-600 hover:bg-indigo-300 hover:text-indigo-800 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 group-chip-remove-btn" data-user-id="${user.id}">
                <svg class="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                  <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
                </svg>
              </button>
            `;
            // Add listener specifically to the button inside the chip
            chip.querySelector('.group-chip-remove-btn').addEventListener('click', (e) => {
                // Get the userId from the button's dataset
                const button = e.currentTarget; // Use currentTarget to ensure it's the button
                const userIdToRemove = parseInt(button.dataset.userId);
                removeUserFromGroupSelection(userIdToRemove);
            });
            newGroupAddedUsersContainer.appendChild(chip);
        });
    }

    // Create New Group Action
    if (newGroupCreate) {
        newGroupCreate.addEventListener('click', async () => {
            const groupName = document.getElementById('new-group-name').value.trim();
            const participantIds = newGroupSelectedUsers.map(u => u.id);

            if (!groupName) {
                showToast("Please enter a group name.", "warning");
                return;
            }
            // Require at least 2 members total (creator + 1 other)
            if (participantIds.length < 1) {
                showToast("Please add at least one other member to the group.", "warning");
                return;
            }

            newGroupCreate.disabled = true;
            showToast("Creating group...", "info");

            const allParticipantIds = [currentUserId, ...participantIds];
            const uniqueParticipantIds = [...new Set(allParticipantIds)]; // Ensure uniqueness

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/chat/conversations', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: groupName,
                        participant_ids: uniqueParticipantIds
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => null);
                    throw new Error(errorData?.error || 'Failed to create group');
                }

                const data = await response.json();
                newGroupModal.classList.add('hidden');
                await loadConversations(); // Refresh list
                if (data.conversation_id) {
                    await loadConversation(data.conversation_id); // Load the new group chat
                }
                showToast("Group created successfully!", "success");

            } catch (error) {
                console.error("Error creating group:", error);
                showToast(`Error: ${error.message}`, "error");
            } finally {
                newGroupCreate.disabled = false; // Re-enable button
            }
        });
    }

    // --- Send Button ---
    document.getElementById('send-btn').addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline
            e.preventDefault(); // Prevent default Enter behavior (like newline)
            handleSendMessage();
        }
    });

}); // End DOMContentLoaded

// --- Core Chat Functions ---

async function loadConversations() {
    console.log('Loading conversations...');
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token available for loading conversations.');
            // Handle this case, e.g., redirect to login
            return;
        }

        const response = await fetch('/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) { // Unauthorized
                localStorage.removeItem('token');
                // Redirect to login or show welcome screen
                document.getElementById('chat').classList.add('hidden');
                document.getElementById('welcome').classList.remove('hidden');
                showToast("Session expired. Please sign in.", "error");
            } else {
                showToast("Failed to load conversations.", "error");
            }
            console.error('Failed to load conversations:', response.status, response.statusText);
            return; // Stop execution for this function
        }

        conversations = await response.json(); // Store conversation list globally
        console.log('Conversations loaded:', conversations);
        renderChatList(conversations); // Update the UI

        // Automatically load the first conversation if none is selected,
        // or reload the current one if it exists after refresh.
        const messageList = document.getElementById('message-list');
        if (!currentConversationId && conversations.length > 0) {
            console.log("No current conversation, loading first one:", conversations[0].id);
            await loadConversation(conversations[0].id);
        } else if (currentConversationId && conversations.some(c => c.id === currentConversationId)) {
            console.log("Current conversation exists, reloading:", currentConversationId);
            await loadConversation(currentConversationId); // Reload potentially updated info
        } else if (currentConversationId && conversations.length > 0) {
            // Current conversation ID is invalid (e.g., deleted), load first one
            console.log("Current conversation ID invalid, loading first one:", conversations[0].id);
            await loadConversation(conversations[0].id);
        } else if (conversations.length === 0) {
            // Handle case with no conversations
            messageList.innerHTML = '<div class="p-4 text-center text-gray-500">No conversations yet. Start a new chat!</div>';
            document.getElementById('conversation-name').textContent = 'Chat';
            currentConversationId = null; // Ensure no conversation is selected
        }

    } catch (error) {
        console.error('Error loading conversations:', error);
        showToast("An error occurred while loading conversations.", "error");
    }
}

function renderChatList(convList) {
    const chatListEl = document.getElementById('chat-list');
    if (!chatListEl) return;
    chatListEl.innerHTML = ''; // Clear current list

    if (!convList || convList.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'p-4 text-center text-gray-500 text-sm';
        emptyMessage.textContent = 'No chats match your search.';
        chatListEl.appendChild(emptyMessage);
        return;
    }

    convList.forEach(conv => {
        const chatItem = document.createElement('div');
        // Base classes + conditional highlighting
        chatItem.className = `flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg transition duration-150 ease-in-out chat-list-item ${conv.id === currentConversationId ? 'bg-blue-100 dark:bg-blue-800' : ''}`;
        chatItem.dataset.conversationId = conv.id; // Add dataset for easy selection

        // Determine display name (handle 1-on-1 vs group) - assumes 'participants' array exists
        let displayName = conv.name; // Use backend provided name
        // Maybe add logic here if backend doesn't provide a good default name for 1-on-1

        const unreadCount = conv.unread_count || 0;

        // Improved innerHTML structure
        chatItem.innerHTML = `
            <div class="relative mr-3">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=40" alt="${displayName}" class="w-10 h-10 rounded-full">
                ${unreadCount > 0 ? `<span class="absolute top-0 right-0 block h-4 w-4 transform -translate-y-1/2 translate-x-1/2 rounded-full ring-2 ring-white bg-red-500 text-white text-xs flex items-center justify-center">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">${displayName}</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${conv.last_message || 'No messages yet'}</p>
            </div>
        `;

        chatItem.addEventListener('click', () => {
            // Prevent reloading if already selected
            if (conv.id !== currentConversationId) {
                loadConversation(conv.id);
                // Optional: Immediately highlight clicked item visually
                document.querySelectorAll('.chat-list-item').forEach(item => item.classList.remove('bg-blue-100', 'dark:bg-blue-800'));
                chatItem.classList.add('bg-blue-100', 'dark:bg-blue-800');
            }
        });
        chatListEl.appendChild(chatItem);
    });
}


async function loadConversation(conversationId) {
    console.log(`Loading conversation ${conversationId}...`);
    if (!conversationId) {
        console.warn("loadConversation called with null or undefined ID.");
        return;
    }

    // Visually indicate loading
    const messageList = document.getElementById('message-list');
    const conversationNameEl = document.getElementById('conversation-name');
    messageList.innerHTML = '<div class="p-4 text-center text-gray-500">Loading messages...</div>';
    conversationNameEl.textContent = 'Loading...';

    try {
        // Update current conversation ID state
        currentConversationId = conversationId;

        // Join the WebSocket room for this conversation
        if (socket && socket.connected && typeof joinConversation === 'function') {
            joinConversation(conversationId); // joinConversation should handle sending 'join_conversation' event
        } else {
            console.warn("Socket not ready or joinConversation function not found when trying to join room.");
            // Attempt to reconnect or wait? For now, proceed with fetch.
            if (typeof initializeSocket === 'function') { initializeSocket(); } // Try initializing again
        }

        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication token missing');

        // --- Fetch Conversation Details (Messages) ---
        const response = await fetch(`/chat/messages/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 403) { // Forbidden
                showToast("You are not authorized to view this conversation.", "error");
            } else {
                showToast("Failed to load messages.", "error");
            }
            throw new Error(`Failed to load messages: ${response.statusText}`);
        }

        const messages = await response.json();
        console.log('Messages loaded for conversation', conversationId, messages);

        // --- Render Messages ---
        messageList.innerHTML = ''; // Clear loading indicator
        if (!messages || messages.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'p-4 text-center text-gray-500 italic system-message';
            emptyMessage.textContent = 'No messages yet. Be the first to say hello!';
            messageList.appendChild(emptyMessage);
        } else {
            messages.forEach(msg => {
                const messageDiv = createMessageElement(msg);
                if (messageDiv) {
                    messageList.prepend(messageDiv); // Prepend because of flex-col-reverse
                }
            });
            // Scroll to the bottom (most recent message) after rendering
            messageList.scrollTop = messageList.scrollHeight;
        }

        // --- Update Conversation Header ---
        const convData = conversations.find(c => c.id === conversationId);
        conversationNameEl.textContent = convData ? convData.name : 'Chat'; // Use fetched name

        // --- Update Chat List Highlighting ---
        renderChatList(conversations); // Re-render to ensure correct item is highlighted

        // --- Mark Conversation as Read ---
        await markConversationRead(conversationId);

        // Focus the message input
        document.getElementById('message-input').focus();

    } catch (error) {
        console.error(`Error loading conversation ${conversationId}:`, error);
        messageList.innerHTML = `<div class="p-4 text-center text-red-500">Error loading messages. Please try again.</div>`;
        conversationNameEl.textContent = 'Error';
        // Potentially clear currentConversationId if load failed badly
        // currentConversationId = null;
    }
}

async function markConversationRead(conversationId) {
    if (!conversationId) return;
    console.log(`Marking conversation ${conversationId} as read...`);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/chat/conversations/${conversationId}/mark_read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            console.log(`Conversation ${conversationId} successfully marked as read.`);
            // Update local state immediately for UI responsiveness
            const convIndex = conversations.findIndex(c => c.id === conversationId);
            if (convIndex !== -1) {
                conversations[convIndex].unread_count = 0;
                // Re-render the chat list to remove the unread badge
                renderChatList(conversations);
            }
        } else {
            console.error('Failed to mark conversation as read on server:', response.status);
        }
    } catch (error) {
        console.error('Error during mark read API call:', error);
    }
}


function createMessageElement(msg) {
    if (!msg || !msg.id || !msg.sender_id) {
        console.warn("Invalid message data received:", msg);
        return null; // Don't render invalid messages
    }

    const messageWrapper = document.createElement('div'); // Create a wrapper for alignment
    const messageDiv = document.createElement('div');
    const isOwnMessage = msg.sender_id === currentUserId;

    // --- Wrapper for alignment ---
    messageWrapper.className = `w-full flex mb-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`;

    // --- Message Bubble ---
    messageDiv.className = `message max-w-[75%] p-3 rounded-lg shadow-sm relative break-words ${isOwnMessage ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 dark:text-gray-100 rounded-bl-none'}`;
    messageDiv.dataset.messageId = msg.id;
    messageDiv.dataset.senderId = msg.sender_id;
    if (msg.is_deleted) {
        messageDiv.classList.add('deleted', 'italic', 'text-gray-400', 'dark:text-gray-500');
        // Reset background if deleted
        messageDiv.classList.remove('bg-blue-500', 'bg-white', 'dark:bg-gray-700');
        messageDiv.classList.add('bg-transparent', 'dark:bg-transparent', 'shadow-none');
    }

    // --- Add Reply Preview Box (if applicable) ---
    if (msg.replied_to_id && !msg.is_deleted) { // Don't show reply context for deleted messages
        const replyBox = document.createElement('div');
        const repliedContent = msg.replied_to_content || '[Message unavailable]';
        const repliedIsDeleted = repliedContent === '[Message deleted]';
        let repliedToUserText = msg.replied_to_username || 'Someone';
        if (msg.replied_to_sender === currentUserId) {
            repliedToUserText = 'You';
        }

        replyBox.className = `reply-box mb-1 p-2 rounded-md border-l-4 ${isOwnMessage ? 'border-blue-300 bg-blue-400 bg-opacity-50' : 'border-gray-300 bg-gray-100 dark:bg-gray-600 dark:border-gray-500'} text-xs opacity-90 cursor-pointer`;
        replyBox.innerHTML = `
            <div class="font-semibold flex items-center gap-1">
                <svg class="w-3 h-3 inline flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                Replied to ${repliedToUserText}
            </div>
            <div class="mt-1 pl-1 truncate ${repliedIsDeleted ? 'italic text-gray-500 dark:text-gray-400' : ''}">
                ${repliedContent}
            </div>
        `;

        // Add click listener to scroll to the original message
        replyBox.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering message selection on the parent
            const originalMsgEl = document.querySelector(`.message[data-message-id="${msg.replied_to_id}"]`);
            if (originalMsgEl) {
                originalMsgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight effect
                originalMsgEl.classList.add('highlight');
                setTimeout(() => originalMsgEl.classList.remove('highlight'), 1500); // Duration matches CSS animation
            } else {
                showToast("Original message not found (it might be too old).", "warning");
            }
        });
        messageDiv.appendChild(replyBox); // Append reply box *before* content
    }

    // --- Message Content ---
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content'; // Text color is handled by bubble class
    contentDiv.textContent = msg.is_deleted ? "[Message deleted]" : msg.content;
    messageDiv.appendChild(contentDiv);

    // --- Timestamp and Read Status ---
    const statusContainer = document.createElement('div');
    // Position slightly differently based on sender for better alignment in bubble corners
    statusContainer.className = `text-xs mt-1 flex items-center space-x-1 ${isOwnMessage ? 'float-right pl-2' : 'float-right pl-2'} ${isOwnMessage ? 'text-blue-100 opacity-80' : 'text-gray-400 dark:text-gray-500'}`;

    if (msg.timestamp) {
        const timeSpan = document.createElement('span');
        try {
            // Attempt to parse timestamp robustly
            const date = new Date(msg.timestamp);
            // Check if date is valid before formatting
            if (!isNaN(date.getTime())) {
                timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            } else {
                timeSpan.textContent = "Invalid time"; // Fallback
                console.warn("Invalid timestamp format received:", msg.timestamp);
            }
        } catch (e) {
            timeSpan.textContent = "Time error";
            console.error("Error parsing timestamp:", msg.timestamp, e);
        }
        statusContainer.appendChild(timeSpan);
    }

    // Add read status icon (double checkmark) only for own, non-deleted messages
    if (isOwnMessage && !msg.is_deleted) {
        const statusIcon = document.createElement('span');
        statusIcon.className = 'message-status-icon';
        // Use brighter color for checks on dark blue background
        statusIcon.innerHTML = msg.read_at ? '✔✔' : '✔'; // Double or single check
        statusContainer.appendChild(statusIcon);
    }

    messageDiv.appendChild(statusContainer);

    // Add click handler for context menu ONLY if not deleted
    if (!msg.is_deleted) {
        messageDiv.addEventListener('click', (e) => handleMessageClick(e, messageDiv));
        messageDiv.addEventListener('dblclick', (e) => {
            e.preventDefault(); // Prevent text selection
            setupReplyUI(msg.id, msg.content, msg.sender_id); // Use setupReplyUI from messageHandlers
        });
    }

    messageWrapper.appendChild(messageDiv);
    return messageWrapper;
}

// Function to update read status icons when 'messages_read' event received
function updateMessageReadStatus(messageIds) {
    if (!Array.isArray(messageIds)) return;
    console.log("Updating read status for messages:", messageIds);

    messageIds.forEach(messageId => {
        // Select the wrapper first, then find the message bubble inside
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement && messageElement.dataset.senderId == currentUserId) { // Only update own messages
            const statusIcon = messageElement.querySelector('.message-status-icon');
            if (statusIcon) {
                // Change to double checkmark and maybe slightly bolder/brighter
                statusIcon.innerHTML = '✔✔';
                console.log(`Updated read status icon for message ${messageId}`);
            }
        }
    });
}

// Function called when Send button is clicked or Enter is pressed
function handleSendMessage() {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();

    if (!content) return; // Don't send empty messages

    if (!currentConversationId) {
        showToast("Please select a conversation first.", "warning");
        return;
    }

    // Ensure socket is initialized and connected
    if (!socket || !socket.connected) {
        showToast("Not connected to server. Trying to reconnect...", "warning");
        console.log("Socket not connected. Attempting to send message - likely will fail or queue.");
        // Optionally queue message or try reconnecting explicitly
        if (typeof initializeSocket === 'function') { initializeSocket(); }
        // Display message optimistically but indicate pending state?
        // For now, we rely on the socket.io manager's reconnection attempts.
        // If sending is critical, add queuing logic here or in socket.js.
        return; // Prevent sending if not connected
    }

    // Construct message data, including reply info
    const messageData = {
        conversation_id: currentConversationId,
        sender_id: currentUserId, // Make sure currentUserId is correctly set
        content: content,
        replied_to_id: null // Default to null
    };

    const replyingTo = getReplyData(); // Get data from messageInteractions module
    if (replyingTo) {
        messageData.replied_to_id = replyingTo.id;
    }

    console.log('Sending message via socket:', messageData);
    socket.emit('message', messageData, (ack) => {
        // Optional: Handle acknowledgment from server if implemented
        if (ack?.status === 'success') {
            console.log("Message sent and acknowledged by server.");
        } else if (ack?.status === 'error') {
            console.error("Server reported error sending message:", ack.message);
            showToast(`Server Error: ${ack.message || 'Failed to send'}`, "error");
            // Maybe visually mark the message as failed?
        }
    });

    // --- Optimistic UI Update ---
    // Create a temporary message object matching the expected structure
    const optimisticMessage = {
        id: `temp-${Date.now()}`, // Temporary ID
        conversation_id: currentConversationId,
        sender_id: currentUserId,
        sender_username: 'You', // Assume 'You' for optimistic update
        content: content,
        timestamp: new Date().toISOString(), // Use current time
        is_deleted: false,
        read_at: null, // Not read yet
        replied_to_id: messageData.replied_to_id,
        replied_to_content: replyingTo ? replyingTo.content : null,
        replied_to_sender: replyingTo ? replyingTo.senderId : null,
        replied_to_username: replyingTo ? replyingTo.senderUsername : null, // Need username if available
    };

    const messageElement = createMessageElement(optimisticMessage);
    if (messageElement) {
        // Add a pending state indicator (optional)
        messageElement.querySelector('.message')?.classList.add('pending'); // Style .pending if needed
        // Append to the list
        document.getElementById('message-list').prepend(messageElement); // Prepend for flex-reverse
        // Scroll to bottom
        const messageList = document.getElementById('message-list');
        messageList.scrollTop = messageList.scrollHeight;
    }

    // Clear input and hide reply UI
    messageInput.value = '';
    if (typeof hideReplyUI === 'function') {
        hideReplyUI(); // Clear reply state from messageHandlers
    }
    messageInput.focus();
    // Trigger input event to potentially disable AI buttons if input is now empty
    messageInput.dispatchEvent(new Event('input'));
}


// --- Exports ---
// Export functions needed by other modules (like socket.js for message handling)
export {
    currentConversationId,
    currentUserId,
    conversations, // Make conversation list accessible if needed
    loadConversations,
    loadConversation,
    createMessageElement,
    updateMessageReadStatus,
    renderChatList, // Export if needed for socket updates
    // REMOVED: initializeAIModels (no longer used)
};