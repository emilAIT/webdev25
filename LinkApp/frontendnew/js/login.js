document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.container');
    const registerBtn = document.querySelector('.register-btn');
    const loginBtn = document.querySelector('.login-btn');

    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            container.classList.add('active');
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            container.classList.remove('active');
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.container');
    const registerBtn = document.querySelector('.register-btn');
    const loginBtn = document.querySelector('.login-btn');

    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            container.classList.add('active');
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            container.classList.remove('active');
        });
    }

    // Находим форму регистрации
    const registerForm = document.querySelector('.form-box.register form');
    // Находим форму входа
    const loginForm = document.querySelector('.form-box.login form');
    
    if (registerForm) {
        registerForm.onsubmit = function(event) {
            event.preventDefault();
            console.log("Форма регистрации отправлена, переходим на dashboard");
            navigateToDashboard();
            return false;
        };
    }
    
    if (loginForm) {
        loginForm.onsubmit = function(event) {
            event.preventDefault();
            console.log("Форма входа отправлена, переходим на dashboard");
            navigateToDashboard();
            return false;
        };
    }
    
    // Функция для перехода на dashboard
    function navigateToDashboard() {
        try {
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Ошибка при переходе на dashboard:", error);
            alert("Произошла ошибка при переходе. Пробуем альтернативный путь.");
            // Резервный вариант
            window.location.replace('dashboard.html');
        }
    }
});

// Mock database for demonstration
const users = [
    { username: "testuser", password: "password123" }
];

// Логин пользователя
function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorElement = document.getElementById('login-error');

    if (!username || !password) {
        errorElement.textContent = 'Please fill in all fields.';
        return;
    }

    // Проверка пользователя
    const users = JSON.parse(localStorage.getItem('users')) || {};
    if (users[username] && users[username].password === password) {
        alert('Login successful!');
        window.location.href = 'dashboard.html';
    } else {
        errorElement.textContent = 'Invalid username or password.';
    }
}

// Регистрация пользователя
async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const errorElement = document.getElementById('register-error');

    if (!username || !email || !phone || password.length < 8) {
        errorElement.textContent = 'Please fill out all fields correctly.';
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:8000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, phone, password }),
        });

        const result = await response.json();
        if (response.ok) {
            alert('Registration successful!');
            window.location.href = 'login.html';
        } else {
            errorElement.textContent = result.detail || 'Registration failed.';
        }
    } catch (error) {
        console.error(error);
        errorElement.textContent = 'Failed to register. Please try again.';
    }
}

// Добавьте в конец файла:
const debugButton = document.createElement('button');
debugButton.style.position = 'fixed';
debugButton.style.top = '10px';
debugButton.style.right = '10px';
debugButton.style.padding = '10px';
debugButton.style.color = 'white';
debugButton.style.zIndex = '9999';

document.body.appendChild(debugButton);