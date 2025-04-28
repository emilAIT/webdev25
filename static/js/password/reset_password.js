document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('new-password');
    const btn = document.getElementById('reset-password-btn');
    const error = document.getElementById('reset-password-error');
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    btn.addEventListener('click', async function() {
        const newPassword = passwordInput.value.trim();
        if (!newPassword) {
            error.textContent = "Введите новый пароль";
            return;
        }
        try {
            const response = await fetch('/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: newPassword })
            });
            const data = await response.json();
            if (response.ok) {
                error.style.color = "green";
                error.textContent = "Пароль успешно изменён!";
                passwordInput.value = "";
            } else {
                error.style.color = "red";
                error.textContent = data.detail || "Ошибка. Попробуйте ещё раз.";
            }
        } catch (e) {
            error.textContent = "Ошибка сети";
        }
    });
});