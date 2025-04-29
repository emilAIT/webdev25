document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    
    // Элементы для многошаговой регистрации
    const goToStep2Button = document.getElementById('goToStep2Button');
    const goToStep3Button = document.getElementById('goToStep3Button');
    const backToStep1Button = document.getElementById('backToStep1Button');
    const backToStep2Button = document.getElementById('backToStep2Button');
    const selectPhotoButton = document.getElementById('selectPhotoButton');
    const profilePhotoInput = document.getElementById('profilePhotoInput');
    const profilePhotoPreview = document.getElementById('profilePhotoPreview');
    const nicknameError = document.getElementById('nicknameError');
    const registerStep1 = document.getElementById('registerStep1');
    const registerStep2 = document.getElementById('registerStep2');
    const registerStep3 = document.getElementById('registerStep3');

    // Переход между шагами регистрации
    goToStep2Button.addEventListener('click', function() {
        const nickname = document.getElementById('registerNickname').value.trim();
        
        if (!nickname) {
            nicknameError.textContent = 'Пожалуйста, введите никнейм';
            nicknameError.classList.remove('hidden');
            return;
        }
        
        // Проверка доступности никнейма через API
        fetch('/check-nickname', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nickname }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.available) {
                registerStep1.classList.add('hidden');
                registerStep2.classList.remove('hidden');
                nicknameError.classList.add('hidden');
            } else {
                nicknameError.textContent = 'Этот никнейм уже занят';
                nicknameError.classList.remove('hidden');
            }
        })
        .catch(error => {
            nicknameError.textContent = 'Ошибка проверки никнейма';
            nicknameError.classList.remove('hidden');
            console.error('Error:', error);
        });
    });

    // Обработка выбора фото профиля
    selectPhotoButton.addEventListener('click', function() {
        profilePhotoInput.click();
    });

    profilePhotoInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                profilePhotoPreview.src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    });

    goToStep3Button.addEventListener('click', function() {
        registerStep2.classList.add('hidden');
        registerStep3.classList.remove('hidden');
    });

    backToStep1Button.addEventListener('click', function() {
        registerStep2.classList.add('hidden');
        registerStep1.classList.remove('hidden');
    });

    backToStep2Button.addEventListener('click', function() {
        registerStep3.classList.add('hidden');
        registerStep2.classList.remove('hidden');
    });

    // Функция для входа
    loginButton.addEventListener('click', function() {
        const nickname = document.getElementById('loginNickname').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!nickname || !password) {
            loginError.textContent = 'Пожалуйста, заполните все поля';
            loginError.classList.remove('hidden');
            return;
        }

        // Отправляем запрос на сервер для входа
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nickname, password }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/chat';  // Изменено с '/main' на '/chat'
            } else {
                loginError.textContent = data.message || 'Ошибка входа';
                loginError.classList.remove('hidden');
            }
        })
        .catch(error => {
            loginError.textContent = 'Ошибка сервера';
            loginError.classList.remove('hidden');
            console.error('Error:', error);
        });
    });

    // Функция для регистрации
    registerButton.addEventListener('click', function() {
        const nickname = document.getElementById('registerNickname').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const profilePhotoFile = profilePhotoInput.files[0];

        // Сбросить предыдущие ошибки
        registerError.classList.add('hidden');
        
        // Валидация
        if (!password || !confirmPassword) {
            registerError.textContent = 'Пожалуйста, заполните все поля';
            registerError.classList.remove('hidden');
            return;
        }
        
        if (password !== confirmPassword) {
            registerError.textContent = 'Пароли не совпадают';
            registerError.classList.remove('hidden');
            return;
        }

        if (password.length < 6) {
            registerError.textContent = 'Пароль должен содержать не менее 6 символов';
            registerError.classList.remove('hidden');
            return;
        }

        // Создаем объект FormData для отправки файла
        const formData = new FormData();
        formData.append('nickname', nickname);
        formData.append('password', password);
        if (profilePhotoFile) {
            formData.append('profile_photo', profilePhotoFile);
        }

        // Отправляем запрос на сервер для регистрации
        fetch('/register', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Показать сообщение об успехе и перейти к форме входа
                alert('Регистрация успешна! Теперь вы можете войти в систему.');
                document.getElementById('showLoginLink').click();
            } else {
                registerError.textContent = data.message || 'Ошибка регистрации';
                registerError.classList.remove('hidden');
            }
        })
        .catch(error => {
            registerError.textContent = 'Ошибка сервера';
            registerError.classList.remove('hidden');
            console.error('Error:', error);
        });
    });
});
