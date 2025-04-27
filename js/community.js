import { userID } from './global.js';
const userId = userID;

async function loadGroups() {
  const params = new URLSearchParams(window.location.search);
  const communityId = params.get('community_id');
  const groupList = document.getElementById('groupList');

  try {
    const response = await fetch(`http://localhost:5000/community_groups/${communityId}`);
    const groups = await response.json();

    groupList.innerHTML = '';

    groups.forEach(group => {
      const item = document.createElement('div');
      item.className = 'chat-item';
      item.innerHTML = `
        <img class="avatar" src="png/image%2011.png" alt="Group">
        <div class="chat-box">
          <span>${group.name}</span>
        </div>
        <div class="context-menu">
          <button class="edit-btn">edit</button>
          <button class="delete-btn">delete</button>
        </div>
      `;
      item.querySelector('.chat-box').addEventListener('click', () => {
        window.location.href = `chat.html?chat_id=${group.id}&is_group=1`;
      });

      const editBtn = item.querySelector('.edit-btn');
      const deleteBtn = item.querySelector('.delete-btn');

      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Edit group name:', group.name);
        if (newName && newName !== group.name) {
          fetch('http://localhost:5000/groups_edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group_id: group.id, name: newName })
          }).then(() => loadGroups());
        }
      });

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this group from community?')) {
          fetch('http://localhost:5000/community_groups_delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ community_id: communityId, group_id: group.id })
          }).then(() => loadGroups());
        }
      });

      groupList.appendChild(item);
    });

  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadGroups();
  document.querySelector('.back-icon').addEventListener('click', () => {
    window.location.href = 'chats.html';
  });

  document.querySelectorAll('.chat-item').forEach(chatItem => {
    const chatBox = chatItem.querySelector('.chat-box');
    const contextMenu = chatItem.querySelector('.context-menu');
    let pressTimer;
    let isContextMenuVisible = false;

    function showMenu(event) {
      document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
      });
      chatItem.classList.add('active');
      isContextMenuVisible = true;

      if (event && event.type === 'contextmenu') {
        event.preventDefault();
        contextMenu.style.left = 'calc(100% - 65px)';
        contextMenu.style.top = '0';
        contextMenu.style.transform = 'translateX(0)';
      }
    }

    function hideMenu() {
      chatItem.classList.remove('active');
      isContextMenuVisible = false;
    }

    chatBox.addEventListener('touchstart', function(e) {
      e.preventDefault();
      pressTimer = setTimeout(() => showMenu(e), 500);
    }, { passive: false });

    chatBox.addEventListener('touchend', function(e) {
      clearTimeout(pressTimer);
      if (isContextMenuVisible) {
        e.preventDefault();
        hideMenu();
      }
    }, { passive: false });

    chatBox.addEventListener('touchmove', function() {
      clearTimeout(pressTimer);
    });

    chatBox.addEventListener('contextmenu', function(e) {
      showMenu(e);
    });

    document.addEventListener('click', function(e) {
      if (!chatItem.contains(e.target) && !e.target.closest('.context-menu')) {
        hideMenu();
      }
    });

    document.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', hideMenu);
  });
});