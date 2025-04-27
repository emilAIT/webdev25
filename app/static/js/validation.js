/**
 * Form validation for login and registration pages
 */

document.addEventListener('DOMContentLoaded', function() {
    // Login form validation
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Check if there's no error message, which means we're viewing a fresh form
        const errorMessage = document.getElementById('errorMessage');
        
        // If there's no error message and not coming back from failed login,
        // clear the form fields for a fresh start
        if (errorMessage && !errorMessage.textContent.trim()) {
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        }
        
        loginForm.addEventListener('submit', function(e) {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            
            if (username === '' || password === '') {
                e.preventDefault();
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Please fill out all required fields.',
                    confirmButtonText: 'OK'
                });
                return false;
            }
            
            // On successful submission - we'll let the form submit normally
            // and the backend will handle the redirect
            return true;
        });
    }
    
    // Registration form validation
    const registerForm = document.getElementById('registrationForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();
            const errorMessage = document.getElementById('errorMessage');
            
            if (username === '' || email === '' || password === '' || confirmPassword === '') {
                e.preventDefault();
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Please fill out all required fields.',
                    confirmButtonText: 'OK'
                });
                return false;
            }
            
            if (!validateEmail(email)) {
                e.preventDefault();
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Please enter a valid email address.',
                    confirmButtonText: 'OK'
                });
                return false;
            }
            
            if (password !== confirmPassword) {
                e.preventDefault();
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Passwords do not match.',
                    confirmButtonText: 'OK'
                });
                return false;
            }
            
            if (password.length < 6) {
                e.preventDefault();
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Password must be at least 6 characters long.',
                    confirmButtonText: 'OK'
                });
                return false;
            }
            
            Swal.fire({
                icon: 'success',
                title: 'Registration Successful',
                text: 'Your account has been created successfully. You can now log in.',
                confirmButtonText: 'OK'
            });
            
            return true;
        });
    }
    
    // Email validation helper function
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
});