document.addEventListener('DOMContentLoaded', function() {
    // DOM элементы
    const profilePhoto = document.querySelector('.profile-photo');
    const profilePhotoInput = document.getElementById('profilePhotoInput');
    const profilePhotoPreview = document.getElementById('profilePhotoPreview');
    const savePhotoBtn = document.getElementById('savePhotoBtn');
    const savePasswordBtn = document.getElementById('savePasswordBtn');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const profileError = document.getElementById('profileError');
    const profileSuccess = document.getElementById('profileSuccess');
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');

    // Обработчик клика на фото профиля
    profilePhoto.addEventListener('click', function() {
        // Анимация выделения при клике
        profilePhoto.classList.add('photo-change-active');
        
        // Открываем диалог выбора файла
        profilePhotoInput.click();
    });

    // Обработчик выбора нового файла фото
    profilePhotoInput.addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                // Обновляем превью фото
                profilePhotoPreview.src = e.target.result;
                
                // Показываем кнопку сохранения
                savePhotoBtn.classList.remove('hidden');
                
                // Добавляем эффект свечения для привлечения внимания
                savePhotoBtn.classList.add('pulse');
            };
            
            reader.readAsDataURL(this.files[0]);
        }
    });

    // Обработчик сохранения нового фото
    savePhotoBtn.addEventListener('click', function() {
        const formData = new FormData();
        formData.append('profile_photo', profilePhotoInput.files[0]);
        
        // Отключаем кнопку при отправке
        savePhotoBtn.disabled = true;
        savePhotoBtn.innerText = 'Сохранение...';
        
        fetch('/api/user/update-photo', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccess('Фото профиля успешно обновлено');
                savePhotoBtn.classList.add('hidden');
                profilePhoto.classList.remove('photo-change-active');
            } else {
                showError(data.message || 'Ошибка при обновлении фото');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('Произошла ошибка при обновлении фото');
        })
        .finally(() => {
            savePhotoBtn.disabled = false;
            savePhotoBtn.innerText = 'Сохранить фото';
            savePhotoBtn.classList.remove('pulse');
        });
    });

    // Обработчик сохранения нового пароля
    savePasswordBtn.addEventListener('click', function() {
        // Сбрасываем предыдущие ошибки
        hideError();
        
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Валидация
        if (!currentPassword || !newPassword || !confirmPassword) {
            showError('Пожалуйста, заполните все поля пароля');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showError('Новые пароли не совпадают');
            confirmPasswordInput.classList.add('shake');
            setTimeout(() => {
                confirmPasswordInput.classList.remove('shake');
            }, 500);
            return;
        }
        
        if (newPassword.length < 6) {
            showError('Новый пароль должен содержать не менее 6 символов');
            return;
        }
        
        // Отключаем кнопку при отправке
        savePasswordBtn.disabled = true;
        savePasswordBtn.innerText = 'Сохранение...';
        
        // Отправляем запрос на обновление пароля
        fetch('/api/user/update-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccess('Пароль успешно обновлен');
                // Очищаем поля
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
            } else {
                showError(data.message || 'Ошибка при обновлении пароля');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('Произошла ошибка при обновлении пароля');
        })
        .finally(() => {
            savePasswordBtn.disabled = false;
            savePasswordBtn.innerText = 'Сохранить пароль';
        });
    });

    // Обработчики для переключения видимости пароля
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const type = input.getAttribute('type');
            
            if (type === 'password') {
                input.setAttribute('type', 'text');
                this.textContent = 'visibility';
            } else {
                input.setAttribute('type', 'password');
                this.textContent = 'visibility_off';
            }
            
            // Анимация кнопки
            this.classList.add('shake');
            setTimeout(() => {
                this.classList.remove('shake');
            }, 500);
        });
    });

    // Функция для отображения ошибки
    function showError(message) {
        profileError.textContent = message;
        profileError.classList.remove('hidden');
        
        // Анимируем появление сообщения
        profileError.style.opacity = '0';
        setTimeout(() => {
            profileError.style.opacity = '1';
        }, 10);
    }

    // Функция для скрытия ошибки
    function hideError() {
        profileError.classList.add('hidden');
        profileSuccess.classList.add('hidden');
    }
    
    // Функция для отображения успешного сообщения
    function showSuccess(message) {
        profileSuccess.textContent = message;
        profileSuccess.classList.remove('hidden');
        
        // Анимируем появление сообщения
        profileSuccess.style.opacity = '0';
        setTimeout(() => {
            profileSuccess.style.opacity = '1';
        }, 10);
        
        // Автоматически скрываем сообщение через 3 секунды
        setTimeout(() => {
            profileSuccess.style.opacity = '0';
            setTimeout(() => {
                profileSuccess.classList.add('hidden');
            }, 300);
        }, 3000);
    }

    // Добавляем эффект наведения для полей ввода
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    });
});
