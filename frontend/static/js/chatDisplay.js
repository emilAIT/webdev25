// Функции для отображения чатов и сообщений

// --- Цвета для имен пользователей в группах ---
const userColors = [
    '#E84D78', // Розовый (текущий)
    '#43A5DC', // Голубой
    '#FF9F1C', // Оранжевый
    '#4CAF50', // Зеленый
    '#9B59B6', // Фиолетовый
    '#E74C3C', // Красный
    '#3498DB', // Ярко-синий
    '#F1C40F'  // Желтый
];

// Функция для получения цвета пользователя по ID
function getUserColor(userId) {
    // Простая логика: остаток от деления ID на количество цветов
    // Преобразуем userId в число, если это строка
    const numericUserId = parseInt(userId, 10) || 0;
    const colorIndex = numericUserId % userColors.length;
    return userColors[colorIndex];
}
// --- Конец цветов ---

// Улучшенная функция открытия чата с дополнительными проверками
async function openChatSafe(chatId, chatType) {
    console.log('Попытка безопасного открытия чата с ID:', chatId, 'тип:', chatType || 'не указан');

    if (!chatId) {
        console.error('Ошибка: не указан ID чата');
        showNotification('Не удалось открыть чат: ID чата не указан', 'error'); // Предполагаем showNotification доступна
        return;
    }

    // Проверяем, есть ли чат в локальном DOM
    const chatItems = document.querySelectorAll('.chat-item');
    console.log('Количество чатов в DOM:', chatItems.length);

    let chatExists = false;
    chatItems.forEach(item => {
        const itemId = item.getAttribute('data-chat-id');
        const itemType = item.getAttribute('data-chat-type');

        // Если указан тип, проверяем и ID и тип, иначе только ID
        if (chatType) {
            if (itemId == chatId && itemType === chatType) {
                chatExists = true;
                console.log('Найден чат в DOM с ID:', itemId, 'и типом:', itemType);
            }
        } else if (itemId == chatId) {
            chatExists = true;
            console.log('Найден чат в DOM с ID:', itemId, 'типом:', itemType);
        }
    });

    if (!chatExists) {
        console.log('Чат не найден в DOM, пробуем обновить список чатов');

        try {
            // Пробуем обновить список чатов
            await loadChats(); // Предполагаем loadChats доступна

            // Повторно проверяем наличие чата после обновления
            const selector = chatType
                ? `.chat-item[data-chat-id="${chatId}"][data-chat-type="${chatType}"]`
                : `.chat-item[data-chat-id="${chatId}"]`;

            const refreshedChat = document.querySelector(selector);
            if (!refreshedChat) {
                console.error('Чат не найден даже после обновления списка');

                // Если указан тип, пробуем найти чат без учета типа
                if (chatType) {
                    const anyTypeChat = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
                    if (anyTypeChat) {
                        const foundType = anyTypeChat.getAttribute('data-chat-type');
                        console.log('Найден чат с ID', chatId, 'но типом', foundType, 'вместо', chatType);
                        showNotification(`Найден чат с ID ${chatId}, но другого типа. Открываем его.`, 'warning');
                        openChat(chatId, foundType);
                        return;
                    }
                }

                showNotification('Чат не найден. Возможно, он был удален.', 'error');
                return;
            }
            console.log('Чат найден после обновления списка');
        } catch (error) {
            console.error('Ошибка при обновлении списка чатов:', error);
            showNotification('Не удалось загрузить список чатов', 'error');
            return;
        }
    }

    // Теперь используем обычную функцию открытия чата
    openChat(chatId, chatType);
}

// Открытие чата
async function openChat(chatId, chatType) {
    console.log('Открытие чата:', chatId, 'тип:', chatType || 'не указан');

    // --- ДОБАВЛЕНО: Восстановление видимости UI элементов --- 
    // Восстанавливаем видимость хедера и поля ввода на случай,
    // если открытие чата прерывает процесс создания группы/чата
    const conversationHeader = document.querySelector('.conversation-header');
    const inputContainer = document.querySelector('.input-container');
    const messageContainer = document.querySelector('.message-container'); // Нужен для сброса стилей

    if (conversationHeader) {
        const backButton = conversationHeader.querySelector('.back-button');
        const chatUser = conversationHeader.querySelector('.chat-user');
        // Показываем стандартные элементы хедера
        if (backButton) backButton.style.display = 'flex'; 
        if (chatUser) chatUser.style.display = 'flex';   
    }
    if (inputContainer) {
        inputContainer.style.display = 'flex';
    }
    // Сбрасываем стили messageContainer, которые могли быть добавлены в showNewChatDialog
    if (messageContainer) {
        messageContainer.style.flexDirection = ''; // Сброс на дефолт (row)
        messageContainer.style.justifyContent = ''; // Сброс
        messageContainer.style.alignItems = ''; // Сброс
        messageContainer.style.padding = ''; // Сброс отступов
        messageContainer.innerHTML = ''; // Очищаем контейнер перед загрузкой сообщений
    }
    // Сбрасываем временный файл аватара группы, если он был выбран
    window.groupAvatarFile = null;
    // --- КОНЕЦ ДОБАВЛЕНИЯ --- 

    // Получаем список чатов
    const chatItems = document.querySelectorAll('.chat-item');
    console.log('Количество найденных чатов:', chatItems.length);

    // Выводим ID всех доступных чатов для отладки
    // chatItems.forEach(item => {
    //     console.log('Найден чат с ID:', item.getAttribute('data-chat-id'),
    //         'Тип:', item.getAttribute('data-chat-type'));
    // });

    // Убираем активный класс со всех чатов
    chatItems.forEach(item => {
        item.classList.remove('active');
    });

    // Находим и активируем выбранный чат
    let selector = `.chat-item[data-chat-id="${chatId}"]`;
    if (chatType) {
        selector = `.chat-item[data-chat-id="${chatId}"][data-chat-type="${chatType}"]`;
    }

    console.log('Используемый селектор для поиска чата:', selector);
    const selectedChat = document.querySelector(selector);
    console.log('Найден выбранный чат:', selectedChat ? 'Да' : 'Нет');

    if (selectedChat) {
        selectedChat.classList.add('active');

        // --- Сразу убираем значок непрочитанных при клике --- 
        const unreadBadge = selectedChat.querySelector('.chat-unread');
        if (unreadBadge) {
            unreadBadge.style.display = 'none';
            unreadBadge.textContent = '0';
            console.log(`[openChat] Немедленно скрыт unread badge для чата ${chatId}`);
        }
        selectedChat.classList.remove('has-unread');
        // --- Конец убранного значка --- 

        const actualChatType = selectedChat.getAttribute('data-chat-type');
        console.log('Тип чата из атрибута data-chat-type:', actualChatType);
        const isGroup = actualChatType === 'group';

        console.log(`Открытие ${isGroup ? 'группового' : 'личного'} чата с ID:`, chatId);

        const chatName = selectedChat.querySelector('.chat-name')?.textContent;
        const participantCount = selectedChat.getAttribute('data-participant-count');

        // Обновляем заголовок чата
        const conversationHeader = document.querySelector('.conversation-header');
        const chatUserContainer = conversationHeader?.querySelector('.chat-user');
        const chatAvatarContainer = chatUserContainer?.querySelector('.chat-avatar');

        // --- Обновление Аватара в Хедере --- 
        if (chatAvatarContainer) {
            let avatarUrl = '/static/images/meow-icon.jpg'; // Дефолтный аватар
            let avatarAlt = chatName; // Используем имя чата как alt по умолчанию

            if (isGroup) {
                const groupAvatar = selectedChat.getAttribute('data-group-avatar');
                if (groupAvatar && groupAvatar !== 'null' && groupAvatar !== 'undefined' && groupAvatar !== '') {
                    avatarUrl = groupAvatar;
                }
                console.log(`[openChat Group] Установка аватара группы: ${avatarUrl}`);
            } else {
                const userAvatar = selectedChat.getAttribute('data-user-avatar');
                 if (userAvatar && userAvatar !== 'null' && userAvatar !== 'undefined' && userAvatar !== '') {
                    avatarUrl = userAvatar;
                }
                 console.log(`[openChat Direct] Установка аватара пользователя: ${avatarUrl}`);
            }
            chatAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="${avatarAlt || 'Avatar'}" class="user-avatar-img">`;
        } else {
            console.error('Элемент .chat-avatar в хедере не найден');
        }
        // --- Конец обновления Аватара --- 

        // --- Обновление Имени и Статуса в Хедере --- 
        let chatUserDetails = chatUserContainer?.querySelector('.chat-user-details');
        if (chatUserContainer && !chatUserDetails) {
            chatUserDetails = document.createElement('div');
            chatUserDetails.className = 'chat-user-details';
            chatAvatarContainer?.parentNode.insertBefore(chatUserDetails, chatAvatarContainer.nextSibling);
        }

        if (chatUserDetails) {
            chatUserDetails.innerHTML = ''; // Очищаем перед заполнением
            // --- ДОБАВЛЕНИЕ data-user-id к ШАПКЕ --- 
            // Сначала удаляем старый атрибут, если он был
            conversationHeader.removeAttribute('data-user-id');
            // --- Конец удаления --- 

            const chatUserNameElement = document.createElement('div');
            chatUserNameElement.className = 'chat-user-name';
            chatUserNameElement.textContent = chatName;
            chatUserDetails.appendChild(chatUserNameElement);
            console.log('Имя пользователя в заголовке обновлено:', chatName);

            const userStatusHeader = document.createElement('div');
            userStatusHeader.className = 'user-status-header';
            chatUserDetails.appendChild(userStatusHeader);

            if (!isGroup) {
                const userId = selectedChat.getAttribute('data-user-id');
                if (userId) {
                     // --- ДОБАВЛЕНИЕ data-user-id к ШАПКЕ (здесь!) ---
                     conversationHeader.setAttribute('data-user-id', userId);
                     console.log(`[openChat] Установлен data-user-id=${userId} в шапку чата.`);
                     // --- Конец добавления ---

                    userStatusHeader.textContent = 'loading...';
                    try {
                        const statusData = await fetchAPI(`/api/chat/user-status/${userId}`); // Предполагаем fetchAPI доступна
                        if (statusData) {
                            if (statusData.is_online) {
                                userStatusHeader.textContent = 'online';
                            } else if (statusData.last_seen) {
                                try {
                                    // Предполагаем luxon доступен
                                    const dt = luxon.DateTime.fromISO(statusData.last_seen, { zone: 'utc' });
                                    const localDt = dt.setZone('Asia/Bishkek');
                                    const now = luxon.DateTime.now().setZone('Asia/Bishkek');
                                    let statusText = 'last seen ';
                                    if (localDt.hasSame(now, 'day')) {
                                        statusText += `at ${localDt.toFormat('HH:mm')}`;
                                    } else if (localDt.hasSame(now.minus({ days: 1 }), 'day')) {
                                        statusText += 'yesterday';
                                    } else if (now.diff(localDt, 'days').days < 7) {
                                         statusText += `on ${localDt.toFormat('ccc')}`;
                                    } else {
                                        statusText += `on ${localDt.toFormat('dd.MM.yyyy')}`;
                                    }
                                    userStatusHeader.textContent = statusText;
                                } catch (luxonError) {
                                    console.error("Ошибка форматирования времени Luxon:", luxonError, "Timestamp:", statusData.last_seen);
                                    userStatusHeader.textContent = 'last seen recently';
                                }
                            } else {
                                 userStatusHeader.textContent = 'last seen long time ago';
                            }
                             console.log('Статус пользователя загружен и отформатирован');
                        } else {
                            userStatusHeader.textContent = 'status unknown';
                        }
                    } catch (error) {
                        console.error('Ошибка загрузки статуса пользователя:', error);
                        userStatusHeader.textContent = 'could not load status';
                    }
                } else {
                    userStatusHeader.textContent = 'status unavailable';
                }
            } else { // Группа
                userStatusHeader.textContent = `${participantCount || '?'} members`;
            }
        } else {
            console.error('Элемент .chat-user-details в хедере не найден или не удалось создать');
        }
        // --- Конец обновления Имени и Статуса --- 

        // --- Добавление/Удаление Обработчиков Клика на Хедер для Группы --- 
        const headerClickableElements = chatUserContainer ? [
            chatUserContainer.querySelector('.chat-avatar'),
            chatUserContainer.querySelector('.chat-user-details')
        ].filter(el => el) : [];

        const messageContainer = document.querySelector('.message-container');

        if (isGroup) {
            const groupId = chatId;
            function openGroupInfoHandler() {
                const currentChatType = messageContainer?.getAttribute('data-chat-type');
                if (currentChatType !== 'group') return;
                console.log(`Клик для открытия информации о группе ${groupId}`);
                showGroupInfoPanel(groupId); // Предполагаем showGroupInfoPanel доступна
            }

            headerClickableElements.forEach(element => {
                const newElement = element.cloneNode(true);
                newElement.style.cursor = 'pointer';
                element.parentNode.replaceChild(newElement, element);
                // Добавляем обработчик только к новой копии
                newElement.addEventListener('click', openGroupInfoHandler);
            });
            console.log('[openChat Group] Обработчики клика на хедер ДОБАВЛЕНЫ.');

        } else {
            headerClickableElements.forEach(element => {
                const newElement = element.cloneNode(true);
                newElement.style.cursor = 'default';
                element.parentNode.replaceChild(newElement, element);
                // Старые обработчики удалены при клонировании, новые не добавляем
            });
             console.log('[openChat Direct] Обработчики клика на хедер УДАЛЕНЫ.');
        }
        // --- Конец добавления/Удаления Обработчиков --- 

        // Показываем контейнер сообщений
        const welcomeScreen = document.querySelector('.welcome-screen');
        const conversation = document.querySelector('.conversation');
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (conversation) {
            conversation.style.display = 'flex';
            console.log('Контейнер сообщений показан');
        } else {
            console.log('Элемент контейнера сообщений не найден');
        }

        // Устанавливаем тип чата в атрибут контейнера сообщений
        if (messageContainer) {
            messageContainer.setAttribute('data-chat-type', isGroup ? 'group' : 'direct');
            messageContainer.setAttribute('data-chat-id', chatId);
            console.log('Атрибуты контейнера сообщений установлены');
        } else {
            console.log('Элемент контейнера сообщений не найден');
        }

        // Загружаем сообщения чата
        console.log('Вызов функции loadChatMessages с параметрами:', { chatId, isGroup });
        loadChatMessages(chatId, isGroup);

        // Отправляем статус прочтения при открытии чата
        sendReadStatusOnChatOpen(chatId, isGroup); // Предполагаем sendReadStatusOnChatOpen доступна

    } else {
        console.error('Ошибка: чат с ID', chatId, (chatType ? `и типом ${chatType}` : ''), 'не найден в списке чатов');
        // Пробуем найти чат с указанным ID без учета типа, если тип был указан
        if (chatType) {
            console.log('Пробуем найти чат без учета типа');
            const anyTypeChat = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
            if (anyTypeChat) {
                console.log('Найден чат с таким ID, но другого типа:', anyTypeChat.getAttribute('data-chat-type'));
                console.log('Рекомендуется использовать полный селектор с типом чата');
            }
        }
        // Загружаем список чатов повторно
        console.log('Пробуем загрузить список чатов повторно...');
        loadChats().then(() => {
            // Пробуем открыть чат еще раз после обновления списка
            setTimeout(() => {
                const refreshSelector = chatType
                    ? `.chat-item[data-chat-id="${chatId}"][data-chat-type="${chatType}"]`
                    : `.chat-item[data-chat-id="${chatId}"]`;
                const refreshedChat = document.querySelector(refreshSelector);
                if (refreshedChat) {
                    console.log('Чат найден после обновления списка, пробуем открыть снова');
                    openChat(chatId, chatType);
                } else {
                    console.error('Чат с ID', chatId, (chatType ? `и типом ${chatType}` : ''), 'не найден даже после обновления списка');
                    showNotification('Не удалось открыть чат. Чат не найден.', 'error');
                }
            }, 500);
        }).catch(err => {
            console.error("Ошибка при повторной загрузке чатов: ", err);
            showNotification('Ошибка загрузки списка чатов', 'error');
        });
    }
}

// Загрузка сообщений чата
async function loadChatMessages(chatId, isGroup) {
    try {
        // Если тип чата не передан, определяем его
        if (isGroup === undefined) {
            const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
            if (chatItem) {
                isGroup = chatItem.getAttribute('data-chat-type') === 'group';
            } else {
                console.warn(`Не удалось определить тип чата для ID ${chatId} из DOM, пробуем угадать...`);
                isGroup = false; // Может быть неверно!
            }
        }

        console.log(`Загрузка сообщений для ${isGroup ? 'группового' : 'личного'} чата с ID:`, chatId);

        // --- ИСПРАВЛЕНИЕ URL --- 
        const url = isGroup
            ? `api/groups/${chatId}/messages` // URL для групп
            : `api/chat/direct-messages/${chatId}`; // Правильный URL для личных сообщений
        // --- КОНЕЦ ИСПРАВЛЕНИЯ --- 

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки сообщений: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        displayMessages(data.messages || [], chatId, isGroup);
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        showNotification('Не удалось загрузить сообщения', 'error');
        // Отображаем пустой контейнер или сообщение об ошибке
        const messageContainer = document.querySelector('.message-container');
        if (messageContainer) {
            messageContainer.innerHTML = '<div class="no-messages error">Ошибка загрузки сообщений</div>';
        }
    }
}

// --- ДОБАВЛЕНО: Логика для плавающего индикатора даты --- 
let floatingIndicatorTimeout = null;
let dateSeparatorsCache = []; // Кэш позиций разделителей дат

function setupFloatingDateIndicator() {
    console.log("[FloatingDate] setupFloatingDateIndicator called"); // DEBUG
    const messageContainer = document.querySelector('.message-container');
    const floatingIndicator = document.getElementById('floating-date-indicator');
    const floatingIndicatorSpan = floatingIndicator?.querySelector('span');

    if (!messageContainer || !floatingIndicator || !floatingIndicatorSpan) {
        console.warn('[FloatingDate] Элементы для плавающего индикатора даты не найдены.', {messageContainer, floatingIndicator, floatingIndicatorSpan}); // DEBUG
        return;
    }
    console.log("[FloatingDate] Found elements:", {messageContainer, floatingIndicator}); // DEBUG

    // Оптимизация: используем requestAnimationFrame для обработки скролла
    let isTicking = false;

    messageContainer.addEventListener('scroll', () => {
        // console.log("[FloatingDate] Scroll event fired"); // DEBUG (может быть слишком много логов)
        if (!isTicking) {
            window.requestAnimationFrame(() => {
                // console.log("[FloatingDate] requestAnimationFrame callback"); // DEBUG
                updateFloatingIndicator(messageContainer, floatingIndicator, floatingIndicatorSpan);
                isTicking = false;
            });
            isTicking = true;
        }

        // Логика показа/скрытия по таймауту
        // Сначала делаем элемент display:block, затем добавляем класс visible для transition
        if (floatingIndicator.style.display !== 'block') {
             console.log("[FloatingDate] Making indicator display: block"); // DEBUG
             floatingIndicator.style.display = 'block';
             // Небольшая задержка перед добавлением класса для старта transition
             requestAnimationFrame(() => {
                floatingIndicator.classList.add('visible');
                console.log("[FloatingDate] Added 'visible' class"); // DEBUG
             });
        } else {
            // Если уже виден, просто обновляем таймер
            floatingIndicator.classList.add('visible'); // Убедимся, что класс есть
        }

        clearTimeout(floatingIndicatorTimeout);
        floatingIndicatorTimeout = setTimeout(() => {
            console.log("[FloatingDate] Hiding indicator via timeout"); // DEBUG
            floatingIndicator.classList.remove('visible');
            // Можно добавить transitionend listener, чтобы ставить display:none после анимации,
            // но для простоты пока оставим display:block, класс visible управляет opacity
            // Если будут проблемы с layout, можно будет добавить:
            // floatingIndicator.addEventListener('transitionend', () => {
            //    if (!floatingIndicator.classList.contains('visible')) {
            //        floatingIndicator.style.display = 'none';
            //    }
            // }, { once: true });
        }, 1000); // Скрываем через 1 секунду после остановки скролла
    });
}

function updateFloatingIndicator(container, indicator, indicatorSpan) {
    // console.log("[FloatingDate] updateFloatingIndicator called"); // DEBUG
    // Обновляем кэш позиций
    dateSeparatorsCache = Array.from(container.querySelectorAll('.date-separator')).map(el => ({
        element: el,
        top: el.offsetTop,
        text: el.querySelector('span')?.textContent || ''
    }));
    // console.log("[FloatingDate] Separators cache:", dateSeparatorsCache); // DEBUG

    const scrollTop = container.scrollTop;
    let currentSeparatorText = '';

    // Находим текущий активный разделитель
    for (let i = dateSeparatorsCache.length - 1; i >= 0; i--) {
        // Используем container.offsetTop для корректировки относительно родителя
        // Вычитаем высоту самого индикатора (примерно) и небольшой буфер
        const indicatorHeightApproximation = 30;
        if (scrollTop >= (dateSeparatorsCache[i].top - container.offsetTop - indicatorHeightApproximation)) { 
            currentSeparatorText = dateSeparatorsCache[i].text;
            break;
        }
    }
    
    // Если прокрутили выше самого первого разделителя, берем его текст
    if (!currentSeparatorText && dateSeparatorsCache.length > 0) {
        currentSeparatorText = dateSeparatorsCache[0].text;
    }
    // console.log("[FloatingDate] Current separator text:", currentSeparatorText); // DEBUG

    // Обновляем текст индикатора, только если он изменился
    if (indicatorSpan.textContent !== currentSeparatorText) {
        console.log("[FloatingDate] Updating indicator text to:", currentSeparatorText); // DEBUG
        indicatorSpan.textContent = currentSeparatorText;
    }
}

// Отображение сообщений чата
function displayMessages(messages, chatId, isGroup) {
    const messageContainer = document.querySelector('.message-container');
    if (!messageContainer) return;

    messageContainer.innerHTML = ''; // Очищаем контейнер

    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    if (!currentUserId) {
        console.error('ID пользователя не найден для отображения сообщений');
        messageContainer.innerHTML = '<div class="no-messages error">Ошибка: ID пользователя не определен</div>';
        return;
    }

    if (isGroup === undefined) {
        const containerChatType = messageContainer.getAttribute('data-chat-type');
            isGroup = containerChatType === 'group';
    }
    console.log(`Отображение сообщений для ${isGroup ? 'группового' : 'личного'} чата с ID:`, chatId, 'Current user ID:', currentUserId);

    // --- ДОБАВЛЕНО: Логика разделителей дат --- 
    let lastMessageDateStr = null; // Храним дату последнего сообщения в формате YYYY-MM-DD
    const today = luxon.DateTime.now().setZone('Asia/Bishkek').startOf('day');
    const yesterday = today.minus({ days: 1 });
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    // --- ДОБАВЛЕНО: Сброс и подготовка кэша для индикатора --- 
    dateSeparatorsCache = []; // Очищаем кэш перед заполнением
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    if (messages && messages.length > 0) {
        let previousSenderId = null;
        messages.forEach(message => {
            // --- ДОБАВЛЕНО: Проверка и добавление разделителя дат --- 
            try {
                const messageDateTime = luxon.DateTime.fromISO(message.timestamp, { zone: 'utc' }).setZone('Asia/Bishkek');
                const messageDateStr = messageDateTime.toISODate(); // Get YYYY-MM-DD

                if (messageDateStr !== lastMessageDateStr) {
                    let separatorText = '';
                    const messageDate = messageDateTime.startOf('day');

                    if (messageDate.hasSame(today, 'day')) {
                        separatorText = 'Today'; // Changed from 'Сегодня'
                    } else if (messageDate.hasSame(yesterday, 'day')) {
                        separatorText = 'Yesterday'; // Changed from 'Вчера'
                    } else {
                        // Use format 'd MMMM yyyy' (e.g., 15 June 2024)
                        separatorText = messageDate.toFormat('d MMMM yyyy', { locale: 'en' });
                    }

                    const dateSeparator = document.createElement('div');
                    dateSeparator.className = 'date-separator';
                    dateSeparator.innerHTML = `<span>${separatorText}</span>`;
                    messageContainer.appendChild(dateSeparator);

                    // --- ДОБАВЛЕНО: Добавляем позицию в кэш --- 
                    // Делаем это здесь, т.к. offsetTop будет корректным после добавления в DOM
                    // dateSeparatorsCache.push({ element: dateSeparator, top: dateSeparator.offsetTop, text: separatorText });
                    // Перенес обновление кэша в updateFloatingIndicator для простоты
                    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

                    lastMessageDateStr = messageDateStr;
                }
            } catch (e) {
                console.error("Ошибка обработки даты сообщения:", e, "Timestamp:", message.timestamp);
                // Если ошибка, не добавляем разделитель и продолжаем
            }
            // --- КОНЕЦ ДОБАВЛЕНИЯ ---

            const isCurrentUser = message.sender.id === currentUserId;
            const isSameSender = message.sender.id === previousSenderId;
            previousSenderId = message.sender.id;

            const messageElement = document.createElement('div');
            messageElement.className = `message ${isCurrentUser ? 'my-message' : 'other-message'}`;
            messageElement.setAttribute('data-message-id', message.id);
            messageElement.setAttribute('data-sender-id', message.sender.id);
            messageElement.setAttribute('data-timestamp', message.timestamp);

            // Add forwarded attribute if this is a forwarded message
            if (message.forwarded) {
                messageElement.setAttribute('data-forwarded', 'true');
                if (message.original_sender) {
                    messageElement.setAttribute('data-original-sender-id', message.original_sender.id);
                }
            }

            let isConsecutive = false;
            if (isSameSender) {
                isConsecutive = true;
                messageElement.classList.add('consecutive-message');
            }

            const showSenderInfo = isGroup && !isCurrentUser && !isConsecutive;
            const senderAvatar = message.sender.avatar_url || message.sender.avatar || '/static/images/meow-icon.jpg';

            const isRead = message.is_read === true;
            const readStatusClass = isRead ? 'read' : 'unread';
            const readStatusIcon = isRead ?
                '<span class="read-status read"><i class="fas fa-check-double"></i></span>' :
                '<span class="read-status unread"><i class="fas fa-check"></i></span>';

            const isEdited = message.edited === true || message.is_edited === true;
            const isReply = !!message.reply_info;
            let replyHTML = '';
            
            if (isReply) {
                const replySender = message.reply_info.sender_name || 'Unknown';
                const replyText = message.reply_info.content_snippet || 'Original message';
                replyHTML = `
                    <div class="reply-container">
                        <span class="reply-sender">${replySender}</span>
                        <span class="reply-text">${replyText}</span>
                    </div>
                `;
            }

            // Add forwarded info HTML if this is a forwarded message
            let forwardedHTML = '';
            if (message.forwarded && message.original_sender) {
                forwardedHTML = `
                    <div class="forwarded-info">
                        <i class="fas fa-share"></i> Forwarded from <span class="forwarded-sender">${message.original_sender.username}</span>
                    </div>
                `;
            }

            // --- НОВАЯ ЛОГИКА ОТОБРАЖЕНИЯ ФАЙЛА --- 
            let messageContentHTML = '';
            const fileUrlPrefix = '/static/media/chat_files/';
            if (typeof message.content === 'string' && message.content.startsWith(fileUrlPrefix)) {
                // Это сообщение с файлом
                const fileUrl = message.content;
                const filename = fileUrl.substring(fileUrl.indexOf('_', fileUrlPrefix.length) + 1);
                const extension = filename.split('.').pop().toLowerCase();

                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
                const videoExtensions = ['mp4', 'webm', 'ogg', 'mov']; // Добавили mov

                if (imageExtensions.includes(extension)) {
                    // Показываем изображение
                    messageContentHTML = `
                        <img src="${fileUrl}" alt="${filename}" class="message-image">
                    `;
                } else if (videoExtensions.includes(extension)) {
                    // Показываем видео
                    messageContentHTML = `
                        <video controls class="message-video" preload="metadata">
                            <source src="${fileUrl}">
                            Your browser does not support the video tag.
                        </video>
                    `;
                } else {
                    // Показываем ссылку на другие файлы
                    let fileIconClass = 'fa-file';
                    if (['pdf'].includes(extension)) {
                        fileIconClass = 'fa-file-pdf';
                    } else if (['doc', 'docx'].includes(extension)) {
                        fileIconClass = 'fa-file-word';
                    } else if (['zip', 'rar', '7z'].includes(extension)) {
                        fileIconClass = 'fa-file-archive';
                    }
                    
                    messageContentHTML = `
                        <a href="${fileUrl}" target="_blank" download="${filename}" class="file-message-link">
                            <i class="fas ${fileIconClass} file-icon"></i>
                            <span class="file-name">${filename}</span>
                        </a>
                    `;
                }
            } else {
                // Это обычное текстовое сообщение
                messageContentHTML = `<div class="message-text">${message.content || ''}</div>`;
            }
            // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

            // --- ПРИМЕНЕНИЕ ЦВЕТА К ИМЕНИ --- 
            let senderNameStyle = '';
            if (isGroup && !isCurrentUser) { // Только для чужих сообщений в группе
                const color = getUserColor(message.sender.id);
                senderNameStyle = `style="color: ${color};"`;
            }
            // --- КОНЕЦ ПРИМЕНЕНИЯ ЦВЕТА ---

            let messageHTML = '';
            if (showSenderInfo) {
                messageHTML += `<div class="message-sender-info"><div class="message-avatar"><img src="${senderAvatar}" alt="${message.sender.username}" class="user-avatar-img"></div></div>`;
            }

            messageHTML += `
                <div class="message-bubble">
                    ${showSenderInfo ? `<div class="message-sender-name" ${senderNameStyle}>${message.sender.username}</div>` : ''}
                    ${forwardedHTML}
                    ${replyHTML}
                    ${messageContentHTML}
                    <div class="message-time">
                        ${formatMessageTime(message.timestamp)}
                        ${isCurrentUser ? readStatusIcon : ''}
                    </div>
                    ${isEdited ? '<span class="edited-indicator">(edited)</span>' : ''}
                </div>
            `;
            messageHTML += `<div class="message-menu-trigger"><i class="fas fa-ellipsis-v"></i></div>`;

            messageElement.innerHTML = messageHTML;
            messageContainer.appendChild(messageElement);
            
            if (window.contextMenu && typeof window.contextMenu.addToMessage === 'function') {
                window.contextMenu.addToMessage(messageElement);
            }
        });

        // Прокрутка вниз
        const lastElement = messageContainer.lastElementChild;
        if (lastElement) {
            setTimeout(() => {
                 // Проверяем, был ли последний элемент разделителем дат
                if (lastElement.classList.contains('date-separator')) {
                    // Если да, скроллим до предпоследнего элемента (последнего сообщения)
                    const lastMessageElement = messageContainer.children[messageContainer.children.length - 2];
                    if (lastMessageElement) {
                        lastMessageElement.scrollIntoView({ behavior: 'auto', block: 'end' }); 
                    } else {
                         messageContainer.scrollTop = messageContainer.scrollHeight;
                    }
                } else {
                    // Иначе скроллим к последнему элементу (сообщению)
                    lastElement.scrollIntoView({ behavior: 'auto', block: 'end' }); 
                }
            }, 0);
        } else {
             setTimeout(() => {
                 messageContainer.scrollTop = messageContainer.scrollHeight;
             }, 0);
        }

        // --- ДОБАВЛЕНО: Первичное обновление индикатора после отрисовки --- 
        // Это нужно, чтобы индикатор показал правильную дату сразу после загрузки
        const floatingIndicator = document.getElementById('floating-date-indicator');
        const floatingIndicatorSpan = floatingIndicator?.querySelector('span');
        if (floatingIndicator && floatingIndicatorSpan) {
            // Небольшая задержка, чтобы DOM точно обновился
            setTimeout(() => updateFloatingIndicator(messageContainer, floatingIndicator, floatingIndicatorSpan), 50); 
        }
        // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    } else {
        messageContainer.innerHTML = '<div class="no-messages"></div>';
    }

    setupMessageSending(chatId, isGroup);
}

// Форматирование времени сообщения
function formatMessageTime(timestamp) {
    try {
        const dt = luxon.DateTime.fromISO(timestamp, { zone: 'utc' });
        const localDt = dt.setZone('Asia/Bishkek');
        return localDt.toFormat('HH:mm');
    } catch (e) {
        console.error("Ошибка форматирования времени сообщения:", e, "Timestamp:", timestamp);
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Форматирование времени последнего сообщения в списке чатов
function formatChatTime(timestamp) {
    try {
        // Предполагаем, что luxon доступен глобально
        const dt = luxon.DateTime.fromISO(timestamp, { zone: 'utc' });
        const localDt = dt.setZone('Asia/Bishkek');
        const now = luxon.DateTime.now().setZone('Asia/Bishkek');

        if (localDt.hasSame(now, 'day')) {
            return localDt.toFormat('HH:mm'); // Сегодня
        } else if (localDt.hasSame(now.minus({ days: 1 }), 'day')) {
            return 'Yesterday'; // Вчера
        } else if (now.diff(localDt, 'days').days < 7) {
            return localDt.toFormat('ccc'); // День недели (Пн, Вт, ...)
        } else {
            return localDt.toFormat('dd.MM.yyyy'); // Полная дата
        }
    } catch (e) {
        console.error("Ошибка форматирования времени чата:", e, "Timestamp:", timestamp);
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    }
}


// Настройка отправки сообщений
function setupMessageSending(chatId, isGroup) {
    console.log('Настройка отправки сообщений для чата:', chatId, 'isGroup:', isGroup);

    const messageInput = document.querySelector('.message-input');
    const sendButton = document.querySelector('.send-button');
    const attachButton = document.getElementById('attach-file-button'); // Находим кнопку скрепки
    const fileInput = document.getElementById('file-input'); // Находим инпут файла

    if (!messageInput || !sendButton || !attachButton || !fileInput) { // Проверяем наличие новых элементов
        console.error('Не найдены все необходимые элементы для отправки сообщения или файла');
        return;
    }

    // Удаляем предыдущие обработчики событий, чтобы избежать дублирования
    // Важно: нужен именованный обработчик для удаления
    messageInput.removeEventListener('keypress', handleMessageInputKeypress);
    sendButton.removeEventListener('click', handleSendButtonClick);
    attachButton.removeEventListener('click', handleAttachButtonClick); // Удаляем старый обработчик скрепки
    fileInput.removeEventListener('change', handleFileSelect); // Удаляем старый обработчик выбора файла

    // Сохраняем информацию о чате в атрибуты элементов
    messageInput.setAttribute('data-chat-id', chatId);
    messageInput.setAttribute('data-chat-type', isGroup ? 'group' : 'direct');
    sendButton.setAttribute('data-chat-id', chatId);
    sendButton.setAttribute('data-chat-type', isGroup ? 'group' : 'direct');
    attachButton.setAttribute('data-chat-id', chatId); // Добавляем атрибуты и для скрепки
    attachButton.setAttribute('data-chat-type', isGroup ? 'group' : 'direct');
    fileInput.setAttribute('data-chat-id', chatId);
    fileInput.setAttribute('data-chat-type', isGroup ? 'group' : 'direct');

    // Добавляем новые обработчики
    messageInput.addEventListener('keypress', handleMessageInputKeypress);
    sendButton.addEventListener('click', handleSendButtonClick);
    attachButton.addEventListener('click', handleAttachButtonClick); // Добавляем обработчик для скрепки
    fileInput.addEventListener('change', handleFileSelect); // Добавляем обработчик для выбора файла

    // Показываем поле ввода сообщения, если оно было скрыто
    const inputContainer = document.querySelector('.input-container');
    if (inputContainer) {
        inputContainer.style.display = 'flex';
    }

    // Фокус на поле ввода сообщения
    setTimeout(() => messageInput.focus(), 0); // Небольшая задержка для надежности
}

// Обработчик клика по кнопке скрепки
function handleAttachButtonClick() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.click(); // Программно кликаем по скрытому инпуту файла
    }
}

// Обработчик выбора файла
async function handleFileSelect(event) { 
    const file = event.target.files[0];
    const chatId = event.target.getAttribute('data-chat-id');
    const isGroup = event.target.getAttribute('data-chat-type') === 'group';

    if (file && chatId) {
        console.log('Выбран файл:', file.name, 'Тип:', file.type, 'Размер:', file.size, 'Для чата:', chatId);
        
        // Показываем уведомление о начале загрузки
        showNotification(`Загрузка файла: ${file.name}...`, 'info');

        try {
            // Используем функцию uploadFile из api.js вместо прямого запроса
            const result = await window.uploadFile(chatId, isGroup, file);
            
            if (!result.success) {
                throw new Error(result.error || 'Ошибка при загрузке файла');
            }

            console.log('Файл успешно загружен:', result);
            showNotification(`Файл ${file.name} успешно загружен!`, 'success');
            
            // Вместо обновления всего чата, добавляем сообщение в UI через websocket data
            // Система WebSocket должна сама уведомить об этом сообщении всех участников
            
            // В случае, если WebSocket не сработал, после небольшой задержки обновим весь чат
            setTimeout(() => {
                // Проверяем, было ли сообщение добавлено через WebSocket
                const messageElement = document.querySelector(`.message[data-message-id="${result.message?.id}"]`);
                if (!messageElement && result.message?.id) {
                    console.log('Сообщение не было добавлено через WebSocket, обновляем вручную');
                    
                    // Проверяем, поддерживается ли appendMessageToChat из websocket.js
                    if (typeof window.appendMessageToChat === 'function') {
                        window.appendMessageToChat(result.message, isGroup);
                    } else {
                        // Если нет, обновляем весь чат
                        loadChatMessages(chatId, isGroup);
                    }
                    
                    // Обновляем список чатов в любом случае
                    if (typeof window.loadChats === 'function') {
                        window.loadChats();
                    }
                }
            }, 2000); // Даем 2 секунды на обработку WebSocket

        } catch (error) {
            console.error('Ошибка при загрузке файла:', error);
            showNotification(`Ошибка при загрузке файла: ${error.message}`, 'error');
        } finally {
            // Очищаем инпут файла в любом случае, чтобы можно было выбрать тот же файл снова
            event.target.value = null;
        }

    } else {
        console.error('Файл не выбран или не удалось определить чат.');
        // Очищаем инпут на всякий случай
        event.target.value = null;
    }
}

// Обработчик нажатия Enter в поле ввода сообщения (должна быть глобальной или экспортированной)
function handleMessageInputKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const chatId = event.target.getAttribute('data-chat-id');
        const chatType = event.target.getAttribute('data-chat-type');

        if (chatId) {
            sendChatMessage(chatId, chatType === 'group');
        } else {
            console.error('Ошибка: не найден ID чата для отправки сообщения');
        }
    }
}

// Функция-обработчик для кнопки отправки сообщения
function handleSendButtonClick() {
    console.log('Клик по кнопке отправки');
    
    // Получаем текст сообщения
    const messageInput = document.querySelector('.message-input');
    const content = messageInput.value.trim();
    
    // Проверяем, что сообщение не пустое
    if (!content) {
        console.log('Сообщение пустое, не отправляем');
        return;
    }
    
    // Получаем ID чата из атрибута
    const chatId = this.getAttribute('data-chat-id');
    const isGroup = this.getAttribute('data-chat-type') === 'group';
    
    // Проверяем наличие идентификатора чата
    if (!chatId) {
        console.error('ID чата не определен, не отправляем сообщение');
        return;
    }
    
    // Проверяем, является ли это ответом на сообщение
    const replyToId = messageInput.getAttribute('data-reply-to'); // Получаем ID из атрибута
    
    // Создаем объект данных сообщения
    const messageData = {
        chat_id: chatId,
        content: content,
        is_group: isGroup,
        reply_to: replyToId || null // Добавляем reply_to, если он есть
    };
    
    // Если был ответ, удаляем плашку и атрибут
    if (replyToId) {
        const replyPreview = document.querySelector('.reply-preview'); // Ищем правильный элемент
        if (replyPreview) {
            replyPreview.remove();
        }
        messageInput.removeAttribute('data-reply-to'); // Удаляем атрибут
    }
    
    // Отправляем сообщение на сервер
    sendChatMessage(chatId, isGroup);
}

// Отправка сообщения через WebSocket или HTTP
async function sendChatMessage(chatId, isGroup) {
    const messageInput = document.querySelector('.message-input');
    if (!messageInput) return;

    const messageText = messageInput.value.trim();
    if (!messageText) return;

    const replyToId = messageInput.getAttribute('data-reply-to');
    console.log(`Attempting to send message in ${isGroup ? 'group' : 'chat'} ${chatId}. ReplyTo: ${replyToId || 'none'}. Text: "${messageText}"`);

    const tempId = `temp_${Date.now()}`;
    
    // --- Get reply info for clearing UI ---
    const replyPreview = document.querySelector('.reply-preview');
    if (replyPreview) {
        replyPreview.remove(); // Remove preview
    }
    messageInput.removeAttribute('data-reply-to'); // Clear reply state from input
    // --- End reply info ---

    // --- Sending Logic ---
    const websocketConnected = window.chatSocket && window.chatSocket.readyState === WebSocket.OPEN;

    if (websocketConnected) {
        console.log('WebSocket is connected. Attempting send via WS.');
        const messagePayload = {
            type: isGroup ? 'group_message' : 'direct_message',
            content: messageText,
            reply_to: replyToId ? parseInt(replyToId) : null // Send reply_to via WS
        };
        if (isGroup) {
            messagePayload.group_id = parseInt(chatId);
        } else {
            messagePayload.chat_id = parseInt(chatId);
        }

        try {
            window.chatSocket.send(JSON.stringify(messagePayload));
            console.log('Message sent successfully via WebSocket:', messagePayload);
            // Clear input ONLY after successful WS send attempt
            messageInput.value = ''; 
            // No need to call sendMessageToServer if WS succeeds
            return;
        } catch (error) {
            console.error('Error sending message via WebSocket:', error);
            // If WS fails, proceed to HTTP fallback ONLY for direct messages
            if (isGroup) {
                showNotification('Failed to send message via WebSocket. Please check your connection.', 'error');
                return; // No HTTP fallback for groups in this design
            } else {
                 showNotification('WebSocket error, attempting HTTP fallback...', 'warning');
            }
        }
    } else {
        console.warn('WebSocket is not connected.');
        // Proceed to HTTP fallback ONLY for direct messages
        if (isGroup) {
             showNotification('WebSocket is not connected. Cannot send group messages.', 'error');
             return; // No HTTP fallback for groups
        } else {
            console.log('Attempting send via HTTP fallback for direct message.');
        }
    }

    // --- HTTP Fallback (ONLY FOR DIRECT MESSAGES) ---
    if (!isGroup) {
        const messageDataForHttp = {
            chat_id: parseInt(chatId),
            message: messageText, // Field name expected by /api/chat/send-message
            reply_to: replyToId ? parseInt(replyToId) : null
        };
        // Clear input field before HTTP fallback too (less critical but consistent)
        messageInput.value = ''; 
        // Call the dedicated HTTP sending function
        sendMessageToServer(messageDataForHttp, tempId); // No need to await here, it handles its own errors/updates
    }
}

// HTTP Sending Function (Now ONLY for Direct Messages Fallback)
async function sendMessageToServer(directMessageData, tempId) {
     console.log('Sending direct message via HTTP fallback:', directMessageData);
    try {
        const url = `/api/chat/send-message`; // Fixed URL for direct messages

        // requestData is directly the argument now
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(directMessageData), // Send the direct message data
            credentials: 'include'
        });

        if (!response.ok) {
            let errorDetail = `Failed to send message via HTTP: ${response.status} ${response.statusText}`;
             try {
                 const errorJson = await response.json();
                 // Log the detailed error from FastAPI validation
                 console.error("FastAPI Validation Error:", errorJson.detail);
                 errorDetail = `Failed to send: ${errorJson.detail[0]?.msg || errorDetail}` ; // Try to get specific field error
             } catch (e) { /* Error parsing JSON */ }
            throw new Error(errorDetail); // Throw the detailed error
        }

        const responseData = await response.json();
        console.log('Message sent successfully via HTTP:', responseData);

        // Update the message ID in the UI if the server responded with one
        if (responseData && responseData.message_id) {
            updateMessageId(tempId, responseData.message_id);
        } else {
            console.warn('Server HTTP response did not include message_id:', responseData);
            // Message remains with tempId, might cause issues later if not handled
        }
        // Optionally refresh chats/messages if needed after HTTP success
        // loadChats();
        // loadChatMessages(directMessageData.chat_id, false); // Reload messages for this chat

    } catch (error) {
        console.error('Error in sendMessageToServer (HTTP fallback):', error);
        showNotification(error.message || 'Failed to send message via HTTP.', 'error'); // Show detailed error
        markMessageAsError(tempId); // Mark optimistic message as failed
        // Do not re-throw, just handle the error here
    }
}

// Функция для проверки существования чата по ID
async function checkChatExists(chatId) {
    console.log('Проверка существования чата с ID:', chatId);
    try {
        const response = await fetch(`/api/chat/check/${chatId}`);
        console.log('Результат проверки чата:', { status: response.status, ok: response.ok });
        if (!response.ok) {
            if (response.status === 404) {
                console.log('Чат не найден на сервере');
                return false;
            }
            throw new Error(`Ошибка проверки чата: ${response.status}`);
        }
        const data = await response.json();
        console.log('Данные о чате:', data);
        return data.exists === true;
    } catch (error) {
        console.error('Ошибка при проверке существования чата:', error);
        return false;
    }
}

// Обработчик клика по элементу чата в списке чатов
function handleChatItemClick(chatItem) {
    const chatId = chatItem.getAttribute('data-chat-id');
    const chatType = chatItem.getAttribute('data-chat-type');

    console.log('Клик на чате:', {
        id: chatId,
        type: chatType,
        name: chatItem.querySelector('.chat-name')?.textContent
    });

    if (chatId) {
        openChat(chatId, chatType); // Используем openChat напрямую, т.к. клик из списка гарантирует существование DOM элемента
    } else {
        console.error('Ошибка: не найден ID чата');
    }
}

// Функция для оптимистичного отображения сообщения в UI до получения ответа сервера
function appendOptimisticMessage(chatId, isGroup, content, tempId, replyToId = null, replySender = null, replyText = null) {
    const messageContainer = document.querySelector('.message-container');
    if (!messageContainer) {
        console.error('Контейнер сообщений не найден');
        return;
    }
    
    const timestamp = new Date().toISOString();
    const formattedTime = formatMessageTime(timestamp);
    
    const userIdElement = document.querySelector('meta[name="user-id"]');
    const currentUserId = userIdElement ? parseInt(userIdElement.getAttribute('content')) : null;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message my-message';
    messageElement.setAttribute('data-message-id', tempId);
    messageElement.setAttribute('data-sender-id', currentUserId);
    messageElement.setAttribute('data-timestamp', timestamp);
    messageElement.setAttribute('data-temp-id', tempId);
    
    let replyHTML = '';
    // Добавляем блок ответа, если это ответ на сообщение
    if (replyToId && replySender) {
        replyHTML = `
            <div class="reply-container">
                <span class="reply-sender">${replySender}</span>
                <span class="reply-text">${replyText || 'Original message'}</span>
            </div>
        `;
    }
    
    messageElement.innerHTML = `
        <div class="message-bubble">
            ${replyHTML}
            <div class="message-text">${content}</div>
            <div class="message-time">
                ${formattedTime}
                <span class="read-status unread"><i class="fas fa-check"></i></span>
            </div>
        </div>
        <div class="message-menu-trigger"><i class="fas fa-ellipsis-v"></i></div>
    `;
    
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
    
    // Добавляем контекстное меню к сообщению
    if (window.contextMenu && typeof window.contextMenu.addToMessage === 'function') {
        window.contextMenu.addToMessage(messageElement);
    }
    
    return messageElement;
}

// Функция для обновления ID сообщения (после получения настоящего ID от сервера)
function updateMessageId(tempId, realId) {
    const messageElement = document.querySelector(`[data-temp-id="${tempId}"]`);
    if (messageElement) {
        messageElement.setAttribute('data-message-id', realId);
        messageElement.removeAttribute('data-temp-id');
    }
}

// Функция для маркировки сообщения как ошибочного при сбое отправки
function markMessageAsError(tempId) {
    const messageElement = document.querySelector(`[data-temp-id="${tempId}"]`);
    if (messageElement) {
        const messageBubble = messageElement.querySelector('.message-bubble');
        if (messageBubble) {
            messageBubble.classList.add('error');
        }
    }
}

// --- ДОБАВЛЕНО: Вызов инициализации индикатора --- 
// Вызываем после определения всех нужных функций
document.addEventListener('DOMContentLoaded', setupFloatingDateIndicator);

// --- Image Lightbox Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const closeBtn = document.querySelector('.lightbox-close-btn');
    const messageContainer = document.querySelector('.message-container'); // Main container for messages

    if (!lightbox || !lightboxImage || !closeBtn || !messageContainer) {
        console.warn('Lightbox elements or message container not found. Lightbox functionality disabled.');
        return;
    }

    // Use event delegation on the message container
    messageContainer.addEventListener('click', (event) => {
        // Check if the clicked element is an image inside a message bubble
        if (event.target.classList.contains('message-image')) {
            const imageElement = event.target;
            lightboxImage.src = imageElement.src;
            lightbox.style.display = 'flex'; // Show the lightbox (use flex as defined in CSS)
            console.log('Lightbox opened for image:', imageElement.src);
        }
    });

    // Function to close the lightbox
    const closeLightbox = () => {
        lightbox.style.display = 'none';
        lightboxImage.src = ''; // Clear src
        console.log('Lightbox closed');
    };

    // Close lightbox when clicking the close button
    closeBtn.addEventListener('click', closeLightbox);

    // Close lightbox when clicking on the background (outside the image)
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) { // Only close if the click is directly on the background
            closeLightbox();
        }
    });
});
// --- End Image Lightbox Logic ---

// --- ДОБАВЛЕНО: Функция обновления UI статуса пользователя --- 
function updateUserStatusUI(userId, statusData) {
    console.log(`[StatusUpdate] Updating status for user ${userId}:`, statusData);
    const currentChatId = document.querySelector('.message-container')?.getAttribute('data-chat-id');
    const currentChatType = document.querySelector('.message-container')?.getAttribute('data-chat-type');
    const isChatOpen = document.querySelector('.conversation')?.style.display === 'flex';

    let statusText = 'status unknown';
    // Показываем индикатор ТОЛЬКО если is_online === true
    const shouldShowIndicator = statusData ? statusData.is_online === true : false;

    // Рассчитываем statusText (логика остается прежней, использует last_seen)
    if (shouldShowIndicator) { 
        statusText = 'online';
    } else if (statusData && statusData.last_seen) {
        try {
            const lastSeen = statusData.last_seen; // Используем переменную для читаемости
            const dt = luxon.DateTime.fromISO(lastSeen, { zone: 'utc' });
            const localDt = dt.setZone('Asia/Bishkek');
            const now = luxon.DateTime.now().setZone('Asia/Bishkek');
            statusText = 'last seen ';
            if (localDt.hasSame(now, 'day')) {
                statusText += `today at ${localDt.toFormat('HH:mm')}`;
            } else if (localDt.hasSame(now.minus({ days: 1 }), 'day')) {
                statusText += `yesterday at ${localDt.toFormat('HH:mm')}`;
            } else if (now.diff(localDt, 'days').days < 7) {
                statusText += `on ${localDt.toFormat('ccc at HH:mm')}`;
            } else {
                statusText += `on ${localDt.toFormat('dd.MM.yyyy')}`;
            }
        } catch (luxonError) {
            console.error("Ошибка форматирования last_seen:", luxonError, "Timestamp:", lastSeen);
            statusText = 'last seen recently';
        }
    } else {
        statusText = 'last seen long time ago';
    }

    // 1. Обновление в списке чатов
    const chatListItem = document.querySelector(`.chat-item[data-user-id="${userId}"][data-chat-type="direct"]`);
    if (chatListItem) {
        const statusElement = chatListItem.querySelector('.user-status-list'); 
        
        // --- ДОБАВЛЕН ЛОГ HTML АВАТАРА --- 
        const avatarElementForLog = chatListItem.querySelector('.chat-avatar');
        if (avatarElementForLog) {
            console.log(`[StatusUpdate] HTML inside .chat-avatar for user ${userId}:`, avatarElementForLog.innerHTML);
        } else {
             console.warn(`[StatusUpdate] Could not find .chat-avatar to log HTML for user ${userId}`);
        }
        // --- КОНЕЦ ЛОГА --- 

        // Исправлен селектор: ищем индикатор внутри .chat-avatar
        const onlineIndicator = chatListItem.querySelector('.chat-avatar .online-indicator'); 
        
        if (!statusElement) {
             console.warn(`[StatusUpdate] .user-status-list not found in chat item for user ${userId}. Status might not be displayed in list.`);
        }

        if (onlineIndicator) {
             // Используем вычисленное значение shouldShowIndicator
             console.log(`[StatusUpdate] Final decision: shouldShowIndicator = ${shouldShowIndicator}`);
             console.log(`[StatusUpdate] Attempting to set display=${shouldShowIndicator ? 'block' : 'none'} for indicator:`, onlineIndicator);
             onlineIndicator.style.display = shouldShowIndicator ? 'block' : 'none';
             console.log(`[StatusUpdate] Chat list indicator for ${userId} set to ${shouldShowIndicator ? 'visible' : 'hidden'}`);
        } else {
            // Этот лог теперь будет более информативным после предыдущего
            console.warn(`[StatusUpdate] .online-indicator element not found inside .chat-avatar for user ${userId}`);
        }
        // Используем вычисленное значение shouldShowIndicator для класса
        chatListItem.classList.toggle('online', shouldShowIndicator);
    }

    // 2. Обновление в заголовке открытого чата
    const conversationHeader = document.querySelector('.conversation-header');
    // Получаем ID пользователя напрямую из атрибута шапки
    const headerUserId = conversationHeader?.getAttribute('data-user-id');

    // Проверяем, открыт ли чат и совпадает ли ID пользователя в шапке с ID из сообщения
    if (isChatOpen && headerUserId && headerUserId == userId) {
        const headerStatusElement = conversationHeader.querySelector('.user-status-header');
        if (headerStatusElement) {
            headerStatusElement.textContent = statusText; // statusText рассчитан выше
            console.log(`[StatusUpdate] Header status for user ${userId} updated to: ${statusText}`);
        } else {
            console.warn(`[StatusUpdate] .user-status-header not found in open chat header for user ${userId}.`);
        }
    } else {
         // Логируем, почему шапка не обновилась (для отладки)
         if (isChatOpen && headerUserId && headerUserId != userId) {
            console.log(`[StatusUpdate] Header not updated for user ${userId}. Open chat header is for user ${headerUserId}.`);
         } else if (!isChatOpen) {
            console.log(`[StatusUpdate] Header not updated for user ${userId}. Conversation not open.`);
         } else if (!headerUserId) {
            console.log(`[StatusUpdate] Header not updated for user ${userId}. Header has no data-user-id (likely group chat).`);
    }
}
}
// --- КОНЕЦ ФУНКЦИИ ---