// Basic emoji list
const basicEmojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
    '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯', '✨', '💫', '👋', '🤚', '🖐',
    '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇',
    '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅'
];

class EmojiPicker {
    constructor() {
        this.isVisible = false;
        this.pickerElement = null;
        this.targetInput = null;
        this.init();
    }

    init() {
        // Create emoji picker container
        this.pickerElement = document.createElement('div');
        this.pickerElement.className = 'emoji-picker';
        this.pickerElement.style.display = 'none';

        // Create emoji grid
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'emoji-grid';

        // Add emojis to grid
        basicEmojis.forEach(emoji => {
            const emojiButton = document.createElement('button');
            emojiButton.className = 'emoji-button';
            emojiButton.textContent = emoji;
            emojiButton.addEventListener('click', () => this.insertEmoji(emoji));
            emojiGrid.appendChild(emojiButton);
        });

        this.pickerElement.appendChild(emojiGrid);
        document.body.appendChild(this.pickerElement);

        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.pickerElement.contains(e.target) && 
                !e.target.closest('.chat-footer-icons')) {
                this.hide();
            }
        });
    }

    toggle(targetInput, buttonElement) {
        this.targetInput = targetInput;
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(buttonElement);
        }
    }

    show(buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        this.pickerElement.style.display = 'block';
        this.pickerElement.style.position = 'absolute';
        this.pickerElement.style.left = `${rect.left}px`;
        this.pickerElement.style.top = `${rect.top - this.pickerElement.offsetHeight}px`;
        this.isVisible = true;
    }

    hide() {
        this.pickerElement.style.display = 'none';
        this.isVisible = false;
    }

    insertEmoji(emoji) {
        if (this.targetInput) {
            const start = this.targetInput.selectionStart;
            const end = this.targetInput.selectionEnd;
            const text = this.targetInput.value;
            const before = text.substring(0, start);
            const after = text.substring(end);
            this.targetInput.value = before + emoji + after;
            this.targetInput.selectionStart = this.targetInput.selectionEnd = start + emoji.length;
            this.targetInput.focus();
        }
        this.hide();
    }
}

// Initialize emoji picker
const emojiPicker = new EmojiPicker();

// Add event listener to emoji button
document.addEventListener('DOMContentLoaded', () => {
    const emojiButton = document.querySelector('.chat-footer-icons svg:first-child');
    const messageInput = document.querySelector('.message-input');
    
    if (emojiButton && messageInput) {
        emojiButton.style.cursor = 'pointer';
        emojiButton.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPicker.toggle(messageInput, emojiButton);
        });
    }
}); 