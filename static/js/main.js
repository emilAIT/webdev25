/**
 * Основной JS файл для функциональности главной страницы
 */

document.addEventListener('DOMContentLoaded', function() {
    // Переменные для элементов интерфейса
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    // Создаем элемент для эффекта вспышки при смене темы
    const flashElement = document.createElement('div');
    flashElement.className = 'theme-flash';
    document.body.appendChild(flashElement);
    
    // Проверяем сохраненную тему
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        themeIcon.src = '/static/images/moon.png';
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        themeIcon.src = '/static/images/sun.png';
    }
    
    // Переключение темы
    themeToggle.addEventListener('click', () => {
        // Активируем эффект вспышки
        flashElement.classList.add('active');
        
        // Переключаем тему
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
        
        // Меняем иконку темы
        if(document.body.classList.contains('dark-theme')) {
            themeIcon.src = '/static/images/moon.png';
            localStorage.setItem('theme', 'dark');
        } else {
            themeIcon.src = '/static/images/sun.png';
            localStorage.setItem('theme', 'light');
        }
        
        // Удаляем класс активности для вспышки
        setTimeout(() => {
            flashElement.classList.remove('active');
        }, 700); // Должно соответствовать продолжительности анимации
    });

    // Функционал мобильного меню
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        sidebar.addEventListener('click', function(e) {
            // Предотвращаем схлопывание при нажатии на элементы внутри
            if (e.target === this || e.target.closest('.user-info')) {
                this.classList.toggle('expanded');
            }
        });

        // Создаем кнопку для показа/скрытия сайдбара
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'sidebar-toggle';
        toggleBtn.innerHTML = '☰';
        document.body.appendChild(toggleBtn);
        
        toggleBtn.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('visible');
        });
        
        // Показываем сайдбар по умолчанию, если нет активного чата
        if (!window.chatModule || !window.chatModule.getCurrentChatId()) {
            document.querySelector('.sidebar').classList.add('visible');
        }
    }

    // Функционал бокового меню опций
    const optionsMenuBtn = document.getElementById('options-menu-btn');
    const chatOptionsMenuBtn = document.getElementById('chat-options-menu-btn');
    const optionsDrawer = document.getElementById('options-drawer');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawerOverlay = document.getElementById('drawer-overlay');
    
    // Открытие бокового меню
    optionsMenuBtn?.addEventListener('click', function() {
        optionsDrawer.classList.add('active');
    });
    
    // Открытие бокового меню при клике на иконку в заголовке чата
    chatOptionsMenuBtn?.addEventListener('click', function() {
        optionsDrawer.classList.add('active');
    });
    
    // Закрытие бокового меню
    function closeDrawer() {
        optionsDrawer.classList.remove('active');
    }
    
    drawerCloseBtn?.addEventListener('click', closeDrawer);
    drawerOverlay?.addEventListener('click', closeDrawer);
    
    // При клике вне меню закрываем его
    document.addEventListener('click', function(event) {
        if (optionsDrawer.classList.contains('active') && 
            !optionsDrawer.contains(event.target) && 
            event.target !== optionsMenuBtn && 
            event.target !== chatOptionsMenuBtn) {
            closeDrawer();
        }
    });
    
    // Обработчики для элементов меню
    document.querySelectorAll('.drawer-item').forEach(item => {
        item.addEventListener('click', function() {
            const action = this.querySelector('.drawer-item-text').textContent;
            switch(action) {
                case 'Shared photos':
                    if (getCurrentChatId()) {
                        openSharedPhotosModal(getCurrentChatId());
                    } else {
                        alert('Сначала выберите чат');
                    }
                    break;
                case 'Shared files':
                    if (getCurrentChatId()) {
                        openSharedFilesModal(getCurrentChatId());
                    } else {
                        alert('Сначала выберите чат');
                    }
                    break;
                case 'Shared links':
                    if (getCurrentChatId()) {
                        openSharedLinksModal(getCurrentChatId());
                    } else {
                        alert('Сначала выберите чат');
                    }
                    break;
                case 'Block user':
                    if(confirm('Вы действительно хотите заблокировать этого пользователя?')) {
                        console.log('User blocked');
                    }
                    break;
            }
            closeDrawer();
        });
    });

    // Кнопка нового чата
    const actionButton = document.querySelector('.action-button');
    if (actionButton) {
        actionButton.addEventListener('click', function() {
            // Открываем модальное окно для выбора пользователя
            const newChatMainBtn = document.getElementById('new-chat-main-btn');
            if (newChatMainBtn) {
                newChatMainBtn.click();
            }
        });
    }

    // Улучшенная функция для обновления URL изображения профиля с новой меткой времени
    function updateProfileImage() {
        const profileImg = document.getElementById('userProfileImage');
        if (profileImg) {
            const timestamp = new Date().getTime();
            const newSrc = `/api/user/photo?t=${timestamp}`;
            
            // Создаем новый объект Image для предварительной загрузки
            const preloadImg = new Image();
            preloadImg.onload = function() {
                profileImg.src = newSrc;
            };
            preloadImg.onerror = function() {
                profileImg.src = '/static/images/avatar.png';
            };
            preloadImg.src = newSrc;
        }
    }
    
    // Обновляем изображение при загрузке страницы
    updateProfileImage();
    
    // Также обновляем при нажатии на кнопку обновления
    const refreshIcon = document.querySelector('.refresh-icon');
    if (refreshIcon) {
        refreshIcon.addEventListener('click', function() {
            updateProfileImage();
            // Также обновляем список чатов
            if (window.chatModule) {
                window.chatModule.updateChatsList();
            }
        });
    }

    // Инициализация функционала поиска пользователей для нового чата
    const userSearchInput = document.getElementById('user-search-input');
    const searchResults = document.getElementById('search-results');
    const searchLoading = document.getElementById('search-loading');

    if (typeof initUserSearch === 'function' && userSearchInput && searchResults) {
        initUserSearch({
            searchInput: userSearchInput,
            resultsContainer: searchResults,
            loadingIndicator: searchLoading,
            onUserSelected: async function(userData) {
                try {
                    // Создаем чат с выбранным пользователем
                    const response = await fetch('/api/chat/create_dialog', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ user_id: userData.id })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Закрываем модальное окно
                        const modalOverlay = document.getElementById('new-chat-modal');
                        if (modalOverlay) {
                            modalOverlay.classList.remove('active');
                        }
                        
                        // Обновляем список чатов
                        if (window.chatModule) {
                            await window.chatModule.updateChatsList();
                            
                            // Открываем созданный чат
                            window.chatModule.openChat(
                                data.chat_id, 
                                'dialog',
                                userData.nickname
                            );
                        } else {
                            // Если модуль чата не инициализирован, просто перезагружаем страницу
                            location.reload();
                        }
                    } else {
                        alert(`Ошибка: ${data.message}`);
                    }
                } catch (error) {
                    console.error('Error creating chat:', error);
                    alert('Произошла ошибка при создании чата');
                }
            }
        });
    }
    
    // Инициализация компонента чата
    if (window.chatModule && typeof window.chatModule.initChatComponent === 'function') {
        window.chatModule.initChatComponent();
        
        // Проверяем был ли выбран чат ранее (например, сохраненный в localStorage)
        const lastChatId = localStorage.getItem('lastChatId');
        const lastChatType = localStorage.getItem('lastChatType');
        const lastChatName = localStorage.getItem('lastChatName');
        const lastGroupId = localStorage.getItem('lastGroupId');
        
        if (lastChatId && lastChatType && lastChatName) {
            setTimeout(() => {
                window.chatModule.openChat(lastChatId, lastChatType, lastChatName, lastGroupId);
            }, 1000);
        }
    }

    // Обработка выпадающего меню пользователя
    const optionsDropdown = document.getElementById('options-dropdown');
    
    // Показать/скрыть выпадающее меню при клике на иконку
    optionsMenuBtn?.addEventListener('click', function(e) {
        e.stopPropagation(); // Предотвращаем всплытие события
        optionsDropdown.classList.toggle('active');
    });
    
    // Скрыть меню при клике в любом месте страницы
    document.addEventListener('click', function(e) {
        if (optionsDropdown && optionsDropdown.classList.contains('active') && 
            !optionsDropdown.contains(e.target)) {
            optionsDropdown.classList.remove('active');
        }
    });
    
    // Обработчик для кнопки выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Здесь можно добавить запрос на сервер для выхода
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login';
                } else {
                    console.error('Ошибка при выходе:', data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при выходе:', error);
            });
        });
    }
    
    // Обработчик для кнопки настроек профиля
    const profileSettingsBtn = document.getElementById('profile-settings-btn');
    if (profileSettingsBtn) {
        profileSettingsBtn.addEventListener('click', function() {
            // Закрываем выпадающее меню
            optionsDropdown.classList.remove('active');
            
            // Открываем модальное окно редактирования профиля
            const profileModal = document.getElementById('edit-profile-modal');
            if (profileModal) {
                profileModal.classList.add('active');
            }
        });
    }

    // Инициализация модальных окон для медиафайлов
    initMediaModals();
});

// Функция для получения текущего чата
function getCurrentChatId() {
    return window.chatModule ? window.chatModule.getCurrentChatId() : null;
}

// Инициализация модальных окон для медиафайлов
function initMediaModals() {
    // Общие фотографии
    const sharedPhotosModal = document.getElementById('shared-photos-modal');
    const sharedPhotosCloseBtn = document.getElementById('shared-photos-close-btn');
    
    sharedPhotosCloseBtn?.addEventListener('click', function() {
        sharedPhotosModal.classList.remove('active');
    });
    
    sharedPhotosModal?.addEventListener('click', function(e) {
        if (e.target === sharedPhotosModal) {
            sharedPhotosModal.classList.remove('active');
        }
    });
    
    // Общие файлы
    const sharedFilesModal = document.getElementById('shared-files-modal');
    const sharedFilesCloseBtn = document.getElementById('shared-files-close-btn');
    
    sharedFilesCloseBtn?.addEventListener('click', function() {
        sharedFilesModal.classList.remove('active');
    });
    
    sharedFilesModal?.addEventListener('click', function(e) {
        if (e.target === sharedFilesModal) {
            sharedFilesModal.classList.remove('active');
        }
    });
    
    // Общие ссылки
    const sharedLinksModal = document.getElementById('shared-links-modal');
    const sharedLinksCloseBtn = document.getElementById('shared-links-close-btn');
    
    sharedLinksCloseBtn?.addEventListener('click', function() {
        sharedLinksModal.classList.remove('active');
    });
    
    sharedLinksModal?.addEventListener('click', function(e) {
        if (e.target === sharedLinksModal) {
            sharedLinksModal.classList.remove('active');
        }
    });
}

// Открытие модального окна с общими фотографиями
function openSharedPhotosModal(chatId) {
    const modal = document.getElementById('shared-photos-modal');
    const container = document.getElementById('shared-photos-container');
    const noMediaMessage = modal.querySelector('.no-media-message');
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div class="loading-indicator">Загрузка фотографий...</div>';
    noMediaMessage.style.display = 'none';
    
    // Открываем модальное окно
    modal.classList.add('active');
    
    // Загружаем данные с сервера
    fetch(`/api/chat/${chatId}/media?type=image`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Ошибка загрузки фотографий');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.message || 'Ошибка загрузки фотографий');
            }
            
            // Проверяем, есть ли фотографии
            if (!data.media || data.media.length === 0) {
                container.innerHTML = '';
                noMediaMessage.style.display = 'block';
                return;
            }
            
            // Создаем элементы для каждого фото
            let photosHTML = '';
            data.media.forEach(photo => {
                // Форматируем время фотографии
                const photoDate = new Date(photo.timestamp);
                const formattedDate = formatSharedItemDate(photoDate);
                
                photosHTML += `
                    <div class="shared-photo-item" data-id="${photo.id}" data-url="${photo.url}">
                        <img src="${photo.url}" alt="Photo ${photo.id}">
                        <div class="photo-info">
                            <span class="photo-sender">${photo.sender_name}</span>
                            <span class="photo-time">${formattedDate}</span>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = photosHTML;
            
            // Добавляем обработчики для просмотра фото
            document.querySelectorAll('.shared-photo-item').forEach(item => {
                item.addEventListener('click', function() {
                    const imageUrl = this.dataset.url;
                    const allImages = [...document.querySelectorAll('.shared-photo-item')].map(item => item.dataset.url);
                    openLightbox(imageUrl, allImages);
                });
            });
        })
        .catch(error => {
            console.error('Ошибка при загрузке фотографий:', error);
            container.innerHTML = `<div class="error-message">Ошибка при загрузке фотографий: ${error.message}</div>`;
        });
}

// Открытие модального окна с общими файлами
function openSharedFilesModal(chatId) {
    const modal = document.getElementById('shared-files-modal');
    const container = document.getElementById('shared-files-container');
    const noMediaMessage = modal.querySelector('.no-media-message');
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div class="loading-indicator">Загрузка файлов...</div>';
    noMediaMessage.style.display = 'none';
    
    // Открываем модальное окно
    modal.classList.add('active');
    
    // Загружаем данные с сервера
    fetch(`/api/chat/${chatId}/files`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Ошибка загрузки файлов');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.message || 'Ошибка загрузки файлов');
            }
            
            // Проверяем, есть ли файлы
            if (!data.files || data.files.length === 0) {
                container.innerHTML = '';
                noMediaMessage.style.display = 'block';
                return;
            }
            
            // Создаем элементы для каждого файла
            container.innerHTML = '';
            data.files.forEach(file => {
                // Форматируем время файла
                const fileDate = new Date(file.timestamp);
                const formattedDate = formatSharedItemDate(fileDate);
                
                // Определяем иконку для файла
                let fileIcon = getFileIconByName(file.name);
                
                const fileItem = document.createElement('div');
                fileItem.className = 'shared-file-item';
                fileItem.innerHTML = `
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-details">
                            <span class="file-size">${file.size || 'Неизвестно'}</span>
                            <span class="file-date">${formattedDate}</span>
                            <span class="file-sender">От: ${file.sender_name}</span>
                        </div>
                    </div>
                `;
                
                // Добавляем обработчик для скачивания файла
                fileItem.addEventListener('click', function() {
                    window.open(file.url, '_blank');
                });
                
                container.appendChild(fileItem);
            });
        })
        .catch(error => {
            console.error('Ошибка при загрузке файлов:', error);
            container.innerHTML = `<div class="error-message">Ошибка при загрузке файлов: ${error.message}</div>`;
        });
}

// Определение иконки файла по его имени
function getFileIconByName(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const icons = {
        'pdf': '📄',
        'doc': '📝',
        'docx': '📝',
        'xls': '📊',
        'xlsx': '📊',
        'ppt': '📑',
        'pptx': '📑',
        'txt': '📃',
        'zip': '📦',
        'rar': '📦',
        'mp3': '🎵',
        'wav': '🎵',
        'mp4': '🎬',
        'avi': '🎬',
        'mov': '🎬',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'default': '📁'
    };
    
    return icons[extension] || icons.default;
}

// Открытие модального окна с общими ссылками
function openSharedLinksModal(chatId) {
    const modal = document.getElementById('shared-links-modal');
    const container = document.getElementById('shared-links-container');
    const noMediaMessage = modal.querySelector('.no-media-message');
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div class="loading-indicator">Загрузка ссылок...</div>';
    noMediaMessage.style.display = 'none';
    
    // Открываем модальное окно
    modal.classList.add('active');
    
    // Загружаем данные с сервера
    fetch(`/api/chat/${chatId}/links`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Ошибка загрузки ссылок');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.message || 'Ошибка загрузки ссылок');
            }
            
            // Проверяем, есть ли ссылки
            if (!data.links || data.links.length === 0) {
                container.innerHTML = '';
                noMediaMessage.style.display = 'block';
                return;
            }
            
            // Создаем элементы для каждой ссылки
            container.innerHTML = '';
            data.links.forEach(link => {
                const linkItem = document.createElement('div');
                linkItem.className = 'shared-link-item';
                
                // Форматируем время сообщения
                const messageDate = new Date(link.timestamp);
                const formattedDate = formatSharedItemDate(messageDate);
                
                // Определяем иконку в зависимости от типа URL
                let linkIcon = '🔗';
                
                if (link.url.includes('youtube.com') || link.url.includes('youtu.be')) {
                    linkIcon = '📺';
                } else if (link.url.includes('github.com')) {
                    linkIcon = '📂';
                } else if (link.url.includes('instagram.com')) {
                    linkIcon = '📷';
                } else if (link.url.includes('twitter.com') || link.url.includes('x.com')) {
                    linkIcon = '🐦';
                } else if (link.url.includes('facebook.com') || link.url.includes('fb.com')) {
                    linkIcon = '👤';
                } else if (link.url.includes('linkedin.com')) {
                    linkIcon = '💼';
                } else if (link.url.includes('reddit.com')) {
                    linkIcon = '🔴';
                } else if (link.url.includes('wikipedia.org')) {
                    linkIcon = '📚';
                } else if (link.url.includes('amazon.com')) {
                    linkIcon = '🛒';
                } else if (link.url.includes('docs.google.com')) {
                    linkIcon = '📄';
                }
                
                linkItem.innerHTML = `
                    <div class="link-header">
                        <span class="link-icon">${linkIcon}</span>
                        <div class="link-title">${link.title}</div>
                    </div>
                    <a href="${link.url}" target="_blank" class="link-url">${link.url}</a>
                    <div class="link-context">${link.context || ''}</div>
                    <div class="link-details">
                        Отправлено: ${link.sender_name} · ${formattedDate}
                    </div>
                `;
                
                container.appendChild(linkItem);
            });
        })
        .catch(error => {
            console.error('Ошибка при загрузке ссылок:', error);
            container.innerHTML = `<div class="error-message">Ошибка при загрузке ссылок: ${error.message}</div>`;
        });
}

// Форматирование даты для медиа-элементов
function formatSharedItemDate(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= today) {
        // Сегодня - показываем только время
        return 'Сегодня ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date >= yesterday) {
        // Вчера
        return 'Вчера ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        // Другие даты - полный формат
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Функция для открытия лайтбокса с фотографией
function openLightbox(imageUrl, allImages = []) {
    // Создаем элементы лайтбокса
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    
    let currentIndex = allImages.indexOf(imageUrl);
    
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <img src="${imageUrl}" class="lightbox-img" alt="Фото">
            <button class="lightbox-close">&times;</button>
            ${allImages.length > 1 ? `
                <button class="lightbox-nav lightbox-prev">&lt;</button>
                <button class="lightbox-nav lightbox-next">&gt;</button>
            ` : ''}
        </div>
    `;
    
    document.body.appendChild(lightbox);
    
    // Предотвращаем скролл страницы
    document.body.style.overflow = 'hidden';
    
    // Обработчик закрытия лайтбокса
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // Обработчики для навигации (если есть несколько изображений)
    if (allImages.length > 1) {
        // Предыдущее изображение
        lightbox.querySelector('.lightbox-prev').addEventListener('click', function() {
            currentIndex = (currentIndex - 1 + allImages.length) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        });
        
        // Следующее изображение
        lightbox.querySelector('.lightbox-next').addEventListener('click', function() {
            currentIndex = (currentIndex + 1) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        });
        
        // Навигация с помощью клавиатуры
        document.addEventListener('keydown', keyNavHandler);
    }
    
    // Обновление изображения в лайтбоксе
    function updateLightboxImage(newUrl) {
        const img = lightbox.querySelector('.lightbox-img');
        img.src = newUrl;
    }
    
    // Обработчик нажатий клавиш для навигации
    function keyNavHandler(e) {
        if (e.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + allImages.length) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        } else if (e.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        } else if (e.key === 'Escape') {
            closeLightbox();
        }
    }
    
    // Функция закрытия лайтбокса
    function closeLightbox() {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', keyNavHandler);
        lightbox.remove();
    }
}
