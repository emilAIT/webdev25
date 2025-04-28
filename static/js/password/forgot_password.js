document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('forgot-password');
    const sendBtn = document.getElementById('forgot-password-btn');
    const errorMessage = document.getElementById('forgot-password-error');

    sendBtn.addEventListener('click', async function() {
        const email = emailInput.value.trim();
        if (!email) {
            errorMessage.textContent = "Please enter your email address.";
            return;
        }
        try {
            const response = await fetch('/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (response.ok) {
                errorMessage.style.color = "#90ee90";
                errorMessage.textContent = "An email with password reset instructions has been sent to your address.";
                emailInput.value = "";
            } else if (response.status === 404) {
                errorMessage.style.color = "red";
                errorMessage.textContent = "This email is not registered.";
            } else {
                errorMessage.style.color = "red";
                errorMessage.textContent = data.detail || "An error occurred. Please try again.";
            }
        } catch (e) {
            errorMessage.style.color = "red";
            errorMessage.textContent = "Network error";
        }
    });
});