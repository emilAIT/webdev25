import { userID, userName } from './global.js';

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const chatId = params.get('chat_id');
  const isGroup = params.get('is_group') === '1';
  const chatName = document.getElementById('chatName');

  console.log('chatId:', chatId, 'isGroup:', isGroup); // Отладка параметров

  const nameDisplay = document.querySelector('.username');
  if (!nameDisplay) {
    console.error('Элемент .username не найден!');
    return;
  }

  // Обработчик клика
  chatName.addEventListener('click', (e) => {
    e.preventDefault(); // Предотвращаем стандартное поведение браузера
    e.stopPropagation(); // Останавливаем всплытие события
    console.log('Клик по названию группы сработал!');
    if (isGroup) {
      console.log(`Пер26: Перенаправление на group_info.html?group_id=${chatId}`);
      window.location.href = `group_info.html?group_id=${chatId}`;
    } else {
      alert('Это не групповой чат.');
    }
  });

  chatName.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Предотвращаем стандартное поведение (например, выделение)
    chatName.click(); // Программно вызываем событие click
  });

  const socket = io('http://127.0.0.1:5000');
  socket.emit('join', isGroup ? { group_id: chatId } : { user_id: userID });

  const messagesContainer = document.querySelector('.messages');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendButton');
  const avatar = document.getElementById('chatAvatar');

  const emojiToggle = document.getElementById('emojiToggle');
  const emojiPicker = document.getElementById('emojiPicker');
  const contextMenu = document.getElementById('contextMenu');
  const backIcon = document.getElementById('backIcon');

  let activeMessage = null;

  // Назад
  backIcon.addEventListener('click', () => {
    window.location.href = '/chats.html';
  });

  // Имя собеседника/группы
  try {
    if (isGroup) {
      const res = await fetch(`http://127.0.0.1:5000/groups/${chatId}`);
      const group = await res.json();
      nameDisplay.textContent = group.name;
      avatar.src = 'png/image 11.png';
    } else {
      const res = await fetch(`http://127.0.0.1:5000/users`);
      const users = await res.json();
      const friend = users.find(u => u.id == chatId);
      const avatarEl = document.querySelector('.avatar');
      try {
        const res = await fetch(`http://127.0.0.1:5000/chat_info/${chatId}?is_group=${isGroup ? 1 : 0}`);
        const chatInfo = await res.json();
        nameDisplay.textContent = chatInfo.name || 'Чат';
        avatarEl.src = 'png/default.png';
      } catch {
        nameDisplay.textContent = 'Чат';
        avatarEl.src = 'png/default.png';
      }
    }
  } catch (err) {
    console.error('Ошибка при загрузке информации о чате:', err);
    nameDisplay.textContent = 'Чат';
    avatar.src = 'png/default.png';
  }

  async function loadMessages() {
    try {
      const url = isGroup
        ? `http://127.0.0.1:5000/messages_group/${chatId}?user_id=${userID}`
        : `http://127.0.0.1:5000/messages/${chatId}?user_id=${userID}`;
  
      const res = await fetch(url);
      const messages = await res.json();
      messagesContainer.innerHTML = '';
  
      messages.forEach(msg => {
        const div = document.createElement('div');
        div.classList.add('message');
        div.dataset.messageId = msg.id;
  
        const readBy = msg.read_by || [];
  
        if (msg.sender_id == userID) {
          div.classList.add('outgoing');
          const isRead = readBy.includes(msg.receiver_id);
          div.innerHTML = msg.content + (isRead ? `<img src="png/image 14.png" class="read-status" alt="\u2713">` : '');
        } else {
          div.classList.add('incoming');
          div.textContent = msg.content;
        }
        messagesContainer.appendChild(div);
      });
  
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
      const unreadIds = messages
        .filter(msg => msg.receiver_id == userID && !(msg.read_by || []).includes(userID))
        .map(msg => msg.id);
  
      if (unreadIds.length > 0) {
        socket.emit('message_read', {
          user_id: userID,
          message_ids: unreadIds,
          chat_id: chatId,
          is_group: isGroup
        });
      }
    } catch (err) {
      messagesContainer.innerHTML = `<div>Ошибка загрузки: ${err.message}</div>`;
    }
  }  

  await loadMessages();

  sendBtn.addEventListener('click', async () => {
    const content = input.value.trim();
    if (!content) return;

    try {
      const res = await fetch('http://127.0.0.1:5000/messages_send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: userID,
          ...(isGroup ? { group_id: chatId } : { receiver_id: chatId }),
          content: content
        })
      });

      const result = await res.json();
      if (res.ok) {
        input.value = '';
        await loadMessages();
      } else {
        alert(result.error || 'Ошибка отправки');
      }
    } catch (err) {
      alert('Ошибка сервера: ' + err.message);
    }
  });

  socket.on('message_updated', (event) => {
    const isMyPrivateChat =
      !isGroup &&
      ((event.receiver_id == userID && event.sender_id == chatId) ||
       (event.sender_id == userID && event.receiver_id == chatId));
  
    const isMyGroupChat = isGroup && event.group_id == chatId;
  
    if (isMyPrivateChat || isMyGroupChat) {
      loadMessages();
    }
  });   

  // --- Эмодзи ---
  emojiToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === 'flex' ? 'none' : 'flex';
  });

  emojiPicker.addEventListener('click', (e) => {
    if (e.target.tagName === 'SPAN') {
      input.value += e.target.textContent;
      input.focus();
    }
  });

  // --- Контекстное меню и редактирование ---
  function hideContextMenu() {
    if (activeMessage) {
      activeMessage.style.marginBottom = '';
      activeMessage.classList.remove('active');
      activeMessage = null;
    }
    contextMenu.style.opacity = '0';
    contextMenu.style.transform = 'translateY(-5px)';
    contextMenu.style.visibility = 'hidden';
    setTimeout(() => {
      contextMenu.style.display = 'none';
    }, 200);
  }

  messagesContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const messageEl = e.target.closest('.message');
    if (messageEl && messageEl.classList.contains('outgoing')) {
      if (activeMessage) {
        activeMessage.style.marginBottom = '';
        activeMessage.classList.remove('active');
      }
      activeMessage = messageEl;
      messageEl.classList.add('active');

      contextMenu.style.display = 'flex';
      contextMenu.style.position = 'absolute';
      contextMenu.style.left = '-9999px';
      const menuHeight = contextMenu.offsetHeight;

      messageEl.style.marginBottom = `${menuHeight}px`;

      const rect = messageEl.getBoundingClientRect();
      contextMenu.style.position = 'fixed';
      contextMenu.style.left = `${rect.right - 80}px`;
      contextMenu.style.top = `${rect.bottom + 5}px`;

      contextMenu.style.opacity = '1';
      contextMenu.style.transform = 'translateY(0)';
      contextMenu.style.visibility = 'visible';
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('.message.active')) {
      hideContextMenu();
    }
  });

  document.getElementById('deleteMessage').addEventListener('click', async () => {
    if (!activeMessage) return;
    const messageId = activeMessage.dataset.messageId;

    try {
      await fetch(`http://127.0.0.1:5000/messages/${messageId}`, {
        method: 'DELETE'
      });
      await loadMessages();
      hideContextMenu();
    } catch (err) {
      alert('Ошибка удаления');
    }
  });

  document.getElementById('editMessage').addEventListener('click', async () => {
    if (!activeMessage) return;
    const messageId = activeMessage.dataset.messageId;
    const oldText = activeMessage.textContent.trim();
    const newText = prompt('Изменить сообщение:', oldText);

    if (newText !== null && newText !== oldText) {
      try {
        await fetch(`http://127.0.0.1:5000/messages/${messageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newText })
        });
        await loadMessages();
      } catch (err) {
        alert('Ошибка редактирования');
      }
    }
  });

  document.querySelector('.back-icon').addEventListener('click', () => {
    window.location.href = 'chats.html';
  });

  contextMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});