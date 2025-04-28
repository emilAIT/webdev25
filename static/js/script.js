document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector("#login-form");
    const loginErrorElement = document.querySelector("#login-error"); // Находим элемент ошибки

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (loginErrorElement) loginErrorElement.textContent = ""; // Очищаем предыдущую ошибку
            const username = document.querySelector("#username").value;
            const password = document.querySelector("#password").value;
            try {
                const response = await fetch("/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem("token", data.access_token);
                    window.location.href = `/chat?token=${data.access_token}`;
                } else {
                    if (loginErrorElement) loginErrorElement.textContent = data.detail || "Login failed"; // Показываем ошибку в <p>
                }
            } catch (error) {
                console.error("Login error:", error);
                if (loginErrorElement) loginErrorElement.textContent = "An error occurred during login"; // Показываем ошибку в <p>
            }
        });
    }

    const registerForm = document.querySelector("#register-form");
    const registerErrorElement = document.querySelector("#register-error"); // Находим элемент ошибки

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (registerErrorElement) registerErrorElement.textContent = ""; // Очищаем предыдущую ошибку
            
            const username = document.querySelector("#reg-username").value;
            const email = document.querySelector("#reg-email").value;
            console.log(email);
            const password = document.querySelector("#reg-password").value;
            
            try {
                const response = await fetch("/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Вместо прямого перехода в чат, перенаправляем на страницу верификации
                    window.location.href = `/verification?email=${encodeURIComponent(email)}&token=${data.temp_token}`;
                } else {
                    if (registerErrorElement) registerErrorElement.textContent = data.detail || "Registration failed"; // Показываем ошибку в <p>
                }
            } catch (error) {
                console.error("Registration error:", error);
                if (registerErrorElement) registerErrorElement.textContent = "An error occurred during registration"; // Показываем ошибку в <p>
            }
        });
    }
});