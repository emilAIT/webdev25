document.addEventListener('DOMContentLoaded', function() {
    // заменили const на let, чтобы можно было присваивать новый токен:
    let token = localStorage.getItem("token");
    if (!token) {
        console.log("No token found, redirecting to login");
        window.location.href = "/";
        return;
    }

    let addUserContext = 'contacts';

    let currentChatId = null; // Добавьте эту переменную
    let currentContactAvatar = null; // Для хранения аватара текущего контакта
    const messageContainer = document.querySelector("#message-container");
    const messageInput = document.querySelector("#message-text");
    const sendButton = document.querySelector("#send-button");
    const contactsList = document.querySelector('.contacts-list');
    const noChatPlaceholder = document.querySelector('#no-chat-selected');
    const selectedMedia = [];
    const mediaInput = document.getElementById('media-input');
    const mediaButton = document.getElementById('media-button');
    const mediaPreviewContainer = document.getElementById('media-preview-container');
    const mediaPreviewContent = document.getElementById('media-preview-content');
    const closePreviewBtn = document.getElementById('close-preview');
    const mediaLightbox = document.getElementById('media-lightbox');
    const lightboxContent = document.querySelector('.lightbox-content');
    const closeLightboxBtn = document.getElementById('close-lightbox');
    const downloadMediaBtn = document.getElementById('download-media');
    const chatHeader = document.querySelector('.chat-header');

    const emojiButton = document.querySelector('.emoji-button');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const closeEmojiPickerBtn = document.getElementById('close-emoji-picker');
    const emojiGrid = document.getElementById('emoji-grid');
    const emojiLoading = document.querySelector('.emoji-loading');
    let emojisLoaded = false;
    const API_KEY = '5ea1113c8ca5c111a97f7be1af7b95886bd84898';
    const API_URL = `https://emoji-api.com/emojis?access_key=${API_KEY}`;

    const addUserButton = document.getElementById('add-user');
    const addUserContainer = document.getElementById('add-user-container');
    const cancelAddContact = document.getElementById('cancel-add-contact');
    const addContactBtn = document.getElementById('add-contact-btn');
    const newContactNameInput = document.getElementById('new-contact-name');
    const addGroupButton = document.getElementById('add-group');
    const addGroupContainer = document.getElementById('add-group-container');
    const cancelAddGroup = document.getElementById('cancel-add-group');
    const addGroupBtn = document.getElementById('add-group-btn');
    const newGroupNameInput = document.getElementById('new-group-name');
    const editProfileButton = document.getElementById('edit-profile');
    const editProfileContainer = document.getElementById('edit-profile-container');
    const cancelEditProfile = document.getElementById('cancel-edit-profile');
    const saveProfileBtn = document.getElementById('save-profile');
    const editUsernameInput = document.getElementById('edit-username');
    const editEmailInput = document.getElementById('edit-email');
    const editPasswordInput = document.getElementById('edit-password');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenu = document.getElementById('user-menu');
    const groupUserMenu = document.getElementById('group-user-menu');

    const usersList = document.getElementById('users-list');
    const addGroupMemberBtn = document.getElementById('add-group-member-btn');
    const leaveGroupBtn = document.getElementById('leave-group-btn');

    const editAvatarImg = document.getElementById('edit-avatar-img');
    const editAvatarInput = document.getElementById('edit-avatar-input'); 
    let selectedAvatarFile = null;  

    const editGroupProfileContainer = document.getElementById('edit-group-profile-container');
    const editGroupProfileBtn = document.getElementById('edit-group-profile-btn') || changeGroupNameBtn; // если заменяем существующую кнопку
    const cancelEditGroupProfileBtn = document.getElementById('cancel-edit-group-profile');
    const saveGroupProfileBtn = document.getElementById('save-group-profile');

    const editGroupAvatarImg = document.getElementById('edit-group-avatar-img');
    const editGroupAvatarInput = document.getElementById('edit-group-avatar-input');
    const editGroupNameInput = document.getElementById('edit-group-name');

    let selectedGroupAvatarFile = null;
    let currentGroupCreatorId = null;

    // Disable message input and buttons on initial load
    disableMessaging();
    
    // Function to disable messaging when no chat is selected
    function disableMessaging() {
        messageInput.disabled = true;
        sendButton.disabled = true;
        document.getElementById('media-button').disabled = true;
        document.querySelector('.emoji-button').disabled = true;
        userMenuBtn.disabled = true; // Disable the user menu button
        
        // Show placeholder
        noChatPlaceholder.style.display = 'flex';

        const headerAvatar = chatHeader.querySelector('.current-contact .contact-avatar img');
        if (headerAvatar) {
            headerAvatar.style.visibility = 'hidden';
        }
        
        // Add visual indication that input is disabled
        messageInput.classList.add('disabled');
        sendButton.classList.add('disabled');
        document.getElementById('media-button').classList.add('disabled');
        document.querySelector('.emoji-button').classList.add('disabled');
        userMenuBtn.classList.add('disabled'); // Add disabled class to user menu button
    }
    
    // Function to enable messaging when a chat is selected
    function enableMessaging() {
        messageInput.disabled = false;
        sendButton.disabled = false;
        document.getElementById('media-button').disabled = false;
        document.querySelector('.emoji-button').disabled = false;
        userMenuBtn.disabled = false; // Enable the user menu button
        
        // Hide placeholder
        noChatPlaceholder.style.display = 'none';
        const headerAvatar = chatHeader.querySelector('.current-contact .contact-avatar img');
        if (headerAvatar) {
            headerAvatar.style.visibility = 'visible';
        }
        
        // Remove visual indication
        messageInput.classList.remove('disabled');
        sendButton.classList.remove('disabled');
        document.getElementById('media-button').classList.remove('disabled');
        document.querySelector('.emoji-button').classList.remove('disabled');
        userMenuBtn.classList.remove('disabled'); // Remove disabled class from user menu button
    }

    const currentUser = {
        name: 'You',
        avatar: '/static/images/avatar.png'
    };

    // Хранилище для идентификаторов отображённых сообщений
    const displayedMessages = new Set();

    // Получаем свой user_id из JWT
    function getCurrentUserId() {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return parseInt(payload.user_id, 10);
        } catch {
            return null;
        }
    }
    

    async function loadGroupMembers(groupId) {
        try {
            // Запрос с расширением, чтобы получить creator_id (нужно добавить на сервере)
            const groupResponse = await fetch(`/user/groups`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!groupResponse.ok) throw new Error("Failed to load groups");
            const groups = await groupResponse.json();
            const group = groups.find(g => g.id === groupId);
            currentGroupCreatorId = group ? group.creator_id : null;
    
            const response = await fetch(`/groups/${groupId}/members`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to load group members: ${response.statusText}`);
            }
            const members = await response.json();
    
            usersList.innerHTML = '';
    
            if (members.length === 0) {
                usersList.innerHTML = '<div style="padding: 10px; color: #ccc;">No members in this group</div>';
                return;
            }
    
            const currentUserId = getCurrentUserId();
    
            members.forEach(member => {
                const memberElement = document.createElement('div');
                memberElement.classList.add('contactInGroupInfo');
                memberElement.setAttribute('data-id', member.id);
    
                // Добавляем иконку удаления, если текущий пользователь — создатель и не этот участник
                const canRemove = currentUserId === currentGroupCreatorId && member.id !== currentUserId;
    
                memberElement.innerHTML = `
                    <div class="contact-avatar">
                        <img src="${member.avatar || '/static/images/avatar.png'}" alt="${member.username}">
                    </div>
                    <div class="contact-info">
                        <h3>${member.username}</h3>
                    </div>
                    <div class="contact-status offline"></div>
                    ${canRemove ? `<button class="remove-member-btn" title="Remove user" aria-label="Remove user">
                        <ion-icon name="close-circle-outline" class="remove-icon"></ion-icon>
                    </button>` : ''}
                `;
                usersList.appendChild(memberElement);
            });
    
            // Добавляем обработчики клика по кнопкам удаления
            document.querySelectorAll('.remove-member-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const memberDiv = e.target.closest('.contactInGroupInfo');
                    const memberId = memberDiv.getAttribute('data-id');
                    const memberName = memberDiv.querySelector('.contact-info h3').textContent;
                    confirmRemoveMember(memberId, memberName);
                });
            });
        } catch (error) {
            console.error(error);
            usersList.innerHTML = '<div style="padding: 10px; color: red;">Failed to load members</div>';
        }
    }
    
    
    function confirmRemoveMember(userId, username) {
        const modal = document.getElementById('confirm-remove-member-modal');
        const usernameElem = document.getElementById('remove-member-username');
        const cancelBtn = document.getElementById('cancel-remove-member-btn');
        const confirmBtn = document.getElementById('confirm-remove-member-btn');
    
        usernameElem.textContent = username;
        modal.classList.remove('hidden');
    
        // Отвязываем предыдущие обработчики, чтобы не накапливались
        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    
        confirmBtn.onclick = async () => {
            try {
                const res = await fetch(`/groups/${currentChatId}/members/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'Ошибка при удалении участника');
                }
                showNotification(`Пользователь "${username}" успешно удалён из группы`);
                await loadGroupMembers(currentChatId);

            } catch (e) {
                showNotification(`Ошибка: ${e.message}`);
            } finally {
                modal.classList.add('hidden');
            }
        };
    }
    
    

    async function loadUserProfile() {
        try {
            const response = await fetch("/user/profile", {
                headers: { 
                    "Authorization": `Bearer ${token}` 
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                document.querySelector('.profile-info h3').textContent = userData.username;
                document.querySelector('.profile-info p').textContent = userData.email || '';
                
                // Обновляем аватар в боковом меню
                const profileAvatarImg = document.querySelector('.profile-avatar img');
                if (profileAvatarImg && userData.avatar) {
                    profileAvatarImg.src = userData.avatar; // Путь уже будет /static/images/...
                }
    
                // Обновляем поля редактирования профиля
                if (editUsernameInput) editUsernameInput.value = userData.username;
                if (editEmailInput) editEmailInput.value = userData.email || '';
                if (editAvatarImg && userData.avatar) {
                    editAvatarImg.src = userData.avatar; // Путь уже будет /static/images/...
                }
    
                // Обновляем текущего пользователя для отображения сообщений
                currentUser.avatar = userData.avatar || '/static/images/avatar.png';
            } else {
                console.error("Failed to load user profile:", response.status);
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
        }
    }
    editAvatarImg.addEventListener('click', () => {
        editAvatarInput.click();
    });
    
    // Когда пользователь выбрал файл
    editAvatarInput.addEventListener('change', () => {
        const file = editAvatarInput.files[0];
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        const ext = file.name.split('.').pop().toLowerCase();
        if (file && file.type.startsWith('image/') && allowedExtensions.includes(ext)) {
            if (file.size > maxSize) {
                showNotification('Файл слишком большой. Максимальный размер — 5 МБ.');
                editAvatarInput.value = '';
                return;
            }
            selectedAvatarFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                editAvatarImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Пожалуйста, выберите изображение в формате PNG, JPG, JPEG или GIF.');
            editAvatarInput.value = '';
        }
    },
);

    // Function to update the last message preview for a contact in the sidebar
    function updateContactPreview(contactElement) {
        const lastMsgBubble = messageContainer.querySelector('.message:last-child .message-bubble');
        if (!lastMsgBubble) return;
        let preview = '';
        if (lastMsgBubble.querySelector('img.message-media')) {
            preview = '📷 Photo';
        } else if (lastMsgBubble.querySelector('video.message-media')) {
            preview = '🎥 Video';
        } else {
            const textElem = lastMsgBubble.querySelector('p');
            preview = textElem ? textElem.textContent : '';
        }
        if (preview.length > 30) preview = preview.slice(0, 30) + '…';
        const previewElem = contactElement.querySelector('.contact-info p');
        if (previewElem) previewElem.textContent = preview;
    }

    // Async function to fetch last message and update preview for each contact
    async function fetchAndUpdateContactPreview(contactElement, contactId) {
        try {
            const chatResponse = await fetch(`/chat/one-on-one/${contactId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!chatResponse.ok) return;
            const { chat_id } = await chatResponse.json();
            const msgResponse = await fetch(`/messages/${chat_id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!msgResponse.ok) return;
            const messages = await msgResponse.json();
            if (!messages.length) return;
            const lastContent = messages[messages.length - 1].content || '';
            let preview = '';
            if (/\[Media: (.*?)\]/.test(lastContent)) {
                const file = /\[Media: (.*?)\]/.exec(lastContent)[1];
                if (/\.(jpg|jpeg|png|gif)$/i.test(file)) preview = '📷 Photo';
                else if (/\.(mp4|webm|ogg)$/i.test(file)) preview = '🎥 Video';
                else preview = 'Attachment';
            } else {
                preview = lastContent;
            }
            if (preview.length > 30) preview = preview.slice(0, 30) + '…';
            const previewElem = contactElement.querySelector('.contact-info p');
            if (previewElem) previewElem.textContent = preview;
        } catch (e) {
            console.error('Preview fetch error', e);
        }
    }

    async function loadContacts() {
        try {
            console.log("Loading contacts...");
            const response = await fetch("/contacts", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Unauthorized, redirecting to login");
                    localStorage.removeItem("token");
                    window.location.href = "/";
                    return;
                }
                throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
            }
            const contacts = await response.json();
            contactsList.innerHTML = "";
    
            if (contacts.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.classList.add('empty-contacts');
                emptyMessage.innerHTML = `
                    <div class="empty-contacts-message">
                        <p>You don't have any contacts yet</p>
                        <p>Click the "Add Contact" button in the menu</p>
                    </div>
                `;
                contactsList.appendChild(emptyMessage);
                await loadGroups();
                return;
            }
    
            const previewPromises = [];
            contacts.forEach(contact => {
                const contactElement = document.createElement('div');
                console.log(contact);
                contactElement.classList.add('contact');
                contactElement.setAttribute('data-username', contact.username);
                contactElement.setAttribute('data-id', contact.id);
                contactElement.innerHTML = `
                    <div class="contact-avatar">
                        <img src="${contact.avatar || '/static/images/avatar.png'}" alt="${contact.username}">
                    </div>
                    <div class="contact-info">
                        <h3>${contact.username}</h3>
                        <p></p>
                    </div>
                    <div class="contact-status offline"></div>
                `;
                contactsList.appendChild(contactElement);
                previewPromises.push(fetchAndUpdateContactPreview(contactElement, contact.id));
            });
            await Promise.all(previewPromises);
    
            const contactElements = document.querySelectorAll('.contact');
            contactElements.forEach(contact => {
                contact.addEventListener('click', async function() {
                    contactElements.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    
                    const contactName = this.querySelector('.contact-info h3').textContent;
                    const contactImg = this.querySelector('.contact-avatar img').src;
                    const isOnline = this.querySelector('.contact-status.online') !== null;
                    const contactId = this.getAttribute('data-id');
                    
                    currentContactAvatar = contactImg;
                    
                    try {
                        const response = await fetch(`/chat/one-on-one/${contactId}`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(`Failed to get chat: ${errorData.detail || response.statusText}`);
                        }
                        const data = await response.json();
                        currentChatId = data.chat_id;
                        
                        document.querySelector('.current-contact .contact-info h3').textContent = contactName;
                        document.querySelector('.current-contact .contact-avatar img').src = contactImg;
                        
                        reconnectWebSocket();
                        loadMessages();
                        enableMessaging();
                    } catch (error) {
                        console.error("Error fetching chat ID:", error);
                        showNotification(`Не удалось открыть чат: ${error.message}`);
                        currentChatId = null;
                        disableMessaging();
                    }
                });
            });
    
            console.log("Contacts loaded successfully");
        } catch (error) {
            console.error("Error loading contacts:", error);
        }
        await loadGroups();
    }
    
    // Update reconnectWebSocket to use currentChatId
    function reconnectWebSocket() {
        if (!currentChatId) {
            console.log("No chat ID available, skipping WebSocket connection");
            return;
        }
        if (ws) {
            ws.onclose = null;
            ws.close();
        }
        ws = new WebSocket(`ws://${window.location.host}/ws/${currentChatId}?token=${token}`);
        ws.onopen = () => {
            console.log("WebSocket connection established for chat:", currentChatId);
            // После открытия ws отправляем read для всех входящих непрочитанных сообщений
            if (unreadToMark && unreadToMark.length > 0) {
                unreadToMark.forEach(mid => {
                    ws.send(JSON.stringify({ type: "read", message_id: mid }));
                });
                unreadToMark = [];
            }
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                console.log("Message event data:", data);
                const currentUserId = getCurrentUserId();
                const isOutgoing = data.sender_id === currentUserId;
                displayMessage(
                    data.id,
                    data.content,
                    data.sender_username,
                    isOutgoing ? currentUser.avatar : currentContactAvatar,
                    isOutgoing,
                    data.timestamp,
                    'message',
                    data.status
                );
                // NEW: если входящее сообщение и чат открыт, сразу отправить read
                if (!isOutgoing && ws && ws.readyState === WebSocket.OPEN && data.id) {
                    ws.send(JSON.stringify({ type: "read", message_id: data.id }));
                }

                // For both sender and receiver, move the chat up and update preview
                const contactId = isOutgoing ? data.receiver_id : data.sender_id;
                const contactEl = document.querySelector(`.contact[data-id="${contactId}"]`);
                if (contactEl) {
                    // Move the contact to the top of the list
                    contactsList.prepend(contactEl);
                    // Fetch and update preview to include this new message
                    fetchAndUpdateContactPreview(contactEl, contactId);
                }
            } else if (data.type === 'message_read') {
                // Обновить статус сообщения на галочку (прочитано)
                const msgElem = messageContainer.querySelector(`[data-message-id="${data.message_id}"]`);
                if (msgElem) {
                    const statusSpan = msgElem.querySelector('.message-status');
                    if (statusSpan) {
                        statusSpan.innerHTML = '<ion-icon name="checkmark-done" style="color: #25d366; font-size: 18px; vertical-align: middle;"></ion-icon>';
                        statusSpan.title = 'Read';
                    }
                }
            } else if (data.type === 'user_list') {
                // Update online status of contacts
                data.users.forEach(u => {
                    const el = document.querySelector(`.contact[data-id="${u.id}"]`);
                    if (el) {
                        el.querySelector('.contact-status').classList.replace('offline','online');
                    }
                });
            }
            // Новая ветка для глобального presence
            else if (data.type === 'presence') {
                const el = document.querySelector(`.contact[data-id="${data.user_id}"] .contact-status`);
                if (el) {
                    el.classList.replace(data.status === 'online' ? 'offline' : 'online', data.status);
                }
            }
        };
        
        ws.onclose = (event) => {
            console.log("WebSocket connection closed:", event);
            // Automatic reconnection removed to prevent reconnect loop
        };
        
        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }
 
    // …после reconnectWebSocket()/ws.onmessage…
    const notifSocket = new WebSocket(`ws://${window.location.host}/ws/notifications?token=${token}`);
    notifSocket.onmessage = evt => {
        const data = JSON.parse(evt.data);
        if (data.type === 'contacts_update') {
            loadContacts();
        } else if (data.type === 'new_message') {
            // Handle new message notifications - move chat to top and update preview
            const contactId = data.sender_id;
            const contactElement = document.querySelector(`.contact[data-id="${contactId}"]`);
            
            if (contactElement) {
                // Move chat to top of the list
                contactsList.prepend(contactElement);
                
                // Use the existing updateContactPreview function
                // First create a temporary message element to simulate having the message in the DOM
                const tempMsg = document.createElement('div');
                tempMsg.classList.add('message', 'incoming');
                
                const msgBubble = document.createElement('div');
                msgBubble.classList.add('message-bubble');
                
                // Process message content (handle media or text)
                if (/\[Media: (.*?)\]/.test(data.content)) {
                    if (/\.(jpg|jpeg|png|gif)$/i.test(data.content)) {
                        const img = document.createElement('img');
                        img.classList.add('message-media');
                        msgBubble.appendChild(img);
                    } else if (/\.(mp4|webm|ogg)$/i.test(data.content)) {
                        const video = document.createElement('video');
                        video.classList.add('message-media');
                        msgBubble.appendChild(video);
                    }
                } else {
                    const p = document.createElement('p');
                    p.textContent = data.content;
                    msgBubble.appendChild(p);
                }
                
                tempMsg.appendChild(msgBubble);
                
                // Temporarily append to message container (but hidden)
                tempMsg.style.display = 'none';
                messageContainer.appendChild(tempMsg);
                
                // Now update the preview using the existing function
                updateContactPreview(contactElement);
                
                // Remove the temporary element
                messageContainer.removeChild(tempMsg);
            }
        }
        // Новая ветка для глобального presence
        else if (data.type === 'presence') {
            const el = document.querySelector(`.contact[data-id="${data.user_id}"] .contact-status`);
            if (el) {
                el.classList.replace(data.status === 'online' ? 'offline' : 'online', data.status);
            }
        }
    };
    notifSocket.onerror = e => console.error('Notifications WS error', e);
    notifSocket.onclose = () => console.log('Notifications WS closed');

    async function loadMessages() {
        try {
            if (!currentChatId) {
                console.log("No chat selected");
                return;
            }
            console.log("Loading messages for chat_id:", currentChatId);
            const response = await fetch(`/messages/${currentChatId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Unauthorized, redirecting to login");
                    localStorage.removeItem("token");
                    window.location.href = "/";
                    return;
                }
                throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
            }
            const messages = await response.json();
            console.log("Loaded messages:", messages);
            messageContainer.innerHTML = "";
            displayedMessages.clear();
    
            const currentUserId = getCurrentUserId();
            unreadToMark = [];
            messages.forEach(msg => {
                const isOutgoing = msg.sender_id === currentUserId;
                displayMessage(
                    msg.id,
                    msg.content,
                    msg.sender_username,
                    msg.sender_avatar || (isOutgoing ? currentUser.avatar : currentContactAvatar),
                    isOutgoing,
                    msg.timestamp,
                    "message",
                    msg.status
                );
                // Если входящее и не прочитано — добавить в список для отметки
                if (!isOutgoing && msg.status === 0) {
                    unreadToMark.push(msg.id);
                }
            });
            // Отправить событие read для всех непрочитанных
            if (ws && ws.readyState === WebSocket.OPEN && unreadToMark.length > 0) {
                unreadToMark.forEach(mid => {
                    ws.send(JSON.stringify({ type: "read", message_id: mid }));
                });
                unreadToMark = [];
            }
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    }

    let ws = null;
    let unreadToMark = [];
    sendButton.addEventListener("click", async () => {
        const content = messageInput.value.trim();
        
        // Проверяем, выбран ли контакт
        if (!currentChatId) {
            console.log("No contact selected");
            return;
        }
        
        if (content || selectedMedia.length > 0) {
            await sendMessage(content, selectedMedia);
            messageInput.value = "";
            mediaPreviewContainer.classList.add('hidden');
            mediaPreviewContent.innerHTML = '';
            selectedMedia.length = 0;
            // Move chat up and update preview immediately after sending
            const activeContact = document.querySelector('.contact.active');
            if (activeContact) {
                contactsList.prepend(activeContact);
                updateContactPreview(activeContact);
            }
        }
    });

    messageInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const content = messageInput.value.trim();
            if (content || selectedMedia.length > 0) {
                await sendMessage(content, selectedMedia);
                messageInput.value = '';
                mediaPreviewContainer.classList.add('hidden');
                mediaPreviewContent.innerHTML = '';
                selectedMedia.length = 0;
            }
        }
    });

    // Изменяем функцию отправки сообщения для поддержки загрузки медиа
    async function sendMessage(message, mediaFiles = []) {
        try {
            // Сначала загружаем все медиа на сервер (если они есть)
            const uploadedMedia = [];
            
            if (mediaFiles.length > 0) {
                const formData = new FormData();
                
                // Добавляем все файлы в FormData
                for (let i = 0; i < mediaFiles.length; i++) {
                    formData.append('files', mediaFiles[i]);
                }
                
                // Загружаем файлы на сервер
                const uploadResponse = await fetch(`/upload-media/${currentChatId}`, {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload media files');
                }
                
                // Получаем информацию о загруженных файлах
                const uploadResult = await uploadResponse.json();
                uploadedMedia.push(...uploadResult.files);
            }
            
            // Новая логика отправки через WebSocket
            if (ws.readyState === WebSocket.OPEN) {
                if (uploadedMedia.length > 0) {
                    // Display each media and text message as sent
                    if (uploadedMedia.length === 1) {
                        const mediaTag = ` [Media: ${uploadedMedia[0]}]`;
                        const contentWithMedia = (message || '') + mediaTag;
                        // displayMessage(null, contentWithMedia, currentUser.name, currentUser.avatar, true, new Date().toISOString(), 'message');
                        ws.send(JSON.stringify({ content: contentWithMedia, type: "message" }));
                    } else {
                        uploadedMedia.forEach((file, index) => {
                            const mediaTag = ` [Media: ${file}]`;
                            const contentForThis = index === uploadedMedia.length - 1 ? (message || '') + mediaTag : mediaTag;
                            // displayMessage(null, contentForThis, currentUser.name, currentUser.avatar, true, new Date().toISOString(), 'message');
                            ws.send(JSON.stringify({ content: contentForThis, type: "message" }));
                        });
                    }
                } else if (message) {
                    // displayMessage(null, message, currentUser.name, currentUser.avatar, true, new Date().toISOString(), 'message');
                    ws.send(JSON.stringify({ content: message, type: "message" }));
                }
            } else {
                console.error("WebSocket is not open, cannot send message");
                showNotification("Ошибка соединения. Пожалуйста, обновите страницу.");
            }
        } catch (error) {
            console.error("Send message error:", error);
            showNotification("Не удалось отправить сообщение. Пожалуйста, попробуйте еще раз.");
        }
    }

    function displayMessage(messageId, message, senderName, senderAvatar, isOutgoing, timestamp, type, status) {
        if (messageId && displayedMessages.has(messageId)) {
            console.log("Message already displayed, skipping:", messageId);
            return;
        }
        if (messageId) {
            displayedMessages.add(messageId);
        }

        console.log("Displaying message:", message, "from:", senderName, "isOutgoing:", isOutgoing, "type:", type);
        const messageElement = document.createElement('div');
        if (type === "system") {
            messageElement.classList.add('message', 'system');
            messageElement.innerHTML = `
                <div class="message-bubble">
                    <p>${message}</p>
                    <span class="message-time">${formatTimestamp(timestamp)}</span>
                </div>
            `;
        } else {
            messageElement.classList.add('message', isOutgoing ? 'outgoing' : 'incoming');
            let mediaHTML = '';
            const mediaRegex = /\[Media: (.*?)\]/g;
            let textContent = message;
            const mediaMatches = message.match(mediaRegex);
            if (mediaMatches) {
                mediaMatches.forEach(match => {
                    const fileName = match.match(/\[Media: (.*?)\]/)[1];
                    const isImage = fileName.match(/\.(jpg|jpeg|png|gif)$/i);
                    const isVideo = fileName.match(/\.(mp4|webm|ogg)$/i);
                    if (isImage) {
                        mediaHTML += `<img src="/static/media/${fileName}" alt="Media" class="message-media">`;
                    } else if (isVideo) {
                        mediaHTML += `<video src="/static/media/${fileName}" controls class="message-media"></video>`;
                    }
                    textContent = textContent.replace(match, '');
                });
            }
            const textHTML = textContent.trim() ? `<p>${textContent}</p>` : '';
            let statusIcon = '';
            if (isOutgoing) {
                if (status === 1) {
                    statusIcon = `<span class="message-status" title="Read"><ion-icon name="checkmark-done" style="color: #25d366; font-size: 18px; vertical-align: middle;"></ion-icon></span>`;
                } else {
                    statusIcon = `<span class="message-status" title="Delivered"><ion-icon name="checkmark-outline" style="color: #b0b0b0; font-size: 18px; vertical-align: middle;"></ion-icon></span>`;
                }
            }
            messageElement.innerHTML = `
                <div class="message-avatar">
                    <img src="${senderAvatar}" alt="${senderName}">
                </div>
                <div class="message-bubble">
                    <div class="message-sender">${senderName}</div>
                    ${mediaHTML}
                    ${textHTML}
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                        <span class="message-time">${formatTimestamp(timestamp)}</span>
                        ${statusIcon}
                    </div>
                </div>
            `;
            if (messageId) messageElement.setAttribute('data-message-id', messageId);
        }
        messageContainer.appendChild(messageElement);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    function formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                console.error("Invalid timestamp:", timestamp);
                return "Invalid time";
            }
            return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (error) {
            console.error("Error formatting timestamp:", timestamp, error);
            return "Invalid time";
        }
    }

    addUserButton.addEventListener('click', () => {
        addUserContext = 'contacts';
        addUserContainer.classList.remove('hidden');
        newContactNameInput.focus();
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });
    

    cancelAddContact.addEventListener('click', function() {
        addUserContainer.classList.add('hidden');
        newContactNameInput.value = '';
    });

    // Обновление функционала добавления контакта
    addContactBtn.addEventListener('click', async () => {
    const usernameToAdd = newContactNameInput.value.trim();
    if (!usernameToAdd) {
        showNotification("Введите имя пользователя для добавления.");
        return;
    }

    if (addUserContext === 'contacts') {
        // Добавление в контакты
        try {
            const searchResponse = await fetch(`/users/search?query=${encodeURIComponent(usernameToAdd)}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (!searchResponse.ok) throw new Error(`Ошибка поиска пользователя: ${searchResponse.statusText}`);
            const searchResults = await searchResponse.json();
    
            if (searchResults.length === 0) {
                showNotification(`Пользователь "${usernameToAdd}" не найден.`);
                return;
            } else if (searchResults.length > 1) {
                showNotification(`Найдено несколько пользователей с именем "${usernameToAdd}". Уточните имя.`);
                return;
            }
    
            const userToAdd = searchResults[0];
    
            // Получаем текущего пользователя с сервера
            const profileResponse = await fetch('/user/profile', {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (!profileResponse.ok) throw new Error('Не удалось получить профиль пользователя');
            const currentUser = await profileResponse.json();
    
            console.log("Текущий пользователь ID:", currentUser.id);
            console.log("Добавляем контакт ID:", userToAdd.id);
    
            if (!userToAdd.id) {
                showNotification("ID пользователя не найден.");
                return;
            }
    
            if (userToAdd.id === currentUser.id) {
                showNotification("Вы не можете добавить себя в контакты.");
                return;
            }
    
            const addResponse = await fetch('/contacts/add', {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ contact_ids: [userToAdd.id] })
            });
    
            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                throw new Error(errorData.detail || 'Ошибка при добавлении контакта');
            }
    
            showNotification(`Пользователь "${userToAdd.username}" успешно добавлен в контакты.`);
            await loadContacts();
    
            addUserContainer.classList.add('hidden');
            newContactNameInput.value = '';
    
        } catch (error) {
            console.error(error);
            showNotification(`Ошибка: ${error.message}`);
        }

    } else if (addUserContext === 'group-members') {
        // Добавление в группу
        if (!currentChatId) {
            showNotification("Группа не выбрана.");
            return;
        }
        try {
            // Поиск пользователя
            const searchResponse = await fetch(`/users/search?query=${encodeURIComponent(usernameToAdd)}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            
            if (!searchResponse.ok) {
                let errorText;
                try {
                    const errorData = await searchResponse.json();
                    errorText = errorData.detail || JSON.stringify(errorData);
                } catch {
                    errorText = await searchResponse.text();
                }
                throw new Error(`Ошибка поиска пользователя: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`);
            }
            const searchResults = await searchResponse.json();

            if (searchResults.length === 0) {
                showNotification(`Пользователь "${usernameToAdd}" не найден.`);
                return;
            } else if (searchResults.length > 1) {
                showNotification(`Найдено несколько пользователей с именем "${usernameToAdd}". Уточните имя.`);
                return;
            }

            const userToAdd = searchResults[0];

            // Добавляем в группу
            const addResponse = await fetch(`/groups/${currentChatId}/add-members`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ user_ids: [userToAdd.id] })
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                throw new Error(errorData.detail || 'Ошибка при добавлении участника');
            }

            showNotification(`Пользователь "${userToAdd.username}" успешно добавлен в группу.`);
            await loadGroupMembers(currentChatId);

            addUserContainer.classList.add('hidden');
            newContactNameInput.value = '';

        } catch (error) {
            console.error(error);
            showNotification(`Ошибка: ${error.message}`);
        }
    }
});

    

    addUserContainer.addEventListener('click', function(e) {
        if (e.target === addUserContainer) {
            addUserContainer.classList.add('hidden');
            newContactNameInput.value = '';
        }
    });

    addGroupButton.addEventListener('click', function() {
        addGroupContainer.classList.remove('hidden');
        newGroupNameInput.focus();
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });

    cancelAddGroup.addEventListener('click', function() {
        addGroupContainer.classList.add('hidden');
        newGroupNameInput.value = '';
    });

    addGroupBtn.addEventListener('click', async function() {
        const groupName = newGroupNameInput.value.trim();
        if (!groupName) {
            showNotification("Введите название группы.");
            return;
        }
    
        try {
            const response = await fetch("/groups/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name: groupName })
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Ошибка создания группы");
            }
    
            // Вместо создания элемента вручную просто обновим список групп
            await loadGroups();
    
            addGroupContainer.classList.add('hidden');
            newGroupNameInput.value = '';
            showNotification(`Группа "${groupName}" успешно создана.`);
    
        } catch (error) {
            showNotification(`Ошибка: ${error.message}`);
        }
    });
    
    

    addGroupContainer.addEventListener('click', function(e) {
        if (e.target === addGroupContainer) {
            addGroupContainer.classList.add('hidden');
        }
    });

    editProfileButton.addEventListener('click', function() {
        const username = document.querySelector('.profile-info h3').textContent;
        const email = document.querySelector('.profile-info p').textContent;
        editUsernameInput.value = username;
        editEmailInput.value = email;
        editPasswordInput.value = '';
        editProfileContainer.classList.remove('hidden');
        editUsernameInput.focus();
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });

    cancelEditProfile.addEventListener('click', function() {
        editProfileContainer.classList.add('hidden');
    });

    // В обработчике сохранения профиля корректно перезаписываем token:
    saveProfileBtn.addEventListener('click', async function() {
        const username = editUsernameInput.value.trim();
        const email = editEmailInput.value.trim();
        const password = editPasswordInput.value.trim();
    
        if (!username || !email) return showNotification("Заполните все поля");
    
        try {
            // Если есть выбранный файл аватара, загружаем его отдельно
            let avatarUrl = null;
            if (selectedAvatarFile) {
                const formData = new FormData();
                formData.append('file', selectedAvatarFile); // Сервер ожидает поле 'file', а не 'avatar'
    
                const uploadResponse = await fetch('/user/upload-avatar', {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${token}`
                    },
                    body: formData
                });
    
                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json();
                    console.error('Upload error:', uploadResponse.status, errorData);
                    throw new Error(`Ошибка загрузки аватара: ${errorData.detail || uploadResponse.statusText}`);
                }
    
                const uploadData = await uploadResponse.json();
                avatarUrl = uploadData.avatar_url;
            }
    
            // Отправляем обновлённые данные профиля
            const bodyData = { username, email };
            if (password) bodyData.password = password;
            if (avatarUrl) bodyData.avatar = avatarUrl;
    
            const res = await fetch('/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(bodyData)
            });
    
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || res.statusText);
    
            // Обновляем UI
            document.querySelector('.profile-info h3').textContent = data.username;
            document.querySelector('.profile-info p').textContent = data.email;
            if (data.avatar) {
                const profileAvatarImg = document.querySelector('.profile-avatar img');
                if (profileAvatarImg) profileAvatarImg.src = data.avatar;
                if (editAvatarImg) editAvatarImg.src = data.avatar;
                currentUser.avatar = data.avatar;
            }
    
            editProfileContainer.classList.add('hidden');
    
            localStorage.setItem('token', data.token);
            token = data.token;
            showNotification('Профиль обновлён, токен обновлён');
            await loadUserProfile();
            await loadContacts();
            loadMessages();

    
            // Сбрасываем выбранный файл
            selectedAvatarFile = null;
            editAvatarInput.value = '';
        } catch (e) {
            showNotification('Ошибка обновления профиля: ' + e.message);
        }
    });
    

    editProfileContainer.addEventListener('click', function(e) {
        if (e.target === editProfileContainer) {
            editProfileContainer.classList.add('hidden');
        }
    });

    userMenuBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        if (!currentChatId) return;
    
        const activeContact = document.querySelector('.contact.active');
        const isGroupChat = activeContact && activeContact.classList.contains('group');
    
        userMenu.classList.add('hidden');
        userMenu.classList.remove('active');
        groupUserMenu.classList.add('hidden');
        groupUserMenu.classList.remove('active');
    
        if (isGroupChat) {
            // Обновляем имя группы в меню
            const groupNameElement = document.getElementById('group-name');
            if (groupNameElement) {
                groupNameElement.textContent = currentContactUsername || '';
            }
    
            groupUserMenu.classList.remove('hidden');
            setTimeout(() => {
                groupUserMenu.classList.add('active');
            }, 10);
    
            loadGroupMembers(currentChatId);
        } else {
            userMenu.classList.remove('hidden');
            setTimeout(() => {
                userMenu.classList.add('active');
            }, 10);
        }
    
        document.addEventListener('click', handleOutsideClickMenu);
    });
    
    


    addGroupMemberBtn.addEventListener('click', () => {
        addUserContext = 'group-members';
        addUserContainer.classList.remove('hidden');
        newContactNameInput.focus();
    
        groupUserMenu.classList.remove('active');
        setTimeout(() => {
            groupUserMenu.classList.add('hidden');
        }, 300);
    });
    
    
    leaveGroupBtn.addEventListener('click', async () => {
        if (!currentChatId) return;
    
        try {
            const response = await fetch(`/groups/${currentChatId}/leave`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка выхода из группы');
            }
            showNotification('Вы вышли из группы');
    
            // Обновляем список контактов и групп
            await loadContacts();
            loadMessages();
    
            // Сбрасываем текущий чат
            currentChatId = null;
            currentContactUsername = null;
            messageContainer.innerHTML = '';
            disableMessaging();
    
            // Закрываем меню
            groupUserMenu.classList.remove('active');
            setTimeout(() => {
                groupUserMenu.classList.add('hidden');
            }, 300);
        } catch (error) {
            showNotification(`Ошибка: ${error.message}`);
        }
    });

    function handleOutsideClickMenu(event) {
        const target = event.target;
        if (
            !userMenu.contains(target) &&
            !groupUserMenu.contains(target) &&
            !userMenuBtn.contains(target)
        ) {
            userMenu.classList.remove('active');
            groupUserMenu.classList.remove('active');
            setTimeout(() => {
                userMenu.classList.add('hidden');
                groupUserMenu.classList.add('hidden');
            }, 300);
            document.removeEventListener('click', handleOutsideClickMenu);
        }
    }
    
    

    const clearHistoryBtn = userMenu.querySelector('.clear-btn');
    const deleteChatBtn = userMenu.querySelector('.delete-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const cancelConfirmationBtn = document.getElementById('cancel-confirmation');
    const confirmationDeletionBtn = document.getElementById('confirmation-deletion');

    clearHistoryBtn.addEventListener('click', async function() {
        if (!currentChatId) return;
        const response = await fetch(`/messages/${currentChatId}/clear`, {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) {
            const err = await response.json();
            showNotification(`Ошибка очистки истории: ${err.detail || 'Unknown error'}`);
            return;
        }
        if (!userMenu.classList.contains('hidden')) {
            userMenu.classList.remove('active');
            setTimeout(() => {
                userMenu.classList.add('hidden');
            }, 300);
        }
        messageContainer.innerHTML = '';
        showNotification('История чата очищена');
        await loadMessages();
        
    }); 

    deleteChatBtn.addEventListener('click', function() {
        confirmationModal.classList.remove('hidden');
        userMenu.classList.remove('active');
        setTimeout(() => {
            userMenu.classList.add('hidden');
        }, 300);
    });

    cancelConfirmationBtn.addEventListener('click', function() {
        confirmationModal.classList.add('hidden');
    });

    confirmationDeletionBtn.addEventListener('click', async function() {
        if (!currentChatId) return;
    
        try {
            const activeContact = document.querySelector('.contact.active');
            const isGroupChat = activeContact && activeContact.classList.contains('group');
    
            let url, method;
            if (isGroupChat) {
                url = `/chats/${currentChatId}`;
                method = 'DELETE';
            } else {
                url = `/chats/${currentChatId}/leave`;
                method = 'DELETE';
            }
    
            const response = await fetch(url, {
                method,
                headers: { "Authorization": `Bearer ${token}` }
            });
    
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to delete chat');
            }
    
            // Clear message container
            messageContainer.innerHTML = '';
    
            // Reset header
            document.querySelector('.current-contact .contact-info h3').textContent = '';
            document.querySelector('.current-contact .contact-info p').textContent = '';
            const headerAvatar = document.querySelector('.current-contact .contact-avatar img');
            if (headerAvatar) {
                headerAvatar.src = '/static/images/avatar.png'; // Default avatar
                headerAvatar.style.visibility = 'hidden'; // Already done in disableMessaging, but ensure consistency
            }
    
            // Reset chat state
            currentChatId = null;
            currentContactUsername = null;
            currentContactAvatar = null;
    
            // Close WebSocket if open
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
                ws = null;
            }
    
            // Remove active class from contact
            if (activeContact) {
                activeContact.classList.remove('active');
            }
    
            // Update UI
            showNotification('Чат удалён');
            disableMessaging();
            await loadContacts();
    
        } catch (error) {
            showNotification(`Ошибка удаления чата: ${error.message}`);
        }
    
        confirmationModal.classList.add('hidden');
    });
    

    confirmationModal.addEventListener('click', function(e) {
        if (e.target === confirmationModal) {
            confirmationModal.classList.add('hidden');
        }
    });

    const searchInput = document.querySelector('.search-contact');
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const contacts = document.querySelectorAll('.contact');
        contacts.forEach(contact => {
            const contactName = contact.querySelector('.contact-info h3').textContent.toLowerCase();
            if (contactName.includes(searchTerm)) {
                contact.style.display = 'flex';
            } else {
                contact.style.display = 'none';
            }
        });
    });

    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');
    menuBtn.addEventListener('click', function() {
        menu.classList.remove('hidden');
        setTimeout(() => {
            menu.classList.add('active');
        }, 10);
    });

    document.addEventListener('click', function(event) {
        if (!menu.contains(event.target) && !menuBtn.contains(event.target) && menu.classList.contains('active')) {
            menu.classList.remove('active');
            setTimeout(() => {
                menu.classList.add('hidden');
            }, 300);
        }
    });

    document.getElementById('logout').addEventListener('click', function() {
        localStorage.removeItem("token");
        // Закрываем WebSocket соединения для обновления статуса присутствия
        if (typeof ws !== 'undefined' && ws) ws.close();
        if (typeof notifSocket !== 'undefined' && notifSocket) notifSocket.close();
        // Переходим на страницу logout без добавления записи в историю
        window.location.replace(`/logout?token=${token}`);
    });

    mediaButton.addEventListener('click', function() {
        if (!emojiPickerContainer.classList.contains('hidden')) {
            emojiPickerContainer.classList.add('hidden');
        }
        mediaInput.click();
    });

    mediaInput.addEventListener('change', function() {
        if (this.files.length > 0) {          
            handleMediaFiles(this.files);
        }
    });

    editGroupProfileBtn.addEventListener('click', () => {
        // Заполняем текущие значения
        editGroupNameInput.value = currentContactUsername || '';
        editGroupAvatarImg.src = document.querySelector('.current-contact .contact-avatar img').src || '/static/images/group.png';
        selectedGroupAvatarFile = null;
    
        editGroupProfileContainer.classList.remove('hidden');
        setTimeout(() => {
            editGroupProfileContainer.classList.add('active');
        }, 10);
    });
    
    cancelEditGroupProfileBtn.addEventListener('click', () => {
        editGroupProfileContainer.classList.remove('active');
        setTimeout(() => {
            editGroupProfileContainer.classList.add('hidden');
        }, 300);
    });
    
    // Клик по аватару — открываем выбор файла
    editGroupAvatarImg.addEventListener('click', () => {
        editGroupAvatarInput.click();
    });
    
    // Выбор файла аватара
    editGroupAvatarInput.addEventListener('change', () => {
        const file = editGroupAvatarInput.files[0];
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif'];
        const maxSize = 5 * 1024 * 1024;
        const ext = file.name.split('.').pop().toLowerCase();
        if (file && file.type.startsWith('image/') && allowedExtensions.includes(ext)) {
            if (file.size > maxSize) {
                showNotification('Файл слишком большой. Максимальный размер — 5 МБ.');
                editGroupAvatarInput.value = '';
                return;
            }
            selectedGroupAvatarFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                editGroupAvatarImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Пожалуйста, выберите изображение в формате PNG, JPG, JPEG или GIF.');
            editGroupAvatarInput.value = '';
        }
    });

    saveGroupProfileBtn.addEventListener('click', async () => {
        const newName = editGroupNameInput.value.trim();
        if (!newName) {
            showNotification('Название группы не может быть пустым');
            return;
        }
    
        const formData = new FormData();
        formData.append('name', newName);
        if (selectedGroupAvatarFile) {
            formData.append('avatar_file', selectedGroupAvatarFile);
        }
    
        try {
            const response = await fetch(`/groups/${currentChatId}/profile`, {
                method: 'PUT',
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Ошибка обновления группы');
            }
            const data = await response.json();
    
            // Обновляем UI
            document.querySelector('.current-contact .contact-info h3').textContent = data.name;
            document.querySelector('.current-contact .contact-avatar img').src = data.avatar || '/static/images/group.png';

            const groupContactElement = document.querySelector(`.contact.group[data-group-id="${currentChatId}"]`);
            if (groupContactElement) {
                groupContactElement.querySelector('.contact-info h3').textContent = data.name;
                groupContactElement.querySelector('.contact-avatar img').src = data.avatar || '/static/images/group.png';
            }

            const groupAvatarImg = document.querySelector('#group-user-menu .profile-avatar img');
            if (groupAvatarImg) {
                groupAvatarImg.src = data.avatar || '/static/images/group.png';
            }
    
            showNotification('Профиль группы обновлен');
    
            // Закрываем модал
            editGroupProfileContainer.classList.remove('active');
            setTimeout(() => {
                editGroupProfileContainer.classList.add('hidden');
            }, 300);
    
            selectedGroupAvatarFile = null;
        } catch (e) {
            showNotification('Ошибка: ' + e.message);
        }
    });
    

    function handleMediaFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                selectedMedia.push(file);
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';               
                    if (file.type.startsWith('image/')) {
                        previewItem.innerHTML = `
                            <img src="${e.target.result}" alt="Preview">
                            <button class="remove-preview" data-index="${selectedMedia.length - 1}">
                                <ion-icon name="close"></ion-icon>
                            </button>
                        `;
                    } else if (file.type.startsWith('video/')) {
                        previewItem.innerHTML = `
                            <video src="${e.target.result}" muted></video>
                            <button class="remove-preview" data-index="${selectedMedia.length - 1}">
                                <ion-icon name="close"></ion-icon>
                            </button>
                            <div class="media-type-icon">
                                <ion-icon name="videocam"></ion-icon>
                            </div>
                        `;
                    }
                    mediaPreviewContent.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            }
        }
        if (selectedMedia.length > 0) {
            mediaPreviewContainer.classList.remove('hidden');
        }
    }

    mediaPreviewContent.addEventListener('click', function(e) {
        if (e.target.closest('.remove-preview')) {
            const button = e.target.closest('.remove-preview');
            const index = parseInt(button.getAttribute('data-index'));
                selectedMedia.splice(index, 1);
            button.closest('.preview-item').remove();
            document.querySelectorAll('.remove-preview').forEach((btn, idx) => {
                btn.setAttribute('data-index', idx);
            });
            if (selectedMedia.length === 0) {
                mediaPreviewContainer.classList.add('hidden');
            }
        }
    });

    closePreviewBtn.addEventListener('click', function() {
        mediaPreviewContainer.classList.add('hidden');
        mediaPreviewContent.innerHTML = '';
        selectedMedia.length = 0;
    });

    document.addEventListener('click', function(e) {
        const mediaEl = e.target.closest('img.message-media, video.message-media');
        if (mediaEl) {
            const mediaUrl = mediaEl.src || mediaEl.currentSrc;
            const isVideo = mediaEl.tagName.toLowerCase() === 'video';
            if (isVideo) {
                lightboxContent.innerHTML = `<video src="${mediaUrl}" controls autoplay></video>`;
                downloadMediaBtn.setAttribute('data-src', mediaUrl);
                downloadMediaBtn.setAttribute('data-filename', 'video_' + new Date().getTime() + '.mp4');
            } else {
                lightboxContent.innerHTML = `<img src="${mediaUrl}" alt="Full size image">`;
                downloadMediaBtn.setAttribute('data-src', mediaUrl);
                downloadMediaBtn.setAttribute('data-filename', 'image_' + new Date().getTime() + '.jpg');
            }
            mediaLightbox.classList.remove('hidden');
        }
    });

    closeLightboxBtn.addEventListener('click', function() {
        mediaLightbox.classList.add('hidden');
        lightboxContent.innerHTML = '';
    });

    downloadMediaBtn.addEventListener('click', function() {
        const mediaUrl = this.getAttribute('data-src');
        const filename = this.getAttribute('data-filename');
        if (mediaUrl) {
            const a = document.createElement('a');
            a.href = mediaUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });

    mediaLightbox.addEventListener('click', function(e) {
        if (e.target === mediaLightbox) {
            mediaLightbox.classList.add('hidden');
            lightboxContent.innerHTML = '';
        }
    });

    emojiButton.addEventListener('click', function() {
        if (!mediaPreviewContainer.classList.contains('hidden')) {
            emojiPickerContainer.classList.add('hidden');
        }
        emojiPickerContainer.classList.remove('hidden');
        if (!emojisLoaded) {
            fetchEmojis();
        }
    });

    closeEmojiPickerBtn.addEventListener('click', function() {
        emojiPickerContainer.classList.add('hidden');
    });

    document.addEventListener('click', function(event) {
        if (!emojiPickerContainer.contains(event.target) && 
            !emojiButton.contains(event.target) && 
            !emojiPickerContainer.classList.contains('hidden')) {
            emojiPickerContainer.classList.add('hidden');
        }
    });

    async function loadGroups() {
        try {
            const response = await fetch("/user/groups", {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error("Не удалось загрузить группы");
            const groups = await response.json();
    
            // НЕ очищаем contactsList, просто добавляем новые группы
    
            groups.forEach(group => {
                if (contactsList.querySelector(`.contact.group[data-group-id="${group.id}"]`)) {
                    return;
                }
            
                const groupElement = document.createElement('div');
                groupElement.classList.add('contact', 'group');
                groupElement.setAttribute('data-group-id', group.id);
                groupElement.innerHTML = `
                    <div class="contact-avatar">
                        <img src="${group.avatar || '/static/images/group.png'}" alt="${group.name}">
                    </div>
                    <div class="contact-info">
                        <h3>${group.name}</h3>
                        <p>Group</p>
                    </div>
                `;
                contactsList.appendChild(groupElement);
            
                groupElement.addEventListener('click', async function() {
                    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
            
                    currentChatId = group.id;
                    currentContactUsername = group.name;
            
                    // Обновляем хедер
                    document.querySelector('.current-contact .contact-info h3').textContent = group.name;
                    document.querySelector('.current-contact .contact-info p').textContent = 'Group';
                    const headerAvatar = document.querySelector('.current-contact .contact-avatar img');
                    if (headerAvatar) {
                        headerAvatar.src = group.avatar || '/static/images/group.png';
                        headerAvatar.style.visibility = 'visible';
                    }
            
                    // Обновляем меню группы — имя и аватар
                    const groupNameElement = document.getElementById('group-name');
                    if (groupNameElement) {
                        groupNameElement.textContent = group.name;
                    }
                    const groupAvatarImg = document.querySelector('#group-user-menu .profile-avatar img');
                    if (groupAvatarImg) {
                        groupAvatarImg.src = group.avatar || '/static/images/group.png';
                    }
            
                    reconnectWebSocket();
                    loadMessages();
                    enableMessaging();
                    loadGroupMembers(currentChatId);
                });
            });
            
        } catch (error) {
            console.error("Ошибка загрузки групп:", error);
            showNotification("Не удалось загрузить группы");
        }
    }
    
    

    function fetchEmojis() {
        emojiLoading.style.display = 'flex';
        emojiGrid.innerHTML = '';
        fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                emojiLoading.style.display = 'none';
                displayEmojis(data);
                emojisLoaded = true;
            })
            .catch(error => {
                console.error('Error fetching emojis:', error);
                emojiLoading.innerHTML = `
                    <p>Не удалось загрузить эмодзи</p>
                    <button id="retry-emoji-load" class="action-btn">
                        <ion-icon name="refresh-outline"></ion-icon> Повторить
                    </button>
                `;
                document.getElementById('retry-emoji-load').addEventListener('click', fetchEmojis);
            });
    }

    function displayEmojis(emojis) {
        const limitedEmojis = emojis.slice(0, 100);
        limitedEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji.character;
            emojiItem.title = emoji.unicodeName;
            emojiItem.addEventListener('click', function() {
                insertEmoji(emoji.character);
            });
            emojiGrid.appendChild(emojiItem);
        });
    }

    function insertEmoji(emoji) {
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        messageInput.value = textBefore + emoji + textAfter;
        messageInput.selectionStart = cursorPos + emoji.length;
        messageInput.selectionEnd = cursorPos + emoji.length;
        messageInput.focus();
    }

    // Добавим функцию для отображения уведомлений
    function showNotification(message) {
        // Простая реализация уведомления - можно улучшить с CSS-анимацией
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 3000);
        }, 100);
    }

    loadUserProfile();
    loadContacts().then(initPresence);

    // Добавляем функцию инициализации глобального присутствия
    async function initPresence() {
        try {
            const res = await fetch('/users/online', { headers: { "Authorization": `Bearer ${token}` } });
            if (!res.ok) return;
            const onlineIds = await res.json();
            document.querySelectorAll('.contact').forEach(c => {
                const id = parseInt(c.getAttribute('data-id'), 10);
                const statusEl = c.querySelector('.contact-status');
                if (!statusEl) return;
                if (onlineIds.includes(id)) statusEl.classList.replace('offline','online');
                else statusEl.classList.replace('online','offline');
            });
        } catch (e) { console.error(e); }
    }
});