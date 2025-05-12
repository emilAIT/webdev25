const API_URL = window.location.origin;
const token = localStorage.getItem("admin_token");

if (!token) {
    // Показываем форму входа, если нет токена
    showLoginForm();
} else {
    // Загружаем данные администратора
    loadAdminData();
}

function showLoginForm() {
    document.body.innerHTML = `
        <div class="admin-container">
            <h2>Вход в админ-панель</h2>
            <div class="add-admin-form">
                <div class="form-group">
                    <label for="adminUsername">Имя пользователя</label>
                    <input type="text" id="adminUsername" required>
                </div>
                <div class="form-group">
                    <label for="adminPassword">Пароль</label>
                    <input type="password" id="adminPassword" required>
                </div>
                <button onclick="login()">Войти</button>
            </div>
        </div>
    `;
}

async function login() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    if (username === 'admin' && password === 'admin') {
        localStorage.setItem('admin_token', 'admin_session');
        window.location.reload();
    } else {
        alert('Неверные учетные данные');
    }
}

let userActivityChart = null;
let translationChart = null;

async function loadCharts() {
    try {
        // Загрузка данных для графиков
        const [activityData, translationStats] = await Promise.all([
            fetch(`${API_URL}/admin/stats/user-activity`).then(r => r.json()),
            fetch(`${API_URL}/admin/stats/translations`).then(r => r.json())
        ]);

        // График активности пользователей
        const ctx1 = document.getElementById('userActivityChart').getContext('2d');
        if (userActivityChart) userActivityChart.destroy();
        userActivityChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: activityData.dates,
                datasets: [{
                    label: 'Активные пользователи',
                    data: activityData.counts,
                    borderColor: '#007bff',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // График статистики переводов
        const ctx2 = document.getElementById('translationChart').getContext('2d');
        if (translationChart) translationChart.destroy();
        translationChart = new Chart(ctx2, {
            type: 'pie',
            data: {
                labels: ['Переведено', 'Без перевода'],
                datasets: [{
                    data: [translationStats.translated, translationStats.not_translated],
                    backgroundColor: ['#28a745', '#dc3545']
                }]
            }
        });

    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

async function loadUsers() {
    try {
        const users = await fetch(`${API_URL}/admin/users`).then(r => r.json());
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.message_count}</td>
                <td>${user.last_activity ? new Date(user.last_activity).toLocaleString() : 'Нет активности'}</td>
                <td>
                    <button class="delete-btn" onclick="deleteUser(${user.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function deleteUser(userId) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Пользователь успешно удален');
            loadUsers();
            loadAdminData();
            loadCharts();
        } else {
            throw new Error('Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Ошибка при удалении пользователя');
    }
}

async function loadAdminData() {
    try {
        const [usersCount, messagesCount, groupsCount] = await Promise.all([
            fetch(`${API_URL}/admin/stats/users`).then(r => r.json()),
            fetch(`${API_URL}/admin/stats/messages`).then(r => r.json()),
            fetch(`${API_URL}/admin/stats/groups`).then(r => r.json())
        ]);

        document.getElementById('totalUsers').textContent = usersCount.count;
        document.getElementById('totalMessages').textContent = messagesCount.count;
        document.getElementById('totalGroups').textContent = groupsCount.count;

        await Promise.all([
            loadCharts(),
            loadUsers()
        ]);

        // Загрузка списка администраторов
        const admins = await fetch(`${API_URL}/admin/list`).then(r => r.json());
        const tbody = document.querySelector('#adminsTable tbody');
        tbody.innerHTML = admins.map(admin => `
            <tr>
                <td>${admin.id}</td>
                <td>${admin.username}</td>
                <td>${new Date(admin.created_at).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading admin data:', error);
        alert('Ошибка загрузки данных');
    }
}

async function addNewAdmin() {
    const username = document.getElementById('newAdminUsername').value;
    const password = document.getElementById('newAdminPassword').value;

    try {
        const response = await fetch(`${API_URL}/admin/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            alert('Администратор успешно добавлен');
            loadAdminData();
        } else {
            throw new Error('Failed to add admin');
        }
    } catch (error) {
        console.error('Error adding admin:', error);
        alert('Ошибка при добавлении администратора');
    }
}