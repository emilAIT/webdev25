/**
 * Emoji Picker for ShrekChat
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const emojiBtn = document.querySelector('.emoji-btn');
    const emojiPicker = document.querySelector('.emoji-picker');
    const emojiClose = document.querySelector('.emoji-close');
    const emojiSearch = document.querySelector('.emoji-search input');
    const emojiContainer = document.querySelector('.emoji-container');
    const emojiCategories = document.querySelectorAll('.emoji-category');
    const messageInput = document.getElementById('messageInput');

    // Emoji data by category
    const emojiData = {
        smileys: [
            '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', 
            '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗',
            '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
            '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝'
        ],
        animals: [
            '🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐩', '🐺', '🦊',
            '🦝', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄',
            '🦓', '🦌', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐏',
            '🐑', '🐐', '🐪', '🐫', '🦙', '🦘', '🦥', '🦨', '🦡', '🐘'
        ],
        food: [
            '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈',
            '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
            '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐',
            '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇'
        ],
        travel: [
            '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐',
            '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍',
            '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃',
            '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊'
        ],
        activities: [
            '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
            '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁',
            '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌',
            '🎿', '⛷', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾'
        ],
        objects: [
            '⌚', '📱', '📲', '💻', '⌨', '🖥', '🖨', '🖱', '🖲', '🕹',
            '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
            '📽', '🎞', '📞', '☎', '📟', '📠', '📺', '📻', '🎙', '🎚',
            '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋'
        ],
        symbols: [
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
            '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
            '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
            '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐'
        ],
        flags: [
            '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪',
            '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹',
            '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬',
            '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸'
        ]
    };

    // Initialize emoji picker
    function initEmojiPicker() {
        // Toggle emoji picker visibility
        if (emojiBtn) {
            emojiBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                emojiPicker.style.display = emojiPicker.style.display === 'flex' ? 'none' : 'flex';
                
                // Load first category (smileys) by default if container is empty
                if (emojiContainer.children.length === 0) {
                    loadEmojiCategory('smileys');
                }
            });
        }

        // Close emoji picker
        if (emojiClose) {
            emojiClose.addEventListener('click', function() {
                emojiPicker.style.display = 'none';
            });
        }

        // Close emoji picker when clicking outside
        document.addEventListener('click', function(e) {
            if (emojiPicker.style.display === 'flex' && 
                !emojiPicker.contains(e.target) && 
                e.target !== emojiBtn) {
                emojiPicker.style.display = 'none';
            }
        });

        // Category selection
        emojiCategories.forEach(category => {
            category.addEventListener('click', function() {
                const categoryName = this.getAttribute('data-category');
                
                // Update active category
                emojiCategories.forEach(cat => cat.classList.remove('active'));
                this.classList.add('active');
                
                // Load emojis for selected category
                loadEmojiCategory(categoryName);
            });
        });

        // Search functionality
        if (emojiSearch) {
            emojiSearch.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                if (searchTerm.length === 0) {
                    // If search is cleared, show active category
                    const activeCategory = document.querySelector('.emoji-category.active');
                    if (activeCategory) {
                        loadEmojiCategory(activeCategory.getAttribute('data-category'));
                    } else {
                        loadEmojiCategory('smileys');
                    }
                    return;
                }
                
                // Search across all categories
                emojiContainer.innerHTML = '';
                let results = [];
                
                Object.keys(emojiData).forEach(category => {
                    emojiData[category].forEach(emoji => {
                        // Simple search - add more sophisticated search if needed
                        if (results.length < 40) { // Limit results
                            results.push(emoji);
                        }
                    });
                });
                
                if (results.length === 0) {
                    emojiContainer.innerHTML = '<div class="no-results">No emojis found</div>';
                } else {
                    displayEmojis(results);
                }
            });
        }
    }

    // Load emojis for a specific category
    function loadEmojiCategory(category) {
        const emojis = emojiData[category] || [];
        emojiContainer.innerHTML = '';
        
        if (emojis.length === 0) {
            emojiContainer.innerHTML = '<div class="no-results">No emojis in this category</div>';
            return;
        }
        
        displayEmojis(emojis);
    }

    // Display a list of emojis in the container
    function displayEmojis(emojis) {
        emojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            
            emojiItem.addEventListener('click', function() {
                insertEmoji(emoji);
            });
            
            emojiContainer.appendChild(emojiItem);
        });
    }

    // Insert emoji at cursor position in message input
    function insertEmoji(emoji) {
        if (!messageInput) return;
        
        const cursorPos = messageInput.selectionStart;
        const text = messageInput.value;
        const textBefore = text.substring(0, cursorPos);
        const textAfter = text.substring(cursorPos);
        
        messageInput.value = textBefore + emoji + textAfter;
        
        // Set cursor position after inserted emoji
        messageInput.selectionStart = cursorPos + emoji.length;
        messageInput.selectionEnd = cursorPos + emoji.length;
        messageInput.focus();
    }

    // Initialize the emoji picker
    initEmojiPicker();
});