/**
 * Функционал для поиска пользователей
 */

// Объявление глобальных переменных
let searchTimeout;
let currentSearchOffset = 0;
let currentSearchQuery = '';
let isLoadingMore = false;
let hasMoreResults = false;

/**
 * Инициализация функционала поиска пользователей
 * @param {Object} options - Настройки поиска
 * @param {HTMLElement} options.searchInput - Поле ввода поиска
 * @param {HTMLElement} options.resultsContainer - Контейнер для результатов
 * @param {HTMLElement} options.loadingIndicator - Индикатор загрузки
 * @param {Function} options.onUserSelected - Функция обработки выбора пользователя
 */
function initUserSearch(options) {
    const {
        searchInput,
        resultsContainer,
        loadingIndicator,
        onUserSelected
    } = options;

    if (!searchInput || !resultsContainer) {
        console.error('Необходимые элементы для поиска не найдены');
        return;
    }

    // Обработка ввода в поле поиска
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        // Сбрасываем предыдущий таймер
        clearTimeout(searchTimeout);
        
        // Сбрасываем состояние поиска при новом запросе
        if (query !== currentSearchQuery) {
            currentSearchOffset = 0;
            currentSearchQuery = query;
            hasMoreResults = false;
        }
        
        // Если запрос пустой, показываем сообщение
        if (query.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Введите имя пользователя для поиска</div>';
            return;
        }
        
        // Если запрос слишком короткий, не выполняем поиск
        if (query.length < 2) {
            resultsContainer.innerHTML = '<div class="no-results">Введите минимум 2 символа</div>';
            return;
        }
        
        // Устанавливаем таймер для предотвращения частых запросов
        searchTimeout = setTimeout(() => {
            performSearch(query, 0, true);
        }, 500);
    });

    // Обработка прокрутки для загрузки дополнительных результатов
    resultsContainer.addEventListener('scroll', function() {
        if (isLoadingMore || !hasMoreResults) return;
        
        // Проверяем, подошли ли мы к концу списка
        const scrollPos = this.scrollTop + this.clientHeight;
        const scrollHeight = this.scrollHeight;
        
        // Если мы прокрутили до конца (с небольшим запасом)
        if (scrollHeight - scrollPos < 50 && currentSearchQuery) {
            performSearch(currentSearchQuery, currentSearchOffset);
        }
    });

    /**
     * Выполнение поиска пользователей
     * @param {string} query - Поисковый запрос
     * @param {number} offset - Смещение для пагинации
     * @param {boolean} clearResults - Очистить ли предыдущие результаты
     */
    function performSearch(query, offset = 0, clearResults = false) {
        if (clearResults) {
            resultsContainer.innerHTML = '';
        }
        
        // Показываем индикатор загрузки
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        isLoadingMore = true;
        
        fetch(`/api/user/search?query=${encodeURIComponent(query)}&offset=${offset}&limit=20`)
            .then(response => response.json())
            .then(data => {
                // Скрываем индикатор загрузки
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                if (!data.success) {
                    if (clearResults) {
                        resultsContainer.innerHTML = `<div class="no-results">Ошибка: ${data.message}</div>`;
                    }
                    return;
                }
                
                if (data.users.length === 0 && clearResults) {
                    resultsContainer.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
                    return;
                }
                
                // Обновляем состояние поиска
                currentSearchOffset = offset + data.users.length;
                hasMoreResults = data.has_more;
                
                // Отображаем результаты поиска
                let resultsHTML = clearResults ? '' : resultsContainer.innerHTML;
                
                // Удаляем сообщение о результатах, если оно есть
                if (clearResults && resultsContainer.querySelector('.no-results')) {
                    resultsContainer.querySelector('.no-results').remove();
                }
                
                data.users.forEach(user => {
                    resultsHTML += `
                        <div class="user-item" data-user-id="${user.id}" data-nickname="${user.nickname}">
                            <div class="user-avatar-small">
                                <img src="/api/user/photo/${user.id}" onerror="this.src='/static/images/avatar.png'" alt="${user.nickname}">
                            </div>
                            <div class="user-info-compact">
                                <div class="user-name-compact">${user.nickname}</div>
                                <div class="user-email-compact">ID: ${user.id}${user.email ? ' | ' + user.email : ''}</div>
                            </div>
                        </div>
                    `;
                });
                
                resultsContainer.innerHTML = resultsHTML;
                
                // Добавляем обработчики событий для каждого пользователя
                document.querySelectorAll('.user-item').forEach(item => {
                    // Удаляем существующие обработчики, чтобы избежать дублирования
                    const clonedItem = item.cloneNode(true);
                    item.parentNode.replaceChild(clonedItem, item);
                    
                    // Добавляем новый обработчик
                    clonedItem.addEventListener('click', function() {
                        const userData = {
                            id: this.dataset.userId,
                            nickname: this.dataset.nickname
                        };
                        
                        if (typeof onUserSelected === 'function') {
                            onUserSelected(userData);
                        }
                    });
                });
                
                isLoadingMore = false;
            })
            .catch(error => {
                console.error('Error searching users:', error);
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                if (clearResults) {
                    resultsContainer.innerHTML = '<div class="no-results">Ошибка при выполнении поиска</div>';
                }
                isLoadingMore = false;
            });
    }
}
