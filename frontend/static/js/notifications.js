// Функция показа уведомления
function showNotification(message, arg2, arg3) {
    let duration = 3000; // Default duration
    let type = 'info';     // Default type

    // Determine type and duration based on arguments passed
    if (typeof arg2 === 'number') {
        duration = arg2;
        if (typeof arg3 === 'string') {
            type = arg3;
        }
    } else if (typeof arg2 === 'string') {
        type = arg2;
        if (typeof arg3 === 'number') {
            duration = arg3;
        }
    }
    // If only message is provided, defaults are used.

    console.log(`[Notification] Showing: "${message}", Type: ${type}, Duration: ${duration}`); // Added log for debugging

    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Добавляем уведомление в DOM
    document.body.appendChild(notification);
    
    // Показываем уведомление (с небольшой задержкой для анимации)
    setTimeout(() => {
        notification.classList.add('show');
    }, 10); // 10ms delay
    
    // Скрываем и удаляем уведомление через указанное время
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.remove('show');
            // Ждем завершения CSS-анимации перед удалением (должно совпадать с transition-duration в CSS)
            setTimeout(() => {
                if (document.body.contains(notification)) { // Проверяем, не удален ли элемент уже
                    document.body.removeChild(notification);
                }
            }, 500); // Увеличил время ожидания анимации до 500ms
        }, duration);
    } else {
        // Если duration <= 0, уведомление не будет автоматически скрываться
        // Можно добавить кнопку закрытия вручную, если нужно
    }
    
    return notification;
} 