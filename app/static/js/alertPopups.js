// Alert Popups Module

// Replace the showAlertPopup function with SweetAlert implementation
function showAlertPopup(title, message, type = 'info') {
    Swal.fire({
        title: title,
        text: message,
        icon: type,
        confirmButtonText: 'OK'
    });
}

export { showAlertPopup };