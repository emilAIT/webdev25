document.addEventListener('DOMContentLoaded', function() {
    // Элементы UI
    const tabLinks = document.querySelectorAll('.admin-nav-link[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Счетчики статистики
    const usersCountElement = document.getElementById('users-count');
    const messagesCountElement = document.getElementById('messages-count');
    const chatsCountElement = document.getElementById('chats-count');
    const groupsCountElement = document.getElementById('groups-count');
    const activeUsersElement = document.getElementById('active-users');
    const messagesTodayElement = document.getElementById('messages-today');
    
    // Графики
    let messagesChart = null;
    
    // Таблицы
    const usersTable = document.getElementById('users-table').querySelector('tbody');
    const messagesTable = document.getElementById('messages-table').querySelector('tbody');
    const groupsTable = document.getElementById('groups-table').querySelector('tbody');
    
    // Пагинация
    const usersPagination = document.getElementById('users-pagination');
    const messagesPagination = document.getElementById('messages-pagination');
    const groupsPagination = document.getElementById('groups-pagination');
    
    // Поиск
    const userSearchInput = document.getElementById('user-search');
    const userSearchBtn = document.getElementById('user-search-btn');
    const groupSearchInput = document.getElementById('group-search');
    const groupSearchBtn = document.getElementById('group-search-btn');
    
    // Модальные окна
    const editUserModal = document.getElementById('edit-user-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const editUserError = document.getElementById('edit-user-error');
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    const confirmDeleteMessage = document.getElementById('confirm-delete-message');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    
    // Состояние приложения
    let currentTab = 'dashboard';
    let currentUsersPage = 1;
    let currentMessagesPage = 1;
    let currentGroupsPage = 1;
    let userSearchQuery = '';
    let groupSearchQuery = '';
    let deleteCallback = null;
    
    // Инициализация
    initTabs();
    loadStats();
    
    // Слушатели событий
    document.getElementById('refreshStats').addEventListener('click', loadStats);
    
    userSearchBtn.addEventListener('click', () => {
        userSearchQuery = userSearchInput.value.trim();
        currentUsersPage = 1;
        loadUsers();
    });
    
    userSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            userSearchQuery = userSearchInput.value.trim();
            currentUsersPage = 1;
            loadUsers();
        }
    });
    
    groupSearchBtn.addEventListener('click', () => {
        groupSearchQuery = groupSearchInput.value.trim();
        currentGroupsPage = 1;
        loadGroups();
    });
    
    groupSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            groupSearchQuery = groupSearchInput.value.trim();
            currentGroupsPage = 1;
            loadGroups();
        }
    });
    
    // Модальные окна
    document.querySelectorAll('.modal-close, .close-modal').forEach(button => {
        button.addEventListener('click', () => {
            editUserModal.style.display = 'none';
            confirmDeleteModal.style.display = 'none';
        });
    });
    
    editUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        updateUser();
    });
    
    confirmDeleteBtn.addEventListener('click', () => {
        if (deleteCallback) deleteCallback();
        confirmDeleteModal.style.display = 'none';
    });
    
    // ====== Функции ======
    
    // Инициализация табов
    function initTabs() {
        tabLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const tab = link.getAttribute('data-tab');
                if (!tab) return;
                
                // Убираем активный класс со всех табов и ссылок
                tabLinks.forEach(l => l.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Делаем текущий таб и ссылку активными
                link.classList.add('active');
                document.getElementById(tab).classList.add('active');
                
                currentTab = tab;
                
                // Загружаем данные для таба
                switch (tab) {
                    case 'dashboard':
                        loadStats();
                        break;
                    case 'users':
                        loadUsers();
                        break;
                    case 'messages':
                        loadMessages();
                        break;
                    case 'groups':
                        loadGroups();
                        break;
                }
            });
        });
    }
    
    // Загрузка статистики
    function loadStats() {
        fetch('/api/admin/stats')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateStats(data.stats);
                    updateCharts(data.stats);
                }
            })
            .catch(error => {
                console.error('Ошибка при загрузке статистики:', error);
            });
    }
    
    // Обновление статистики
    function updateStats(stats) {
        usersCountElement.textContent = stats.users_count;
        messagesCountElement.textContent = stats.messages_count;
        chatsCountElement.textContent = stats.chats_count;
        groupsCountElement.textContent = stats.groups_count;
        activeUsersElement.textContent = stats.active_users;
        messagesTodayElement.textContent = stats.messages_today;
    }
    
    // Обновление графиков
    function updateCharts(stats) {
        const ctx = document.getElementById('messagesChart').getContext('2d');
        
        // Уничтожаем предыдущий график, если он существует
        if (messagesChart) messagesChart.destroy();
        
        // Получаем данные из статистики
        const labels = stats.daily_messages.map(item => item.date).reverse();
        const data = stats.daily_messages.map(item => item.count).reverse();
        
        // Создаем новый график
        messagesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Количество сообщений',
                    data: data,
                    backgroundColor: '#4a90e2',
                    borderColor: '#4a90e2',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#8a9cc0'
                        },
                        grid: {
                            color: 'rgba(138, 156, 192, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#8a9cc0'
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#8a9cc0'
                        }
                    }
                }
            }
        });
    }
    
    // Загрузка пользователей
    function loadUsers() {
        usersTable.innerHTML = '<tr><td colspan="9" style="text-align: center;">Загрузка...</td></tr>';
        
        const url = `/api/admin/users?page=${currentUsersPage}&q=${encodeURIComponent(userSearchQuery)}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderUsers(data.users);
                    renderPagination(usersPagination, data.pagination, (page) => {
                        currentUsersPage = page;
                        loadUsers();
                    });
                }
            })
            .catch(error => {
                console.error('Ошибка при загрузке пользователей:', error);
                usersTable.innerHTML = '<tr><td colspan="9" style="text-align: center;">Ошибка при загрузке пользователей</td></tr>';
            });
    }
    
    // Отображение пользователей
    function renderUsers(users) {
        if (!users || users.length === 0) {
            usersTable.innerHTML = '<tr><td colspan="9" style="text-align: center;">Пользователи не найдены</td></tr>';
            return;
        }
        
        usersTable.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            const statusIndicator = user.is_active 
                ? '<span class="status-indicator status-active"></span> Активен' 
                : '<span class="status-indicator status-inactive"></span> Заблокирован';
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td><img src="${user.photo_url || '/static/images/default-profile.png'}" alt="Фото" style="width: 30px; height: 30px; border-radius: 50%;"></td>
                <td>${user.nickname}</td>
                <td>${user.email}</td>
                <td>${user.created_at}</td>
                <td>${user.message_count}</td>
                <td>

                </td>
            `;
            
            // Добавляем обработчики для кнопок
        
            
            usersTable.appendChild(row);
        });
    }
    
    // Загрузка сообщений
    function loadMessages() {
        messagesTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">Загрузка...</td></tr>';
        
        fetch(`/api/admin/messages?page=${currentMessagesPage}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderMessages(data.messages);
                    renderPagination(messagesPagination, data.pagination, (page) => {
                        currentMessagesPage = page;
                        loadMessages();
                    });
                }
            })
            .catch(error => {
                console.error('Ошибка при загрузке сообщений:', error);
                messagesTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">Ошибка при загрузке сообщений</td></tr>';
            });
    }
    
    // Отображение сообщений
    function renderMessages(messages) {
        if (!messages || messages.length === 0) {
            messagesTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">Сообщения не найдены</td></tr>';
            return;
        }
        
        messagesTable.innerHTML = '';
        
        messages.forEach(message => {
            const row = document.createElement('tr');
            
            let chatInfo = 'Нет данных';
            if (message.chat) {
                if (message.chat.type === 'chat') {
                    chatInfo = `Диалог с ${message.chat.recipient}`;
                } else if (message.chat.type === 'group') {
                    chatInfo = `Группа: ${message.chat.name}`;
                }
            }
            
            row.innerHTML = `
                <td>${message.id}</td>
                <td>${message.sender.nickname}</td>
                <td>${message.content}</td>
                <td>${chatInfo}</td>
                <td>${message.created_at}</td>
                <td>

                </td>
            `;
            
            // Добавляем обработчики для кнопок
            
            messagesTable.appendChild(row);
        });
    }
    
    // Загрузка групп
    function loadGroups() {
        groupsTable.innerHTML = '<tr><td colspan="8" style="text-align: center;">Загрузка...</td></tr>';
        
        const url = `/api/admin/groups?page=${currentGroupsPage}&q=${encodeURIComponent(groupSearchQuery)}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderGroups(data.groups);
                    renderPagination(groupsPagination, data.pagination, (page) => {
                        currentGroupsPage = page;
                        loadGroups();
                    });
                }
            })
            .catch(error => {
                console.error('Ошибка при загрузке групп:', error);
                groupsTable.innerHTML = '<tr><td colspan="8" style="text-align: center;">Ошибка при загрузке групп</td></tr>';
            });
    }
    
    // Отображение групп
    function renderGroups(groups) {
        if (!groups || groups.length === 0) {
            groupsTable.innerHTML = '<tr><td colspan="8" style="text-align: center;">Группы не найдены</td></tr>';
            return;
        }
        
        groupsTable.innerHTML = '';
        
        groups.forEach(group => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${group.id}</td>
                <td><img src="${group.photo_url || '/static/images/group-default.png'}" alt="Фото" style="width: 30px; height: 30px; border-radius: 5px;"></td>
                <td>${group.name}</td>
                <td>${group.description || 'Нет описания'}</td>
                <td>${group.member_count}</td>
                <td>${group.message_count}</td>
                <td>${group.created_at}</td>
                <td>
                </td>
            `;
            
     
            
            groupsTable.appendChild(row);
        });
    }
    
    // Отображение пагинации
    function renderPagination(container, pagination, callback) {
        container.innerHTML = '';
        
        if (pagination.pages <= 1) return;
        
        // Кнопка "Предыдущая"
        const prevButton = document.createElement('button');
        prevButton.className = 'pagination-btn';
        prevButton.innerHTML = '&larr;';
        prevButton.disabled = pagination.page === 1;
        prevButton.addEventListener('click', () => {
            if (pagination.page > 1) callback(pagination.page - 1);
        });
        container.appendChild(prevButton);
        
        // Номера страниц
        const maxVisible = 5;
        let startPage = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
        let endPage = Math.min(pagination.pages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `pagination-btn ${i === pagination.page ? 'active' : ''}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                callback(i);
            });
            container.appendChild(pageButton);
        }
        
        // Кнопка "Следующая"
        const nextButton = document.createElement('button');
        nextButton.className = 'pagination-btn';
        nextButton.innerHTML = '&rarr;';
        nextButton.disabled = pagination.page === pagination.pages;
        nextButton.addEventListener('click', () => {
            if (pagination.page < pagination.pages) callback(pagination.page + 1);
        });
        container.appendChild(nextButton);
    }
    
    // Открытие модального окна редактирования пользователя
    function openEditUserModal(user) {
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-nickname').value = user.nickname;
        document.getElementById('edit-user-status').value = user.is_active ? 'active' : 'inactive';
        document.getElementById('edit-user-admin').value = user.is_admin ? 'true' : 'false';
        
        editUserError.style.display = 'none';
        editUserModal.style.display = 'flex';
    }
    
    // Обновление данных пользователя
    function updateUser() {
        const userId = document.getElementById('edit-user-id').value;
        const nickname = document.getElementById('edit-user-nickname').value.trim();
        const isActive = document.getElementById('edit-user-status').value === 'active';
        const isAdmin = document.getElementById('edit-user-admin').value === 'true';
        
        if (!nickname) {
            editUserError.textContent = 'Никнейм не может быть пустым';
            editUserError.style.display = 'block';
            return;
        }
        
        fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nickname: nickname,
                is_active: isActive,
                is_admin: isAdmin
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                editUserModal.style.display = 'none';
                loadUsers(); // Перезагружаем список пользователей
            } else {
                editUserError.textContent = data.message || 'Произошла ошибка при обновлении пользователя';
                editUserError.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Ошибка при обновлении пользователя:', error);
            editUserError.textContent = 'Произошла ошибка при обновлении пользователя';
            editUserError.style.display = 'block';
        });
    }
    
    // Отображение модального окна подтверждения удаления
    function showDeleteConfirmation(message, callback) {
        confirmDeleteMessage.textContent = message;
        deleteCallback = callback;
        confirmDeleteModal.style.display = 'flex';
    }
    
    // Удаление сообщения
    function deleteMessage(messageId) {
        fetch(`/api/admin/messages/${messageId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadMessages(); // Перезагружаем список сообщений
            } else {
                alert(data.message || 'Произошла ошибка при удалении сообщения');
            }
        })
        .catch(error => {
            console.error('Ошибка при удалении сообщения:', error);
            alert('Произошла ошибка при удалении сообщения');
        });
    }
    
    // Удаление группы
    function deleteGroup(groupId) {
        fetch(`/api/admin/groups/${groupId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadGroups(); // Перезагружаем список групп
                loadStats(); // Обновляем статистику
            } else {
                alert(data.message || 'Произошла ошибка при удалении группы');
            }
        })
        .catch(error => {
            console.error('Ошибка при удалении группы:', error);
            alert('Произошла ошибка при удалении группы');
        });
    }
});
