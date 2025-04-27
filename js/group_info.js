document.addEventListener('DOMContentLoaded', function() {
    const groupId = new URLSearchParams(window.location.search).get('group_id');
    if (!groupId) {
      alert('Group ID not provided');
      window.location.href = 'chats.html';
      return;
    }
  
    // Load group information
    fetch(`http://localhost:5000/groups/${groupId}`)
      .then(response => response.json())
      .then(group => {
        document.getElementById('groupAvatar').src = group.avatar_url || 'png/default_group.png';
        document.getElementById('renameInput').value = group.name;
        document.getElementById('memberCount').textContent = `${group.members.length} members`;
        const memberList = document.getElementById('memberList');
        memberList.innerHTML = '';
        group.members.forEach(member => {
          const memberDiv = document.createElement('div');
          memberDiv.className = 'member-item';
          memberDiv.innerHTML = `
            <img src="${member.avatar_url || 'png/default_user.png'}" alt="Avatar" class="avatar">
            <span>${member.name}</span>
          `;
          memberList.appendChild(memberDiv);
        });
      })
      .catch(error => console.error('Error loading group info:', error));
  
    // Handle "retitle" field
    document.getElementById('renameInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        const newName = this.value.trim();
        if (newName) {
          fetch('http://localhost:5000/groups_edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group_id: groupId, name: newName })
          })
          .then(response => response.json())
          .then(data => {
            if (data.message === 'Group updated') {
              alert('Group name updated');
            } else {
              alert('Failed to update group name');
            }
          })
          .catch(error => console.error('Error updating group name:', error));
        }
      }
    });
  
    // Handle "exit from group" button
    document.getElementById('exitBtn').addEventListener('click', function() {
      if (confirm('Are you sure you want to exit the group?')) {
        fetch('http://localhost:5000/group_members_remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: groupId, user_id: userID }) // Assume userID is globally available
        })
        .then(response => response.json())
        .then(data => {
          if (data.message === 'Member removed') {
            alert('You have exited the group');
            window.location.href = 'chats.html';
          } else {
            alert('Failed to exit the group');
          }
        })
        .catch(error => console.error('Error exiting group:', error));
      }
    });
  
    // Handle "back" icon
    document.getElementById('backIcon').addEventListener('click', function() {
      window.location.href = `chat.html?chat_id=${groupId}&is_group=1`;
    });
  
    // Handle "plus" icon (placeholder for future functionality)
    document.getElementById('addIcon').addEventListener('click', function() {
      alert('Add functionality to be implemented later');
    });
  });