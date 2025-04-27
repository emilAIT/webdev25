// Call notification handling
document.addEventListener('DOMContentLoaded', function () {
    // Call notification elements
    const callNotification = document.getElementById('call-notification');
    const callerAvatar = document.getElementById('caller-avatar');
    const callerName = document.getElementById('caller-name');
    const acceptCallButton = document.getElementById('accept-call');
    const declineCallButton = document.getElementById('decline-call');
    const callRingtone = document.getElementById('call-ringtone');
    const toggleCallSound = document.getElementById('toggle-call-sound');

    // Call notification state
    let currentCallChatId = null;
    let currentCallerId = null;
    let isCallSoundEnabled = true;

    // Call status popup elements
    let callStatusPopup = null;
    let callCancelButton = null;

    // Create call status popup element
    function createCallStatusPopup() {
        // Create the popup if it doesn't exist
        if (!callStatusPopup) {
            callStatusPopup = document.createElement('div');
            callStatusPopup.className = 'call-status-popup';
            callStatusPopup.innerHTML = `
                <div class="call-status-content">
                    <i class="fas fa-phone"></i>
                    <span id="call-status-message">Calling...</span>
                </div>
                <button class="call-cancel-button" id="call-cancel-button">
                    Cancel
                </button>
            `;
            document.body.appendChild(callStatusPopup);

            // Get the cancel button reference
            callCancelButton = document.getElementById('call-cancel-button');

            // Add event listener for the cancel button
            callCancelButton.addEventListener('click', cancelOutgoingCall);
        }
        return callStatusPopup;
    }    // Show the call status popup
    function showCallStatus(message, isError = false) {
        const popup = createCallStatusPopup();
        document.getElementById('call-status-message').textContent = message;
        popup.classList.add('active'); // Always add active

        if (isError) {
            popup.classList.add('error');
            // Keep error messages visible for 3 seconds
            setTimeout(() => {
                if (popup.classList.contains('active')) {
                    popup.classList.add('deactivate');
                    hideCallStatus();
                }
            }, 3000);
        } else {
            popup.classList.add('outgoing');
            // Hide after 120 seconds if no response
            setTimeout(() => {
                if (popup.classList.contains('active')) {
                    hideCallStatus();
                }
            }, 120000);
        }
    }

    // Hide the call status popup
    function hideCallStatus() {
        if (callStatusPopup)
            callStatusPopup.classList.remove('active', 'outgoing', 'deactivate', 'error');
    }

    // Cancel the outgoing call
    function cancelOutgoingCall() {
        if (currentCallChatId && window.activeWebSocket && window.activeWebSocket.readyState === WebSocket.OPEN) {
            window.activeWebSocket.send(JSON.stringify({
                type: "call_cancel",
                chat_id: currentCallChatId
            }));
            console.log('Call cancel request sent for chat:', currentCallChatId);
        } else {
            console.error('Cannot cancel call: No active WebSocket connection');
        }
        hideCallStatus();
    }

    // Show incoming call notification
    function showCallNotification(caller) {
        // Set caller information
        if (caller.profile_photo) {
            callerAvatar.innerHTML = `<img src="${caller.profile_photo}" alt="${caller.name}">`;
        } else {
            callerAvatar.textContent = caller.name.charAt(0).toUpperCase();
        }

        callerName.textContent = caller.name;

        // Show notification
        callNotification.classList.add('active');

        // Play ringtone if sound is enabled
        if (isCallSoundEnabled) {
            console.log('Attempting to play ringtone...');
            // Load the audio file explicitly first
            callRingtone.load();
            // Check if audio file is loaded
            console.log('Ringtone ready state:', callRingtone.readyState);
            // Try to play with better error handling
            callRingtone.play()
                .then(() => console.log('Ringtone playing successfully'))
                .catch(error => {
                    console.error('Error playing ringtone:', error);
                    // Try playing after a user interaction (click on document)
                    document.addEventListener('click', function audioUnlock() {
                        callRingtone.play().catch(e => console.error('Still cannot play audio:', e));
                        document.removeEventListener('click', audioUnlock);
                    }, { once: true });
                });
        }

        // Auto-hide after 120 seconds if no response (call would be missed)
        setTimeout(() => {
            if (callNotification.classList.contains('active')) {
                hideCallNotification();

                // Auto-decline the call if it's still active
                if (currentCallChatId && window.activeWebSocket && window.activeWebSocket.readyState === WebSocket.OPEN) {
                    console.log('Auto-declining call after timeout');
                    window.activeWebSocket.send(JSON.stringify({
                        type: "call_answer",
                        response: "decline",
                        chat_id: currentCallChatId
                    }));
                }
            }
        }, 120000);
    }

    // Hide call notification
    function hideCallNotification() {
        callNotification.classList.remove('active');
        callRingtone.pause();
        callRingtone.currentTime = 0;
    }

    // Handle accept call button click
    acceptCallButton.addEventListener('click', function () {
        // Log what's happening for debugging
        try {
            console.log('Accept button clicked, currentCallChatId:', currentCallChatId);
            // Use the globally shared WebSocket from chat.js
            const socket = window.activeWebSocket;
            console.log('WebSocket status:', socket ? socket.readyState : 'undefined');

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "call_answer",
                    response: "accept",
                    chat_id: currentCallChatId
                }));
            } else {
                console.error('No active WebSocket connection available');
            }

            hideCallNotification();

            // Store the chat ID locally before timeout to ensure it's not lost
            const chatIdToNavigate = currentCallChatId;

            // Redirect to video call page (delay to allow server processing)
            setTimeout(() => {
                console.log('Navigating to video call page for chat:', chatIdToNavigate);
                window.location.href = `/videocall/${chatIdToNavigate}`;
            }, 500);

        } catch (error) {
            console.error('Error during call acceptance:', error);

        }
    });

    // Handle decline call button click
    declineCallButton.addEventListener('click', function () {
        if (currentCallChatId && window.activeWebSocket) {
            window.activeWebSocket.send(JSON.stringify({
                type: "call_answer",
                response: "decline",
                chat_id: currentCallChatId
            }));
        }
        hideCallNotification();
    });

    // Handle toggle sound button click
    toggleCallSound.addEventListener('click', function () {
        isCallSoundEnabled = !isCallSoundEnabled;

        const icon = toggleCallSound.querySelector('i');
        if (isCallSoundEnabled) {
            icon.className = 'fas fa-volume-up';
            if (callNotification.classList.contains('active')) {
                callRingtone.play().catch(error => {
                    console.error('Error playing ringtone:', error);
                });
            }
        } else {
            icon.className = 'fas fa-volume-mute';
            callRingtone.pause();
        }
    });

    // Expose the call handling function to the window object so it can be called from chat.js
    window.handleCallNotification = function (data) {
        console.log('Call notification received:', data);

        switch (data.type) {
            case 'incoming_call':
                // Store the chat ID and caller ID for later use when accepting/declining
                currentCallChatId = data.chat_id;
                currentCallerId = data.caller.id;
                console.log('Setting currentCallChatId to:', currentCallChatId); // Debug logging
                showCallNotification(data.caller);
                break;

            case 'call_status':
                // Make sure we update the current call chat ID when receiving a call status
                if (data.chat_id) {
                    currentCallChatId = data.chat_id;
                    console.log('Setting currentCallChatId from call_status to:', currentCallChatId);
                } else if (window.currentCallChatId) {
                    // Use the global call chat ID if available
                    currentCallChatId = window.currentCallChatId;
                    console.log('Using window.currentCallChatId:', currentCallChatId);
                }
                
                showCallStatus(data.message || 'Calling...');
                break;

            case 'call_accepted':
                hideCallStatus();
                // Redirect to video call page
                window.location.href = `/videocall/${data.chat_id}`;
                break;
            case 'call_declined':
                // First hide the calling status and notification
                hideCallStatus();
                // Then show the declined message
                showCallStatus('Call was declined', true);
                // Reset call state
                currentCallChatId = null;
                currentCallerId = null;
                break;
            case 'call_canceled':
                // Hide the incoming call notification when call is canceled by the caller
                hideCallNotification();
                console.log('Call canceled by the caller');
                // Also hide any call status that might be showing
                hideCallStatus();
                // Reset call state
                currentCallChatId = null;
                currentCallerId = null;
                break;
            case 'call_error':
                hideCallStatus();
                hideCallNotification();
                showError(data.message || 'Call failed');
                break;
        }
    };

    // Helper function to display error messages
    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        document.body.appendChild(errorElement);
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }
});
