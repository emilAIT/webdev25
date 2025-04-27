document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const contactsList = document.getElementById('contactsList');
    const groupsList = document.getElementById('groupsList');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatMessages = document.getElementById('chatMessages');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebarMenu = document.querySelector('.sidebar-menu');
    const emojiButton = document.querySelector('.emoji-button');
    const emojiPanel = document.getElementById('emojiPanel');
    const contactsTab = document.getElementById('contactsTab');
    const groupsTab = document.getElementById('groupsTab');
    const settingsTab = document.querySelector('.settings-tab');
    const settingsMenu = document.getElementById('settingsMenu');
    const settingsMain = settingsMenu.querySelector('.settings-main');
    const settingsProfile = settingsMenu.querySelector('.settings-profile');
    const createGroupChatButton = document.getElementById('createGroupChatButton');
    const groupModal = document.getElementById('groupModal');
    const groupNameInput = document.getElementById('groupNameInput');
    const groupContactsList = document.getElementById('groupContactsList');
    const createGroupFinal = document.getElementById('createGroupFinal');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const searchResults = document.getElementById('searchResults');
    const messagesByContact = {};
    const messagesByGroup = {};
    let currentMode = 'contacts';
    let currentContact = null; // Начальное значение null
    let currentGroup = null; // Начальное значение null
    let lastMessageTime = null; // Для polling

    // Храним добавленные контакты
    let addedContacts = [];
    
    // Добавляем стили для переключателей
    const style = document.createElement('style');
    style.textContent = `
        /* Стили для активного слайдера */
        .slider.active {
            background-color: #2196F3;
        }
        .slider.active:before {
            transform: translateX(26px);
        }
        .group-settings-icon {
            margin-left: auto;
            cursor: pointer;
            width: 30px;
            height: 30px;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #249FF4;
            font-size: 18px;
            border-radius: 50%;
            transition: background-color 0.3s;
        }
        .group-settings-icon:hover {
            background-color: rgba(33, 150, 243, 0.1);
        }
        .group-dropdown-menu {
            position: absolute;
            top: 50px;
            right: 15px;
            background-color: white;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            border-radius: 5px;
            padding: 5px 0;
            min-width: 180px;
            z-index: 100;
            display: none;
        }
        .group-dropdown-menu.active {
            display: block;
            animation: fadeIn 0.2s ease-in-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .group-menu-item {
            padding: 10px 15px;
            cursor: pointer;
            transition: background-color 0.3s;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .group-menu-item:hover {
            background-color: #f5f5f5;
        }
        .group-menu-item.delete-group {
            color: #f44336;
        }
        .group-menu-item.delete-group:hover {
            background-color: #ffebee;
        }
        .members-modal, .rename-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .members-content, .rename-content {
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            width: 80%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
        }
        .members-header, .rename-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .members-close, .rename-close {
            cursor: pointer;
            font-size: 20px;
        }
        .members-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
        }
        .member {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border-radius: 5px;
            background-color: #f5f5f5;
        }
        .member .avatar {
            width: 30px;
            height: 30px;
            background-color: #ccc;
            border-radius: 50%;
        }
        .add-members-section {
            display: flex;
            justify-content: center;
            margin-top: 15px;
        }
        .add-members-btn, .save-members-btn {
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 15px;
            padding: 10px 20px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            transition: background-color 0.3s, transform 0.2s;
            box-shadow: 0 4px 10px rgba(33, 150, 243, 0.3);
        }
        .add-members-btn:hover, .save-members-btn:hover {
            background-color: #0b7dda;
            transform: translateY(-2px);
        }
        .add-members-actions {
            display: flex;
            justify-content: center;
            margin-top: 15px;
        }
        .member-checkbox {
            margin-right: 10px;
        }
        .rename-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .rename-input {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            width: 100%;
        }
        .rename-btn {
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 10px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        .rename-btn:hover {
            background-color: #0b7dda;
        }
    `;
    document.head.appendChild(style);

    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, match => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match]));
    }

    async function fetchRegisteredUsers() {
        try {
            const response = await fetch('/api/users', { credentials: 'include' });
            const data = await response.json();
            return data.users || [];
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            return [];
        }
    }

    async function loadContacts() {
        try {
            const response = await fetch('/api/contacts', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                addedContacts = data.contacts || [];
                contactsList.innerHTML = '';
                
                addedContacts.forEach(user => {
                    const contactDiv = document.createElement('div');
                    contactDiv.className = 'contact';
                    if (currentContact === user) {
                        contactDiv.classList.add('active');
                    }
                    contactDiv.innerHTML = `
                        <div class="user-info-wrapper">
                            <div class="avatar"></div>
                            <span class="name">${escapeHTML(user)}</span>
                        </div>
                    `;
                    contactsList.appendChild(contactDiv);
                });
            } else {
                console.error('Ошибка загрузки контактов:', data.error);
            }
        } catch (error) {
            console.error('Ошибка при загрузке контактов:', error);
        }
    }

    async function clearContactsList() {
        if (!confirm('Вы уверены, что хотите очистить список контактов?')) {
            return;
        }
        
        try {
            const response = await fetch('/api/contacts/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.success) {
                addedContacts = [];
                contactsList.innerHTML = '';
                alert('Список контактов очищен.');
            } else {
                console.error('Ошибка очистки контактов:', data.error);
                alert('Не удалось очистить список контактов: ' + data.error);
            }
        } catch (error) {
            console.error('Ошибка при очистке контактов:', error);
            alert('Ошибка сервера при очистке контактов');
        }
    }

    function loadGroups() {
        fetch('/api/groups', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                groupsList.innerHTML = '';
                
                if (data.groups) {
                    data.groups.forEach(group => {
                        const groupDiv = document.createElement('div');
                        groupDiv.className = 'group';
                        groupDiv.innerHTML = `
                            <div class="user-info-wrapper">
                                <div class="avatar"></div>
                                <span class="name">${escapeHTML(group.name)}</span>
                            </div>
                        `;
                        groupsList.appendChild(groupDiv);
                    });
                }
            })
            .catch(error => console.error('Ошибка загрузки групп:', error));
    }

    async function clearGroupsList() {
        if (!confirm('Вы уверены, что хотите покинуть все группы?')) {
            return;
        }
        
        try {
            const response = await fetch('/api/groups/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.success) {
                groupsList.innerHTML = '';
                currentGroup = null;
                chatMessages.innerHTML = '';
                document.querySelector('.chat-header .name').textContent = '';
                document.querySelector('.chat-header .status').textContent = '';
                alert('Вы покинули все группы.');
            } else {
                console.error('Ошибка очистки групп:', data.error);
                alert('Не удалось выйти из групп: ' + data.error);
            }
        } catch (error) {
            console.error('Ошибка при очистке групп:', error);
            alert('Ошибка сервера при выходе из групп');
        }
    }

    async function searchContact() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        searchResults.innerHTML = '';

        if (!searchTerm) return;

        const registeredUsers = await fetchRegisteredUsers();
        const foundUser = registeredUsers.find(user => user.toLowerCase() === searchTerm);

        if (!foundUser) {
            searchResults.innerHTML = '<p>Нет такого контакта.</p>';
            return;
        }

        const resultDiv = document.createElement('div');
        resultDiv.className = 'search-result';

        if (addedContacts.includes(foundUser)) {
            resultDiv.innerHTML = `
                <div class="user-info-wrapper">
                    <div class="avatar"></div>
                    <span class="name">${escapeHTML(foundUser)}</span>
                </div>
                <label class="switch">
                    <input type="checkbox" checked onchange="removeContact('${foundUser}', this)">
                    <span class="slider active"></span>
                </label>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="user-info-wrapper">
                    <div class="avatar"></div>
                    <span class="name">${escapeHTML(foundUser)}</span>
                </div>
                <label class="switch">
                    <input type="checkbox" onchange="addContact('${foundUser}', this)">
                    <span class="slider"></span>
                </label>
            `;
        }
        searchResults.appendChild(resultDiv);
    }

    window.addContact = async function (username, checkbox) {
        if (checkbox.checked) {
            try {
                const response = await fetch('/api/contacts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact_username: username }),
                    credentials: 'include'
                });
                const data = await response.json();
                if (data.success) {
                    addedContacts.push(username);
                    loadContacts();
                    searchResults.innerHTML = '';
                    searchInput.value = '';
                } else {
                    console.error('Ошибка добавления контакта:', data.error);
                    alert('Не удалось добавить контакт: ' + data.error);
                    checkbox.checked = false;
                }
            } catch (error) {
                console.error('Ошибка при добавлении контакта:', error);
                alert('Ошибка сервера при добавлении контакта');
                checkbox.checked = false;
            }
        }
    };

    window.removeContact = async function (username, checkbox) {
        if (!checkbox.checked) {
            try {
                const response = await fetch('/api/contacts/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact_username: username }),
                    credentials: 'include'
                });
                const data = await response.json();
                if (data.success) {
                    // Удаляем из списка контактов
                    const index = addedContacts.indexOf(username);
                    if (index > -1) {
                        addedContacts.splice(index, 1);
                    }
                    loadContacts();
                    
                    // Если этот контакт был открыт в чате, закрываем его
                    if (currentContact === username) {
                        currentContact = null;
                        chatMessages.innerHTML = '';
                        document.querySelector('.chat-header .name').textContent = '';
                        document.querySelector('.chat-header .status').textContent = '';
                    }
                    
                    // Обновляем результаты поиска
                    searchResults.innerHTML = '';
                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'search-result';
                    resultDiv.innerHTML = `
                        <div class="user-info-wrapper">
                            <div class="avatar"></div>
                            <span class="name">${escapeHTML(username)}</span>
                        </div>
                        <label class="switch">
                            <input type="checkbox" onchange="addContact('${username}', this)">
                            <span class="slider"></span>
                        </label>
                    `;
                    searchResults.appendChild(resultDiv);
                } else {
                    console.error('Ошибка удаления контакта:', data.error);
                    alert('Не удалось удалить контакт: ' + data.error);
                    checkbox.checked = true;
                }
            } catch (error) {
                console.error('Ошибка при удалении контакта:', error);
                alert('Ошибка сервера при удалении контакта');
                checkbox.checked = true;
            }
        }
    };

    function loadContactsForGroup() {
        fetch('/api/contacts', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                groupContactsList.innerHTML = '';
                if (data.success && data.contacts) {
                    data.contacts.forEach(user => {
                        const contactDiv = document.createElement('div');
                        contactDiv.className = 'contact';
                        contactDiv.innerHTML = `
                            <input type="checkbox" class="contact-checkbox" data-username="${escapeHTML(user)}">
                            <div class="avatar"></div>
                            <span class="name">${escapeHTML(user)}</span>
                        `;
                        groupContactsList.appendChild(contactDiv);
                    });
                } else {
                    console.error('Ошибка загрузки контактов для группы:', data.error || 'Ответ не успешен');
                    groupContactsList.innerHTML = '<p>Не удалось загрузить контакты. Добавьте контакты перед созданием группы.</p>';
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки контактов для группы:', error);
                groupContactsList.innerHTML = '<p>Ошибка при загрузке контактов. Попробуйте позже.</p>';
            });
    }

    function openGroupModal() {
        groupModal.style.display = 'flex';
        groupNameInput.value = '';
        loadContactsForGroup();
    }

    function closeGroupModal() {
        groupModal.style.display = 'none';
    }

    function createGroup() {
        const groupName = document.getElementById('groupNameInput').value.trim();
        const selectedUsers = [];
        document.querySelectorAll('.contact-checkbox:checked').forEach(checkbox => {
            selectedUsers.push(checkbox.dataset.username);
        });

        if (!groupName) {
            alert('Введите название группы');
            return;
        }

        // Если не выбран ни один контакт, уведомляем пользователя что он будет единственным участником
        if (selectedUsers.length === 0) {
            alert('Вы будете единственным участником группы');
        }

        fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: groupName,
                members: selectedUsers
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadGroups();
                closeGroupModal();
            } else {
                alert('Ошибка при создании группы: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Произошла ошибка при создании группы');
        });
    }

    createGroupFinal.addEventListener('click', createGroup);
    groupModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-close')) {
            closeGroupModal();
        }
    });

    menuToggle.addEventListener('click', () => {
        sidebarMenu.classList.toggle('active');
        document.querySelector('.menu-items').classList.toggle('active');
    });

    settingsTab.addEventListener('click', (e) => {
        e.stopPropagation();
        if (settingsMenu.classList.contains('active')) {
            settingsMenu.classList.remove('active');
            settingsOverlay.classList.remove('active');
            settingsTab.classList.remove('active');
            settingsMain.classList.add('active');
            settingsProfile.classList.remove('active');
        } else {
            const rect = settingsTab.getBoundingClientRect();
            settingsMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
            settingsMenu.style.left = `${rect.left + window.scrollX}px`;
            settingsMenu.classList.add('active');
            settingsOverlay.classList.add('active');
            settingsTab.classList.add('active');
            closeAllMenus();
        }
    });

    settingsMain.addEventListener('click', (e) => {
        const settingsItem = e.target.closest('.settings-item');
        if (settingsItem) {
            const action = settingsItem.getAttribute('data-action');
            if (action === 'my-profile') {
                settingsMain.classList.remove('active');
                settingsProfile.classList.add('active');
                loadUserProfile();
            } else if (action === 'create-group') {
                openGroupModal();
                settingsMenu.classList.remove('active');
                settingsOverlay.classList.remove('active');
                settingsTab.classList.remove('active');
            } else if (action === 'exit') {
                fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.replace('/');
                        }
                    })
                    .catch(error => console.error('Ошибка при выходе:', error));
            }
        }
    });

    settingsProfile.addEventListener('click', (e) => {
        const backButton = e.target.closest('.back-button');
        if (backButton) {
            settingsProfile.classList.remove('active');
            settingsMain.classList.add('active');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.settings-tab') && !e.target.closest('.settings-menu')) {
            settingsMenu.classList.remove('active');
            settingsOverlay.classList.remove('active');
            settingsTab.classList.remove('active');
            settingsMain.classList.add('active');
            settingsProfile.classList.remove('active');
        }
    });

    contactsTab.addEventListener('click', () => {
        currentMode = 'contacts';
        contactsList.classList.add('active');
        groupsList.classList.remove('active');
        contactsTab.classList.add('active');
        groupsTab.classList.remove('active');
        settingsMenu.classList.remove('active');
        settingsOverlay.classList.remove('active');
        settingsTab.classList.remove('active');
        settingsMain.classList.add('active');
        settingsProfile.classList.remove('active');
        if (currentContact) {
            loadChat(currentContact, messagesByContact);
        }
    });

    groupsTab.addEventListener('click', () => {
        currentMode = 'groups';
        groupsList.classList.add('active');
        contactsList.classList.remove('active');
        groupsTab.classList.add('active');
        contactsTab.classList.remove('active');
        settingsMenu.classList.remove('active');
        settingsOverlay.classList.remove('active');
        settingsTab.classList.remove('active');
        settingsMain.classList.add('active');
        settingsProfile.classList.remove('active');
        if (currentGroup) {
            loadChat(currentGroup, messagesByGroup);
        }
    });

    emojiButton.addEventListener('click', () => {
        if (emojiPanel.classList.contains('active')) {
            emojiPanel.style.opacity = '0';
            setTimeout(() => {
                emojiPanel.classList.remove('active');
            }, 200);
        } else {
            emojiPanel.classList.add('active');
            emojiPanel.style.opacity = '1';
        }
    });

    emojiPanel.addEventListener('click', (e) => {
        const emoji = e.target.closest('.emoji');
        if (emoji) {
            messageInput.value += emoji.dataset.emoji;
            messageInput.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.emoji-panel') && !e.target.closest('.emoji-button')) {
            if (emojiPanel.classList.contains('active')) {
                emojiPanel.style.opacity = '0';
                setTimeout(() => {
                    emojiPanel.classList.remove('active');
                }, 200);
            }
        }
    });

    searchInput.addEventListener('input', () => {
        if (currentMode === 'contacts') {
            searchContact();
        } else {
            const searchTerm = searchInput.value.toLowerCase();
            const groups = groupsList.getElementsByClassName('group');
            Array.from(groups).forEach(group => {
                const name = group.querySelector('.name').textContent.toLowerCase();
                group.style.display = name.includes(searchTerm) ? 'flex' : 'none';
            });
        }
    });

    contactsList.addEventListener('click', (e) => {
        if (currentMode !== 'contacts') return;
        const contact = e.target.closest('.contact');
        if (contact) {
            Array.from(contactsList.getElementsByClassName('contact')).forEach(c =>
                c.classList.remove('active'));
            contact.classList.add('active');
            currentContact = contact.querySelector('.name').textContent;
            loadChat(currentContact, messagesByContact);
        }
    });

    groupsList.addEventListener('click', (e) => {
        if (currentMode !== 'groups') return;
        const group = e.target.closest('.group');
        if (group) {
            Array.from(groupsList.getElementsByClassName('group')).forEach(g =>
                g.classList.remove('active'));
            group.classList.add('active');
            currentGroup = group.querySelector('.name').textContent;
            loadChat(currentGroup, messagesByGroup);
            
            // Добавляем меню настроек группы
            const chatHeader = document.querySelector('.chat-header');
            
            // Удаляем старое меню и иконки настроек, если они есть
            const oldMenus = document.querySelectorAll('.group-dropdown-menu');
            oldMenus.forEach(menu => menu.remove());
            
            const oldIcons = document.querySelectorAll('.group-settings-icon');
            oldIcons.forEach(icon => icon.remove());
            
            // Добавляем новую иконку настроек в виде троеточия
            const groupSettingsIcon = document.createElement('div');
            groupSettingsIcon.className = 'group-settings-icon';
            groupSettingsIcon.innerHTML = `<i class="fas fa-ellipsis-v"></i>`;
            chatHeader.appendChild(groupSettingsIcon);
            
            // Создаем выпадающее меню (но пока не показываем)
            const groupMenu = document.createElement('div');
            groupMenu.className = 'group-dropdown-menu';
            groupMenu.innerHTML = `
                <div class="group-menu-item view-members">
                    <i class="fas fa-users"></i> Участники
                </div>
                <div class="group-menu-item rename-group">
                    <i class="fas fa-edit"></i> Переименовать
                </div>
                <div class="group-menu-item delete-group">
                    <i class="fas fa-trash"></i> Удалить
                </div>
            `;
            chatHeader.appendChild(groupMenu);
            
            // Очищаем старые обработчики событий
            const newSettingsIcon = chatHeader.querySelector('.group-settings-icon');
            const newGroupMenu = chatHeader.querySelector('.group-dropdown-menu');
            
            // Переключение меню при клике на иконку
            newSettingsIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                newGroupMenu.classList.toggle('active');
            });
            
            // Добавляем глобальный обработчик для закрытия меню при клике вне его
            const closeMenuHandler = (e) => {
                if (!e.target.closest('.group-settings-icon') && !e.target.closest('.group-dropdown-menu')) {
                    newGroupMenu.classList.remove('active');
                }
            };
            
            // Удаляем старый обработчик и добавляем новый
            document.removeEventListener('click', closeMenuHandler);
            document.addEventListener('click', closeMenuHandler);
            
            // Обработчики для пунктов меню
            newGroupMenu.querySelector('.view-members').addEventListener('click', () => {
                newGroupMenu.classList.remove('active');
                viewGroupMembers(currentGroup);
            });
            
            newGroupMenu.querySelector('.rename-group').addEventListener('click', () => {
                newGroupMenu.classList.remove('active');
                renameGroup(currentGroup);
            });
            
            newGroupMenu.querySelector('.delete-group').addEventListener('click', () => {
                newGroupMenu.classList.remove('active');
                deleteGroup(currentGroup);
            });
        }
    });

    async function loadChat(name, messagesStorage) {
        document.querySelector('.chat-header .name').textContent = name;
        const contactElement = currentMode === 'contacts' ?
            contactsList.querySelector(`.contact.active .status`) : null;
        document.querySelector('.chat-header .status').textContent =
            contactElement && contactElement.classList.contains('online') ? 'онлайн' : '';

        chatMessages.innerHTML = '';

        try {
            const response = await fetch(`/api/messages?mode=${currentMode}&target=${encodeURIComponent(name)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const data = await response.json();
            if (data.success && data.messages) {
                messagesStorage[name] = data.messages.map(message => ({
                    text: message.text,
                    time: message.time,
                    status: message.status,
                    isSent: message.isSent,
                    sender: message.sender
                }));

                data.messages.forEach(message => {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `message ${message.isSent ? 'sent' : 'received'}`;
                    messageDiv.innerHTML = `
                        <div class="message-content">
                            ${message.isSent ? '' : (currentMode === 'groups' ? `<span class="message-sender">${escapeHTML(message.sender)}</span>` : '')}
                            <span class="message-text">${escapeHTML(message.text)}</span>
                            <span class="message-time">${message.time}</span>
                            ${message.isSent ? 
                            `<span class="message-status ${message.status}">
                                <i class="fas fa-${message.status === 'read' ? 'check-double' : 'check'}"></i>
                            </span>
                            <span class="message-actions">
                                <i class="fas fa-ellipsis-v"></i>
                                <div class="message-menu">
                                    <div class="menu-item">Редактировать</div>
                                    <div class="menu-item">Удалить</div>
                                    <div class="menu-item">Удалить у всех</div>
                                </div>
                            </span>` : ''}
                        </div>
                    `;
                    chatMessages.appendChild(messageDiv);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;

                lastMessageTime = data.messages.length > 0 ? data.messages[data.messages.length - 1].time : null;
            } else {
                console.error('Ошибка загрузки сообщений:', data.error);
                alert('Не удалось загрузить сообщения: ' + data.error);
            }
        } catch (error) {
            console.error('Ошибка при загрузке сообщений:', error);
            alert('Ошибка сервера при загрузке сообщений');
        }
    }

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        if (!currentContact && currentMode === 'contacts' || !currentGroup && currentMode === 'groups') {
            alert('Выберите контакт или группу');
            return;
        }

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messagesStorage = currentMode === 'contacts' ? messagesByContact : messagesByGroup;
        const currentTarget = currentMode === 'contacts' ? currentContact : currentGroup;

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: currentTarget,
                    mode: currentMode,
                    text: text,
                    time: time
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Ошибка отправки сообщения:', errorData.error || response.statusText);
                alert('Не удалось отправить сообщение: ' + (errorData.error || 'Ошибка сервера'));
                return;
            }

            const data = await response.json();
            if (!data.success) {
                console.error('Ошибка отправки сообщения:', data.error);
                alert('Не удалось отправить сообщение: ' + data.error);
                return;
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message sent';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <span class="message-text">${escapeHTML(text)}</span>
                    <span class="message-time">${time}</span>
                    <span class="message-status unread"><i class="fas fa-check"></i></span>
                    <span class="message-actions">
                        <i class="fas fa-ellipsis-v"></i>
                        <div class="message-menu">
                            <div class="menu-item">Редактировать</div>
                            <div class="menu-item">Удалить</div>
                            <div class="menu-item">Удалить у всех</div>
                        </div>
                    </span>
                </div>
            `;
            chatMessages.appendChild(messageDiv);
            messageInput.value = '';
            chatMessages.scrollTop = chatMessages.scrollHeight;

            if (!messagesStorage[currentTarget]) {
                messagesStorage[currentTarget] = [];
            }
            messagesStorage[currentTarget].push({
                text: text,
                time: time,
                status: 'unread',
                isSent: true,
                sender: 'You'
            });

            lastMessageTime = time;
            
            // Обновляем сообщения, чтобы убедиться, что все видно обоим пользователям
            setTimeout(pollMessages, 500);
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
            alert('Ошибка сервера при отправке сообщения');
        }
    }

    async function pollMessages() {
        const currentTarget = currentMode === 'contacts' ? currentContact : currentGroup;
        if (!currentTarget) return;

        try {
            const response = await fetch(`/api/messages?mode=${currentMode}&target=${encodeURIComponent(currentTarget)}${lastMessageTime ? `&since=${lastMessageTime}` : ''}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const data = await response.json();
            if (data.success && data.messages && data.messages.length > 0) {
                const messagesStorage = currentMode === 'contacts' ? messagesByContact : messagesByGroup;

                if (!messagesStorage[currentTarget]) {
                    messagesStorage[currentTarget] = [];
                }

                data.messages.forEach(message => {
                    // Улучшенная проверка на дубликаты
                    const messageKey = `${message.sender}-${message.text}-${message.time}`;
                    const exists = messagesStorage[currentTarget].some(m => 
                        `${m.sender}-${m.text}-${m.time}` === messageKey
                    );
                    
                    if (!exists) {
                        messagesStorage[currentTarget].push({
                            text: message.text,
                            time: message.time,
                            status: message.status,
                            isSent: message.isSent,
                            sender: message.sender
                        });

                        const messageDiv = document.createElement('div');
                        messageDiv.className = `message ${message.isSent ? 'sent' : 'received'}`;
                        messageDiv.innerHTML = `
                            <div class="message-content">
                                ${message.isSent ? '' : (currentMode === 'groups' ? `<span class="message-sender">${escapeHTML(message.sender)}</span>` : '')}
                                <span class="message-text">${escapeHTML(message.text)}</span>
                                <span class="message-time">${message.time}</span>
                                ${message.isSent ? 
                                `<span class="message-status ${message.status}">
                                    <i class="fas fa-${message.status === 'read' ? 'check-double' : 'check'}"></i>
                                </span>
                                <span class="message-actions">
                                    <i class="fas fa-ellipsis-v"></i>
                                    <div class="message-menu">
                                        <div class="menu-item">Редактировать</div>
                                        <div class="menu-item">Удалить</div>
                                        <div class="menu-item">Удалить у всех</div>
                                    </div>
                                </span>` : ''}
                            </div>
                        `;
                        chatMessages.appendChild(messageDiv);
                        chatMessages.scrollTop = chatMessages.scrollHeight;

                        lastMessageTime = message.time;
                    }
                });
            }
        } catch (error) {
            console.error('Ошибка при получении сообщений:', error);
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    function closeAllMenus() {
        const menus = document.querySelectorAll('.message-menu.active');
        menus.forEach(menu => menu.classList.remove('active'));
    }

    chatMessages.addEventListener('click', (e) => {
        const actionsIcon = e.target.closest('.message-actions i');
        if (actionsIcon) {
            const menu = actionsIcon.nextElementSibling;
            const isOpen = menu.classList.contains('active');
            closeAllMenus();
            if (!isOpen) {
                menu.classList.add('active');
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message-actions') && !e.target.closest('.message-menu')) {
            closeAllMenus();
        }
    });

    chatMessages.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (!menuItem) return;

        const message = menuItem.closest('.message');
        // Проверяем, что сообщение отправлено текущим пользователем
        if (!message.classList.contains('sent')) {
            console.error('Нельзя редактировать чужие сообщения');
            return;
        }
        
        const messageContent = message.querySelector('.message-content');
        const messageText = message.querySelector('.message-text');
        const messagesStorage = currentMode === 'contacts' ? messagesByContact : messagesByGroup;
        const currentTarget = currentMode === 'contacts' ? currentContact : currentGroup;

        const messageIndex = Array.from(chatMessages.children).indexOf(message);
        closeAllMenus();

        if (menuItem.textContent.includes('Редактировать')) {
            const originalText = messageText.textContent;
            messageContent.innerHTML = `
                <div class="edit-container">
                    <input type="text" class="edit-input" value="${originalText}">
                    <div class="edit-actions">
                        <button class="save-btn"><i class="fas fa-check"></i> Сохранить</button>
                        <button class="cancel-btn"><i class="fas fa-times"></i> Отменить</button>
                    </div>
                </div>
            `;

            const editInput = messageContent.querySelector('.edit-input');
            editInput.focus();

            messageContent.querySelector('.save-btn').addEventListener('click', () => {
                const newText = editInput.value.trim();
                if (newText) {
                    const originalStatus = messagesStorage[currentTarget][messageIndex].status;
                    messageContent.innerHTML = `
                        <span class="message-text">${escapeHTML(newText)}</span>
                        <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span class="message-status ${originalStatus}">
                            <i class="fas fa-${originalStatus === 'read' ? 'check-double' : 'check'}"></i>
                        </span>
                        <span class="message-actions">
                            <i class="fas fa-ellipsis-v"></i>
                            <div class="message-menu">
                                <div class="menu-item">Редактировать</div>
                                <div class="menu-item">Удалить</div>
                                <div class="menu-item">Удалить у всех</div>
                            </div>
                        </span>
                    `;
                    messagesStorage[currentTarget][messageIndex].text = newText;
                    messagesStorage[currentTarget][messageIndex].time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            });

            messageContent.querySelector('.cancel-btn').addEventListener('click', () => {
                messageContent.innerHTML = `
                    <span class="message-text">${escapeHTML(originalText)}</span>
                    <span class="message-time">${messagesStorage[currentTarget][messageIndex].time}</span>
                    <span class="message-status ${messagesStorage[currentTarget][messageIndex].status}">
                        <i class="fas fa-${messagesStorage[currentTarget][messageIndex].status === 'read' ? 'check-double' : 'check'}"></i>
                    </span>
                    <span class="message-actions">
                        <i class="fas fa-ellipsis-v"></i>
                        <div class="message-menu">
                            <div class="menu-item">Редактировать</div>
                            <div class="menu-item">Удалить</div>
                            <div class="menu-item">Удалить у всех</div>
                        </div>
                    </span>
                `;
            });

        } else if (menuItem.textContent.includes('Удалить')) {
            message.remove();
            messagesStorage[currentTarget].splice(messageIndex, 1);
        } else if (menuItem.textContent.includes('Удалить у всех')) {
            // Реализуем функционал "Удалить у всех"
            const messageData = messagesStorage[currentTarget][messageIndex];
            
            // Отправляем запрос на сервер для удаления сообщения у всех участников
            fetch('/api/messages/deleteForAll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: currentMode,
                    target: currentTarget,
                    text: messageData.text,
                    time: messageData.time
                }),
                credentials: 'include'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    message.remove();
                    messagesStorage[currentTarget].splice(messageIndex, 1);
                    console.log('Сообщение успешно удалено у всех');
                } else {
                    console.error('Ошибка при удалении сообщения у всех:', data.error);
                    alert('Не удалось удалить сообщение: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Ошибка сети при удалении сообщения:', error);
                alert('Ошибка сервера при удалении сообщения');
            });
        }
    });

    function loadUserProfile() {
        fetch('/api/user/profile', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Ошибка сети: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                const profileName = settingsProfile.querySelector('.profile-name');
                const profileEmail = settingsProfile.querySelector('.profile-email');

                if (data.success && profileName && profileEmail) {
                    profileName.textContent = data.name || 'Имя не указано';
                    profileEmail.textContent = data.email || 'Email не указан';
                } else {
                    console.error('Не удалось загрузить профиль:', data.error || 'Ответ не успешен');
                    if (profileName) profileName.textContent = 'Ошибка загрузки';
                    if (profileEmail) profileEmail.textContent = 'Ошибка загрузки';
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки профиля:', error);
                const profileName = settingsProfile.querySelector('.profile-name');
                const profileEmail = settingsProfile.querySelector('.profile-email');
                if (profileName) profileName.textContent = 'Ошибка загрузки';
                if (profileEmail) profileEmail.textContent = 'Ошибка загрузки';
            });
    }

    const icons = document.querySelectorAll('.menu-item i, .settings-tab i, .message-actions i, .message-status i');
    icons.forEach(icon => {
        icon.style.color = '#FFFFFF';
    });

    // Инициализация
    loadContacts();
    loadGroups();
    setInterval(pollMessages, 2000); // Polling каждые 2 секунды
    pollMessages(); // Немедленный вызов для загрузки сообщений

    async function viewGroupMembers(groupName) {
        try {
            const response = await fetch(`/api/groups/members?group=${encodeURIComponent(groupName)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.success) {
                const modal = document.createElement('div');
                modal.className = 'members-modal';
                modal.innerHTML = `
                    <div class="members-content">
                        <div class="members-header">
                            <h3>Участники группы "${escapeHTML(groupName)}"</h3>
                            <span class="members-close">&times;</span>
                        </div>
                        <div class="members-list">
                            ${data.members.map(member => `
                                <div class="member">
                                    <div class="avatar"></div>
                                    <span class="name">${escapeHTML(member)}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="add-members-section">
                            <button class="add-members-btn">Добавить участников</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                modal.querySelector('.members-close').addEventListener('click', () => {
                    modal.remove();
                });
                
                // Закрытие по клику вне контента
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.remove();
                    }
                });
                
                // Обработчик для кнопки добавления участников
                modal.querySelector('.add-members-btn').addEventListener('click', () => {
                    addGroupMembers(groupName, data.members);
                    modal.remove();
                });
            } else {
                console.error('Ошибка получения участников группы:', data.error);
                alert('Не удалось получить список участников: ' + data.error);
            }
        } catch (error) {
            console.error('Ошибка при получении участников группы:', error);
            alert('Ошибка сервера при получении участников группы');
        }
    }

    async function addGroupMembers(groupName, existingMembers) {
        try {
            // Получаем список контактов
            const response = await fetch('/api/contacts', { credentials: 'include' });
            const data = await response.json();
            
            if (!data.success) {
                console.error('Ошибка загрузки контактов:', data.error);
                alert('Не удалось загрузить контакты: ' + data.error);
                return;
            }
            
            const contacts = data.contacts || [];
            
            // Создаем модальное окно для выбора контактов
            const modal = document.createElement('div');
            modal.className = 'members-modal';
            modal.innerHTML = `
                <div class="members-content">
                    <div class="members-header">
                        <h3>Добавить участников в группу "${escapeHTML(groupName)}"</h3>
                        <span class="members-close">&times;</span>
                    </div>
                    <div class="members-list">
                        ${contacts.length > 0 ? contacts.map(contact => {
                            const isAlreadyMember = existingMembers.includes(contact);
                            return `
                                <div class="member">
                                    <div class="avatar"></div>
                                    <span class="name">${escapeHTML(contact)}</span>
                                </div>
                            `;
                        }).join('') : '<p>У вас нет контактов. Добавьте контакты через поиск.</p>'}
                    </div>
                    <div class="add-members-actions">
                        <button class="save-members-btn">Добавить выбранные контакты</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('.members-close').addEventListener('click', () => {
                modal.remove();
            });
            
            // Закрытие по клику вне контента
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Обработчик для кнопки сохранения
            modal.querySelector('.save-members-btn').addEventListener('click', async () => {
                const selectedContacts = Array.from(modal.querySelectorAll('.member-checkbox:checked:not([disabled])'))
                    .map(checkbox => checkbox.dataset.username);
                
                if (selectedContacts.length === 0) {
                    alert('Выберите хотя бы один контакт для добавления в группу');
                    return;
                }
                
                try {
                    const response = await fetch('/api/groups/members/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            group: groupName,
                            members: selectedContacts
                        }),
                        credentials: 'include'
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        modal.remove();
                        if (data.added_count > 0) {
                            alert(`Добавлено ${data.added_count} участников в группу "${groupName}"`);
                        } else if (data.message) {
                            alert(data.message);
                        }
                        // Обновляем список участников
                        viewGroupMembers(groupName);
                    } else {
                        console.error('Ошибка добавления участников:', data.error);
                        alert('Не удалось добавить участников: ' + data.error);
                    }
                } catch (error) {
                    console.error('Ошибка при добавлении участников:', error);
                    alert('Ошибка сервера при добавлении участников');
                }
            });
        } catch (error) {
            console.error('Ошибка при подготовке добавления участников:', error);
            alert('Ошибка при подготовке добавления участников');
        }
    }

    async function renameGroup(groupName) {
        const modal = document.createElement('div');
        modal.className = 'rename-modal';
        modal.innerHTML = `
            <div class="rename-content">
                <div class="rename-header">
                    <h3>Переименовать группу "${escapeHTML(groupName)}"</h3>
                    <span class="rename-close">&times;</span>
                </div>
                <div class="rename-form">
                    <input type="text" class="rename-input" placeholder="Новое название группы" value="${escapeHTML(groupName)}">
                    <button class="rename-btn">Сохранить</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.rename-close').addEventListener('click', () => {
            modal.remove();
        });
        
        // Закрытие по клику вне контента
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        modal.querySelector('.rename-btn').addEventListener('click', async () => {
            const newName = modal.querySelector('.rename-input').value.trim();
            if (!newName) {
                alert('Введите название группы');
                return;
            }
            
            try {
                const response = await fetch('/api/groups/rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        oldName: groupName,
                        newName: newName
                    }),
                    credentials: 'include'
                });
                
                const data = await response.json();
                if (data.success) {
                    currentGroup = newName;
                    loadGroups();
                    document.querySelector('.chat-header .name').textContent = newName;
                    modal.remove();
                } else {
                    console.error('Ошибка переименования группы:', data.error);
                    alert('Не удалось переименовать группу: ' + data.error);
                }
            } catch (error) {
                console.error('Ошибка при переименовании группы:', error);
                alert('Ошибка сервера при переименовании группы');
            }
        });
    }

    async function deleteGroup(groupName) {
        if (!confirm(`Вы уверены, что хотите удалить группу "${groupName}"?`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/groups/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: groupName }),
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.success) {
                // Очищаем чат и заголовок
                chatMessages.innerHTML = '';
                document.querySelector('.chat-header .name').textContent = '';
                document.querySelector('.chat-header .status').textContent = '';
                
                // Удаляем меню группы и иконку настроек
                const groupMenu = document.querySelector('.group-dropdown-menu');
                if (groupMenu) {
                    groupMenu.remove();
                }
                
                const settingsIcon = document.querySelector('.group-settings-icon');
                if (settingsIcon) {
                    settingsIcon.remove();
                }
                
                // Сбрасываем текущую группу
                currentGroup = null;
                
                // Обновляем список групп
                loadGroups();
            } else {
                console.error('Ошибка удаления группы:', data.error);
                alert('Не удалось удалить группу: ' + data.error);
            }
        } catch (error) {
            console.error('Ошибка при удалении группы:', error);
            alert('Ошибка сервера при удалении группы');
        }
    }
});