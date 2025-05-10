document.addEventListener('DOMContentLoaded', function() {
    console.log("Translation.js loaded - translation functionality initialized");

    // Create a shared context object on the window
    if (!window.BlinkContextMenu) {
        window.BlinkContextMenu = {};
    }

    // Get the translate buttons from context menus
    let translateBtn = document.getElementById('translateMessageOption');
    let incomingTranslateBtn = document.getElementById('incomingTranslateMessageOption');
    let translationPopup = null;
    let translationOverlay = null;
    
    // Variables to store current context
    let currentMessageElement = null;
    let currentMessageId = null;
    let currentContent = null;      // Access to context data from chatFunc.js
    function getCurrentMessageContext() {
        // Try to get the message element from any open context menu
        const contextMenu = document.getElementById('messageContextMenu');
        const incomingContextMenu = document.getElementById('incomingMessageContextMenu');
        
        // Check if either context menu is open
        if ((contextMenu && contextMenu.style.display === 'block') || 
            (incomingContextMenu && incomingContextMenu.style.display === 'block')) {
            // Get message element with context menu open
            currentMessageElement = document.querySelector('.message.context-active');
            
            // If not found via classes, try to get from the parent scope or context
            if (!currentMessageElement) {
                console.log("No message with context-active class found, looking for it in other ways");
                
                // Try to get it from chat.js if it was stored in a global variable
                if (window.BlinkContextMenu && window.BlinkContextMenu.currentMessageElement) {
                    currentMessageElement = window.BlinkContextMenu.currentMessageElement;
                }
            }
            
            // Get message details if we have the element
            if (currentMessageElement) {
                currentMessageId = currentMessageElement.getAttribute('data-message-id');
                const contentElement = currentMessageElement.querySelector('.message-content');
                if (contentElement) {
                    currentContent = contentElement.textContent;
                    return true;
                }
            }
        }
        
        // If we got here, we couldn't find a valid message context
        console.error("Failed to get message context. No active message found.");
        return false;
    }
    
    // Setup translation button click event for outgoing messages
    if (translateBtn) {
        translateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Get current message context
            if (!getCurrentMessageContext()) {
                console.error('No message selected for translation');
                return;
            }
            
            // Create and show translation options popup
            showTranslationPopup();
            
            // Hide the context menu
            const contextMenu = document.getElementById('messageContextMenu');
            if (contextMenu) {
                contextMenu.style.display = 'none';
            }
        });
    }
      // Setup translation button click event for incoming messages
    if (incomingTranslateBtn) {
        incomingTranslateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log("Incoming translate button clicked");
            
            // Get current message context
            if (!getCurrentMessageContext()) {
                // Try to get it directly from chatFunc.js via the global variable
                const activeMessage = document.querySelector('.message.context-active');
                if (activeMessage) {
                    currentMessageElement = activeMessage;
                    currentMessageId = activeMessage.getAttribute('data-message-id');
                    currentContent = activeMessage.querySelector('.message-content').textContent;
                } else {
                    console.error('No message selected for translation');
                    return;
                }
            }
            
            // Create and show translation options popup
            showTranslationPopup();
            
            // Hide the context menu
            const contextMenu = document.getElementById('incomingMessageContextMenu');
            if (contextMenu) {
                contextMenu.style.display = 'none';
            }
        });
    }
      // Listen for custom translate-message event from chatFunc.js
    window.addEventListener('translate-message', function(e) {
        console.log("Received translate-message event:", e);
        
        // Extract the message element and content from the event detail
        if (e.detail && e.detail.messageElement) {
            currentMessageElement = e.detail.messageElement;
            currentContent = e.detail.content || currentMessageElement.querySelector('.message-content')?.textContent;
            
            // Store on the window object for potential cross-file access
            if (window.BlinkContextMenu) {
                window.BlinkContextMenu.currentMessageElement = currentMessageElement;
            }
            
            if (currentMessageElement && currentContent) {
                // Show translation options popup
                showTranslationPopup();
            } else {
                console.error('Invalid message data in translate-message event');
            }
        } else {
            console.error('Missing message element in translate-message event');
        }
    });
    
    /**
     * Create and display the translation popup with language options
     */
    function showTranslationPopup() {
        // Don't create duplicates
        if (translationPopup) {
            translationPopup.remove();
        }
        
        // Create overlay
        translationOverlay = document.createElement('div');
        translationOverlay.className = 'translation-overlay';
        document.body.appendChild(translationOverlay);
        
        // Create popup
        translationPopup = document.createElement('div');
        translationPopup.className = 'translation-popup';
        
        // Add translation language options
        const languageOptions = [
            { code: 'en', name: 'English', icon: '🇺🇸' },
            { code: 'es', name: 'Spanish', icon: '🇪🇸' },
            { code: 'fr', name: 'French', icon: '🇫🇷' },
            { code: 'de', name: 'German', icon: '🇩🇪' },
            { code: 'it', name: 'Italian', icon: '🇮🇹' },
            { code: 'ja', name: 'Japanese', icon: '🇯🇵' },
            { code: 'zh', name: 'Chinese', icon: '🇨🇳' },
            { code: 'ru', name: 'Russian', icon: '🇷🇺' },
            { code: 'ar', name: 'Arabic', icon: '🇸🇦' },
            { code: 'pt', name: 'Portuguese', icon: '🇵🇹' }
        ];
        
        // Add popup title
        const popupTitle = document.createElement('div');
        popupTitle.className = 'translation-popup-title';
        popupTitle.textContent = 'Translate to:';
        translationPopup.appendChild(popupTitle);
        
        // Create a container for language options
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'translation-options-container';
        
        languageOptions.forEach(language => {
            const optionElement = document.createElement('div');
            optionElement.className = 'translation-option';
            optionElement.innerHTML = `
                <div class="translation-icon">
                    ${language.icon}
                </div>
                <span>${language.name}</span>
            `;
            optionsContainer.appendChild(optionElement);
            
            // Add click event for this option
            optionElement.addEventListener('click', function() {
                handleLanguageSelection(language.code, language.name);
            });
        });
        
        translationPopup.appendChild(optionsContainer);
        
        // Add popup to the body
        document.body.appendChild(translationPopup);
        
        // Position the popup near the message
        if (currentMessageElement) {
            const messageRect = currentMessageElement.getBoundingClientRect();
            
            translationPopup.style.position = 'fixed';
            translationPopup.style.top = `${messageRect.top}px`;
            translationPopup.style.left = `${messageRect.right + 10}px`;
            
            // Adjust if the popup would go off-screen
            setTimeout(() => {
                const popupRect = translationPopup.getBoundingClientRect();
                
                if (popupRect.right > window.innerWidth) {
                    // Position to the left of the message instead
                    translationPopup.style.left = `${messageRect.left - popupRect.width - 10}px`;
                }
                
                if (popupRect.bottom > window.innerHeight) {
                    // Align with bottom of screen with margin
                    translationPopup.style.top = `${window.innerHeight - popupRect.height - 10}px`;
                }
                
                if (popupRect.top < 0) {
                    // Align with top of screen with margin
                    translationPopup.style.top = '10px';
                }
                
                // Show popup with animation after positioning
                translationPopup.classList.add('active');
                translationOverlay.classList.add('active');
            }, 10);
        }
        
        // Add click event to the overlay to close the popup
        translationOverlay.addEventListener('click', closeTranslationPopup);
    }
    
    /**
     * Close the translation popup
     */
    function closeTranslationPopup() {
        if (translationPopup) {
            translationPopup.classList.remove('active');
            translationOverlay.classList.remove('active');
            
            setTimeout(() => {
                translationPopup.remove();
                translationOverlay.remove();
                translationPopup = null;
                translationOverlay = null;
            }, 300);
        }
    }
    
    /**
     * Handle the selected language for translation
     * @param {string} languageCode - The code of the selected language (e.g., 'en', 'es')
     * @param {string} languageName - The name of the selected language
     */
    function handleLanguageSelection(languageCode, languageName) {
        // Close the popup
        closeTranslationPopup();
        
        if (!currentMessageElement || !currentContent) {
            alert('No message selected for translation');
            return;
        }
        
        // Mark message as being translated
        currentMessageElement.classList.add('translating');
        
        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'translation-loading';
        loadingIndicator.innerHTML = `
            <div class="translation-loading-spinner"></div>
            <span>Translating to ${languageName}...</span>
        `;
        currentMessageElement.appendChild(loadingIndicator);
          // Call the translation API
        fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: currentContent,
                target_language: languageCode
            })
        })
        .then(response => {
            if (!response.ok) {
                // If main API fails, try the fallback API
                if (response.status === 503) {
                    return fetch('/api/translate/fallback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            text: currentContent,
                            target_language: languageCode
                        })
                    });
                }
                throw new Error('Translation failed');
            }
            return response.json();
        })
        .then(data => {
            // Remove loading indicator
            loadingIndicator.remove();
            currentMessageElement.classList.remove('translating');
            
            // Display the translated message
            const translatedText = data.translated_text || data.text;
            
            // Create a translation display
            const translationDisplay = document.createElement('div');
            translationDisplay.className = 'translation-result';
            translationDisplay.innerHTML = `
                <div class="translation-header">
                    <span>Translated to ${languageName}</span>
                    <button class="close-translation">×</button>
                </div>
                <div class="translated-content">${translatedText}</div>
            `;
            
            // Add translation to the message
            currentMessageElement.appendChild(translationDisplay);
            
            // Setup close button
            translationDisplay.querySelector('.close-translation').addEventListener('click', function() {
                translationDisplay.remove();
            });
        })
        .catch(error => {
            console.error('Error translating message:', error);
            
            // Remove loading indicator
            loadingIndicator.remove();
            currentMessageElement.classList.remove('translating');
            
            alert('Failed to translate message. Please try again.');
        });
    }
    
});