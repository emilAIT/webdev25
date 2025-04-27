// Модуль для обработки авторизации и регистрации

document.addEventListener('DOMContentLoaded', function() {
    // Инициализация обработчиков формы
    initLoginForm();
    initRegisterForm();
    initForgotPasswordViewToggle();
});

// Функция для проверки reCAPTCHA
function verifyCaptcha() {
    const response = grecaptcha.getResponse();
    if (response.length === 0) {
        return false; // Капча не решена
    }
    return true; // Капча решена
}

// Инициализация формы входа
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    const errorElement = document.getElementById('login-error'); // Находим элемент для ошибки
    
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        errorElement.style.display = 'none'; // Скрываем предыдущие ошибки
        
        // Проверка reCAPTCHA
        if (!verifyCaptcha()) {
            showLoginError('Solve the captcha to continue.');
            return;
        }
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const submitButton = loginForm.querySelector('button[type="submit"]');
        
        if (!emailInput || !passwordInput) return;
        
        // --- ДОБАВЛЯЕМ ПРОВЕРКУ НА ПУСТЫЕ ПОЛЯ ---
        const loginValue = emailInput.value.trim();
        const passwordValue = passwordInput.value.trim();

        if (!loginValue || !passwordValue) {
            showLoginError('Please fill in the Email and Password fields.');
            return; // Прерываем отправку, если поля пустые
        }
        // --- КОНЕЦ ПРОВЕРКИ ---
        
        // Отладочная информация
        console.log('Значения полей формы логина:');
        console.log('Email:', emailInput.value);
        console.log('Password длина:', passwordInput.value.length);
        
        // Отключаем кнопку отправки и показываем загрузку
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
        
        try {
            // Создаем FormData из формы
            const formData = new FormData(loginForm);
            
            // Отправляем данные на бэкенд
            const response = await fetch('/login', { // Используем fetch напрямую
                method: 'POST',
                body: formData
            });

            const result = await response.json(); // Ожидаем JSON в любом случае

            if (response.ok) {
                // Успешный вход, делаем редирект на URL из ответа
                if (result.success && result.redirect_url) {
                    window.location.href = result.redirect_url;
                } else {
                    // Неожиданный успешный ответ
                    showLoginError('Не удалось выполнить перенаправление после входа.');
                }
            } else {
                // Ошибка входа, показываем сообщение из ответа
                showLoginError(result.detail || 'Произошла ошибка при входе.');
            }
        } catch (error) {
            console.error("Login fetch error:", error); // Логируем ошибку fetch
            showLoginError('Ошибка сети или сервера. Повторите попытку.');
        } finally {
            // Восстанавливаем кнопку
            submitButton.disabled = false;
            submitButton.innerHTML = 'Войти';
            // Сбрасываем reCAPTCHA
            grecaptcha.reset();
        }
    });
}

// Инициализация формы регистрации
function initRegisterForm() {
    const registerForm = document.getElementById('register-form');
    const errorElement = document.getElementById('register-error');
    
    if (!registerForm) return;
    
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        if (errorElement) {
            errorElement.style.display = 'none'; // Скрываем предыдущие ошибки
        }
        
        // Проверка reCAPTCHA
        if (!verifyCaptcha()) {
            showRegisterError('Пожалуйста, пройдите проверку reCAPTCHA.');
            return;
        }
        
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmPasswordInput = document.getElementById('register-confirm-password');
        const submitButton = registerForm.querySelector('button[type="submit"]');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmPasswordInput) return;
        
        // --- ДОБАВЛЯЕМ ПРОВЕРКУ НА ПУСТЫЕ ПОЛЯ ---
        const nameValue = nameInput.value.trim();
        const emailValue = emailInput.value.trim();
        const passwordValue = passwordInput.value.trim();
        const confirmPasswordValue = confirmPasswordInput.value.trim();

        if (!nameValue || !emailValue || !passwordValue) {
            showRegisterError('Please fill in all required fields (Name, Email, Password).');
            return;
        }
        
        // Валидация полей
        if (passwordInput.value !== confirmPasswordInput.value) {
            showRegisterError('Пароли не совпадают');
            return;
        }
        
        // Отключаем кнопку отправки и показываем загрузку
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
        
        try {
            // Сохраняем данные для автологина
            const loginCredentials = {
                email: emailValue,
                password: passwordValue,
                captchaResponse: grecaptcha.getResponse()
            };

            // Делаем запрос на регистрацию без формы
            const registrationResponse = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'email': emailValue,
                    'username': nameValue,
                    'password': passwordValue,
                    'g-recaptcha-response': grecaptcha.getResponse()
                }),
                redirect: 'manual' // Важно: не следуем за редиректами
            });
            
            // Если регистрация прошла успешно (статус 2xx или 3xx)
            if (registrationResponse.ok || registrationResponse.type === 'opaqueredirect') {
                showRegisterSuccess('Registration successful! Logging you in...');
                
                // Задержка перед автоматическим входом
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Выполняем автологин
                await performAutoLogin(loginCredentials);
            } else {
                // Пытаемся получить детали ошибки
                try {
                    const errorData = await registrationResponse.json();
                    showRegisterError(errorData.detail || 'Ошибка регистрации. Повторите попытку позже.');
                } catch (parseError) {
                    showRegisterError('Ошибка регистрации. Повторите попытку позже.');
                }
            }
        } catch (error) {
            console.error("Register fetch error:", error);
            showRegisterError(error.message || 'Ошибка регистрации. Повторите попытку.');
        } finally {
            // Восстанавливаем кнопку
            submitButton.disabled = false;
            submitButton.innerHTML = 'Зарегистрироваться';
            // Сбрасываем reCAPTCHA
            grecaptcha.reset();
        }
    });
}

// Функция для автоматического входа после регистрации
async function performAutoLogin(credentials) {
    try {
        // Создаем данные для входа
        const loginFormData = new FormData();
        loginFormData.append('login_id', credentials.email);
        loginFormData.append('password', credentials.password);
        loginFormData.append('g-recaptcha-response', credentials.captchaResponse);
        
        // Отправляем запрос на вход
        const loginResponse = await fetch('/login', {
            method: 'POST',
            body: loginFormData,
            credentials: 'include',
            redirect: 'follow'
        });
        
        if (loginResponse.redirected) {
            // Если был редирект после успешного входа, переходим по URL
            window.location.href = loginResponse.url;
            return;
        }
        
        const loginResult = await loginResponse.json();
        
        if (loginResponse.ok) {
            // Перенаправляем на главную страницу или dashboard
            window.location.href = loginResult.redirect_url || '/chat';
        } else {
            // Если вход не удался, всё равно направляем на страницу входа
            window.location.href = '/login';
        }
    } catch (loginError) {
        console.error("Автологин после регистрации не удался:", loginError);
        // В случае ошибки автологина перенаправляем на страницу входа
        window.location.href = '/login';
    }
}

// Инициализация переключения между входом и сбросом пароля
function initForgotPasswordViewToggle() {
    const loginView = document.getElementById('login-view');
    const forgotPasswordView = document.getElementById('forgot-password-view');
    const forgotPasswordLink = document.querySelector('.forgot-password');
    const backToLoginLink = document.getElementById('back-to-login-link');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotErrorElement = document.getElementById('forgot-error');
    const forgotSuccessElement = document.getElementById('forgot-success');
    const forgotEmailInput = document.getElementById('forgot-email');

    if (!loginView || !forgotPasswordView || !forgotPasswordLink || !backToLoginLink || !forgotPasswordForm) {
        console.error('Required elements for view toggling not found');
        return;
    }

    // Клик на "Forgot Password?"
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'none';
        forgotPasswordView.style.display = 'block';
        forgotErrorElement.style.display = 'none'; // Скрываем сообщения при переключении
        forgotSuccessElement.style.display = 'none';
        forgotEmailInput.value = ''; // Очищаем поле
    });

    // Клик на "Back to Login"
    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordView.style.display = 'none';
        loginView.style.display = 'block';
    });

    // Обработка отправки формы сброса пароля (та же логика, что была в модальном окне)
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        forgotErrorElement.style.display = 'none';
        forgotSuccessElement.style.display = 'none';
        const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        const email = forgotEmailInput.value.trim();
        if (!email) {
            showForgotError('Please enter your email address.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Reset Link';
            return;
        }

        console.log('Запрос на сброс пароля для email:', email);

        // --- РАСКОММЕНТИРУЕМ И ИСПОЛЬЗУЕМ FETCH ---
        try {
            const response = await fetch('/request-password-reset', { // Указываем новый endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Отправляем JSON
                body: JSON.stringify({ email: email }) // Помещаем email в тело запроса
            });
            const result = await response.json();
            if (response.ok) {
                showForgotSuccess(result.detail || 'Password reset link sent successfully!');
                forgotEmailInput.value = ''; // Очищаем поле после успеха
            } else {
                // Бэкенд всегда возвращает 200 OK в этом случае, но на всякий случай
                showForgotError(result.detail || 'Failed to send reset link.');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            showForgotError('Network or server error. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Reset Link';
        }
        // --------------------------------------------
        
        /* // УДАЛЯЕМ СТАРУЮ ЗАГЛУШКУ
        setTimeout(() => {
             showForgotSuccess('If an account exists for this email, a password reset link has been sent.');
             forgotEmailInput.value = '';
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Reset Link';
        }, 1000);
        */
    });
}

// Функции для показа сообщений в модальном окне
function showForgotError(message) {
    const errorElement = document.getElementById('forgot-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function showForgotSuccess(message) {
    const successElement = document.getElementById('forgot-success');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
}

// Показ ошибки входа
function showLoginError(message) {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        alert(message);
    }
}

// Показ ошибки регистрации
function showRegisterError(message) {
    const errorElement = document.getElementById('register-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        alert(message);
    }
}

// Показ успешного сообщения при регистрации
function showRegisterSuccess(message) {
    const successElement = document.getElementById('register-success');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    } else {
        alert(message);
    }
}