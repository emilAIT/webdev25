// login.js
const API_URL = '';

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  
  try {
    const response = await fetch(`/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store complete user data
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("username", username);
      window.location.href = "/"; // Redirect to root instead of /chat
    } else {
      alert("Ошибка: " + data.detail);
    }
  } catch (err) {
    console.error(err);
    alert("Ошибка соединения с сервером");
  }
});
