// Модуль для работы с API

// Базовая функция для отправки запросов
async function fetchAPI(url, method = 'GET', data = null, contentType = 'application/json') {
    const options = {
        method: method,
        headers: {
            'Accept': 'application/json',
        },
        credentials: 'include'
    };
    
    if (data) {
        if (contentType === 'application/json') {
            options.headers['Content-Type'] = contentType;
            options.body = JSON.stringify(data);
            console.log('Отправка тела запроса (JSON):', options.body);
        } else if (contentType === 'multipart/form-data') {
            // Для загрузки файлов не указываем Content-Type, 
            // браузер сам установит правильный с boundary
            options.body = data;
        }
    }
    
    console.log(`Отправка ${method} запроса на ${url}:`, options);
    
    try {
        const response = await fetch(url, options);
        
        console.log('Получен ответ:', response.status, response.statusText);
        
        // Проверка на ошибки аутентификации
        if (response.status === 401) {
            window.location.href = '/login';
            return null;
        }
        
        // Проверка на другие ошибки
        if (!response.ok) {
            // Попытка прочитать тело ответа как JSON
            const responseText = await response.text();
            console.log('Тело ответа с ошибкой:', responseText);
            
            let errorData;
            try {
                errorData = JSON.parse(responseText);
                console.log('Распарсенные данные ошибки:', errorData);
            } catch (e) {
                errorData = { detail: responseText || `Ошибка сервера: ${response.status}` };
                console.log('Ошибка парсинга JSON, используем текст как есть');
            }
            
            // Форматируем сообщение об ошибке
            let errorMessage = '';
            
            if (Array.isArray(errorData.detail)) {
                // Если ошибка - массив объектов (Pydantic validation errors)
                console.log('Обработка массива ошибок');
                errorMessage = errorData.detail.map(err => {
                    if (err.loc && err.loc.length > 1) {
                        return `Поле "${err.loc[1]}": ${err.msg}`;
                    }
                    return err.msg;
                }).join('; ');
            } else if (typeof errorData.detail === 'object') {
                // Если ошибка - объект
                console.log('Обработка объекта ошибок');
                errorMessage = Object.values(errorData.detail).join('; ');
            } else {
                // Если ошибка - строка или что-то еще
                console.log('Обработка строки ошибки');
                errorMessage = errorData.detail || 'Неизвестная ошибка';
            }
            
            throw new Error(errorMessage);
        }
        
        // Для некоторых запросов (например DELETE) может не быть тела ответа
        if (response.status === 204) {
            return { success: true };
        }
        
        // Парсинг JSON ответа
        const responseData = await response.json();
        console.log('Успешный ответ:', responseData);
        return responseData;
    } catch (error) {
        console.error('API ошибка:', error);
        
        // Используем функцию showLoginError или showRegisterError вместо showNotification
        // для ошибок на страницах логина и регистрации
        const path = window.location.pathname;
        if (path === '/login') {
            if (typeof showLoginError === 'function') {
                showLoginError(error.message || 'Ошибка запроса.');
            } 
        } else if (path === '/register') {
            if (typeof showRegisterError === 'function') {
                showRegisterError(error.message || 'Ошибка запроса.');
            }
        } else if (typeof showNotification === 'function') {
            showNotification(error.message, 5000, 'error');
        } else {
            // Если никакой функции нет, используем alert
            alert(error.message || 'Произошла ошибка при выполнении запроса.');
        }
        
        throw error;
    }
}

// Функция входа
async function login(email, password) {
    console.log('Аргументы login:', { email, password });
    
    try {
        // Отправляем данные через FormData
        console.log('Отправка данных входа через FormData...');
        
        // Создаем FormData
        const formData = new FormData();
        formData.append('login_id', email);
        formData.append('password', password);
        
        // Отправляем запрос
        const formResult = await fetch('/login', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            redirect: 'follow' // Следовать за перенаправлениями
        });
        
        console.log('Результат входа FormData:', formResult.status, formResult.statusText);
        
        // Проверяем статус ответа
        if (formResult.status >= 200 && formResult.status < 400) {
            // Успешный вход (включая перенаправления 3xx)
            console.log('Вход успешен, статус:', formResult.status);
            
            // Если это перенаправление, перенаправляем пользователя
            if (formResult.redirected) {
                console.log('Перенаправление на:', formResult.url);
                window.location.href = formResult.url;
                return { success: true, redirected: true };
            }
            
            // Если сервер вернул HTML, не пытаемся парсить его как JSON
            const contentType = formResult.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                console.log('Сервер вернул HTML');
                return { success: true };
            }
            
            // Если всё-таки JSON, пробуем его распарсить
            try {
                const jsonData = await formResult.json();
                return { success: true, ...jsonData };
            } catch (parseError) {
                console.log('Ответ не в формате JSON, считаем вход успешным');
                return { success: true };
            }
        } else {
            // Ошибка
            const errorText = await formResult.text();
            console.error('Ошибка входа, статус:', formResult.status);
            console.error('Текст ошибки:', errorText);
            
            let errorMessage = `Ошибка входа (${formResult.status})`;
            try {
                // Пробуем распарсить JSON-ошибку
                const errorData = JSON.parse(errorText);
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => {
                            if (err.loc && err.loc.length > 1) {
                                return `Поле "${err.loc[1]}": ${err.msg}`;
                            }
                            return err.msg;
                        }).join('; ');
                    } else {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                // Если не JSON, используем текст как есть
                if (errorText && errorText.length < 100) {
                    errorMessage = errorText;
                }
            }
            
            // Если статус 401, значит неверные учетные данные
            if (formResult.status === 401) {
                errorMessage = 'Неверный email или пароль';
            }
            
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Ошибка при входе:', error);
        return { success: false, error: error.message };
    }
}

// Функция регистрации напрямую без обертки
async function register(username, email, password) {
    console.log('Аргументы register:', { username, email, password });
    
    try {
        // Пропускаем JSON-попытку и сразу используем FormData
        console.log('Отправка данных через FormData...');
        
        // Создаем FormData
        const formData = new FormData();
        formData.append('username', username);
        formData.append('email', email);
        formData.append('password', password);
        
        // Отправляем как multipart/form-data
        const formResult = await fetch('/register', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            redirect: 'follow' // Следовать за перенаправлениями
        });
        
        console.log('Результат FormData:', formResult.status, formResult.statusText);
        
        // Проверяем статус ответа
        if (formResult.status >= 200 && formResult.status < 400) {
            // Успешная регистрация (включая перенаправления 3xx)
            console.log('Регистрация успешна, статус:', formResult.status);
            
            // Если это перенаправление, перенаправляем пользователя
            if (formResult.redirected) {
                console.log('Перенаправление на:', formResult.url);
                window.location.href = formResult.url;
                return { success: true, redirected: true };
            }
            
            // Если сервер вернул HTML, не пытаемся парсить его как JSON
            const contentType = formResult.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                console.log('Сервер вернул HTML');
                return { success: true };
            }
            
            // Если всё-таки JSON, пробуем его распарсить
            try {
                const jsonData = await formResult.json();
                return { success: true, ...jsonData };
            } catch (parseError) {
                console.log('Ответ не в формате JSON, считаем регистрацию успешной');
                return { success: true };
            }
        } else {
            // Ошибка
            const errorText = await formResult.text();
            console.error('Ошибка регистрации, статус:', formResult.status);
            console.error('Текст ошибки:', errorText);
            
            let errorMessage = `Ошибка регистрации (${formResult.status})`;
            try {
                // Пробуем распарсить JSON-ошибку
                const errorData = JSON.parse(errorText);
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail.map(err => {
                            if (err.loc && err.loc.length > 1) {
                                return `Поле "${err.loc[1]}": ${err.msg}`;
                            }
                            return err.msg;
                        }).join('; ');
                    } else {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                // Если не JSON, используем текст как есть
                if (errorText && errorText.length < 100) {
                    errorMessage = errorText;
                }
            }
            
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        return { success: false, error: error.message };
    }
}

// Функции для работы с чатами
async function loadChats() {
    try {
        const chats = await fetchAPI('/api/chat/list');
        return chats;
    } catch (error) {
        console.error('Ошибка при загрузке чатов:', error);
        return [];
    }
}

async function getChatMessages(chatId, offset = 0, limit = 50) {
    try {
        const messages = await fetchAPI(`/api/chat/${chatId}/messages?offset=${offset}&limit=${limit}`);
        return messages;
    } catch (error) {
        console.error(`Ошибка при загрузке сообщений для чата ${chatId}:`, error);
        return [];
    }
}

async function searchUsers(query) {
    try {
        const users = await fetchAPI(`/api/chat/users/search?query=${encodeURIComponent(query)}`);
        return users;
    } catch (error) {
        console.error('Ошибка при поиске пользователей:', error);
        return [];
    }
}

async function createChat(userId) {
    try {
        const result = await fetchAPI('/api/chat/create', 'POST', { user_id: userId });
        return result;
    } catch (error) {
        console.error('Ошибка при создании чата:', error);
        return null;
    }
}

// Функции для работы с группами
async function createGroup(name, description, memberIds) {
    console.log('Вызвана функция createGroup с параметрами:', {
        name: name,
        description: description,
        memberIds: memberIds
    });
    
    try {
        // Проверяем параметры
        if (!name || typeof name !== 'string' || name.trim() === '') {
            throw new Error('Название группы обязательно и должно быть строкой');
        }
        
        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            throw new Error('Необходимо выбрать хотя бы одного участника');
        }
        
        console.log('Отправляем запрос на создание группы...');
        
        // Форматируем данные для отправки
        const data = {
            group_name: name,
            description: description || '',
            member_ids: memberIds
        };
        
        console.log('Тело запроса:', JSON.stringify(data));
        
        // Отправляем запрос с использованием fetchAPI
        const result = await fetchAPI('/api/groups/create', 'POST', data);
        console.log('Получен результат от сервера:', result);
        
        // Проверяем ответ сервера
        if (!result) {
            throw new Error('Пустой ответ от сервера');
        }
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        return result;
    } catch (error) {
        console.error('Ошибка при создании группы:', error);
        throw error;
    }
}

async function getGroupInfo(groupId) {
    try {
        const group = await fetchAPI(`/api/groups/${groupId}`);
        return group;
    } catch (error) {
        console.error(`Ошибка при получении информации о группе ${groupId}:`, error);
        return null;
    }
}

// Функции для работы с профилем
async function getUserProfile() {
    try {
        const profile = await fetchAPI('/api/chat/current-user');
        return profile;
    } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
        return null;
    }
}

async function updateUserProfile(profileData) {
    try {
        const result = await fetchAPI('/api/chat/profile', 'PUT', profileData);
        return result;
    } catch (error) {
        console.error('Ошибка при обновлении профиля:', error);
        return null;
    }
}

async function uploadAvatar(file) {
    try {
        console.log('Начинаем загрузку аватара, размер файла:', file.size, 'bytes');
        
        const formData = new FormData();
        formData.append('avatar', file);
        
        console.log('Отправляем запрос на загрузку аватара:', file.name, file.type);
        
        // Делаем запрос на загрузку аватара
        const result = await fetchAPI('/api/chat/avatar', 'POST', formData, 'multipart/form-data');
        
        console.log('Результат загрузки аватара:', result);
        
        // Если ответ пустой, создаем стандартный ответ
        if (!result) {
            return { success: false, error: 'Пустой ответ от сервера' };
        }
        
        return result;
    } catch (error) {
        console.error('Ошибка при загрузке аватара:', error);
        return { 
            success: false, 
            error: error.message || 'Неизвестная ошибка при загрузке аватара' 
        };
    }
}

// Upload file to chat
async function uploadFile(chatId, isGroup, file) {
    try {
        console.log('Starting file upload to chat, file size:', file.size, 'bytes');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('chat_id', chatId);
        formData.append('is_group', isGroup);
        
        console.log('Sending file upload request:', file.name, file.type);
        
        // Make the request to upload the file
        const result = await fetchAPI('/api/chat/upload-file', 'POST', formData, 'multipart/form-data');
        
        console.log('File upload result:', result);
        
        if (!result) {
            return { success: false, error: 'Empty response from server' };
        }
        
        return result;
    } catch (error) {
        console.error('Error during file upload:', error);
        return { 
            success: false, 
            error: error.message || 'Unknown error during file upload' 
        };
    }
}

// Export functions for use in other modules
window.fetchAPI = fetchAPI;
window.login = login;
window.register = register;
window.loadChats = loadChats;
window.getChatMessages = getChatMessages;
window.searchUsers = searchUsers;
window.createChat = createChat;
window.createGroup = createGroup;
window.getGroupInfo = getGroupInfo;
window.getUserProfile = getUserProfile;
window.updateUserProfile = updateUserProfile;
window.uploadAvatar = uploadAvatar;
window.uploadFile = uploadFile; // Export the new function