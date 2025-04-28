/**
 * Notification system
 */

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - The notification type ('success', 'error', 'info', 'remove-contact')
 * @param {number} duration - How long to show the notification in ms
 */
function showNotification(message, type, duration = 3000) {
  // Skip showing "failed to create group" error notifications
  if (type === 'error' && message.toLowerCase().includes('failed to create group')) {
    console.log('Suppressing error notification:', message);
    return;
  }
  
  const notification = createNotification(message, type);
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('hide');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

/**
 * Show success notification
 */
function showSuccessNotification(message, duration = 3000) {
  showNotification(message, 'success', duration);
}

/**
 * Show error notification
 */
function showErrorNotification(message, duration = 5000) {
  showNotification(message, 'error', duration);
}

/**
 * Create notification element
 */
function createNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    notification.classList.add('hide');
    setTimeout(() => notification.remove(), 300);
  });
  
  notification.appendChild(closeBtn);
  
  return notification;
}
