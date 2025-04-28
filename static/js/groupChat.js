/**
 * Функционал для создания и управления групповыми чатами
 */

document.addEventListener('DOMContentLoaded', function() {
    // Элементы для работы с модальным окном создания группы
    const createGroupBtn = document.querySelector('.user-icon[title="Новая группа"]');
    const groupModal = document.getElementById('create-group-modal');
    const closeGroupModalBtn = document.getElementById('group-modal-close-btn');
    const createGroupSubmitBtn = document.getElementById('group-create-btn');
    const groupNameInput = document.getElementById('group-name');
    const groupDescInput = document.getElementById('group-description');
    const groupPhotoInput = document.getElementById('group-photo-input');
    const groupPreviewImage = document.getElementById('group-preview-image');
    const photoOverlay = document.querySelector('#create-group-modal .photo-overlay');
    const participantsSearchInput = document.getElementById('participants-search-input');
    const participantsResults = document.getElementById('participants-results');
    const selectedParticipantsList = document.getElementById('selected-participants-list');
    const participantsCountSpan = document.getElementById('participants-count');
    const groupMessageElement = document.getElementById('group-message');
    
    // Проверяем наличие элементов на странице
    if (!createGroupBtn || !groupModal) {
        console.log('Элементы для работы с групповыми чатами не найдены');
        return;
    }

    // Массив для хранения выбранных участников
    let selectedParticipants = [];
    // Массив для кэширования контактов
    let cachedContacts = [];

    // Открытие модального окна создания группы
    function openGroupModal() {
        groupModal.classList.add('active');
        // Сбрасываем форму
        resetGroupForm();
        // Загружаем контакты пользователя
        loadUserContacts();
    }

    // Закрытие модального окна создания группы
    function closeGroupModal() {
        groupModal.classList.remove('active');
    }

    // Сброс формы создания группы
    function resetGroupForm() {
        groupNameInput.value = '';
        groupDescInput.value = '';
        groupPhotoInput.value = '';
        groupPreviewImage.src = '/static/images/default_group.png';
        selectedParticipants = [];
        updateSelectedParticipantsUI();
    }

    // Обработчики событий для модального окна
    createGroupBtn?.addEventListener('click', openGroupModal);
    closeGroupModalBtn?.addEventListener('click', closeGroupModal);
    
    // Закрытие модального окна при клике вне содержимого
    groupModal?.addEventListener('click', function(e) {
        if (e.target === groupModal) {
            closeGroupModal();
        }
    });

    // Обработка выбора фото группы
    photoOverlay?.addEventListener('click', function() {
        groupPhotoInput.click();
    });

    // Предпросмотр выбранного изображения
    groupPhotoInput?.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                groupPreviewImage.src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    });

    // Обработка поиска участников
    participantsSearchInput?.addEventListener('input', function() {
        const searchQuery = this.value.trim().toLowerCase();
        if (searchQuery) {
            filterContacts(searchQuery);
        } else {
            displayAllContacts();
        }
    });

    // Загрузка контактов пользователя
    async function loadUserContacts() {
        try {
            // Показываем индикатор загрузки
            participantsResults.innerHTML = '<div class="loading">Загрузка контактов...</div>';
            
            // Запрашиваем список чатов (диалогов) пользователя
            const response = await fetch('/api/chats');
            const data = await response.json();
            
            if (data.success) {
                // Фильтруем только диалоги (не группы)
                const dialogs = data.chats.filter(chat => chat.type === 'dialog');
                
                if (dialogs.length === 0) {
                    participantsResults.innerHTML = '<div class="no-results">У вас пока нет контактов</div>';
                    return;
                }
                
                // Сохраняем в кэш
                cachedContacts = dialogs.map(chat => ({
                    id: chat.participant_id,
                    name: chat.participant_name || chat.name,
                    avatar: `/api/user/photo/${chat.participant_id}`
                }));
                
                // Отображаем контакты
                displayAllContacts();
            } else {
                participantsResults.innerHTML = '<div class="error">Не удалось загрузить контакты</div>';
            }
        } catch (error) {
            console.error('Ошибка при загрузке контактов:', error);
            participantsResults.innerHTML = '<div class="error">Ошибка загрузки</div>';
        }
    }

    // Отображение всех контактов
    function displayAllContacts() {
        if (cachedContacts.length === 0) {
            participantsResults.innerHTML = '<div class="no-results">Контакты не найдены</div>';
            return;
        }

        renderContactsList(cachedContacts);
    }

    // Фильтрация контактов по поисковому запросу
    function filterContacts(query) {
        const filteredContacts = cachedContacts.filter(
            contact => contact.name.toLowerCase().includes(query)
        );
        
        if (filteredContacts.length === 0) {
            participantsResults.innerHTML = '<div class="no-results">Контакты не найдены</div>';
        } else {
            renderContactsList(filteredContacts);
        }
    }

    // Отрисовка списка контактов
    function renderContactsList(contacts) {
        let html = '';
        
        contacts.forEach(contact => {
            // Проверяем, выбран ли контакт
            const isSelected = selectedParticipants.some(p => p.id === contact.id);
            const selectedClass = isSelected ? 'selected' : '';
            
            html += `
                <div class="contact-item ${selectedClass}" data-id="${contact.id}" data-name="${contact.name}">
                    <div class="contact-avatar">
                        <img src="${contact.avatar}" alt="${contact.name}" onerror="this.src='/static/images/avatar.png'">
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">${contact.name}</div>
                    </div>
                    <div class="contact-select">
                        ${isSelected ? '✓' : ''}
                    </div>
                </div>
            `;
        });
        
        participantsResults.innerHTML = html;
        
        // Добавляем обработчики событий для выбора контактов
        document.querySelectorAll('.contact-item').forEach(item => {
            item.addEventListener('click', function() {
                const contactId = this.dataset.id;
                const contactName = this.dataset.name;
                toggleParticipant(contactId, contactName, this.querySelector('.contact-avatar img').src);
                this.classList.toggle('selected');
                this.querySelector('.contact-select').textContent = this.classList.contains('selected') ? '✓' : '';
            });
        });
    }

    // Добавление/удаление участника из списка выбранных
    function toggleParticipant(id, name, avatar) {
        const index = selectedParticipants.findIndex(p => p.id === id);
        
        if (index !== -1) {
            // Удаляем из списка
            selectedParticipants.splice(index, 1);
        } else {
            // Добавляем в список
            selectedParticipants.push({ id, name, avatar });
        }
        
        updateSelectedParticipantsUI();
    }

    // Обновление UI списка выбранных участников
    function updateSelectedParticipantsUI() {
        participantsCountSpan.textContent = selectedParticipants.length;
        
        if (selectedParticipants.length === 0) {
            selectedParticipantsList.innerHTML = '<div class="no-participants">Выберите участников из списка</div>';
            return;
        }
        
        let html = '';
        selectedParticipants.forEach(participant => {
            html += `
                <div class="selected-participant" data-id="${participant.id}">
                    <div class="participant-avatar">
                        <img src="${participant.avatar}" alt="${participant.name}" onerror="this.src='/static/images/avatar.png'">
                    </div>
                    <div class="participant-name">${participant.name}</div>
                    <div class="remove-participant" title="Удалить">✕</div>
                </div>
            `;
        });
        
        selectedParticipantsList.innerHTML = html;
        
        // Добавляем обработчики для удаления участников
        document.querySelectorAll('.remove-participant').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const participantItem = this.closest('.selected-participant');
                const participantId = participantItem.dataset.id;
                
                // Удаляем из списка выбранных
                const index = selectedParticipants.findIndex(p => p.id === participantId);
                if (index !== -1) {
                    selectedParticipants.splice(index, 1);
                }
                
                // Обновляем отображение выбранных участников
                updateSelectedParticipantsUI();
                
                // Обновляем отметку в списке контактов
                const contactItem = document.querySelector(`.contact-item[data-id="${participantId}"]`);
                if (contactItem) {
                    contactItem.classList.remove('selected');
                    contactItem.querySelector('.contact-select').textContent = '';
                }
            });
        });
    }

    // Показ сообщений об ошибках или успехе
    function showMessage(message, type = 'error') {
        groupMessageElement.textContent = message;
        groupMessageElement.className = `modal-message ${type}`;
        groupMessageElement.style.display = 'block';
        
        // Скрываем сообщение через 3 секунды
        setTimeout(() => {
            groupMessageElement.style.display = 'none';
        }, 3000);
    }

    // Создание группы
    createGroupSubmitBtn?.addEventListener('click', async function() {
        // Проверяем название группы
        const groupName = groupNameInput.value.trim();
        if (!groupName) {
            showMessage('Введите название группы');
            return;
        }
        
        // Проверяем наличие участников
        if (selectedParticipants.length === 0) {
            showMessage('Добавьте хотя бы одного участника');
            return;
        }
        
        // Создаем объект FormData для отправки данных
        const formData = new FormData();
        formData.append('chat_name', groupName);
        formData.append('description', groupDescInput.value.trim());
        
        // Добавляем ID участников
        selectedParticipants.forEach(participant => {
            formData.append('member_ids', participant.id);
        });
        
        // Добавляем фото группы, если оно выбрано
        if (groupPhotoInput.files && groupPhotoInput.files[0]) {
            formData.append('group_photo', groupPhotoInput.files[0]);
        }
        
        try {
            // Показываем индикатор загрузки
            createGroupSubmitBtn.textContent = 'Создание...';
            createGroupSubmitBtn.disabled = true;
            
            // Отправляем запрос на создание группы
            const response = await fetch('/api/chat/create_group', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('Группа успешно создана!', 'success');
                
                // Закрываем модальное окно через 1 секунду
                setTimeout(() => {
                    closeGroupModal();
                    
                    // Обновляем список чатов
                    if (window.chatModule) {
                        window.chatModule.updateChatsList();
                    } else {
                        // Если модуль чата не доступен, перезагружаем страницу
                        window.location.reload();
                    }
                }, 1000);
            } else {
                showMessage(data.message || 'Ошибка при создании группы');
            }
        } catch (error) {
            console.error('Ошибка при создании группы:', error);
            showMessage('Произошла ошибка при создании группы');
        } finally {
            // Восстанавливаем кнопку
            createGroupSubmitBtn.textContent = 'Создать';
            createGroupSubmitBtn.disabled = false;
        }
    });
});
