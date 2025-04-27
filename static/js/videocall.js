document.addEventListener('DOMContentLoaded', async () => {
    const localVideo = document.querySelector('.local-video');
    const localPlaceholder = document.querySelector('.local-placeholder');
    const muteButton = document.querySelector('.control-button.mute');
    const videoButton = document.querySelector('.control-button.video-off');
    const endCallButton = document.querySelector('.control-button.end-call');
    
    let stream;
    let isMuted = false;
    let isVideoOff = false;
    
    // Initialize the video stream
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
        localPlaceholder.style.display = 'none';
        
        // When video starts playing, ensure placeholder is hidden
        localVideo.onplaying = () => {
            localPlaceholder.style.display = 'none';
        };
    } catch (error) {
        console.error('Error accessing media devices:', error);
        localPlaceholder.style.display = 'flex';
        localVideo.style.display = 'none';
        
        // Show specific error message based on the error
        if (error.name === 'NotAllowedError') {
            document.querySelector('.placeholder-text').textContent = 
                'Camera access denied. Please allow access in your browser settings.';
        } else if (error.name === 'NotFoundError') {
            document.querySelector('.placeholder-text').textContent = 
                'No camera found. Please connect a camera.';
        }
    }
    
    // Add functionality to the mute button
    muteButton.addEventListener('click', () => {
        if (!stream) return;
        
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) return;
        
        isMuted = !isMuted;
        audioTracks.forEach(track => {
            track.enabled = !isMuted;
        });
        
        // Update button UI
        if (isMuted) {
            muteButton.querySelector('i').className = 'fas fa-microphone-slash';
            muteButton.style.backgroundColor = '#e74c3c';
        } else {
            muteButton.querySelector('i').className = 'fas fa-microphone';
            muteButton.style.backgroundColor = '#7f8c8d';
        }
    });
    
    // Add functionality to the video button
    videoButton.addEventListener('click', () => {
        if (!stream) return;
        
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) return;
        
        isVideoOff = !isVideoOff;
        videoTracks.forEach(track => {
            track.enabled = !isVideoOff;
        });
        
        // Update button UI and show/hide placeholder
        if (isVideoOff) {
            videoButton.querySelector('i').className = 'fas fa-video-slash';
            videoButton.style.backgroundColor = '#e74c3c';
            localPlaceholder.style.display = 'flex';
        } else {
            videoButton.querySelector('i').className = 'fas fa-video';
            videoButton.style.backgroundColor = '#7f8c8d';
            localPlaceholder.style.display = 'none';
        }
    });
    
    // Setup WebRTC after obtaining local media
    const remoteVideo = document.querySelector('.remote-video');
    const remotePlaceholder = document.querySelector('.remote-placeholder');

    // Create signaling WebSocket
    const signalProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const signalUrl = `${signalProtocol}//${window.location.host}/api/ws/videocall/${CHAT_ID}?token=${TOKEN}`;
    const signalingSocket = new WebSocket(signalUrl);
    
    // Debugging: log errors and closure events
    signalingSocket.onerror = (error) => {
        console.error('Signaling WebSocket encountered error:', error);
    };
    signalingSocket.onclose = (event) => {
        console.warn('Signaling WebSocket closed:', event.code, event.reason);
    };

    // RTCPeerConnection configuration
    const pcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(pcConfig);

    // Add local tracks to peer connection
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Handle ICE candidates
    pc.onicecandidate = event => {
        if (event.candidate) {
            signalingSocket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    // Handle remote track
    pc.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
        remotePlaceholder.style.display = 'none';
    };

    // Signaling message handling
    signalingSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        try {
            if (message.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: message.sdp }));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                signalingSocket.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
            } else if (message.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: message.sdp }));
            } else if (message.type === 'candidate') {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            } else if (message.type === 'call_end' || message.type === 'call_declined') {
                // Call ended or declined, clean up and redirect
                endCall();
            }
        } catch (e) {
            console.error('Error during signaling handling:', e);
        }
    };

    // Once signaling socket is open, create and send offer
    signalingSocket.onopen = async () => {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            signalingSocket.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
        } catch (e) {
            console.error('Error creating offer:', e);
        }
    };

    // Function to handle call cleanup and redirect
    function endCall() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        try { pc.close(); } catch {};
        try { signalingSocket.close(); } catch {};
        window.location.href = '/chat';
    }

    // Clean up on end call
    endCallButton.addEventListener('click', () => {
        // Notify other peer that we're ending the call
        if (signalingSocket.readyState === WebSocket.OPEN) {
            signalingSocket.send(JSON.stringify({ type: 'call_end' }));
        }
        endCall();
    });

    // Handle peer connection state changes
    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || 
            pc.iceConnectionState === 'failed' || 
            pc.iceConnectionState === 'closed') {
            // Connection lost with the other peer, end the call
            endCall();
        }
    };
});
