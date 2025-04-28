/**
 * Функционал для редактирования профиля пользователя
 */

document.addEventListener('DOMContentLoaded', function() {
    // Получаем элементы
    const profilePhotoBtn = document.getElementById('profile-photo-btn');
    const editProfileModal = document.getElementById('edit-profile-modal');
    const profileModalCloseBtn = document.getElementById('profile-modal-close-btn');
    const profileSaveBtn = document.getElementById('profile-save-btn');
    const profilePhotoInput = document.getElementById('profile-photo-input');
    const profilePreviewImage = document.getElementById('profile-preview-image');
    const profilePhotoContainer = document.querySelector('.profile-photo');
    const profileMessage = document.getElementById('profile-message');
    
    // Проверяем наличие элементов
    if (!profilePhotoBtn || !editProfileModal) {
        console.error('Необходимые элементы для редактирования профиля не найдены');
        return;
    }
    
    // Открытие модального окна редактирования профиля
    function openProfileModal() {
        editProfileModal.classList.add('active');
        // Загружаем текущие данные пользователя
        fetchUserData();
    }
    
    // Закрытие модального окна редактирования профиля
    function closeProfileModal() {
        editProfileModal.classList.remove('active');
        // Очищаем поля и сообщения
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        if (profileMessage) profileMessage.textContent = '';
        if (profileMessage) profileMessage.style.display = 'none';
    }
    
    // Получение данных пользователя
    async function fetchUserData() {
        try {
            const response = await fetch('/api/user/me');
            const data = await response.json();
            
            if (data.success) {
                // Заполняем поля данными пользователя
                document.getElementById('profile-nickname').value = data.user.nickname;
                if (data.user.email) {
                    document.getElementById('profile-email').value = data.user.email;
                }
                
                // Обновляем фото профиля
                const timestamp = new Date().getTime();
                profilePreviewImage.src = `/api/user/photo?t=${timestamp}`;
            } else {
                showProfileMessage('Не удалось загрузить данные профиля', 'error');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            showProfileMessage('Ошибка при загрузке данных профиля', 'error');
        }
    }
    
    // Отображение сообщений в модальном окне профиля
    function showProfileMessage(message, type = 'success') {
        if (!profileMessage) return;
        
        profileMessage.textContent = message;
        profileMessage.className = 'modal-message ' + type;
        profileMessage.style.display = 'block';
        
        setTimeout(() => {
            profileMessage.style.display = 'none';
        }, 3000);
    }
    
    // Обработчик кнопки сохранения профиля
    profileSaveBtn.addEventListener('click', async function() {
        // Получаем значения полей
        const nickname = document.getElementById('profile-nickname').value;
        const email = document.getElementById('profile-email').value;
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Проверяем обязательные поля
        if (!nickname) {
            showProfileMessage('Имя пользователя обязательно', 'error');
            return;
        }
        
        // Проверяем совпадение паролей
        if (newPassword && newPassword !== confirmPassword) {
            showProfileMessage('Пароли не совпадают', 'error');
            return;
        }
        
        // Проверяем длину пароля
        if (newPassword && newPassword.length < 6) {
            showProfileMessage('Пароль должен содержать не менее 6 символов', 'error');
            return;
        }
        
        // Если пользователь хочет сменить пароль, необходимо указать текущий пароль
        if (newPassword && !currentPassword) {
            showProfileMessage('Для смены пароля необходимо указать текущий пароль', 'error');
            return;
        }
        
        try {
            // Создаем FormData для отправки данных и файла
            const formData = new FormData();
            formData.append('nickname', nickname);
            if (email) formData.append('email', email);
            
            // Добавляем пароли, если они заполнены
            if (currentPassword && newPassword) {
                formData.append('current_password', currentPassword);
                formData.append('new_password', newPassword);
            }
            
            // Добавляем фото, если оно выбрано
            if (profilePhotoInput.files && profilePhotoInput.files[0]) {
                formData.append('profile_photo', profilePhotoInput.files[0]);
            }
            
            // Отправляем данные на сервер
            const response = await fetch('/api/user/update_profile', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showProfileMessage('Профиль успешно обновлен', 'success');
                
                // Обновляем отображаемое имя пользователя
                document.querySelector('.user-name').textContent = nickname;
                
                // Обновляем фото профиля на всех элементах
                updateAllProfileImages();
                
                // Закрываем модальное окно через небольшую задержку
                setTimeout(() => {
                    closeProfileModal();
                }, 1500);
            } else {
                showProfileMessage(data.message || 'Ошибка при обновлении профиля', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showProfileMessage('Произошла ошибка при обновлении профиля', 'error');
        }
    });
    
    // Функция для обновления всех фотографий профиля на странице
    function updateAllProfileImages() {
        const timestamp = new Date().getTime();
        
        // Выбираем только изображения текущего пользователя
        // Изображения текущего пользователя не имеют ID пользователя в URL
        const profileImages = document.querySelectorAll('img[src^="/api/user/photo"]:not([src*="/api/user/photo/"])');
        
        profileImages.forEach(img => {
            const newSrc = `/api/user/photo?t=${timestamp}`;
            img.src = newSrc;
        });
    }
    
    // Обработчик клика на фото профиля
    profilePhotoBtn.addEventListener('click', openProfileModal);
    profileModalCloseBtn.addEventListener('click', closeProfileModal);
    
    // Закрытие модального окна при клике вне его содержимого
    editProfileModal.addEventListener('click', function(event) {
        if (event.target === editProfileModal) {
            closeProfileModal();
        }
    });
    
    // Обработка выбора фото
    profilePhotoContainer.addEventListener('click', function() {
        profilePhotoInput.click();
    });
    
    // Предварительный просмотр выбранного фото
    profilePhotoInput.addEventListener('change', function(event) {
        if (event.target.files && event.target.files[0]) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                profilePreviewImage.src = e.target.result;
            }
            
            reader.readAsDataURL(event.target.files[0]);
        }
    });
});
