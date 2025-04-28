import { socket, isSocketConnected } from './socket.js';
import { currentUserId, showToast } from './chat.js'; // Assuming showToast is exported from chat.js or utils.js

// --- DOM Elements (Declare vars here, assign in init) ---
let callBtn = null;
let callStatusDiv = null; // Keep for 'calling' status
let callStatusText = null;
let hangUpBtn = null; // Old hangup button in status bar
let incomingCallModal = null;
let callerNameEl = null;
let callerAvatarEl = null;
let acceptCallBtn = null;
let rejectCallBtn = null;
let localAudioEl = null; // Will be assigned from parameter
let remoteAudioEl = null; // Will be assigned from parameter
// --- NEW Active Call Modal Elements ---
let activeCallModal = null;
let activeCallAvatar = null;
let activeCallUsername = null;
let activeCallTimer = null;
let muteCallBtn = null;
let activeHangUpBtn = null;
let micIconUnmuted = null;
let micIconMuted = null;

// --- WebRTC State ---
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let currentCall = {
    callId: null,
    callerId: null,
    calleeId: null,
    state: 'idle', // idle, calling, ringing, connected, connecting
    isInitiator: false,
    otherUsername: null // Store the other user's name
};
let callTimerInterval = null; // <-- Declare here
let callStartTime = null;
let isMuted = false;

// --- Configuration (Example STUN server) ---
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // Google's public STUN server
        // You might need TURN servers for NAT traversal in production
    ]
};

// --- Helper Functions ---

function resetCallState() {
    console.log("Resetting call state");
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    remoteStream = null; // Remote stream is managed by peerConnection
    // Elements are now guaranteed to be assigned if init succeeded
    if (localAudioEl) localAudioEl.srcObject = null;
    if (remoteAudioEl) remoteAudioEl.srcObject = null;

    currentCall = {
        callId: null,
        callerId: null,
        calleeId: null,
        state: 'idle',
        isInitiator: false
    };

    // Stop timer (Now safe to access callTimerInterval)
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
    isMuted = false;

    // Ensure active call modal is hidden
    activeCallModal?.classList.add('hidden');
    // Reset mute button state
    if (micIconUnmuted) micIconUnmuted.classList.remove('hidden');
    if (micIconMuted) micIconMuted.classList.add('hidden');

    updateUI();
}

function updateUI() {
    // Ensure elements exist before updating UI
    if (!callStatusDiv || !hangUpBtn || !incomingCallModal || !callerNameEl || !callerAvatarEl || !callBtn || !activeCallModal) {
        console.warn("UI elements not yet initialized in updateUI");
        return;
    }
    console.log("Updating UI based on state:", currentCall.state);

    // Hide all call-related UI initially
    callStatusDiv.classList.add('hidden');
    hangUpBtn.classList.add('hidden');
    incomingCallModal.classList.add('hidden');
    activeCallModal.classList.add('hidden');

    switch (currentCall.state) {
        case 'idle':
            // Show call button only if a 1-on-1 chat is selected (logic in chat.js)
            // Handled by chat.js loadConversation
            break;
        case 'calling':
            callStatusDiv.classList.remove('hidden'); // Use old status bar for calling
            callStatusText.textContent = `Calling ${currentCall.calleeUsername || 'user'}...`;
            hangUpBtn.classList.remove('hidden'); // Use old hangup button here
            callBtn.classList.add('hidden');
            break;
        case 'ringing':
            incomingCallModal.classList.remove('hidden');
            callerNameEl.textContent = currentCall.callerUsername || 'Someone';
            callerAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentCall.callerUsername || 'C')}&background=random&size=60`;
            break;
        case 'connecting': // Intermediate state before 'connected'
            // Show connecting state in the active call modal
            activeCallModal.classList.remove('hidden');
            if (activeCallUsername) activeCallUsername.textContent = `Connecting to ${currentCall.otherUsername || 'user'}...`;
            if (activeCallTimer) activeCallTimer.textContent = '00:00';
            if (activeCallAvatar) activeCallAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentCall.otherUsername || 'U')}&background=random&size=80&color=fff`;
            callBtn.classList.add('hidden');
            break;
        case 'connected':
            activeCallModal.classList.remove('hidden');
            if (activeCallUsername) activeCallUsername.textContent = currentCall.otherUsername || 'user';
            if (activeCallAvatar) activeCallAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentCall.otherUsername || 'U')}&background=random&size=80&color=fff`;
            startCallTimer(); // Start the timer
            callBtn.classList.add('hidden');
            break;
        default:
            // All hidden by default
            break;
    }
}

function startCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    callStartTime = Date.now();
    if (!activeCallTimer) return;

    activeCallTimer.textContent = '00:00'; // Reset display

    callTimerInterval = setInterval(() => {
        if (!callStartTime) {
            clearInterval(callTimerInterval);
            return;
        }
        const elapsedSeconds = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
        const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
        if (activeCallTimer) activeCallTimer.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });
    console.log(`Microphone ${isMuted ? 'muted' : 'unmuted'}`);
    // Update UI
    if (micIconUnmuted) micIconUnmuted.classList.toggle('hidden', isMuted);
    if (micIconMuted) micIconMuted.classList.toggle('hidden', !isMuted);
    if (muteCallBtn) muteCallBtn.title = isMuted ? 'Unmute' : 'Mute';
}

async function getMedia() {
    // Ensure elements exist before setting srcObject
    if (!localAudioEl) {
        console.error("Local audio element not found in getMedia");
        return false;
    }
    console.log("Requesting microphone access...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStream = stream;
        localAudioEl.srcObject = stream; // Play local audio (muted)
        console.log("Microphone access granted.");
        return true;
    } catch (error) {
        console.error('Error accessing media devices.', error);
        showToast('Microphone access denied. Please allow microphone access in your browser settings.', 'error');
        resetCallState();
        return false;
    }
}

function createPeerConnection() {
    // Ensure elements exist before setting srcObject
    if (!remoteAudioEl) {
        console.error("Remote audio element not found in createPeerConnection");
        return;
    }
    console.log("Creating Peer Connection...");
    peerConnection = new RTCPeerConnection(configuration);

    // Add local tracks to the connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            console.log("Adding local track:", track.kind);
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        console.log('Remote track received:', event.track.kind);
        if (!remoteStream) {
            remoteStream = new MediaStream();
            remoteAudioEl.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate:', event.candidate);
            sendSignalingMessage('ice-candidate', event.candidate);
        }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('Peer Connection state changed:', peerConnection.connectionState);
        switch (peerConnection.connectionState) {
            case 'connected':
                if (currentCall.state !== 'connected') {
                    currentCall.state = 'connected';
                    currentCall.otherUsername = currentCall.isInitiator ? currentCall.calleeUsername : currentCall.callerUsername;
                    updateUI();
                    showToast('Call connected!', 'success');
                }
                break;
            case 'disconnected':
            case 'failed':
            case 'closed':
                if (currentCall.state !== 'idle') {
                    showToast('Call ended or disconnected.', 'info');
                    resetCallState();
                }
                break;
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection state changed:', peerConnection.iceConnectionState);
        // Can add more detailed handling here if needed
    }
}

function sendSignalingMessage(type, data) {
    if (!isSocketConnected()) {
        console.error("Socket not connected, cannot send signaling message");
        showToast('Connection error, cannot send call signal.', 'error');
        return;
    }
    const targetId = currentCall.isInitiator ? currentCall.calleeId : currentCall.callerId;
    if (!targetId) {
        console.error("Target ID missing for signaling message");
        return;
    }
    console.log(`Sending signal: ${type} to ${targetId}`);
    socket.emit('webrtc_signal', {
        target_id: targetId,
        type: type,
        data: data
    });
}

// --- Call Initiation and Handling ---

async function startCall(calleeId, calleeUsername) {
    if (currentCall.state !== 'idle') {
        showToast('Already in a call or call attempt in progress.', 'warning');
        return;
    }
    if (!isSocketConnected()) {
        showToast('Not connected to server. Cannot start call.', 'error');
        return;
    }
    if (calleeId === currentUserId) {
        showToast('Cannot call yourself.', 'warning');
        return;
    }

    console.log(`Attempting to call user ${calleeId} (${calleeUsername})`);

    if (!await getMedia()) return; // Request microphone access first

    currentCall.state = 'calling';
    currentCall.callerId = currentUserId;
    currentCall.calleeId = calleeId;
    currentCall.calleeUsername = calleeUsername; // Store for UI
    currentCall.isInitiator = true;
    updateUI();

    // Emit call request via WebSocket
    socket.emit('call_request', { callee_id: calleeId });
    // Peer connection and offer will be created upon 'call_response' acceptance
}

async function handleIncomingCall(data) {
    if (currentCall.state !== 'idle') {
        console.warn('Ignoring incoming call while already busy:', data);
        // Optionally notify the caller that you are busy
        // socket.emit('call_response', { caller_id: data.caller_id, response: 'busy', call_id: data.call_id });
        return;
    }

    console.log('Incoming call received:', data);
    currentCall.state = 'ringing';
    currentCall.callerId = data.caller_id;
    currentCall.callerUsername = data.caller_username;
    currentCall.calleeId = currentUserId;
    currentCall.callId = data.call_id; // Store the call ID from the server
    currentCall.isInitiator = false;
    updateUI();
}

async function acceptCall() {
    if (currentCall.state !== 'ringing') return;
    console.log("Accepting call from", currentCall.callerId);

    if (!await getMedia()) {
        // If media fails, reject the call
        rejectCall();
        return;
    }

    // Respond via WebSocket
    socket.emit('call_response', {
        caller_id: currentCall.callerId,
        response: 'accepted',
        call_id: currentCall.callId
    });

    createPeerConnection(); // Create PC *after* accepting
    // The offer will arrive via 'webrtc_signal'
    currentCall.state = 'connecting'; // Intermediate state
    updateUI(); // Hide modal, show connecting status
    callStatusText.textContent = `Connecting with ${currentCall.callerUsername}...`;
    callStatusDiv.classList.remove('hidden');
    hangUpBtn.classList.remove('hidden');
}

function rejectCall() {
    if (currentCall.state !== 'ringing') return;
    console.log("Rejecting call from", currentCall.callerId);

    socket.emit('call_response', {
        caller_id: currentCall.callerId,
        response: 'rejected',
        call_id: currentCall.callId
    });

    resetCallState();
}

function hangUpCall() {
    if (currentCall.state === 'idle') return;
    console.log("Hanging up call");

    const targetId = currentCall.isInitiator ? currentCall.calleeId : currentCall.callerId;
    if (targetId && currentCall.callId) {
        socket.emit('hang_up', { target_id: targetId, call_id: currentCall.callId });
    }

    resetCallState();
    showToast('Call ended.', 'info');
}

// --- Signaling Message Handlers ---

async function handleWebRTCSignal(data) {
    console.log('Received WebRTC signal:', data.type, 'from', data.sender_id);

    // Ensure peer connection exists if needed
    if (!peerConnection && (data.type === 'answer' || data.type === 'ice-candidate')) {
        console.warn('Received signal but peer connection does not exist. Creating...');
        // This might happen in race conditions. Try creating it.
        if (!localStream && !await getMedia()) {
            console.error("Cannot handle signal without local media.");
            return;
        }
        createPeerConnection();
    }
    // If receiving an offer, ensure PC exists *before* setting remote description
    if (!peerConnection && data.type === 'offer') {
        if (!localStream && !await getMedia()) {
            console.error("Cannot handle offer without local media.");
            return;
        }
        createPeerConnection();
    }

    try {
        switch (data.type) {
            case 'offer':
                // Accept offer only if in 'connecting' state (after accepting)
                if (!currentCall.isInitiator && currentCall.state === 'connecting') {
                    console.log('Setting remote description (offer)');
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
                    console.log('Creating answer...');
                    const answer = await peerConnection.createAnswer();
                    console.log('Setting local description (answer)');
                    await peerConnection.setLocalDescription(answer);
                    sendSignalingMessage('answer', answer);
                } else {
                    console.warn('Received offer in unexpected state:', currentCall.state);
                }
                break;
            case 'answer':
                if (currentCall.isInitiator && currentCall.state === 'connecting') {
                    console.log('Setting remote description (answer)');
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
                } else {
                    console.warn('Received answer in unexpected state:', currentCall.state, 'or as callee.');
                }
                break;
            case 'ice-candidate':
                if (data.data) {
                    console.log('Adding ICE candidate');
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.data));
                } else {
                    console.log('Received null ICE candidate.');
                }
                break;
            default:
                console.warn('Unknown signal type:', data.type);
        }
    } catch (error) {
        console.error('Error handling WebRTC signal:', data.type, error);
        showToast(`Error processing call signal: ${error.message}`, 'error');
        resetCallState(); // Reset on error
    }
}

function handleCallResponse(data) {
    console.log('Received call response:', data);
    if (!currentCall.isInitiator || currentCall.callerId !== currentUserId || currentCall.calleeId !== data.callee_id) {
        console.warn('Received call response for a different call or as callee.');
        return;
    }

    if (data.response === 'accepted') {
        showToast(`${currentCall.calleeUsername || 'User'} accepted the call. Connecting...`, 'info');
        currentCall.state = 'connecting'; // Set state to connecting
        currentCall.callId = data.call_id; // Store the confirmed call ID
        currentCall.otherUsername = currentCall.calleeUsername; // Set other username
        updateUI(); // Update UI to show connecting modal
        // Now create the peer connection and the offer
        createPeerConnection();
        peerConnection.createOffer()
            .then(offer => {
                console.log('Setting local description (offer)');
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log('Sending offer');
                sendSignalingMessage('offer', peerConnection.localDescription);
            })
            .catch(error => {
                console.error('Error creating offer:', error);
                showToast('Failed to initiate call connection.', 'error');
                resetCallState();
            });
    } else if (data.response === 'rejected') {
        showToast(`${currentCall.calleeUsername || 'User'} rejected the call.`, 'warning');
        resetCallState();
    } else if (data.response === 'busy') {
        showToast(`${currentCall.calleeUsername || 'User'} is busy.`, 'warning');
        resetCallState();
    }
}

function handleCallEnded(data) {
    console.log('Received call_ended signal:', data);
    if (currentCall.callId === data.call_id && currentCall.state !== 'idle') {
        showToast('Call ended by the other user.', 'info');
        resetCallState();
    }
}

function handleCallUnavailable(data) {
    console.log('Received call_unavailable signal:', data);
    if (currentCall.isInitiator && currentCall.calleeId === data.callee_id && currentCall.state === 'calling') {
        showToast(`${currentCall.calleeUsername || 'User'} is not available.`, 'warning');
        resetCallState();
    }
}

function handleCallError(data) {
    console.error('Received call_error signal:', data);
    showToast(`Call error: ${data.message || 'Unknown error'}`, 'error');
    resetCallState(); // Reset state on any call error
}

// --- Event Listeners ---

function setupWebRTCListeners() {
    // Ensure elements exist before adding listeners
    if (!hangUpBtn || !acceptCallBtn || !rejectCallBtn || !activeHangUpBtn || !muteCallBtn) {
        console.warn("UI elements not yet initialized in setupWebRTCListeners");
        return;
    }
    // UI Listeners
    // Old hangup button (used during 'calling' state)
    hangUpBtn.addEventListener('click', hangUpCall);
    // Incoming call modal buttons
    acceptCallBtn.addEventListener('click', acceptCall);
    rejectCallBtn.addEventListener('click', rejectCall);
    // --- NEW Active Call Modal Buttons ---
    activeHangUpBtn.addEventListener('click', hangUpCall);
    muteCallBtn.addEventListener('click', toggleMute);

    // Socket Listeners
    if (socket) {
        console.log("Setting up WebRTC socket listeners...");
        socket.on('incoming_call', handleIncomingCall);
        socket.on('call_response', handleCallResponse);
        socket.on('webrtc_signal', handleWebRTCSignal);
        socket.on('call_ended', handleCallEnded);
        socket.on('call_unavailable', handleCallUnavailable);
        socket.on('call_error', handleCallError);
    } else {
        console.error("Socket not initialized, cannot set up WebRTC listeners.");
    }
}

// --- Initialization ---
// Accept ALL required elements as parameters
function initializeWebRTC(initParams) {
    console.log("Initializing WebRTC module with provided elements...");

    // --- Assign provided elements --- 
    localAudioEl = initParams.localAudioElement;
    remoteAudioEl = initParams.remoteAudioElement;
    callBtn = initParams.callBtn;
    callStatusDiv = initParams.callStatusDiv;
    callStatusText = initParams.callStatusText;
    hangUpBtn = initParams.hangUpBtn; // Old status bar hangup
    incomingCallModal = initParams.incomingCallModal;
    callerNameEl = initParams.callerNameEl;
    callerAvatarEl = initParams.callerAvatarEl;
    acceptCallBtn = initParams.acceptCallBtn;
    rejectCallBtn = initParams.rejectCallBtn;
    activeCallModal = initParams.activeCallModal;
    activeCallAvatar = initParams.activeCallAvatar;
    activeCallUsername = initParams.activeCallUsername;
    activeCallTimer = initParams.activeCallTimer;
    muteCallBtn = initParams.muteCallBtn;
    activeHangUpBtn = initParams.activeHangUpBtn;
    micIconUnmuted = initParams.micIconUnmuted;
    micIconMuted = initParams.micIconMuted;

    // --- Detailed Check for Essential Elements --- 
    const elementChecks = {
        localAudioEl: !!localAudioEl,
        remoteAudioEl: !!remoteAudioEl,
        callBtn: !!callBtn,
        callStatusDiv: !!callStatusDiv,
        hangUpBtn: !!hangUpBtn,
        incomingCallModal: !!incomingCallModal,
        acceptCallBtn: !!acceptCallBtn,
        rejectCallBtn: !!rejectCallBtn,
        activeCallModal: !!activeCallModal,
        muteCallBtn: !!muteCallBtn,
        activeHangUpBtn: !!activeHangUpBtn,
        micIconUnmuted: !!micIconUnmuted,
        micIconMuted: !!micIconMuted
    };

    let allFound = true;
    for (const [key, found] of Object.entries(elementChecks)) {
        if (!found) {
            console.error(`[WebRTC Init] Failed to find element: ${key}`);
            allFound = false;
        }
    }

    if (!allFound) {
        console.error("Failed to find one or more UI control elements during WebRTC initialization! Check IDs in index.html and assignments in chat.js.");
        showToast("Error initializing call UI components.", "error");
        // Decide if this is critical enough to stop
        // return; // Optionally stop initialization if critical elements are missing
    }

    resetCallState(); // Ensure clean state on init
    setupWebRTCListeners();
}

// --- Exports ---
export { initializeWebRTC, startCall, currentCall, updateUI as updateWebRTCUI }; // Export necessary functions and state
