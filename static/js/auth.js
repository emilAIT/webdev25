document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleLinks = document.querySelectorAll('.toggle-link');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const sendCodeButton = document.getElementById('send-code');
    const messageElement = document.getElementById('message');

    // Toggle between login and register forms
    toggleLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            loginForm.classList.toggle('active');
            registerForm.classList.toggle('active');
        });
    });

    // Handle login
    loginButton.addEventListener('click', async function () {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showMessage('Пожалуйста, заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Авторизация успешна!', 'success');
                // Добавляем метку времени к URL для предотвращения кэширования
                const timestamp = new Date().getTime();
                setTimeout(() => {
                    window.location.href = '/main?t=' + timestamp;
                }, 1000);
            } else {
                showMessage(data.message || 'Ошибка при авторизации', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Сервер недоступен', 'error');
        }
    });

    // Handle registration
    registerButton.addEventListener('click', async function () {
        const username = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const verificationCode = document.getElementById('verification-code').value;
        const profilePic = document.getElementById('profile-pic').files[0];

        if (!username || !email || !password || !verificationCode) {
            showMessage('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }

        try {
            // Используем FormData для отправки всех данных вместе с фото одним запросом
            const formData = new FormData();
            formData.append('nickname', username);
            formData.append('email', email);
            formData.append('password', password);
            formData.append('verificationCode', verificationCode);
            
            // Добавляем фото профиля, если оно есть
            if (profilePic) {
                formData.append('profile_photo', profilePic);
            }

            const response = await fetch('/register', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Регистрация успешна!', 'success');
                // Добавляем метку времени к URL для предотвращения кэширования
                const timestamp = new Date().getTime();
                setTimeout(() => {
                    window.location.href = '/main?t=' + timestamp;
                }, 1000);
            } else {
                showMessage(data.message || 'Ошибка при регистрации', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Сервер недоступен', 'error');
        }
    });

    // Send verification code
    sendCodeButton.addEventListener('click', async function (e) {
        e.preventDefault();
        const email = document.getElementById('register-email').value;

        if (!email) {
            showMessage('Сначала введите email адрес', 'error');
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            showMessage('Пожалуйста, введите корректный email адрес', 'error');
            return;
        }

        sendCodeButton.textContent = 'Отправка...';
        sendCodeButton.style.opacity = '0.7';
        sendCodeButton.style.pointerEvents = 'none';

        try {
            const response = await fetch('/api/send-verification-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Код подтверждения отправлен на ' + email, 'success');
                document.getElementById('verification-code').focus();

                let countdown = 60;
                const countdownInterval = setInterval(() => {
                    sendCodeButton.textContent = `Повторно через ${countdown}с`;
                    countdown--;

                    if (countdown < 0) {
                        clearInterval(countdownInterval);
                        sendCodeButton.textContent = 'Отправить код';
                        sendCodeButton.style.opacity = '1';
                        sendCodeButton.style.pointerEvents = 'auto';
                    }
                }, 1000);
            } else {
                showMessage(data.detail || 'Ошибка при отправке кода подтверждения', 'error');
                resetSendCodeButton();
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Сервер недоступен', 'error');
            resetSendCodeButton();
        }
    });

    function resetSendCodeButton() {
        sendCodeButton.textContent = 'Отправить код';
        sendCodeButton.style.opacity = '1';
        sendCodeButton.style.pointerEvents = 'auto';
    }

    function showMessage(text, type) {
        messageElement.textContent = text;
        messageElement.style.display = 'block';
        messageElement.className = 'message ' + type;

        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 3000);
    }
});
