const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

// Переключение панелей
sign_up_btn.addEventListener("click", () => {
  container.classList.add("sign-up-mode");
});

sign_in_btn.addEventListener("click", () => {
  container.classList.remove("sign-up-mode");
});

// Обработка формы входа
document.querySelector(".sign-in-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  try {
    const response = await fetch("http://127.0.0.1:5000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    const messageContainer = document.querySelector(".message-container"); // Add a container for messages
    messageContainer.textContent = ""; // Clear previous messages

    if (response.ok) {
      messageContainer.textContent = result.message; // Display success message
      messageContainer.style.color = "green"; // Set success message color
      setTimeout(() => {
        window.location.href = "/chat"; // Redirect to chat page
      }, 1000); // 2000 milliseconds = 2 seconds
    } else {
      messageContainer.textContent = result.error; // Display error message
      messageContainer.style.color = "red"; // Set error message color
    }
  } catch (error) {
    const messageContainer = document.querySelector(".message-container");
    messageContainer.textContent = "Ошибка сервера";
    messageContainer.style.color = "red";
  }
});

// Обработка формы регистрации
document.querySelector(".sign-up-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  try {
    const response = await fetch("http://127.0.0.1:5000/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      setTimeout(() => {
        window.location.href = "/chat"; // Redirect to chat page
      }, 1000); // 2000 milliseconds = 2 seconds
    } else {
      alert(result.error);
    }
  } catch (error) {
    alert("Ошибка сервера");
  }
});