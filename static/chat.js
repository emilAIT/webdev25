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
// --- ADD WEBRTC IMPORTS ---
import { initializeWebRTC, startCall, currentCall as webRTCCallState, updateWebRTCUI } from './webrtc.js';

// --- Global Variables ---
let currentConversationId = null;
let currentUserId = null;
let conversations = [];
let userData = null;

// --- DOM Element Variables (Declare here, assign in DOMContentLoaded) ---
let chatSection = null;
let profileSection = null;
let welcomeSection = null;
let signinSection = null;
let signupSection = null;
let messageList = null;
let messageInput = null;
let conversationNameEl = null;
let conversationAvatarEl = null;
let callBtn = null;
let localAudioElement = null;
let remoteAudioElement = null;
// ... add other frequently used elements if needed ...

// --- Helper function for AI API calls ---
async function callAiFeature(endpoint, text, targetLanguage = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        showToast("Authentication error. Please log in again.", "error");
        return null;
    }

    const body = targetLanguage ? { text, target_language: targetLanguage } : { text };

    try {
        const response = await fetch(`/ai/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown AI error' }));
            throw new Error(errorData.detail || `AI request failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.result; // Assuming backend returns { "result": "..." }

    } catch (error) {
        console.error(`Error calling AI feature ${endpoint}:`, error);
        showToast(`AI Error: ${error.message}`, "error");
        return null;
    }
}

// --- Function to handle AI button clicks ---
// Needs access to button variables, ensure they are passed or accessible
async function handleAiButtonClick(button, endpoint, targetLanguage = null) {
    // Get buttons inside the function or ensure they are accessible from the scope where this is called
    const fixGrammarBtn = document.getElementById('fix-grammar-btn');
    const completeSentenceBtn = document.getElementById('complete-sentence-btn');
    const translateBtn = document.getElementById('translate-btn');
    const messageInput = document.getElementById('message-input'); // Also get messageInput here

    if (!messageInput || !button) return;

    const originalText = messageInput.value;
    if (!originalText.trim()) return; // Don't call if input is empty

    // Disable all AI buttons during processing
    fixGrammarBtn.disabled = true;
    completeSentenceBtn.disabled = true;
    translateBtn.disabled = true;
    button.innerHTML = '<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'; // Loading spinner

    const result = await callAiFeature(endpoint, originalText, targetLanguage);

    // Re-enable buttons and restore icon
    const hasTextNow = messageInput.value.trim().length > 0;
    if (fixGrammarBtn) fixGrammarBtn.disabled = !hasTextNow; // Re-enable based on current input state
    if (completeSentenceBtn) completeSentenceBtn.disabled = !hasTextNow;
    if (translateBtn) translateBtn.disabled = !hasTextNow;
    // Restore original icon (replace spinner) - requires storing original icons or re-querying
    // Simple approach: just remove spinner and let CSS handle original icon if it's background/pseudo
    // Better: Store original innerHTML or use specific classes
    // For now, let's assume the original SVG is still there but hidden, or we reset it manually
    // This part needs refinement based on how icons are implemented in index.html
    // Example reset (assuming SVGs are direct children):
    if (button === fixGrammarBtn) button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>';
    if (button === completeSentenceBtn) button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>';
    if (button === translateBtn) button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5h12M9 3v2m0 4V5m0 4v2m0 4v2m3-10v10m0 4v2m4-14v14m0 4v2m4 0h2m-2-4h2m-2-4h2m-2-4h2m-2-4h2" /></svg>';


    if (result !== null) {
        messageInput.value = result; // Update input field with the result
        messageInput.focus(); // Keep focus on input
        // Trigger input event to potentially re-enable buttons if needed (e.g., if result is empty)
        messageInput.dispatchEvent(new Event('input'));
    } else {
        // If error, keep original text
        messageInput.value = originalText;
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    // --- First assign all DOM elements ---
    chatSection = document.getElementById('chat');
    profileSection = document.getElementById('profile');
    welcomeSection = document.getElementById('welcome');
    signinSection = document.getElementById('signin');
    signupSection = document.getElementById('signup');
    messageList = document.getElementById('message-list');
    messageInput = document.getElementById('message-input');
    conversationNameEl = document.getElementById('conversation-name');
    conversationAvatarEl = document.getElementById('conversation-avatar');
    callBtn = document.getElementById('call-btn');
    localAudioElement = document.getElementById('local-audio');
    remoteAudioElement = document.getElementById('remote-audio');

    // --- Get AI button elements ---
    const fixGrammarBtn = document.getElementById('fix-grammar-btn');
    const completeSentenceBtn = document.getElementById('complete-sentence-btn');
    const translateBtn = document.getElementById('translate-btn');

    // --- Setup AI buttons state based on input ---
    if (messageInput && fixGrammarBtn && completeSentenceBtn && translateBtn) {
        // Function to update button states
        const updateAIButtonStates = () => {
            const hasText = messageInput.value.trim().length > 0;
            fixGrammarBtn.disabled = !hasText;
            completeSentenceBtn.disabled = !hasText;
            translateBtn.disabled = !hasText;

            // Add visual indication of disabled state
            [fixGrammarBtn, completeSentenceBtn, translateBtn].forEach(btn => {
                if (hasText) {
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            });
        };

        // Add event listener for input changes
        messageInput.addEventListener('input', updateAIButtonStates);

        // Initial button state check
        updateAIButtonStates();

        console.log("AI button listeners configured successfully");
    } else {
        console.warn("Failed to initialize AI button listeners - one or more elements not found");
    }

    // --- Set up AI Button Click Handlers ---
    if (fixGrammarBtn) {
        fixGrammarBtn.addEventListener('click', () => {
            if (!messageInput.value.trim()) return; // Extra safety check
            handleAiButtonClick(fixGrammarBtn, 'fix-grammar');
        });
    }

    if (completeSentenceBtn) {
        completeSentenceBtn.addEventListener('click', () => {
            if (!messageInput.value.trim()) return; // Extra safety check
            handleAiButtonClick(completeSentenceBtn, 'complete-sentence');
        });
    }

    if (translateBtn) {
        translateBtn.addEventListener('click', () => {
            if (!messageInput.value.trim()) return; // Extra safety check
            handleAiButtonClick(translateBtn, 'translate', 'English');
        });
    }

    // --- Continue with the rest of initialization ---
    // --- NEW: Assign active call modal elements --- 
    const activeCallModal = document.getElementById('active-call-modal');
    const activeCallAvatar = document.getElementById('active-call-avatar');
    const activeCallUsername = document.getElementById('active-call-username');
    const activeCallTimer = document.getElementById('active-call-timer');
    const muteCallBtn = document.getElementById('mute-call-btn');
    const activeHangUpBtn = document.getElementById('active-hang-up-btn');
    const micIconUnmuted = document.getElementById('mic-icon-unmuted');
    const micIconMuted = document.getElementById('mic-icon-muted');
    // --- Also assign elements needed by WebRTC that were previously assigned elsewhere ---
    const callStatusDiv = document.getElementById('call-status');
    const callStatusText = document.getElementById('call-status-text');
    const hangUpBtn = document.getElementById('hang-up-btn'); // Old status bar hangup
    const incomingCallModal = document.getElementById('incoming-call-modal');
    const callerNameEl = document.getElementById('caller-name');
    const callerAvatarEl = document.getElementById('caller-avatar');
    const acceptCallBtn = document.getElementById('accept-call-btn');
    const rejectCallBtn = document.getElementById('reject-call-btn'); // Make sure this ID exists in HTML

    // --- Define hideAllSections AFTER element assignments --- 
    const hideAllSections = () => {
        // Uses the variables assigned above
        welcomeSection?.classList.add('hidden');
        signinSection?.classList.add('hidden');
        signupSection?.classList.add('hidden');
        chatSection?.classList.add('hidden');
        profileSection?.classList.add('hidden');
    };

    const token = localStorage.getItem('token');
    console.log('Token found in localStorage:', token ? 'Yes' : 'No');

    // Welcome screen button handlers (Use variables assigned at the top)
    const welcomeSigninBtn = document.getElementById('welcome-signin-btn');
    const welcomeSignupBtn = document.getElementById('welcome-signup-btn');

    if (welcomeSigninBtn) {
        welcomeSigninBtn.addEventListener('click', () => {
            hideAllSections(); // Call the function defined above
            signinSection?.classList.remove('hidden'); // Use variable from top
        });
    }

    if (welcomeSignupBtn) {
        welcomeSignupBtn.addEventListener('click', () => {
            hideAllSections(); // Call the function defined above
            signupSection?.classList.remove('hidden'); // Use variable from top
        });
    }

    // --- Token Validation and Initialization ---
    if (!token) {
        // Directly manage visibility using variables assigned at the top
        console.log('No token found, showing welcome page');
        welcomeSection?.classList.remove('hidden');
        chatSection?.classList.add('hidden');
        profileSection?.classList.add('hidden');
        signinSection?.classList.add('hidden');
        signupSection?.classList.add('hidden');
        return; // Stop further execution if no token
    }

    try {
        console.log('Validating token...');
        const userResponse = await fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!userResponse.ok) {
            if (userResponse.status === 401) {
                console.log('Token is invalid or expired.');
                localStorage.removeItem('token');
                throw new Error('Invalid token'); // Throw to trigger catch block
            } else {
                throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
            }
        }

        userData = await userResponse.json();
        currentUserId = userData.id;
        console.log('Current user:', userData);

        // --- Initialization successful, NOW hide all and show chat ---
        hideAllSections(); // Safe to call now
        chatSection?.classList.remove('hidden');

        // Initialize socket connection
        if (typeof initializeSocket === 'function') {
            initializeSocket();
        } else {
            console.error("initializeSocket function not found!");
        }

        // Load initial conversations
        await loadConversations();

        // Setup message handlers and interactions
        if (typeof setupMessageHandlers === 'function') {
            setupMessageHandlers();
        } else {
            console.error("setupMessageHandlers function not found!");
        }
        if (typeof initMessageInteractions === 'function') {
            initMessageInteractions();
        } else {
            console.error("initMessageInteractions function not found!");
        }

        // --- INITIALIZE WEBRTC (Pass ALL elements in an object) ---
        if (typeof initializeWebRTC === 'function') {
            const webrtcInitParams = {
                localAudioElement,
                remoteAudioElement,
                callBtn,
                callStatusDiv,
                callStatusText,
                hangUpBtn,
                incomingCallModal,
                callerNameEl,
                callerAvatarEl,
                acceptCallBtn,
                rejectCallBtn, // Ensure this ID exists in HTML
                activeCallModal,
                activeCallAvatar,
                activeCallUsername,
                activeCallTimer,
                muteCallBtn,
                activeHangUpBtn,
                micIconUnmuted,
                micIconMuted
            };
            // Check if all essential elements were found before initializing
            const essentialElements = [localAudioElement, remoteAudioElement, callBtn, activeCallModal, muteCallBtn, activeHangUpBtn];
            if (essentialElements.every(el => el)) {
                initializeWebRTC(webrtcInitParams);
            } else {
                console.error("One or more essential WebRTC UI elements not found in chat.js. Cannot initialize WebRTC.");
                showToast("Could not initialize audio calling feature (UI error).", "error");
            }
        } else {
            console.error("initializeWebRTC function not found!");
        }

        // Check initial input state for AI buttons
        messageInput?.dispatchEvent(new Event('input'));

        console.log('Chat initialized successfully.');

    } catch (error) {
        console.error('Initialization error:', error);
        localStorage.removeItem('token'); // Clear token on error
        // Directly manage visibility using variables assigned at the top
        chatSection?.classList.add('hidden');
        profileSection?.classList.add('hidden');
        signinSection?.classList.add('hidden');
        signupSection?.classList.add('hidden');
        welcomeSection?.classList.remove('hidden'); // Show welcome on error
        showToast('Session expired or invalid. Please log in again.', 'error');
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
            welcomeSection?.classList.remove('hidden');
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

    // --- Call Button Listener (Ensure callBtn exists) ---
    if (callBtn) {
        callBtn.addEventListener('click', () => {
            if (!currentConversationId || !userData) return;
            const conversation = conversations.find(conv => conv.id === currentConversationId);

            // Use participant_details from the conversation object
            if (!conversation || !conversation.participant_details || conversation.participant_details.length !== 2) {
                showToast('Calls are only supported in 1-on-1 chats.', 'warning');
                return;
            }

            // Find the other participant using participant_details
            const otherParticipant = conversation.participant_details.find(p => p.id !== currentUserId);

            if (!otherParticipant) {
                console.error("Could not find the other participant's details.");
                showToast('Error finding user to call.', 'error');
                return;
            }

            console.log(`Initiating call with User ID: ${otherParticipant.id}, Username: ${otherParticipant.username}`);
            startCall(otherParticipant.id, otherParticipant.username);
        });
    } else {
        // This log should now appear if the button isn't found during initial load
        console.error("Call button element not found during listener setup.");
    }

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

        // --- ADD participant_details to conversation objects (Example - adjust based on your actual API response) ---
        // This part is crucial for getting the other user's ID for calling.
        // You might need to adjust your /chat/conversations endpoint to include participant IDs and usernames.
        // Example structure assumed for conversations array elements:
        // { id: 1, name: 'user_b', participants: ['user_a', 'user_b'], participant_details: [{id: 10, username: 'user_a'}, {id: 11, username: 'user_b'}], ... }

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
    if (!conversationId || !messageList || !conversationNameEl || !callBtn) {
        console.warn("loadConversation called with null ID or missing essential elements.");
        return;
    }

    // --- Reset WebRTC state if a call is active --- 
    if (webRTCCallState.state !== 'idle') {
        console.log("Switching conversation during an active call. Ending the call.");
        // Simulate hangup without emitting to the other user if connection is already broken
        // Or call the hangUp function if it handles this gracefully
        // hangUpCall(); // Assuming hangUpCall resets state correctly
        // For safety, directly reset state here:
        if (typeof updateWebRTCUI === 'function') {
            // Manually reset relevant parts if hangUpCall isn't suitable
            const hangUpBtn = document.getElementById('hang-up-btn');
            const callStatusDiv = document.getElementById('call-status');
            hangUpBtn?.classList.add('hidden');
            callStatusDiv?.classList.add('hidden');
            // More comprehensive reset might be needed in webrtc.js
            console.warn("Call state might need full reset in webrtc.js");
        }
    }

    // Visually indicate loading
    conversationNameEl.textContent = 'Loading...';
    messageList.innerHTML = '<div class="p-4 text-center text-gray-500">Loading messages...</div>';
    callBtn.classList.add('hidden'); // Hide call button initially

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
        if (convData) {
            // Use the name provided by the backend (should be correct now)
            conversationNameEl.textContent = convData.name;
            // Update avatar based on conversation name (optional)
            if (conversationAvatarEl) {
                conversationAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(convData.name)}&background=random&size=40`;
            }

            // --- Show/Hide Call Button --- 
            // Use participant_details to check if it's a 1-on-1 chat
            if (convData.participant_details && convData.participant_details.length === 2) {
                // Ensure the other participant is not the current user (handles self-chat case)
                const otherParticipant = convData.participant_details.find(p => p.id !== currentUserId);
                if (otherParticipant) {
                    callBtn.classList.remove('hidden');
                } else {
                    callBtn.classList.add('hidden'); // It's a self-chat
                }
            } else {
                callBtn.classList.add('hidden'); // It's a group chat
            }
        } else {
            conversationNameEl.textContent = 'Chat'; // Fallback if convData not found
            callBtn.classList.add('hidden');
        }

        // --- Update Chat List Highlighting --- 
        renderChatList(conversations);

        // --- Mark Conversation as Read --- 
        await markConversationRead(conversationId);

        // Focus the message input
        messageInput?.focus();

    } catch (error) {
        console.error(`Error loading conversation ${conversationId}:`, error);
        messageList.innerHTML = `<div class="p-4 text-center text-red-500">Error loading messages. Please try again.</div>`;
        conversationNameEl.textContent = 'Error';
        callBtn.classList.add('hidden'); // Ensure button is hidden on error
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
    // Remove direct bg-white and dark mode text/bg classes for incoming messages
    // Rely on CSS (.message.self-start) for styling incoming messages
    messageDiv.className = `message max-w-[75%] p-3 rounded-lg shadow-sm relative break-words ${isOwnMessage ? 'bg-blue-500 text-white rounded-br-none' : 'rounded-bl-none'}`; // Removed bg-white, dark:* classes for incoming
    messageDiv.dataset.messageId = msg.id;
    messageDiv.dataset.senderId = msg.sender_id;

    // Explicitly add self-start/self-end for CSS targeting
    messageDiv.classList.add(isOwnMessage ? 'self-end' : 'self-start');

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
// Export functions needed by other modules
export {
    currentConversationId,
    currentUserId,
    conversations, // Make conversation list accessible if needed
    loadConversations,
    loadConversation,
    createMessageElement,
    updateMessageReadStatus,
    renderChatList, // Export if needed for socket updates
    showToast // Export showToast if it's defined here
};