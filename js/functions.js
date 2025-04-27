import { setUser } from './global.js';

async function login() {
  const loginInput = document.getElementById('loginInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const errorMessage = document.getElementById('error-message');
  errorMessage.textContent = ''; // очистить прошлую ошибку

  if (!loginInput || !password) {
    errorMessage.textContent = "Enter your login and password";
    return;
  }

  const data = {
    email: loginInput,
    password: password
  };

  try {
    const response = await fetch('http://127.0.0.1:5000/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      setUser(result.name, result.email, result.user_id);
      errorMessage.textContent = '';
      alert(`Welcome, ${result.name}!`);
      window.location.href = 'chats.html';
    } else {
      errorMessage.textContent = "Username (email) or password is incorrect";
    }
  } catch (err) {
    errorMessage.textContent = "Server error: " + err.message;
  }
}

window.login = login;

async function register() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    const errorBox = document.getElementById('reg-error-message');
  
    errorBox.textContent = '';
  
    if (!name || !email || !password || !confirm) {
      errorBox.textContent = 'All fields are required.';
      return;
    }
  
    if (password !== confirm) {
      errorBox.textContent = 'Passwords do not match.';
      return;
    }
  
    const data = {
      name: name,
      email: email,
      password: password
    };
  
    try {
      const res = await fetch('http://127.0.0.1:5000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
  
      const result = await res.json();
  
      if (res.ok) {
        alert('Registration successful!');
        window.location.href = 'index.html'; // перейти на логин
      } else {
        errorBox.textContent = result.error || 'Registration failed.';
      }
    } catch (err) {
      errorBox.textContent = 'Server error: ' + err.message;
    }
  }
  
  window.register = register;  

  import { userID } from './global.js';

  const userId = userID;

  export async function loadChats(container) {
    container.innerHTML = '';
  
    try {
      console.log('userID:', userID);
      const [friendsRes, groupsRes, communitiesRes, communityGroupsRes] = await Promise.all([
        fetch(`http://localhost:5000/friends?user_id=${userId}`),
        fetch(`http://localhost:5000/groups_user?user_id=${userId}`),
        fetch(`http://localhost:5000/communities_user?user_id=${userId}`),
        fetch(`http://localhost:5000/community_groups_all`)
      ]);
  
      const friends = await friendsRes.json();
      const groups = await groupsRes.json();
      const communities = await communitiesRes.json();
      const communityGroups = await communityGroupsRes.json();
  
      // Extract group IDs that are part of any community
      const communityGroupIds = communityGroups.map(cg => cg.group_id);
  
      // Filter groups to exclude those in communities
      const filteredGroups = groups.filter(group => !communityGroupIds.includes(group.id));
  
      friends.forEach(friend => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.innerHTML = `
          <img class="avatar" src="../png/i5.webp" alt="Avatar">
          <div class="chat-box">
            <span>${friend.name}</span>
          </div>
        `;
        item.addEventListener('click', () => {
          window.location.href = `chat.html?chat_id=${friend.id}&is_group=0`;
        });
        container.appendChild(item);
      });
  
      filteredGroups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.innerHTML = `
          <img class="avatar" src="../png/i3.webp" alt="Group">
          <div class="chat-box">
            <span>${group.name}</span>
          </div>
        `;
        item.addEventListener('click', () => {
          window.location.href = `chat.html?chat_id=${group.id}&is_group=1`;
        });
        container.appendChild(item);
      });
  
      communities.forEach(community => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.innerHTML = `
          <img class="avatar" src="png/i4.webp" alt="Community">
          <div class="chat-box">
            <span>${community.name}</span>
          </div>
        `;
        item.addEventListener('click', () => {
          window.location.href = `Community.html?community_id=${community.id}`;
        });
        container.appendChild(item);
      });
  
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  }

export function setupAddContact(cancelSelector, saveSelector, inputSelector) {
  const cancelButton = document.querySelector(cancelSelector);
  const saveButton = document.querySelector(saveSelector);
  const inputField = document.querySelector(inputSelector);

  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      window.location.href = 'chats.html';
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      const name = inputField.value.trim();
      if (!name) {
        alert('Please enter a name');
        return;
      }

      try {
        // Получить список пользователей
        const res = await fetch('http://127.0.0.1:5000/users');
        const users = await res.json();

        // Найти пользователя по имени
        const friend = users.find(u => u.name.toLowerCase() === name.toLowerCase());
        if (!friend) {
          alert('User not found');
          return;
        }

        if (friend.id == userID) {
          alert('You cannot add yourself as a friend!');
          return;
        }

        // Отправить запрос на добавление друга
        const addRes = await fetch('http://127.0.0.1:5000/friends_add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userID, friend_id: friend.id })
        });

        const result = await addRes.json();

        if (addRes.ok) {
          alert('Friend added!');
          window.location.href = 'chats.html';
        } else {
          alert(result.error || 'Failed to add friend');
        }
      } catch (err) {
        alert('Server error: ' + err.message);
      }
    });
  }
}