const socket = io("http://localhost:5000"); // Укажите URL вашего бэкенда

// Подключение к серверу
socket.on("connect", () => {
  console.log("Connected to WebSocket server");
});

// Получение сообщений
socket.on("message", (data) => {
  const chatContainer = document.querySelector(".empty-state");
  const messageElement = document.createElement("p");
  messageElement.textContent = `${data.username}: ${data.content}`;
  chatContainer.appendChild(messageElement);
});

// Отправка сообщения
function sendMessage(username, content) {
  const room = "general"; // Укажите комнату
  socket.emit("send_message", { room, username, content });
}

// Пример: отправка сообщения при нажатии кнопки
document.querySelector(".start-chat-btn").addEventListener("click", () => {
  const username = "User"; // Укажите имя пользователя
  const content = "Привет, это тестовое сообщение!";
  sendMessage(username, content);
});