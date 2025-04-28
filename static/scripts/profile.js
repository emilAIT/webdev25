
        const userData = {
            firstName: "Alice",
            lastName: "Johnson",
            phone: "+1 (555) 123-4567",
            title: "Team Lead",
            bio: "Leading teams with a passion for communication.",
            theme: "blue",
            status: { current: "online", message: "Available" }
        };

        function loadSettings() {
            document.getElementById('firstName').value = userData.firstName;
            document.getElementById('lastName').value = userData.lastName;
            document.getElementById('phone').value = userData.phone;
            document.getElementById('title').value = userData.title;
            document.getElementById('bio').value = userData.bio;
            document.getElementById('avatarPreview').textContent = userData.firstName[0].toUpperCase();
            selectTheme(userData.theme, true);
            document.getElementById('currentStatus').value = userData.status.current;
        }

        function showSection(sectionId) {
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.querySelectorAll('.sidebar-item').forEach(item => {
                item.classList.remove('active');
            });
            document.getElementById(sectionId).classList.add('active');
            document.querySelector(`.sidebar-item[onclick="showSection('${sectionId}')"]`).classList.add('active');
        }

        document.getElementById('firstName').addEventListener('input', function (e) {
            const preview = document.getElementById('avatarPreview');
            const value = e.target.value.trim();
            preview.textContent = value ? value[0].toUpperCase() : '?';
        });

        function selectTheme(theme, initial = false) {
            document.querySelectorAll('.theme-card').forEach(card => {
                card.classList.remove('selected');
            });
            const selectedCard = document.querySelector(`.theme-card[data-theme="${theme}"]`);
            selectedCard.classList.add('selected');

            if (!initial) {
                switch (theme) {
                    case 'light':
                        document.body.style.background = '#f5f5f5';
                        break;
                    case 'blue':
                        document.body.style.background = 'linear-gradient(135deg, #0288d1, #4fc3f7)';
                        break;
                    case 'dark':
                        document.body.style.background = '#424242';
                        break;
                }
                userData.theme = theme;
            }
        }

        function saveSettings() {
            userData.firstName = document.getElementById('firstName').value;
            userData.lastName = document.getElementById('lastName').value;
            userData.phone = document.getElementById('phone').value;
            userData.title = document.getElementById('title').value;
            userData.bio = document.getElementById('bio').value;
            userData.status.current = document.getElementById('currentStatus').value;

            alert('Settings saved successfully!');
            console.log('Saved settings:', userData);
            window.location.href = 'user-profile.html';
        }

        window.onload = loadSettings;