export let userName = localStorage.getItem('userName') || '';
export let userEmail = localStorage.getItem('userEmail') || '';
export let userID = parseInt(localStorage.getItem('userID')) || 0;

export function setUser(name, email, id) {
  userName = name;
  userEmail = email;
  userID = id;
  localStorage.setItem('userName', name);
  localStorage.setItem('userEmail', email);
  localStorage.setItem('userID', id);
}