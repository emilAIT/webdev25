// Alert Popups Module

// Replace SweetAlert with standard JavaScript alerts
function showAlertPopup(title, message, type = 'info') {
    alert(`${title}\n${message}`);
}

export { showAlertPopup };