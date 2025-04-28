async function applyUserTheme() {
  try {
    const response = await fetch('/api/profile');
    if (response.ok) {
      const user = await response.json();
      document.documentElement.setAttribute('data-theme', user.theme || 'blue');
    }
  } catch (error) {
    console.error('Error loading theme:', error);
    document.documentElement.setAttribute('data-theme', 'blue');
  }
}

document.addEventListener('DOMContentLoaded', applyUserTheme);