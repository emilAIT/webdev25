const API_URL = '';

document.getElementById("registrationForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const passwordConfirm = document.getElementById("regPasswordConfirm").value;
    
    if (password !== passwordConfirm) {
        alert("Пароли не совпадают!");
        return;
    }
    
    try {
        const response = await fetch(`/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            alert("Регистрация прошла успешно! Теперь выполните вход.");
            window.location.href = "/login";
        } else {
            const errorData = await response.json();
            alert("Ошибка: " + errorData.detail);
        }
    } catch (err) {
        console.error(err);
        alert("Ошибка соединения с сервером");
    }
});
