document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginForm = document.getElementById('login-form');

  // Add focus styles
  const inputs = document.querySelectorAll('input');
  
  inputs.forEach(input => {
    // Add focus event
    input.addEventListener('focus', () => {
      input.parentElement.classList.add('focused');
    });
    
    // Remove focus event
    input.addEventListener('blur', () => {
      input.parentElement.classList.remove('focused');
      
      // Add 'filled' class if the input has a value
      if (input.value.trim() !== '') {
        input.parentElement.classList.add('filled');
      } else {
        input.parentElement.classList.remove('filled');
      }
    });
  });

  // Handle login button click
  loginButton.addEventListener('click', () => {
    if (validateForm()) {
      performLogin();
    }
  });

  // Add "Enter" key support for login
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (validateForm()) {
        performLogin();
      }
    }
  });

  // Show password functionality could be added here
  
  // Handle signup link click (for demo purposes)
  // const signupLink = document.querySelector('.signup-text a');
  // signupLink.addEventListener('click', (e) => {
  //   e.preventDefault();
  //   alert('Sign up functionality would be implemented here.');
  // });
  
  // Form validation
  function validateForm() {
    let isValid = true;
    
    // Username validation
    const username = usernameInput.value.trim();
    if (username === '') {
      showError(usernameInput, 'Please enter your username');
      isValid = false;
    } else {
      clearError(usernameInput);
    }
    
    // Password validation
    const password = passwordInput.value.trim();
    if (password === '') {
      showError(passwordInput, 'Please enter your password');
      isValid = false;
    } else {
      clearError(passwordInput);
    }
    
    return isValid;
  }
  
  // Login functionality
  async function performLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Clear previous form errors
    const generalErrorElement = loginForm.querySelector('.general-error-message');
    if (generalErrorElement) {
        generalErrorElement.remove();
    }
    loginForm.classList.remove('error');

    console.log('Login attempt:', { username });
    
    // Add loading state to button
    loginButton.disabled = true;
    loginButton.classList.add('loading');
    loginButton.textContent = 'Logging in...';
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch('http://127.0.0.1:8000/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Login successful:', data);

        // Store the token in localStorage
        localStorage.setItem('accessToken', data.access_token);

        // Redirect to chat page
        window.location.href = 'chat.html';

      } else {
        // Handle login errors (e.g., 401 Unauthorized)
        const errorData = await response.json();
        console.error('Login failed:', errorData);
        let errorMessage = `Login failed: ${errorData.detail || 'Incorrect username or password'}`;
        showGeneralError(loginForm, errorMessage);
        // Optionally clear password field on error
        // passwordInput.value = '';
      }

    } catch (error) {
        // Handle network errors
        console.error('Network error during login:', error);
        showGeneralError(loginForm, 'Login failed due to a network error. Please try again.');
    } finally {
        // Reset button state
        loginButton.disabled = false;
        loginButton.classList.remove('loading');
        loginButton.textContent = 'Login';
    }
  }
  
  // Helper functions
  function showError(input, message) {
    const formGroup = input.parentElement;
    formGroup.classList.add('error');
    
    // Create or update error message
    let errorElement = formGroup.querySelector('.error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      formGroup.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
  }
  
  function clearError(input) {
    const formGroup = input.parentElement;
    formGroup.classList.remove('error');
    
    const errorElement = formGroup.querySelector('.error-message');
    if (errorElement) {
      errorElement.remove();
    }
  }

  // Added function to show general form errors
  function showGeneralError(formElement, message) {
    formElement.classList.add('error');
    let errorElement = formElement.querySelector('.general-error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message general-error-message';
        formElement.insertBefore(errorElement, formElement.firstChild);
    }
    errorElement.textContent = message;
  }
});