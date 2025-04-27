const password_toggle = document.getElementById("password-toggle");
const password_input = document.getElementById("password-input");

password_toggle.addEventListener("click", function () {
  const isPassword = password_input.type === "password";
  password_input.type = isPassword ? "text" : "password";
  password_toggle.src = isPassword ? "img/eye.png" : "img/eye-closed.png";
});
