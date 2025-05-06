const API_URL = window.location.origin;
const token = localStorage.getItem("access_token");
const currentUserId = parseInt(localStorage.getItem("user_id")) || null;

if (!currentUserId || !token) {
    window.location.href = "/login";
}

let currentGroupId = null;
let messageWS = null;
let chatWS = null;
let chats = [];
let users = [];

const messagesContainer = document.getElementById("messagesContainer");
const chatTitle = document.getElementById("chatTitle");
const chatMessageInput = document.getElementById("chatMessageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");

// Инициализация
window.addEventListener("DOMContentLoaded", async () => {
    await loadChats();
    setupEventListeners();
    connectChatWebSocket();
    createModalsIfNeeded();
    reinitializeSettings();
});

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    applySettings();
    
    // Настройки темы
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = localStorage.getItem('darkTheme') === 'true';
        themeToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            localStorage.setItem('darkTheme', e.target.checked);
        });
    }

    // Настройки фона
    const bgInput = document.getElementById('bgInput');
    if (bgInput) {
        bgInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    const chatContainer = document.querySelector('.chat-container');
                    if (chatContainer) {
                        chatContainer.style.backgroundImage = `url(${reader.result})`;
                        chatContainer.style.backgroundSize = 'cover';
                        localStorage.setItem('chatBg', reader.result);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

async function initializeApp() {
    await loadChats();
    setupEventListeners();
}

function setupEventListeners() {
    sendMessageBtn.addEventListener("click", sendMessage);
    chatMessageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".edit-delete")) {
            document.querySelectorAll(".dropdown-menu").forEach(m => m.style.display = "none");
        }
    });
    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.message')) {
            e.preventDefault();
            const contextMenu = document.querySelector('.context-menu');
            if (contextMenu) contextMenu.remove();
        }
    });

    // Добавляем обработчики для настроек
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => openModal('settingsModal'));
    }

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', e => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            localStorage.setItem('darkTheme', e.target.checked);
        });
    }

    const bgInput = document.getElementById('bgInput');
    if (bgInput) {
        bgInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    localStorage.setItem('chatBg', reader.result);
                    document.querySelector('.chat-container').style.backgroundImage = `url(${reader.result})`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function connectChatWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chats/${currentUserId}`;
    chatWS = new WebSocket(wsUrl);

    chatWS.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "group_update") {
            handleGroupUpdate(data.data);
        }
    };
}


function connectMessageWebSocket(groupId) {
    if (messageWS) {
        messageWS.onclose = null;
        messageWS.close();
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/${groupId}`;

    messageWS = new WebSocket(wsUrl);
    messageWS.onopen = () => {
        console.log("Connected to chat: " + groupId);
        fetchMessages();
    };
    messageWS.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) return;

        if (data.type === "new_message" && data.data.group_id === currentGroupId) {
            displayMessages([data.data], true);
        } else if (data.type === "updated_message" && data.data.group_id === currentGroupId) {
            updateMessage(data.data);
        } else if (data.type === "deleted_message" && data.data.group_id === currentGroupId) {
            removeMessage(data.data.id);
        }
    };
}


// Сообщения
async function sendMessage() {
    const content = chatMessageInput.value.trim();
    if (!content || !messageWS || messageWS.readyState !== WebSocket.OPEN || !currentGroupId) return;

    messageWS.send(JSON.stringify({
        content,
        author_id: currentUserId,
        group_id: currentGroupId
    }));

    chatMessageInput.value = "";
}

async function fetchMessages() {
    try {
        const response = await fetch(`${API_URL}/messages?group_id=${currentGroupId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
            const messages = await response.json();
            displayMessages(messages);
        }
    } catch (err) {
        console.error("Error loading messages", err);
    }
}

function displayMessages(messages, append = false) {
    if (!append) messagesContainer.innerHTML = "";

    messages.forEach(msg => {
        const isSentByMe = msg.author_id === currentUserId;
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${isSentByMe ? 'sent' : 'received'}`;
        messageDiv.id = `message-${msg.id}`;
        messageDiv.setAttribute("data-message-id", msg.id);

        const authorName = isSentByMe ? 'Вы' : (msg.author && msg.author.username ? msg.author.username : 'Unknown');
        
        const hasTranslation = msg.translated_content && msg.translated_content_lang;
        const displayContent = msg.show_translation && hasTranslation ? msg.translated_content : msg.content;

        messageDiv.innerHTML = `
            <div class="message-wrapper">
                <div class="message-author">${authorName}</div>
                <div class="message-content">${displayContent}</div>
                <div class="message-info">
                    ${new Date(msg.timestamp).toLocaleString([], {hour: '2-digit', minute: '2-digit'})} 
                    ${msg.edited ? '(изменено)' : ''} 
                    ${hasTranslation ? `
                        <span class="translation-toggle" onclick="toggleMessageView(${msg.id})">
                            ${msg.show_translation ? '🔄 Оригинал' : '🌐 Перевод'}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;

        messageDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, msg);
        });

        messagesContainer.appendChild(messageDiv);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function toggleMessageView(messageId) {
    try {
        const response = await fetch(`${API_URL}/messages/${messageId}/toggle-translation`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const updatedMessage = await response.json();
            updateMessage(updatedMessage);
        } else {
            throw new Error("Failed to toggle translation view");
        }
    } catch (err) {
        console.error("Error toggling translation view:", err);
        alert("Ошибка при переключении отображения");
    }
}

function updateMessage(msg) {
    const msgDiv = document.getElementById(`message-${msg.id}`);
    if (!msgDiv) return;

    const hasTranslation = msg.translated_content && msg.translated_content_lang;
    const displayContent = msg.show_translation && hasTranslation ? msg.translated_content : msg.content;
    
    msgDiv.querySelector(".message-content").textContent = displayContent;
    msgDiv.querySelector(".message-info").innerHTML = `
        ${new Date(msg.timestamp).toLocaleString([], {hour: '2-digit', minute: '2-digit'})} 
        ${msg.edited ? '(изменено)' : ''} 
        ${hasTranslation ? `
            <span class="translation-toggle" onclick="toggleMessageView(${msg.id})">
                ${msg.show_translation ? '🔄 Оригинал' : '🌐 Перевод'}
            </span>
        ` : ''}
    `;
}


function removeMessage(messageId) {
    const msgDiv = document.getElementById(`message-${messageId}`);
    if (msgDiv) msgDiv.remove();
}


async function deleteMessage(messageId) {
    if (!confirm("Удалить сообщение?")) return;

    try {
        const response = await fetch(`${API_URL}/messages/${messageId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            removeMessage(messageId);
        } else {
            throw new Error("Failed to delete message");
        }
    } catch (err) {
        console.error("Error deleting message:", err);
        alert("Ошибка при удалении сообщения");
    }
}


// Чаты
async function loadChats() {
    try {
        const response = await fetch(`${API_URL}/chats`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            chats = await response.json();
            renderChatsList();
            if (chats.length > 0 && !currentGroupId) {
                switchToChat(chats[0].id);
            }
        } else {
            throw new Error("Failed to load chats");
        }
    } catch (err) {
        console.error("Error loading chats:", err);
        chats = [];
        renderChatsList();
    }
}

function renderChatsList() {
    const sidebar = document.querySelector(".sidebar");
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <button class="new-chat" onclick="createPrivateChat()">Новый чат</button>
            <button class="new-group" onclick="createGroup()">Новая группа</button>
        </div>
        <div class="chat-list"></div>
    `;
    
    const chatList = sidebar.querySelector(".chat-list");
    chats.forEach(chat => {
        const chatItem = document.createElement("div");
        chatItem.classList.add("chat-item");
        if (chat.id === currentGroupId) chatItem.classList.add("active");
        
        chatItem.innerHTML = `
            <div class="chat-avatar">${chat.name.charAt(0)}</div>
            <div class="chat-info">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-preview">...</div>
            </div>
            <button class="delete-chat" onclick="deleteChat(${chat.id})">×</button>
        `;
        
        chatItem.onclick = (e) => {
            if (!e.target.classList.contains("delete-chat")) {
                switchToChat(chat.id);
            }
        };
        chatList.appendChild(chatItem);
    });
}

function switchToChat(chatId) {
    if (currentGroupId === chatId) return;
    currentGroupId = chatId;
    const chat = chats.find(c => c.id === chatId);

    if (chat) {
        chatTitle.textContent = chat.name;
        messagesContainer.innerHTML = "";
        connectMessageWebSocket(chatId);
        document.querySelectorAll(".chat-item").forEach(i => i.classList.remove("active"));
        const activeItem = Array.from(document.querySelectorAll(".chat-item")).find(i => i.textContent.includes(chat.name));
        if (activeItem) activeItem.classList.add("active");
    }
}

async function createPrivateChat() {
    await fetchUsers();
    const usersList = document.getElementById("usersList");
    usersList.innerHTML = "";
    
    users.forEach(user => {
        if (user.id === currentUserId) return;
        const userItem = document.createElement("div");
        userItem.classList.add("user-item");
        userItem.innerHTML = `
            <div class="user-avatar">${user.username.charAt(0)}</div>
            <div class="user-name">${user.username}</div>
        `;
        userItem.onclick = () => {
            document.getElementById("privateChatNameInput").dataset.recipientId = user.id;
            document.getElementById("userSelectionModal").style.display = "none";
            document.getElementById("privateChatNameModal").style.display = "flex";
        };
        usersList.appendChild(userItem);
    });
    
    document.getElementById("userSelectionModal").style.display = "flex";
}

async function submitPrivateChat() {
    const recipientId = document.getElementById("privateChatNameInput").dataset.recipientId;
    const name = document.getElementById("privateChatNameInput").value.trim();
    
    try {
        const response = await fetch(`${API_URL}/chats`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                user_id: currentUserId,
                recipient_id: parseInt(recipientId),
                name: name || undefined
            })
        });
        
        if (response.ok) {
            const newChat = await response.json();
            closeModal("privateChatNameModal");
            await loadChats();
            switchToChat(newChat.id);
        } else {
            throw new Error("Failed to create chat");
        }
    } catch (err) {
        console.error("Error creating chat:", err);
        alert("Ошибка при создании чата");
    }
}

async function createGroup() {
    const selectedUsers = [];
    await fetchUsers();
    
    const usersList = document.getElementById("groupUsersList");
    usersList.innerHTML = "";
    
    users.forEach(user => {
        if (user.id === currentUserId) return;
        const userItem = document.createElement("div");
        userItem.classList.add("user-item");
        userItem.innerHTML = `
            <div class="user-avatar">${user.username.charAt(0)}</div>
            <div class="user-name">${user.username}</div>
            <input type="checkbox" class="user-checkbox" data-user-id="${user.id}">
        `;
        
        const checkbox = userItem.querySelector(".user-checkbox");
        checkbox.onchange = (e) => {
            if (e.target.checked) {
                selectedUsers.push(user.id);
                userItem.classList.add("selected");
            } else {
                selectedUsers.splice(selectedUsers.indexOf(user.id), 1);
                userItem.classList.remove("selected");
            }
        };
        
        usersList.appendChild(userItem);
    });
    
    document.getElementById("createGroupModal").style.display = "flex";
}

async function submitGroupCreation() {
    const groupName = document.getElementById("groupNameInput").value.trim();
    const selectedUsers = Array.from(document.querySelectorAll(".user-checkbox:checked")).map(cb => parseInt(cb.dataset.userId));
    
    if (!groupName) {
        alert("Введите название группы");
        return;
    }
    
    if (selectedUsers.length === 0) {
        alert("Выберите хотя бы одного участника");
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/groups`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ name: groupName, background: "#ECE5DD" })
        });
        
        if (!response.ok) throw new Error("Failed to create group");
        
        const newGroup = await response.json();
        
        for (const userId of [...selectedUsers, currentUserId]) {
            await fetch(`${API_URL}/groups/${newGroup.id}/add_user?user_id=${userId}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
        }
        
        closeModal("createGroupModal");
        await loadChats();
        switchToChat(newGroup.id);
    } catch (err) {
        console.error("Error creating group:", err);
        alert("Ошибка при создании группы");
    }
}

async function deleteChat(chatId) {
    if (!confirm("Удалить чат?")) return;
    
    try {
        const response = await fetch(`${API_URL}/groups/${chatId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.ok) {
            if (currentGroupId === chatId) {
                currentGroupId = null;
                messagesContainer.innerHTML = "";
                chatTitle.textContent = "Выберите чат";
                if (ws) ws.close();
            }
            await loadChats();
        } else {
            throw new Error("Failed to delete chat");
        }
    } catch (err) {
        console.error("Error deleting chat:", err);
        alert("Ошибка при удалении чата");
    }
}

async function createChat(userId) {
    try {
        const response = await fetch(`${API_URL}/chats`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                user_id: currentUserId,
                recipient_id: userId,
                type: "private"
            })
        });

        if (response.ok) {
            const newChat = await response.json();
            closeModal("userSelectionModal");
            await loadChats();
            switchToChat(newChat.id);
        } else {
            throw new Error("Failed to create chat");
        }
    } catch (err) {
        console.error("Error creating chat:", err);
        alert("Ошибка при создании чата");
    }
}

// Утилиты
async function fetchUsers() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            users = await response.json();
        } else {
            throw new Error("Failed to fetch users");
        }
    } catch (err) {
        console.error("Error fetching users:", err);
        users = [];
    }
}

function toggleDropdown(toggleElem) {
    const menu = toggleElem.querySelector(".dropdown-menu");
    document.querySelectorAll(".dropdown-menu").forEach(m => {
        if (m !== menu) m.style.display = "none";
    });
    menu.style.display = menu.style.display === "block" ? "none" : "block";
}



function openChatParticipants() {
    fetch(`${API_URL}/groups/${currentGroupId}/users`, {
        headers: { "Authorization": `Bearer ${token}` }
    })
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch participants");
            return response.json();
        })
        .then(participants => {
            const participantsList = document.getElementById("participantsList");
            participantsList.innerHTML = "";
            
            participants.forEach(user => {
                const participantDiv = document.createElement("div");
                participantDiv.classList.add("participant-item");
                participantDiv.innerHTML = `
                    <div class="participant-avatar">${user.username.charAt(0)}</div>
                    <div class="participant-name">${user.username}${user.id === currentUserId ? " (Вы)" : ""}</div>
                `;
                participantsList.appendChild(participantDiv);
            });
            
            document.getElementById("chatParticipantsModal").style.display = "flex";
        })
        .catch(err => {
            console.error("Error fetching participants:", err);
            alert("Ошибка при загрузке участников");
        });
}

function showContextMenu(e, msg) {
    const oldMenu = document.querySelector('.context-menu');
    if (oldMenu) oldMenu.remove();

    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';

    contextMenu.innerHTML = `
        <div class="context-menu-item edit-message" data-id="${msg.id}">✏️ Изменить</div>
        <div class="context-menu-item delete-message" data-id="${msg.id}">🗑️ Удалить</div>
        <div class="context-menu-item translate-message" data-id="${msg.id}">
            🌐 Перевести
        </div>
    `;

    // Обработчик для редактирования сообщения
    contextMenu.querySelector('.edit-message').addEventListener('click', () => openEditModal(msg));

    // Обработчик для удаления сообщения
    contextMenu.querySelector('.delete-message').addEventListener('click', () => deleteMessage(msg.id));

    // Обработчик для перевода сообщения
    contextMenu.querySelector('.translate-message').addEventListener('click', () => openTranslateModal(msg));

    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    document.body.appendChild(contextMenu);

    document.addEventListener('click', () => contextMenu.remove(), { once: true });
}

// Add this new function to open translation modal
function openTranslateModal(msg) {
    // Make sure the modal exists
    createModalsIfNeeded();
    
    const modal = document.getElementById("translateMessageModal");
    const select = document.getElementById("translateLanguageSelect");
    
    if (!modal || !select) {
        console.error("Translation modal or select element not found");
        return;
    }
    
    select.dataset.messageId = msg.id;
    
    // Reset selection if needed
    if (select.value) {
        select.selectedIndex = 0;
    }
    
    modal.style.display = "flex";
}

// Add this new function to perform translation
async function submitTranslation() {
    const select = document.getElementById("translateLanguageSelect");
    const messageId = select.dataset.messageId;
    const targetLang = select.value;
    
    if (!targetLang) {
        alert("Пожалуйста, выберите язык перевода");
        return;
    }
    
    try {
        // Проверяем, есть ли уже перевод на этот язык
        const response = await fetch(`${API_URL}/messages/${messageId}/translate`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ target_lang: targetLang })
        });

        if (response.ok) {
            const updatedMessage = await response.json();
            updateMessage(updatedMessage);
            closeModal("translateMessageModal");
        } else {
            throw new Error("Failed to translate message");
        }
    } catch (err) {
        console.error("Translation error:", err);
        alert("Ошибка при переводе сообщения");
    }
}

// Replace the old toggleTranslation function with this one
async function toggleTranslation(messageId, lang) {
    try {
        const response = await fetch(`${API_URL}/messages/${messageId}/translate?target_lang=${lang}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const updatedMessage = await response.json();
            updateMessage(updatedMessage);
        } else {
            throw new Error("Failed to toggle translation");
        }
    } catch (err) {
        console.error("Error toggling translation:", err);
        alert("Ошибка при переводе сообщения");
    }
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

function openEditModal(msg) {
    const modal = document.getElementById("editMessageModal");
    const input = document.getElementById("editMessageInput");
    input.value = msg.content;
    input.dataset.messageId = msg.id;
    modal.style.display = "flex";
    input.focus();
}

async function submitEdit() {
    const input = document.getElementById("editMessageInput");
    const messageId = input.dataset.messageId;
    const content = input.value.trim();
    if (!content) return;

    try {
        const response = await fetch(`${API_URL}/messages/${messageId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            const updatedMessage = await response.json();
            updateMessage(updatedMessage);
            closeModal("editMessageModal");
        } else {
            throw new Error("Failed to edit message");
        }
    } catch (err) {
        console.error("Edit error", err);
        alert("Ошибка при редактировании сообщения");
    }
}

// Add function to handle group updates
function handleGroupUpdate(data) {
    if (data.action === 'created' || data.action === 'updated') {
        // Refresh chats list to show the new/updated group
        loadChats().then(() => {
            // If this is the current group, refresh the title
            if (currentGroupId === data.group_id) {
                chatTitle.textContent = data.name;
            }
        });
    } else if (data.action === 'deleted') {
        // If the current group was deleted, clear the view
        if (currentGroupId === data.group_id) {
            currentGroupId = null;
            messagesContainer.innerHTML = "";
            chatTitle.textContent = "Выберите чат";
            if (ws) ws.close();
        }
        // Refresh the chats list
        loadChats();
    }
}

// Add this new function to create modals if they don't exist
function createModalsIfNeeded() {
    // Check if translate modal exists, if not create it
    if (!document.getElementById("translateMessageModal")) {
        const translateModal = document.createElement("div");
        translateModal.id = "translateMessageModal";
        translateModal.className = "modal";
        translateModal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal" onclick="closeModal('translateMessageModal')">×</span>
                <h3 class="modal-header">Перевести сообщение</h3>
                <div class="form-group">
                    <label for="translateLanguageSelect">Выберите язык перевода:</label>
                    <select id="translateLanguageSelect" class="form-control">
                        <option value="">Выберите язык</option>
                        <option value="RU">Русский</option>
                        <option value="EN-US">Английский (США)</option>
                        <option value="DE">Немецкий</option>
                        <option value="FR">Французский</option>
                        <option value="ES">Испанский</option>
                        <option value="It">Итальянский</option>
                        <option value="Ja">Японский</option>
                        <option value="Zh">Китайский</option>
                    </select>
                </div>
                <button onclick="submitTranslation()">Перевести</button>
            </div>
        `;
        document.body.appendChild(translateModal);
    }
}

// ==== НАЧАЛО блока настроек ====
function applySettings() {
  const dark = localStorage.getItem('darkTheme') === 'true';
  document.getElementById('themeToggle').checked = dark;
  document.body.classList.toggle('dark-theme', dark);

  const bg = localStorage.getItem('chatBg');
  if (bg) {
    document.querySelector('.chat-container').style.backgroundImage = `url(${bg})`;
    document.querySelector('.chat-container').style.backgroundSize = 'cover';
  }
}

document.getElementById('settingsBtn').addEventListener('click', () => {
  openModal('settingsModal');
});

document.getElementById('themeToggle').addEventListener('change', e => {
  const on = e.target.checked;
  document.body.classList.toggle('dark-theme', on);
  localStorage.setItem('darkTheme', on);
});

document.getElementById('bgInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('chatBg', reader.result);
    document.querySelector('.chat-container').style.backgroundImage = `url(${reader.result})`;
  };
  reader.readAsDataURL(file);
});

function resetSettings() {
  localStorage.removeItem('darkTheme');
  localStorage.removeItem('chatBg');
  document.getElementById('themeToggle').checked = false;
  document.body.classList.remove('dark-theme');
  document.querySelector('.chat-container').style.backgroundImage = '';
  closeModal('settingsModal');
}

// При загрузке страницы
document.addEventListener('DOMContentLoaded', applySettings);
// ==== КОНЕЦ блока настроек ====

function reinitializeSettings() {
    // Применяем тему
    const isDarkTheme = localStorage.getItem('darkTheme') === 'true';
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = isDarkTheme;
    }
    document.body.classList.toggle('dark-theme', isDarkTheme);
    
    // Применяем фон чата
    const savedBg = localStorage.getItem('chatBg');
    if (savedBg) {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.style.backgroundImage = `url(${savedBg})`;
            chatContainer.style.backgroundSize = 'cover';
        }
    }
}