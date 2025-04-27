import { userID } from './global.js';
const userId = userID;

async function loadGroups() {
  try {
    console.log("Loading groups for community creation: userId =", userId);
    const response = await fetch(`http://localhost:5000/groups_user?user_id=${userId}`);
    const groups = await response.json();

    const list = document.querySelector('.member-list');
    list.innerHTML = '';

    groups.forEach(group => {
      const div = document.createElement('div');
      div.className = 'member-item';
      div.innerHTML = `
        <span class="avatar">👥</span>
        <label>
          <input type="checkbox" value="${group.id}" />
          <span class="name">${group.name}</span>
        </label>
      `;
      list.appendChild(div);
    });
  } catch (error) {
    console.error("Error loading groups:", error);
  }
}

async function createCommunity() {
  const name = document.querySelector('.name-of-group').value.trim();
  const selected = Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);

  if (!name) {
    alert("Please enter a community name");
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/communities_create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name, creator_id: userId, group_ids: selected })
    });

    const data = await res.json();
    if (res.ok) {
      alert("Community created!");
      window.location.href = 'chats.html';
    } else {
      alert(data.error || "Failed to create community");
    }
  } catch (error) {
    console.error("Error creating community:", error);
    alert("Server error.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadGroups();
  document.querySelector('button:last-child').addEventListener('click', createCommunity);
  document.querySelector('button:first-child').addEventListener('click', () => {
    window.location.href = 'chats.html';
  });
});