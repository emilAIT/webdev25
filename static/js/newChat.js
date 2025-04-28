/**
 * Функционал для поиска и создания новых чатов
 */

document.addEventListener('DOMContentLoaded', function() {
    // Получаем элементы
    const newChatBtn = document.getElementById('new-chat-btn');
    const newChatMainBtn = document.getElementById('new-chat-main-btn');
    const modalOverlay = document.getElementById('new-chat-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCreateBtn = document.getElementById('modal-create-btn');
    const userSearchInput = document.getElementById('user-search-input');
    const searchResults = document.getElementById('search-results');
    const searchLoading = document.getElementById('search-loading');
    
    // Проверяем наличие элементов
    if (!newChatBtn || !modalOverlay) {
        console.error('Необходимые элементы не найдены');
        return;
    }
    
    // Открытие модального окна
    function openModal() {
        modalOverlay.classList.add('active');
        setTimeout(() => {
            userSearchInput.focus();
        }, 300);
    }
    
    // Закрытие модального окна
    function closeModal() {
        modalOverlay.classList.remove('active');
        // Очищаем поле поиска и результаты
        userSearchInput.value = '';
        searchResults.innerHTML = '<div class="no-results">Введите имя пользователя для поиска</div>';
    }
    
    // Обработчики событий для кнопок открытия/закрытия
    newChatBtn?.addEventListener('click', openModal);
    newChatMainBtn?.addEventListener('click', openModal);
    modalCloseBtn?.addEventListener('click', closeModal);
    
    // Закрытие модального окна при клике вне его содержимого
    modalOverlay?.addEventListener('click', function(event) {
        if (event.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Создание чата с выбранным пользователем
    async function createChat(userId, nickname) {
        try {
            const response = await fetch('/api/chat/create_dialog', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`Чат с пользователем ${nickname} успешно создан!`);
                closeModal();
                // В реальном приложении здесь нужно будет перенаправить на страницу чата
                // или обновить список чатов
                location.reload();  // Временное решение - перезагрузка страницы
            } else {
                alert(`Ошибка: ${data.message}`);
            }
        } catch (error) {
            console.error('Error creating chat:', error);
            alert('Произошла ошибка при создании чата');
        }
    }
    
    // Поиск пользователей при вводе
    let searchTimeout;
    userSearchInput?.addEventListener('input', function() {
        const query = this.value.trim();
        
        // Очищаем предыдущий таймер
        clearTimeout(searchTimeout);
        
        // Если запрос пустой, показываем сообщение
        if (query.length === 0) {
            searchResults.innerHTML = '<div class="no-results">Введите имя пользователя для поиска</div>';
            return;
        }
        
        // Если запрос слишком короткий, не выполняем поиск
        if (query.length < 2) {
            searchResults.innerHTML = '<div class="no-results">Введите минимум 2 символа</div>';
            return;
        }
        
        // Устанавливаем таймер для предотвращения частых запросов
        searchTimeout = setTimeout(async function() {
            // Показываем индикатор загрузки
            searchLoading.style.display = 'block';
            searchResults.style.display = 'none';
            
            try {
                const response = await fetch(`/api/user/search?query=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                // Скрываем индикатор загрузки
                searchLoading.style.display = 'none';
                searchResults.style.display = 'block';
                
                if (!data.success) {
                    searchResults.innerHTML = `<div class="no-results">Ошибка: ${data.message}</div>`;
                    return;
                }
                
                if (data.users.length === 0) {
                    searchResults.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
                    return;
                }
                
                // Отображаем результаты поиска
                let resultsHTML = '';
                data.users.forEach(user => {
                    resultsHTML += `
                        <div class="user-item" data-user-id="${user.id}" data-nickname="${user.nickname}">
                            <div class="user-avatar-small">
                                <img src="/api/user/photo/${user.id}" onerror="this.src='/static/images/avatar.png'" alt="${user.nickname}">
                            </div>
                            <div class="user-info-compact">
                                <div class="user-name-compact">${user.nickname}</div>
                                <div class="user-email-compact">ID: ${user.id}</div>
                            </div>
                        </div>
                    `;
                });
                searchResults.innerHTML = resultsHTML;
                
                // Добавляем обработчики событий для каждого пользователя
                document.querySelectorAll('.user-item').forEach(item => {
                    item.addEventListener('click', function() {
                        const userId = this.dataset.userId;
                        const nickname = this.dataset.nickname;
                        createChat(userId, nickname);
                    });
                });
                
            } catch (error) {
                console.error('Error searching users:', error);
                searchLoading.style.display = 'none';
                searchResults.style.display = 'block';
                searchResults.innerHTML = '<div class="no-results">Ошибка при выполнении поиска</div>';
            }
        }, 500);
    });
    
    // Обработчик кнопки "Создать"
    modalCreateBtn?.addEventListener('click', function() {
        // Можно добавить дополнительные действия при создании чата
        const selectedUser = document.querySelector('.user-item.selected');
        if (selectedUser) {
            const userId = selectedUser.dataset.userId;
            const nickname = selectedUser.dataset.nickname;
            createChat(userId, nickname);
        } else {
            alert('Пожалуйста, выберите пользователя из списка');
        }
    });
});
