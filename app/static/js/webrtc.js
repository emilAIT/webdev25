/**
 * WebRTC audio call implementation for ShrekChat
 */

// WebRTC configuration
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Global state
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let localAudio = null;
let remoteAudio = null;
let callActive = false;
let currentCallData = null;
let callDuration = 0;
let callTimer = null;
let isAudioMuted = false;
let ringtone = null;
let dialTone = null;

// Initialize WebRTC
function initWebRTC() {
    try {
        setupWebSocketHandler();
        setupEventListeners();
        console.log('WebRTC initialized successfully');
    } catch (error) {
        console.error('Failed to initialize WebRTC:', error);
    }
}

// Set up WebSocket handler
function setupWebSocketHandler() {
    window.addEventListener('websocket_message', (e) => {
        const data = e.detail;
        if (!data || !data.type) return;

        try {
            switch (data.type) {
                case 'call_offer':
                    handleCallOffer(data);
                    break;
                case 'call_answer':
                    handleCallAnswer(data);
                    break;
                case 'call_ice_candidate':
                    handleIceCandidate(data);
                    break;
                case 'call_end':
                    handleCallEnd(data);
                    break;
                case 'call_decline':
                    handleCallDeclined(data);
                    break;
                default:
                    console.log('Unknown call message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling call message:', error);
        }
    });
}

// Set up event listeners
function setupEventListeners() {
    const audioCallBtn = document.getElementById('audioCallBtn');
    if (audioCallBtn) {
        audioCallBtn.addEventListener('click', startCall);
    }

    const acceptCallBtn = document.getElementById('acceptCallBtn');
    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', acceptIncomingCall);
    }

    const declineCallBtn = document.getElementById('declineCallBtn');
    if (declineCallBtn) {
        declineCallBtn.addEventListener('click', declineIncomingCall);
    }

    const cancelCallBtn = document.getElementById('cancelCallBtn');
    if (cancelCallBtn) {
        cancelCallBtn.addEventListener('click', cancelOutgoingCall);
    }

    const endCallBtn = document.getElementById('endCallBtn');
    if (endCallBtn) {
        endCallBtn.addEventListener('click', endCall);
    }

    const toggleMuteBtn = document.getElementById('toggleMuteBtn');
    if (toggleMuteBtn) {
        toggleMuteBtn.addEventListener('click', toggleMute);
    }
}

// Start a new call
async function startCall() {
    try {
        const currentRoomId = window.shrekChatWebSocket?.getCurrentRoomId();
        const isGroup = window.shrekChatWebSocket?.getCurrentRoomIsGroup();
        const contactName = document.getElementById('chatContactName')?.textContent;
        const contactAvatar = document.getElementById('chatContactAvatar')?.src;

        if (!currentRoomId || isGroup) {
            throw new Error("Cannot call: No valid contact selected or in a group chat");
        }

        const contactItem = document.querySelector(`.contact-item[data-room-id="${currentRoomId}"]`);
        const targetUserId = contactItem?.dataset.userId;

        if (!targetUserId) {
            throw new Error("Cannot call: Target user ID not found");
        }

        // Initialize WebRTC connection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        setupPeerConnectionHandlers();

        // Get user media with specific audio settings
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1
            },
            video: false
        });

        // Set up local audio
        setupLocalAudio();

        // Add tracks to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Create and send offer
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true
        });
        await peerConnection.setLocalDescription(offer);

        // Store call data
        currentCallData = {
            roomId: currentRoomId,
            targetUserId: targetUserId,
            contactName: contactName,
            contactAvatar: contactAvatar
        };

        // Send the offer
        sendCallSignaling({
            type: 'call_offer',
            target_user_id: targetUserId,
            room_id: currentRoomId,
            sdp: offer
        });

        // Show outgoing call UI
        showOutgoingCall(contactName, contactAvatar);

    } catch (error) {
        console.error("Error starting call:", error);
        cleanup();
        showError("Call Failed", "Could not start the call. Please try again.");
    }
}

// Set up peer connection handlers
function setupPeerConnectionHandlers() {
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            console.log('Call connected successfully!');
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendCallSignaling({
                type: 'call_ice_candidate',
                target_user_id: currentCallData.targetUserId,
                room_id: currentCallData.roomId,
                candidate: event.candidate
            });
        }
    };

    peerConnection.ontrack = (event) => {
        console.log('Remote track received');
        remoteStream = event.streams[0];
        setupRemoteAudio();
    };
}

// Set up local audio
function setupLocalAudio() {
    if (localAudio) {
        localAudio.pause();
        localAudio.srcObject = null;
        localAudio.remove();
    }

    localAudio = document.createElement('audio');
    localAudio.id = 'localAudio';
    localAudio.muted = true; // Prevent echo
    localAudio.autoplay = true;
    localAudio.srcObject = localStream;
    document.body.appendChild(localAudio);
}

// Set up remote audio
function setupRemoteAudio() {
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
        remoteAudio.remove();
    }

    remoteAudio = document.createElement('audio');
    remoteAudio.id = 'remoteAudio';
    remoteAudio.autoplay = true;
    remoteAudio.srcObject = remoteStream;
    document.body.appendChild(remoteAudio);

    // Try to play audio
    const playAudio = () => {
        if (!remoteAudio) return;

        remoteAudio.play()
            .then(() => {
                console.log('Remote audio playing successfully');
                remoteAudio.volume = 1.0;
            })
            .catch(error => {
                console.error('Failed to play remote audio:', error);
                if (remoteAudio && callActive) {
                    setTimeout(playAudio, 1000);
                }
            });
    };

    playAudio();
}

// Accept incoming call
async function acceptIncomingCall() {
    try {
        console.log('Accepting incoming call');
        stopRingtone();
        hideIncomingCallUI();

        // Initialize WebRTC connection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        setupPeerConnectionHandlers();

        // Get user media with specific audio settings
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1
            },
            video: false
        });

        // Set up local audio
        setupLocalAudio();

        // Add tracks to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Set remote description and create answer
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(currentCallData.offer)
        );
        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true
        });
        await peerConnection.setLocalDescription(answer);

        // Send the answer
        sendCallSignaling({
            type: 'call_answer',
            target_user_id: currentCallData.targetUserId,
            room_id: currentCallData.roomId,
            sdp: answer
        });

        // Start active call
        startActiveCall();

    } catch (error) {
        console.error("Error accepting call:", error);
        cleanup();
        showError("Call Failed", "Could not accept the call. Please try again.");
    }
}

// Handle call offer
async function handleCallOffer(data) {
    try {
        if (callActive) {
            sendCallSignaling({
                type: 'call_decline',
                target_user_id: data.caller_id,
                room_id: data.room_id
            });
            return;
        }

        currentCallData = {
            roomId: data.room_id,
            targetUserId: data.caller_id,
            contactName: data.caller_name,
            contactAvatar: data.caller_avatar,
            offer: data.sdp
        };

        showIncomingCall(data.caller_name, data.caller_avatar);
        playRingtone();

    } catch (error) {
        console.error("Error handling call offer:", error);
        cleanup();
    }
}

// Handle call answer
async function handleCallAnswer(data) {
    try {
        stopDialTone();
        hideOutgoingCallUI();
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
        );
        startActiveCall();
    } catch (error) {
        console.error("Error handling call answer:", error);
        cleanup();
    }
}

// Handle ICE candidate
async function handleIceCandidate(data) {
    try {
        if (peerConnection && data.candidate) {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );
        }
    } catch (error) {
        console.error("Error handling ICE candidate:", error);
    }
}

// Handle call end
function handleCallEnd(data) {
    hideAllCallOverlays();
    stopAllSounds();
    stopCallTimer();
    cleanup();
}

// Handle call decline
function handleCallDeclined(data) {
    stopDialTone();
    hideOutgoingCallUI();
    showInfo("Call Declined", "The other party declined your call.");
    cleanup();
}

// Decline incoming call
function declineIncomingCall() {
    stopRingtone();
    sendCallSignaling({
        type: 'call_decline',
        target_user_id: currentCallData.targetUserId,
        room_id: currentCallData.roomId
    });
    hideIncomingCallUI();
    cleanup();
}

// Cancel outgoing call
function cancelOutgoingCall() {
    stopDialTone();
    sendCallSignaling({
        type: 'call_end',
        target_user_id: currentCallData.targetUserId,
        room_id: currentCallData.roomId
    });
    hideOutgoingCallUI();
    cleanup();
}

// End active call
function endCall() {
    sendCallSignaling({
        type: 'call_end',
        target_user_id: currentCallData.targetUserId,
        room_id: currentCallData.roomId
    });
    hideActiveCallUI();
    stopCallTimer();
    cleanup();
}

// Toggle mute
function toggleMute() {
    if (!localStream) return;
    
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioMuted;
    });

    const toggleMuteBtn = document.getElementById('toggleMuteBtn');
    if (toggleMuteBtn) {
        const icon = toggleMuteBtn.querySelector('i');
        icon.className = isAudioMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
    }
}

// UI Management
function showOutgoingCall(contactName, contactAvatar) {
    const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
    const calleeAvatar = document.getElementById('calleeAvatar');
    const calleeName = document.getElementById('calleeName');
    const backdrop = document.getElementById('callOverlayBackdrop');

    if (calleeAvatar) calleeAvatar.src = contactAvatar || '/static/images/shrek.jpg';
    if (calleeName) calleeName.textContent = contactName || 'User';

    showBackdrop();
    showOverlay(outgoingCallOverlay);
    playDialTone();
}

function showIncomingCall(callerName, callerAvatar) {
    const incomingCallOverlay = document.getElementById('incomingCallOverlay');
    const callerAvatarElem = document.getElementById('callerAvatar');
    const callerNameElem = document.getElementById('callerName');

    if (callerAvatarElem) callerAvatarElem.src = callerAvatar || '/static/images/shrek.jpg';
    if (callerNameElem) callerNameElem.textContent = callerName || 'User';

    showBackdrop();
    showOverlay(incomingCallOverlay);
}

function startActiveCall() {
    const activeCallOverlay = document.getElementById('activeCallOverlay');
    const activeCallAvatar = document.getElementById('activeCallAvatar');
    const activeCallName = document.getElementById('activeCallName');

    hideIncomingCallUI();
    hideOutgoingCallUI();

    if (activeCallAvatar) {
        activeCallAvatar.src = currentCallData.contactAvatar || '/static/images/shrek.jpg';
    }
    if (activeCallName) {
        activeCallName.textContent = currentCallData.contactName || 'User';
    }

    setTimeout(() => {
        showOverlay(activeCallOverlay);
        callActive = true;
        startCallTimer();
    }, 100);
}

// Helper methods
function showOverlay(overlay) {
    if (overlay) {
        overlay.classList.add('visible');
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
    }
}

function hideOverlay(overlay) {
    if (overlay) {
        overlay.classList.remove('visible');
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
    }
}

function showBackdrop() {
    const backdrop = document.getElementById('callOverlayBackdrop');
    if (backdrop) {
        backdrop.classList.add('visible');
        backdrop.style.opacity = '1';
        backdrop.style.visibility = 'visible';
    }
    document.body.classList.add('has-call-active');
}

function hideBackdrop() {
    const backdrop = document.getElementById('callOverlayBackdrop');
    if (backdrop) {
        backdrop.classList.remove('visible');
        backdrop.style.opacity = '0';
        backdrop.style.visibility = 'hidden';
    }
    document.body.classList.remove('has-call-active');
}

function hideIncomingCallUI() {
    const incomingCallOverlay = document.getElementById('incomingCallOverlay');
    hideOverlay(incomingCallOverlay);
}

function hideOutgoingCallUI() {
    const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
    hideOverlay(outgoingCallOverlay);
}

function hideActiveCallUI() {
    const activeCallOverlay = document.getElementById('activeCallOverlay');
    hideOverlay(activeCallOverlay);
}

function hideAllCallOverlays() {
    hideIncomingCallUI();
    hideOutgoingCallUI();
    hideActiveCallUI();
    hideBackdrop();
}

// Sound management
function playRingtone() {
    try {
        if (ringtone) {
            stopRingtone();
        }
        ringtone = new Audio('/static/sounds/ringing.mp3');
        ringtone.loop = true;
        ringtone.play().catch(e => console.log('Failed to play ringtone:', e));
    } catch (error) {
        console.error('Failed to play ringtone:', error);
    }
}

function stopRingtone() {
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
        ringtone = null;
    }
}

function playDialTone() {
    try {
        dialTone = new Audio('/static/sounds/dialing.mp3');
        dialTone.loop = true;
        dialTone.play().catch(e => console.log('Failed to play dial tone:', e));
    } catch (error) {
        console.error('Failed to play dial tone:', error);
    }
}

function stopDialTone() {
    if (dialTone) {
        dialTone.pause();
        dialTone.currentTime = 0;
        dialTone = null;
    }
}

function stopAllSounds() {
    stopRingtone();
    stopDialTone();
}

// Timer management
function startCallTimer() {
    callDuration = 0;
    updateCallDuration();
    callTimer = setInterval(() => {
        callDuration++;
        updateCallDuration();
    }, 1000);
}

function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
}

function updateCallDuration() {
    const callDurationElement = document.getElementById('callDuration');
    if (!callDurationElement) return;
    
    const minutes = Math.floor(callDuration / 60).toString().padStart(2, '0');
    const seconds = (callDuration % 60).toString().padStart(2, '0');
    
    callDurationElement.textContent = `${minutes}:${seconds}`;
}

// Cleanup
function cleanup() {
    // Stop media streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Remove audio elements
    if (localAudio) {
        localAudio.pause();
        localAudio.srcObject = null;
        localAudio.remove();
        localAudio = null;
    }
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
        remoteAudio.remove();
        remoteAudio = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Reset call state
    callActive = false;
    currentCallData = null;
    isAudioMuted = false;
    remoteStream = null;
    
    // Stop all sounds
    stopAllSounds();
    
    // Hide all overlays
    hideAllCallOverlays();
}

// Signaling
function sendCallSignaling(message) {
    if (window.shrekChatWebSocket && window.shrekChatWebSocket.sendCallSignaling) {
        window.shrekChatWebSocket.sendCallSignaling(message);
    } else {
        console.error("WebSocket interface is not available");
    }
}

// Error handling
function showError(title, message) {
    if (window.alertPopup) {
        window.alertPopup.showError(title, message);
    }
}

function showInfo(title, message) {
    if (window.alertPopup) {
        window.alertPopup.showInfo(title, message);
    }
}

// Initialize WebRTC when the page loads
document.addEventListener('DOMContentLoaded', initWebRTC);