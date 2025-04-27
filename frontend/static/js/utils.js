// Общие вспомогательные функции

// Функция для отображения аватара пользователя (теперь возвращает Promise)
function displayUserAvatar(container, user, defaultIcon = '/static/images/meow-icon.jpg') {
    return new Promise((resolve) => {
        if (!container) {
            resolve(); // Просто выходим, если нет контейнера
            return;
        }

        const avatarUrl = user.avatar_url || user.avatar || defaultIcon;
        const username = user.username || 'User';
        const firstLetter = username.charAt(0).toUpperCase();

        // Базовый HTML для индикатора
        const indicatorHTML = '<div class="online-indicator"></div>';

        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
            const img = new Image();
            img.onload = function() {
                container.innerHTML = `<img src="${avatarUrl}" alt="${username}" class="user-avatar-img">${indicatorHTML}`;
                container.classList.remove('avatar-placeholder');
                resolve(); // Разрешаем Promise после обновления HTML
            };
            img.onerror = function() {
                console.warn(`Не удалось загрузить аватар: ${avatarUrl}, показываем букву.`);
                container.innerHTML = `<div class="avatar-letter">${firstLetter}</div>${indicatorHTML}`;
                container.classList.add('avatar-placeholder');
                resolve(); // Разрешаем Promise после обновления HTML
            };
            img.src = avatarUrl;
            container.classList.remove('avatar-placeholder');
        } else {
            container.innerHTML = `<div class="avatar-letter">${firstLetter}</div>${indicatorHTML}`;
            container.classList.add('avatar-placeholder');
            resolve(); // Разрешаем Promise после обновления HTML
        }
    });
}

// Добавляем экспорт в window, если планируется использовать в других файлах без системы модулей
window.displayUserAvatar = displayUserAvatar; 