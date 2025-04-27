// AI Assistant functionality
const aiModal = document.getElementById('ai-modal');
const aiFab = document.getElementById('ai-fab');
const aiModalClose = document.querySelector('.ai-modal-close');
const aiPromptInput = document.getElementById('ai-prompt-input');
const aiSendBtn = document.querySelector('.ai-send-btn');
const aiResponseArea = document.querySelector('.ai-response-area');
const aiResponse = document.querySelector('.ai-response');

// Load Markdown-it parser
const md = window.markdownit ? window.markdownit({
    html: false,
    linkify: true,
    typographer: true
}) : null;

// Configuration prompt elements
const aiConfigToggle = document.querySelector('.ai-config-toggle');
const aiConfigContent = document.querySelector('.ai-config-content');
const aiConfigPrompt = document.getElementById('ai-config-prompt');
const aiConfigSave = document.querySelector('.ai-config-save');
const aiConfigCancel = document.querySelector('.ai-config-cancel');
const useConfigPrompt = document.getElementById('use-config-prompt');

// State variables
let currentChatId = null;
let currentGroupId = null;
let currentConfigPrompt = "";
let isConfigEdited = false;

// Helper function to get current conversation ID
function getCurrentConversationId() {
    // Check if we're in a direct chat
    const conversation = document.querySelector('.conversation');
    if (conversation && window.getComputedStyle(conversation).display !== 'none') {
        const messageContainer = document.querySelector('.message-container');
        if (!messageContainer) {
            console.error("Message container not found");
            return { chatId: null, groupId: null };
        }
        
        const chatId = messageContainer.getAttribute('data-chat-id');
        const chatType = messageContainer.getAttribute('data-chat-type');
        const isGroup = chatType === 'group';
        
        if (chatId) {
            console.log(`Found conversation: chatId=${chatId}, isGroup=${isGroup}`);
            return {
                chatId: isGroup ? null : parseInt(chatId),
                groupId: isGroup ? parseInt(chatId) : null
            };
        }
    }
    return { chatId: null, groupId: null };
}

// Open AI modal when FAB is clicked
aiFab.addEventListener('click', () => {
    const { chatId, groupId } = getCurrentConversationId();
    currentChatId = chatId;
    currentGroupId = groupId;
    
    // Fetch the configuration prompt for this conversation if available
    fetchConfigPrompt();
    
    aiModal.style.display = 'flex';
    aiPromptInput.focus();
});

// Fetch configuration prompt from the server
async function fetchConfigPrompt() {
    if (!currentChatId && !currentGroupId) {
        // No active conversation, reset to empty
        aiConfigPrompt.value = "";
        currentConfigPrompt = "";
        return;
    }
    
    try {
        const queryParams = currentChatId 
            ? `chat_id=${currentChatId}` 
            : `group_id=${currentGroupId}`;
            
        const response = await fetch(`/api/ai/config-prompt?${queryParams}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        aiConfigPrompt.value = data.prompt || "";
        currentConfigPrompt = data.prompt || "";
        isConfigEdited = false;
    } catch (error) {
        console.error('Error fetching configuration prompt:', error);
        aiConfigPrompt.value = "";
        currentConfigPrompt = "";
    }
}

// Save configuration prompt to the server
async function saveConfigPrompt() {
    if (!currentChatId && !currentGroupId) {
        // No active conversation, can't save
        console.error("Cannot save: No active conversation detected");
        alert('No active conversation detected. Please select a chat first.');
        return;
    }
    
    const prompt = aiConfigPrompt.value.trim();
    
    try {
        console.log("Saving config prompt:", {
            prompt: prompt,
            chat_id: currentChatId,
            group_id: currentGroupId
        });
        
        const response = await fetch('/api/ai/config-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                chat_id: currentChatId,
                group_id: currentGroupId
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Server error:', response.status, errorData);
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
            currentConfigPrompt = prompt;
            isConfigEdited = false;
            
            // Show feedback to user
            const originalText = aiConfigSave.textContent;
            aiConfigSave.textContent = "Saved!";
            setTimeout(() => {
                aiConfigSave.textContent = originalText;
                
                // Hide the configuration prompt section after saving
                aiConfigContent.classList.remove('visible');
                aiConfigToggle.classList.remove('expanded');
                
                // Update the toggle button text
                aiConfigToggle.innerHTML = 'Show <i class="fas fa-chevron-down"></i>';
            }, 1500);
        } else {
            throw new Error('Server did not return success');
        }
    } catch (error) {
        console.error('Error saving configuration prompt:', error);
        alert('Failed to save configuration prompt: ' + error.message);
    }
}

// Toggle the configuration prompt section
aiConfigToggle.addEventListener('click', () => {
    aiConfigContent.classList.toggle('visible');
    aiConfigToggle.classList.toggle('expanded');
    
    // Update the toggle button text
    const isVisible = aiConfigContent.classList.contains('visible');
    aiConfigToggle.innerHTML = isVisible ? 
        'Hide <i class="fas fa-chevron-up"></i>' : 
        'Show <i class="fas fa-chevron-down"></i>';
    
    if (isVisible) {
        aiConfigPrompt.focus();
    }
});

// Mark config as edited when changed
aiConfigPrompt.addEventListener('input', () => {
    isConfigEdited = aiConfigPrompt.value !== currentConfigPrompt;
});

// Save configuration prompt
aiConfigSave.addEventListener('click', saveConfigPrompt);

// Cancel editing configuration prompt
aiConfigCancel.addEventListener('click', () => {
    aiConfigPrompt.value = currentConfigPrompt;
    isConfigEdited = false;
});

// Close AI modal when close button is clicked
aiModalClose.addEventListener('click', () => {
    // Check if there are unsaved changes
    if (isConfigEdited) {
        if (confirm('You have unsaved changes to the configuration prompt. Save changes?')) {
            saveConfigPrompt().then(() => {
                aiModal.style.display = 'none';
            });
            return;
        }
    }
    
    aiModal.style.display = 'none';
});

// Close AI modal when clicking outside the modal content
aiModal.addEventListener('click', (e) => {
    if (e.target === aiModal) {
        // Check if there are unsaved changes
        if (isConfigEdited) {
            if (confirm('You have unsaved changes to the configuration prompt. Save changes?')) {
                saveConfigPrompt().then(() => {
                    aiModal.style.display = 'none';
                });
                return;
            }
        }
        
        aiModal.style.display = 'none';
    }
});

// Send the AI prompt when the send button is clicked
aiSendBtn.addEventListener('click', () => {
    sendAiRequest();
});

// Send the AI prompt when Enter key is pressed (but allow Shift+Enter for new lines)
aiPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiRequest();
    }
});

// Function to send the AI request to the backend
async function sendAiRequest() {
    const prompt = aiPromptInput.value.trim();
    if (!prompt) return;

    // Clear the input field
    aiPromptInput.value = '';

    // Display the user's prompt
    aiResponse.innerHTML = `<strong>You:</strong> ${prompt}\n\n<div class="ai-thinking">Thinking<div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
    aiResponseArea.scrollTop = aiResponseArea.scrollHeight;

    try {
        // Check if the use config prompt checkbox is checked
        const shouldUseConfigPrompt = useConfigPrompt && useConfigPrompt.checked;
        
        // Log whether we're using the config prompt
        console.log(`Sending AI request with${shouldUseConfigPrompt ? '' : 'out'} configuration prompt`);
        
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                model: 'gemini-2.0-flash',
                chat_id: currentChatId,
                group_id: currentGroupId,
                use_config_prompt: shouldUseConfigPrompt
            }),
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Process the AI response with markdown
        let formattedResponse;
        if (md) {
            // If markdown-it is loaded, render the response as markdown
            formattedResponse = md.render(data.response);
        } else {
            // Fallback to basic formatting if markdown-it isn't available
            formattedResponse = data.response
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
        }
        
        // Display the AI response with markdown formatting
        aiResponse.innerHTML = `<strong>You:</strong> ${prompt}\n\n<strong>AI:</strong> <div class="markdown-content">${formattedResponse}</div>`;
        // Scroll to the top of the response area instead of the bottom
        aiResponseArea.scrollTop = 0;
    } catch (error) {
        console.error('Error calling AI API:', error);
        aiResponse.innerHTML = `<strong>You:</strong> ${prompt}\n\n<strong>Error:</strong> Sorry, I couldn't process your request. ${error.message}`;
        // Also scroll to top for error messages
        aiResponseArea.scrollTop = 0;
    }
}