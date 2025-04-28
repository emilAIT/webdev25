// Update dashboard with stats
async function updateDashboard() {
    try {
        const response = await fetch('/api/admin/dashboard-stats');
        if (!response.ok) throw new Error('Failed to fetch dashboard stats');
        const stats = await response.json();

        // Update counters
        document.getElementById('activeUsers').textContent = stats.active_users || 0;
        document.getElementById('messagesSent').textContent = stats.messages_24h || 0;
        document.getElementById('totalUsers').textContent = stats.total_users || 0;

        // Update chart
        updateMessageChart(stats.hourly_stats || []);

        // Update last updated time
        document.getElementById('updateTime').textContent = new Date().toLocaleTimeString();
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

// Initialize chart once
function initCharts() {
    if (window.messageChart) return; // Prevent re-initialization
    const messageCtx = document.getElementById('messageChart').getContext('2d');
    window.messageChart = new Chart(messageCtx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Messages per Hour',
                data: Array(24).fill(0),
                borderColor: '#3b82f6',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// Update message chart
function updateMessageChart(hourlyStats) {
    const data = Array(24).fill(0);
    hourlyStats.forEach(stat => {
        const hour = parseInt(stat.hour);
        if (hour >= 0 && hour < 24) data[hour] = stat.count || 0;
    });

    if (window.messageChart) {
        window.messageChart.data.datasets[0].data = data;
        window.messageChart.update();
    }
}

// Real-time updates with Socket.IO
const socket = io(window.location.origin); // Use dynamic origin
socket.on('dashboardUpdate', (data) => {
    document.getElementById('activeUsers').textContent = data.activeUsers || 0;
    document.getElementById('messagesSent').textContent = data.messagesSent || 0;
    document.getElementById('totalUsers').textContent = data.total_users || 0;
    document.getElementById('updateTime').textContent = new Date().toLocaleTimeString();
});

// Filter and search users
function filterUsers(searchText, filterType) {
    const rows = document.querySelectorAll('#userTable tr');
    rows.forEach(row => {
        const email = row.querySelector('td:nth-child(1)')?.textContent.toLowerCase() || '';
        const name = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
        const status = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';

        const matchesSearch = !searchText ||
            email.includes(searchText.toLowerCase()) ||
            name.includes(searchText.toLowerCase());
        const matchesFilter = filterType === 'all' || status.includes(filterType.toLowerCase());

        row.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        const users = await response.json();
        const userTable = document.getElementById('userTable');
        if (userTable) {
            userTable.innerHTML = users.map(user => `
                <tr class="border-b border-gray-700">
                    <td class="p-2">${user.email}</td>
                    <td class="p-2">${user.first_name || ''} ${user.last_name || ''}</td>
                    <td class="p-2 ${user.action === 'banned' ? 'text-red-400' : 'text-green-400'}">
                        ${user.action.charAt(0).toUpperCase() + user.action.slice(1)}
                    </td>
                    <td class="p-2">${user.last_active ? new Date(user.last_active).toLocaleString() : 'Never'}</td>
                    <td class="p-2 flex flex-wrap gap-2">
                        ${user.action === 'banned'
                            ? `<button onclick="unbanUser(${user.id})" class="bg-green-500 px-2 py-1 rounded hover:bg-green-600 text-sm">Unban</button>`
                            : `<button onclick="banUser(${user.id})" class="bg-red-500 px-2 py-1 rounded hover:bg-red-600 text-sm">Ban</button>`
                        }
                        <button onclick="viewUser(${user.id})" class="bg-blue-500 px-2 py-1 rounded hover:bg-blue-600 text-sm">View</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load chat rooms (groups)
async function loadChatRooms() {
    try {
        const response = await fetch('/api/user-groups');
        if (!response.ok) throw new Error('Failed to fetch groups');
        const groups = await response.json();
        const roomTable = document.getElementById('roomTable');
        if (roomTable) {
            roomTable.innerHTML = groups.map(group => `
                <tr class="border-b border-gray-700">
                    <td class="p-2">${group.name}</td>
                    <td class="p-2">${group.creator_id}</td>
                    <td class="p-2">${group.members?.length || 0}</td>
                    <td class="p-2 text-green-400">Active</td>
                    <td class="p-2 flex flex-wrap gap-2">
                        <button onclick="deleteRoom(${group.id})" class="bg-red-500 px-2 py-1 rounded hover:bg-red-600 text-sm">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading chat rooms:', error);
    }
}

// Ban user
async function banUser(userId) {
    try {
        const response = await fetch(`/api/admin/ban-user/${userId}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to ban user');
        await loadUsers();
        await updateDashboard();
    } catch (error) {
        console.error('Error banning user:', error);
    }
}

// Unban user
async function unbanUser(userId) {
    try {
        const response = await fetch(`/api/admin/unban-user/${userId}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to unban user');
        await loadUsers();
        await updateDashboard();
    } catch (error) {
        console.error('Error unbanning user:', error);
    }
}

// View user profile
async function viewUser(userId) {
    try {
        const response = await fetch(`/api/user/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user profile');
        const user = await response.json();
        alert(`User Profile:\nEmail: ${user.email}\nName: ${user.first_name || ''} ${user.last_name || ''}\nBio: ${user.bio || 'N/A'}\nStatus: ${user.status || 'Offline'}`);
    } catch (error) {
        console.error('Error viewing user:', error);
    }
}

// Delete chat room
async function deleteRoom(groupId) {
    if (!confirm('Are you sure you want to delete this chat room?')) return;
    try {
        const response = await fetch(`/api/group/${groupId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete group');
        await loadChatRooms();
        await updateDashboard();
    } catch (error) {
        console.error('Error deleting chat room:', error);
    }
}

// Save settings (excluding encryption)
async function saveSettings() {
    const settings = {
        allowFileUploads: document.querySelector('#settings input[type="checkbox"]:nth-child(2)')?.checked || false,
        maxMessageLength: document.querySelector('#settings input[type="number"]')?.value || 500,
        theme: document.querySelector('#settings select')?.value || 'dark'
    };

    try {
        const response = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        if (!response.ok) throw new Error('Failed to save settings');
        alert('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings');
    }
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('href').substring(1);
            document.querySelectorAll('main section').forEach(section => {
                section.classList.add('hidden');
            });
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                if (sectionId === 'dashboard' && !window.messageChart) {
                    initCharts();
                } else if (sectionId === 'users') {
                    loadUsers();
                } else if (sectionId === 'chat-rooms') {
                    loadChatRooms();
                }
            }
        });
    });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Show dashboard by default
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.classList.remove('hidden');

    // Setup navigation
    setupNavigation();

    // Initialize components
    initCharts();
    updateDashboard();
    loadUsers();
    loadChatRooms();

    // Update every 30 seconds
    setInterval(updateDashboard, 30000);

    // Search and filter users
    const searchInput = document.querySelector('input[placeholder="Search users..."]');
    const filterSelect = document.querySelector('#users select');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterUsers(e.target.value, filterSelect?.value || 'all');
        });
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            filterUsers(searchInput?.value || '', e.target.value);
        });
    }

    // Search and filter chat rooms
    const roomSearchInput = document.querySelector('input[placeholder="Search rooms..."]');
    const roomFilterSelect = document.querySelector('#chat-rooms select');

    if (roomSearchInput) {
        roomSearchInput.addEventListener('input', (e) => {
            filterChatRooms(e.target.value, roomFilterSelect?.value || 'all');
        });
    }

    if (roomFilterSelect) {
        roomFilterSelect.addEventListener('change', (e) => {
            filterChatRooms(roomSearchInput?.value || '', e.target.value);
        });
    }

    // Settings save button
    const saveButton = document.querySelector('#settings button');
    if (saveButton) {
        saveButton.addEventListener('click', saveSettings);
    }
});

// Filter chat rooms
function filterChatRooms(searchText, filterType) {
    const rows = document.querySelectorAll('#roomTable tr');
    rows.forEach(row => {
        const name = row.querySelector('td:nth-child(1)')?.textContent.toLowerCase() || '';
        const status = row.querySelector('td:nth-child(4)')?.textContent.toLowerCase() || '';

        const matchesSearch = !searchText || name.includes(searchText.toLowerCase());
        const matchesFilter = filterType === 'all' || status.includes(filterType.toLowerCase());

        row.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}