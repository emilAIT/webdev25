// Функция для переключения пароля
async function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.nextElementSibling; // span.toggle-password

    if (input.type === "password") {
        input.type = "text";
    } else {
        input.type = "password";
    }

    const eye = toggle.querySelector('.icon-eye');
    const eyeOff = toggle.querySelector('.icon-eye-off');
    eye.classList.toggle('hidden');
    eyeOff.classList.toggle('hidden');
}