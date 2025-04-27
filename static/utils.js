/**
 * Displays a toast notification using Toastify.
 * @param {string} message The message to display.
 * @param {'info' | 'success' | 'warning' | 'error'} type The type of toast (info, success, warning, error).
 */
export function showToast(message, type = 'info') {
    console.log(`[Toast - ${type.toUpperCase()}]: ${message}`); // Log to console as fallback

    // Check if Toastify is loaded
    if (typeof Toastify === 'undefined') {
        console.warn('Toastify library not loaded. Cannot display toast.');
        return;
    }

    let backgroundColor;
    switch (type) {
        case 'success':
            backgroundColor = '#4CAF50'; // Green
            break;
        case 'warning':
            backgroundColor = '#ff9800'; // Orange
            break;
        case 'error':
            backgroundColor = '#f44336'; // Red
            break;
        case 'info':
        default:
            backgroundColor = '#2196F3'; // Blue
            break;
    }

    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
            background: backgroundColor,
        },
        // onClick: function(){} // Callback after click
    }).showToast();
}
