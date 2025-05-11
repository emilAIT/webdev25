document.addEventListener('DOMContentLoaded', function() {
    let currentTab = 'chats';
    let currentChatId = null;
    let currentGroupId = null;
    let currentUserId = null;

    // Initialize admin panel
    initAdminPanel();

    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            loadContent();
        });
    });

    // Search functionality
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(() => {
        loadContent();
    }, 300));

    // Menu functionality
    const menuIcon = document.querySelector('.menu-icon');
    const menuDrawer = document.querySelector('.menu-drawer');
    
    menuIcon.addEventListener('click', () => {
        menuDrawer.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!menuIcon.contains(e.target) && !menuDrawer.contains(e.target)) {
            menuDrawer.classList.remove('active');
        }
    });

    // More options functionality
    const moreOptions = document.querySelector('.more-options');
    const optionsDrawer = document.querySelector('.chat-options-drawer');
    
    moreOptions.addEventListener('click', () => {
        optionsDrawer.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!moreOptions.contains(e.target) && !optionsDrawer.contains(e.target)) {
            optionsDrawer.classList.remove('active');
        }
    });

    // Delete chat functionality
    document.getElementById('delete-chat-btn').addEventListener('click', async () => {
        if (!currentChatId && !currentGroupId) return;
        
        if (confirm('Вы уверены, что хотите удалить этот чат/группу?')) {
            try {
                const response = await fetch(`/admin/${currentTab}/${currentChatId || currentGroupId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    showFlashMessage('Чат/группа успешно удалена', 'success');
                    loadContent();
                    clearChatView();
                } else {
                    showFlashMessage('Ошибка при удалении чата/группы', 'danger');
                }
            } catch (error) {
                showFlashMessage('Ошибка при удалении чата/группы', 'danger');
            }
        }
    });

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/';
        });
    }

    async function initAdminPanel() {
        loadContent();
        fetch('/users/me', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(r => r.json())
        .then(user => {
            currentUserId = user.id;
        });
    }

    async function loadContent() {
        const searchQuery = searchInput.value.trim();
        try {
            if (currentTab === 'chats') {
                const response = await fetch(`/admin/chats?search=${searchQuery}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const chats = await response.json();
                displayChats(chats);
            } else {
                const response = await fetch(`/admin/groups?search=${searchQuery}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const groups = await response.json();
                displayGroups(groups);
            }
        } catch (error) {
            showFlashMessage('Ошибка при загрузке данных', 'danger');
        }
    }

    function displayChats(chats) {
        const chatList = document.getElementById('chat-list');
        chatList.innerHTML = '';
        
        chats.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.className = 'group-item';
            chatElement.dataset.id = chat.id;
            chatElement.dataset.type = 'chat';

            // Аватарки пользователей (одна поверх другой)
            const avatar1 = chat.user1_avatar_url || '';
            const avatar2 = chat.user2_avatar_url || '';
            const avatarBlock = `
                <div class="chat-avatars">
                    <div class="avatar avatar1">
                        ${avatar1 ? `<img src='${avatar1}' alt='${chat.user1_username}'>` : `<span>${chat.user1_username[0] || '?'}</span>`}
                    </div>
                    <div class="avatar avatar2">
                        ${avatar2 ? `<img src='${avatar2}' alt='${chat.user2_username}'>` : `<span>${chat.user2_username[0] || '?'}</span>`}
                    </div>
                </div>
            `;

            chatElement.innerHTML = `
                <div class="group-info">
                    ${avatarBlock}
                    <div>
                        <div class="group-name">${chat.user1_username} --- ${chat.user2_username}</div>
                    </div>
                </div>
            `;
            
            chatElement.addEventListener('click', () => {
                document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                chatElement.classList.add('active');
                currentChatId = chat.id;
                currentGroupId = null;
                document.getElementById('chat-title').textContent = `${chat.user1_username} --- ${chat.user2_username}`;
                loadChatMessages(chat.id);
            });
            
            chatList.appendChild(chatElement);
        });
    }

    function displayGroups(groups) {
        const chatList = document.getElementById('chat-list');
        chatList.innerHTML = '';
        
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'group-item';
            groupElement.dataset.id = group.id;
            groupElement.dataset.type = 'group';

            // Аватарка группы
            const avatar = group.avatar_url || '';
            const avatarBlock = `
                <div class="chat-avatars">
                    <div class="avatar avatar1">
                        ${avatar ? `<img src='${avatar}' alt='${group.name}'>` : `<span>${group.name[0] || '?'}</span>`}
                    </div>
                </div>
            `;

            groupElement.innerHTML = `
                <div class="group-info">
                    ${avatarBlock}
                    <div>
                        <div class="group-name">${group.name}</div>
                    </div>
                </div>
            `;
            
            groupElement.addEventListener('click', () => {
                document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
                groupElement.classList.add('active');
                currentGroupId = group.id;
                currentChatId = null;
                document.getElementById('chat-title').textContent = group.name;
                loadGroupMessages(group.id);
            });
            
            chatList.appendChild(groupElement);
        });
    }

    async function loadChatMessages(chatId) {
        try {
            const response = await fetch(`/admin/messages/${chatId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const messages = await response.json();
            displayMessages(messages);
        } catch (error) {
            showFlashMessage('Ошибка при загрузке сообщений', 'danger');
        }
    }

    async function loadGroupMessages(groupId) {
        try {
            const response = await fetch(`/admin/messages/group/${groupId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const messages = await response.json();
            displayMessages(messages);
        } catch (error) {
            showFlashMessage('Ошибка при загрузке сообщений', 'danger');
        }
    }

    function displayMessages(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        // Get user1_id and user2_id from the selected chat
        const selectedChat = document.querySelector('.group-item.active');
        let user1_id = null, user2_id = null;
        if (selectedChat && selectedChat.dataset.type === 'chat') {
            [user1_id, user2_id] = selectedChat.dataset.id.split('_').map(Number);
        }

        let lastMessageDate = null;
        messages.forEach(message => {
            const messageDate = new Date(message.timestamp);
            const messageDateString = messageDate.toISOString().split('T')[0];
            if (lastMessageDate !== messageDateString) {
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.textContent = messageDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
                messagesContainer.appendChild(divider);
                lastMessageDate = messageDateString;
            }

            // Alignment: user1_id always right (own-message), user2_id left
            let isUser1 = user1_id && message.sender_id === user1_id;
            const div = document.createElement('div');
            div.className = `chat-message${isUser1 ? ' own-message' : ''}`;

            // Avatar
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            if (message.avatar_url) {
                const avatarImg = document.createElement('img');
                avatarImg.src = message.avatar_url;
                avatarImg.alt = message.username;
                avatarDiv.appendChild(avatarImg);
            } else {
                avatarDiv.innerHTML = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="12" fill="#1E90FF"/>
                        <circle cx="12" cy="8" r="4" fill="white"/>
                        <path d="M12 14c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z" fill="white"/>
                    </svg>
                `;
            }

            // Content
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content-wrapper';
            const date = new Date(message.timestamp);
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Media
            let mediaContent = '';
            if (message.files && message.files.length > 0) {
                const mediaItems = message.files.filter(file => file.file_type === 'image' || file.file_type === 'video').length;
                let mediaClass = '';
                if (mediaItems === 1) mediaClass = 'single-image';
                else if (mediaItems === 2) mediaClass = 'two-images';
                else if (mediaItems >= 3) mediaClass = 'multiple-images';
                mediaContent = `<div class="media-content ${mediaClass}">`;
                message.files.forEach(file => {
                    if (file.file_type === 'image') {
                        mediaContent += `
                            <a class="media-link" data-media-url="${file.file_url}" data-media-type="image">
                                <img src="${file.file_url}" alt="Image" class="preview-image-sent">
                            </a>`;
                    } else if (file.file_type === 'video') {
                        mediaContent += `
                            <a class="media-link" data-media-url="${file.file_url}" data-media-type="video">
                                <video class="preview-video-sent">
                                    <source src="${file.file_url}" type="video/mp4">
                                    Ваш браузер не поддерживает видео.
                                </video>
                            </a>`;
                    } else if (file.file_type === 'file') {
                        const fileName = file.file_url.split('/').pop();
                        mediaContent += `
                            <a href="${file.file_url}" class="file-link" download>
                                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                                    <path d="M12 12v9m0 0l-4-4m4 4l4-4m-9-5V5a2 2 0 012-2h4a2 2 0 012 2v6" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${fileName}
                            </a>`;
                    }
                });
                mediaContent += '</div>';
            }

            contentDiv.innerHTML = `
                <div class="username">${message.username}</div>
                <div class="content">
                    ${message.content ? `<div class="content-text">${message.content}</div>` : '<div class="content-text" style="display: none;"></div>'}
                    ${mediaContent}
                    <div class="timestamp">${timeString}</div>
                </div>
            `;

            if (isUser1) {
                div.appendChild(contentDiv);
                div.appendChild(avatarDiv);
            } else {
                div.appendChild(avatarDiv);
                div.appendChild(contentDiv);
            }

            messagesContainer.appendChild(div);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function displayFiles(files) {
        if (!files || !files.length) return '';
        
        return `
            <div class="media-content ${files.length === 1 ? 'single-image' : files.length === 2 ? 'two-images' : 'multiple-images'}">
                ${files.map(file => {
                    if (file.type.startsWith('image/')) {
                        return `<img src="${file.url}" class="preview-image-sent" alt="Image">`;
                    } else if (file.type.startsWith('video/')) {
                        return `<video src="${file.url}" class="preview-video-sent" controls></video>`;
                    } else {
                        return `
                            <a href="${file.url}" class="file-link" target="_blank">
                                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M12 18v-6M9 15h6" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${file.name}
                            </a>
                        `;
                    }
                }).join('')}
            </div>
        `;
    }

    function clearChatView() {
        document.getElementById('chat-messages').innerHTML = '';
        document.getElementById('chat-title').textContent = 'Выберите чат или группу';
        currentChatId = null;
        currentGroupId = null;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function showFlashMessage(message, type) {
        const flashContainer = document.getElementById('flash-messages');
        const flashElement = document.createElement('div');
        flashElement.className = `flash-${type}`;
        flashElement.textContent = message;
        
        flashContainer.appendChild(flashElement);
        
        setTimeout(() => {
            flashElement.remove();
        }, 3000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}); 