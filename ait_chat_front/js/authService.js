const ACCESS_TOKEN_KEY = 'accessToken';

export function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function hasToken() {
  return !!getToken();
}

export function redirectToLogin() {
  console.log('No access token found or invalid, redirecting to login.');
  // Avoid redirect loop if already on index.html
  if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
       window.location.href = 'index.html';
  }
}

export function logout() {
    removeToken();
    redirectToLogin();
}