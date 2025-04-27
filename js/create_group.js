import { userID } from './global.js';

const userId = userID;

async function loadFriends() {
  try {
    console.log("Создание группы: userId =", userId);
    const response = await fetch(`http://localhost:5000/friends?user_id=${userId}`);
    const friends = await response.json();
    const list = document.querySelector('.member-list');
    list.innerHTML = '';
    friends.forEach(friend => {
      const div = document.createElement('div');
      div.className = 'member-item';
      div.innerHTML = `
        <img src="png/i5.webp" class="avatar" alt="User Avatar">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" value="${friend.id}" />
          <span class="name">${friend.name}</span>
        </label>
      `;
      list.appendChild(div);
    });
  } catch (error) {
    console.error("Ошибка загрузки друзей:", error);
  }
}

async function createGroup() {
  const name = document.querySelector('.name-of-group').value.trim();
  const selected = Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
  if (!name) {
    alert("Введите название");
    return;
  }
  try {
    const existingGroupsRes = await fetch(`http://localhost:5000/groups`);
    const allGroups = await existingGroupsRes.json();
    const existingGroup = allGroups.find(g => g.name.toLowerCase() === name.toLowerCase());
    if (existingGroup) {
      const userGroupsRes = await fetch(`http://localhost:5000/groups_user?user_id=${userId}`);
      const userGroups = await userGroupsRes.json();
      const alreadyInGroup = userGroups.some(g => g.id === existingGroup.id);
      if (alreadyInGroup) {
        alert("Вы уже в этой группе.");
      } else {
        await fetch('http://localhost:5000/group_members_add', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ group_id: existingGroup.id, user_id: userId })
        });
        await Promise.all(selected.map(friend_id => {
          return fetch('http://localhost:5000/group_members_add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ group_id: existingGroup.id, user_id: friend_id })
          });
        }));
        alert("Вы присоединились к существующей группе!");
      }
      window.location.href = 'chats.html';
      return;
    }
    const res = await fetch('http://localhost:5000/groups_create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name, creator_id: userId })
    });
    const data = await res.json();
    const groupId = data.group_id;
    await Promise.all(selected.map(friend_id => {
      return fetch('http://localhost:5000/group_members_add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ group_id: groupId, user_id: friend_id })
      });
    }));
    alert("Новая группа создана!");
    window.location.href = 'chats.html';
  } catch (error) {
    console.error("Ошибка при создании/присоединении к группе:", error);
    alert("Произошла ошибка.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadFriends();
  document.querySelector('button:last-child').addEventListener('click', createGroup);
  document.querySelector('button:first-child').addEventListener('click', () => {
    window.location.href = 'chats.html';
  });
  document.querySelector('.name-of-member').addEventListener('input', (event) => {
    const filterText = event.target.value.toLowerCase().trim();
    const memberItems = document.querySelectorAll('.member-item');
    memberItems.forEach(item => {
      const name = item.querySelector('.name').textContent.toLowerCase();
      if (filterText === '' || name.includes(filterText)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
});