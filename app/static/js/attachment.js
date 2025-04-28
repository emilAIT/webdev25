document.addEventListener('DOMContentLoaded', function() {
    // Get the attachment button and create attachment popup
    const attachmentBtn = document.querySelector('.attachment-btn');
    let attachmentPopup = null;
    let attachmentsOverlay = null;
    
    // Maximum file size (in bytes) - 20MB
    const MAX_FILE_SIZE = 20 * 1024 * 1024; 
    
    // Setup attachment button click event
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Create and show attachment options popup
            showAttachmentPopup();
        });
    }
    
    /**
     * Create and display the attachment popup with options
     */
    function showAttachmentPopup() {
        // Don't create duplicates
        if (attachmentPopup) {
            attachmentPopup.remove();
        }
        
        // Create overlay
        attachmentsOverlay = document.createElement('div');
        attachmentsOverlay.className = 'attachments-overlay';
        document.body.appendChild(attachmentsOverlay);
        
        // Create popup
        attachmentPopup = document.createElement('div');
        attachmentPopup.className = 'attachments-popup';
        
        // Add attachment options
        const attachmentOptions = [
            { type: 'photo', icon: 'fa-image', label: 'Photo', accept: 'image/*' },
            { type: 'video', icon: 'fa-video', label: 'Video', accept: 'video/*' },
            { type: 'document', icon: 'fa-file-alt', label: 'Document', accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt' },
            { type: 'audio', icon: 'fa-music', label: 'Audio', accept: 'audio/*' }
        ];
        
        attachmentOptions.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'attachment-option';
            optionElement.innerHTML = `
                <div class="attachment-icon">
                    <i class="fas ${option.icon}"></i>
                </div>
                <span>${option.label}</span>
                <input type="file" id="attachment-${option.type}" accept="${option.accept}" style="display: none;">
            `;
            attachmentPopup.appendChild(optionElement);
            
            // Add click event for this option
            optionElement.addEventListener('click', function() {
                const fileInput = this.querySelector('input[type="file"]');
                fileInput.click();
            });
            
            // Handle file selection
            const fileInput = optionElement.querySelector('input[type="file"]');
            fileInput.addEventListener('change', function() {
                if (this.files && this.files[0]) {
                    handleFileSelection(this.files[0], option.type);
                }
            });
        });
        
        // Add popup to the body
        document.body.appendChild(attachmentPopup);
        
        // Position the popup directly above the input container
        const inputContainer = document.querySelector('.message-input-container');
        const btnRect = attachmentBtn.getBoundingClientRect();
        const inputContainerRect = inputContainer.getBoundingClientRect();
        
        attachmentPopup.style.position = 'fixed';
        attachmentPopup.style.bottom = `${window.innerHeight - inputContainerRect.top + 10}px`;
        attachmentPopup.style.left = `${btnRect.left}px`;
        
        // Adjust if the popup would go off-screen
        setTimeout(() => {
            const popupRect = attachmentPopup.getBoundingClientRect();
            if (popupRect.right > window.innerWidth) {
                // Shift left to stay on screen with 10px margin
                attachmentPopup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
            }
            if (popupRect.left < 0) {
                // Shift right to stay on screen with 10px margin
                attachmentPopup.style.left = '10px';
            }
            
            // Show popup with animation after positioning
            attachmentPopup.classList.add('active');
            attachmentsOverlay.classList.add('active');
        }, 10);
        
        // Add click event to the overlay to close the popup
        attachmentsOverlay.addEventListener('click', closeAttachmentPopup);
    }
    
    /**
     * Close the attachment popup
     */

    function closeAttachmentPopup() {
        if (attachmentPopup) {
            attachmentPopup.classList.remove('active');
            attachmentsOverlay.classList.remove('active');
            
            setTimeout(() => {
                attachmentPopup.remove();
                attachmentsOverlay.remove();
                attachmentPopup = null;
                attachmentsOverlay = null;
            }, 300);
        }
    }
    
    /**
     * Handle the selected file
     * @param {File} file - Selected file
     * @param {string} type - Type of attachment (photo, video, document, audio)
     */
    function handleFileSelection(file, type) {
        // Close the popup
        closeAttachmentPopup();
        
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            showAlertPopup('File Too Large', 'The maximum file size is 20MB', 'error');
            return;
        }
        
        // Get current room ID
        const currentRoomId = window.BlinkWebSocket ? 
            window.BlinkWebSocket.getCurrentRoomId() : 
            document.getElementById('chatContent').getAttribute('data-current-room-id');
            
        if (!currentRoomId) {
            showAlertPopup('Error', 'No active chat selected', 'error');
            return;
        }
        
        // Show loading indicator
        showSendingAttachmentIndicator(file.name, type);
        
        // Create FormData and upload the file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('room_id', currentRoomId);
        formData.append('attachment_type', type);
        
        // Upload the file
        fetch('/api/messages/attachment', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to upload attachment');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            hideSendingAttachmentIndicator();
            
            // Display the message with attachment in the chat
            if (window.displayMessage) {
                // The server returns the message directly in the data object, not in a nested message property
                const messageData = data.message || data;
                
                // Force the message to display as outgoing (from the sender)
                if (messageData) {
                    // Mark this as the current user's message
                    messageData.sender = 'user';
                    window.displayMessage(messageData);
                }
            }
        })
        .catch(error => {
            console.error('Error uploading attachment:', error);
            hideSendingAttachmentIndicator();
            showAlertPopup('Upload Failed', 'Failed to upload attachment. Please try again.', 'error');
        });
    }
    
    /**
     * Show a temporary indicator that an attachment is being sent
     * @param {string} fileName - Name of the file being uploaded
     * @param {string} type - Type of attachment
     */
    function showSendingAttachmentIndicator(fileName, type) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const loadingElement = document.createElement('div');
        loadingElement.className = 'message outgoing attachment-loading';
        loadingElement.id = 'attachment-loading-indicator';
        
        // Get appropriate icon
        let icon = 'fa-file';
        if (type === 'photo') icon = 'fa-image';
        else if (type === 'video') icon = 'fa-video';
        else if (type === 'document') icon = 'fa-file-alt';
        else if (type === 'audio') icon = 'fa-music';
        loadingElement.innerHTML = `
            <div class="message-content">
                <div class="attachment-preview">
                    <i class="fas ${icon}"></i>
                    <div class="attachment-info">
                        <span class="attachment-name">${fileName}</span>
                        <div class="attachment-loading-bar">
                            <div class="loading-progress"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="message-info">
                <span class="message-time">Sending...</span>
            </div>
        `;
        
        chatMessages.appendChild(loadingElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Animate the loading bar
        const loadingBar = loadingElement.querySelector('.loading-progress');
        animateLoadingBar(loadingBar);
    }
    
    /**
     * Hide the sending attachment indicator
     */
    function hideSendingAttachmentIndicator() {
        const indicator = document.getElementById('attachment-loading-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    /**
     * Animate the loading bar
     * @param {HTMLElement} loadingBar - The loading bar element to animate
     */
    function animateLoadingBar(loadingBar) {
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 90) {
                clearInterval(interval);
            } else {
                width += 10;
                loadingBar.style.width = `${width}%`;
            }
        }, 300);
    }
    /**
     * Display an alert popup
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     * @param {string} type - Alert type (success, error, warning, info)
     */
    function showAlertPopup(title, message, type = 'info') {
        if (window.Swal) {
            window.Swal.fire({
                icon: type,
                title: title,
                text: message,
                confirmButtonText: 'OK'
            });
        } else {
            alert(`${title}: ${message}`);
        }
    }
});