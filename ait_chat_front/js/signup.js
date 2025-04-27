document.addEventListener('DOMContentLoaded', () => {
  const signupButton = document.getElementById('signup-button');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const usernameInput = document.getElementById('username');
  const signupForm = document.getElementById('signup-form');

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

  // Add password strength indicator
  if (passwordInput) {
    // Create password strength indicator element
    const strengthIndicator = document.createElement('div');
    strengthIndicator.className = 'password-strength';
    passwordInput.parentElement.appendChild(strengthIndicator);

    // Check password strength on input
    passwordInput.addEventListener('input', () => {
      const password = passwordInput.value;
      const strength = checkPasswordStrength(password);
      
      // Update the strength indicator
      strengthIndicator.className = 'password-strength';
      if (password.length > 0) {
        if (strength >= 3) {
          strengthIndicator.classList.add('strong');
        } else if (strength >= 2) {
          strengthIndicator.classList.add('medium');
        } else {
          strengthIndicator.classList.add('weak');
        }
      }
    });
  }

  // Check if passwords match in real-time
  if (confirmPasswordInput && passwordInput) {
    confirmPasswordInput.addEventListener('input', () => {
      if (confirmPasswordInput.value && passwordInput.value) {
        if (confirmPasswordInput.value !== passwordInput.value) {
          showError(confirmPasswordInput, 'Passwords do not match');
        } else {
          clearError(confirmPasswordInput);
        }
      }
    });
  }

  // Handle signup button click
  signupButton.addEventListener('click', () => {
    if (validateForm()) {
      performSignup();
    }
  });

  // Add "Enter" key support for signup
  confirmPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (validateForm()) {
        performSignup();
      }
    }
  });

  // Form validation
  function validateForm() {
    let isValid = true;
    
    // Email validation
    const email = emailInput.value.trim();
    if (email === '') {
      showError(emailInput, 'Please enter your email');
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError(emailInput, 'Please enter a valid email address');
      isValid = false;
    } else {
      clearError(emailInput);
    }
    
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
    } else if (password.length < 8) {
      showError(passwordInput, 'Password must be at least 8 characters');
      isValid = false;
    } else {
      clearError(passwordInput);
    }
    
    // Confirm password validation
    const confirmPassword = confirmPasswordInput.value.trim();
    if (confirmPassword === '') {
      showError(confirmPasswordInput, 'Please confirm your password');
      isValid = false;
    } else if (confirmPassword !== password) {
      showError(confirmPasswordInput, 'Passwords do not match');
      isValid = false;
    } else {
      clearError(confirmPasswordInput);
    }
    
    return isValid;
  }
  
  // Signup functionality
  async function performSignup() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim();

    // Clear previous form errors
    const generalErrorElement = signupForm.querySelector('.general-error-message');
    if (generalErrorElement) {
        generalErrorElement.remove();
    }
    signupForm.classList.remove('error');

    console.log('Signup attempt:', { username, email });

    // Add loading state to button
    signupButton.disabled = true;
    signupButton.classList.add('loading');
    signupButton.textContent = 'Creating account...';

    try {
      const response = await fetch('http://127.0.0.1:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        // Simulate successful signup
        alert('Account created successfully! You can now log in.');
        // Redirect to login page
        window.location.href = 'index.html';
      } else {
        // Handle errors (e.g., duplicate username/email)
        const errorData = await response.json();
        console.error('Signup failed:', errorData);
        showGeneralError(signupForm, `Signup failed: ${errorData.detail || 'Unknown error'}`);
        // Optionally, try to link error to specific field if possible based on detail message
        if (errorData.detail && errorData.detail.includes("Username")) {
          showError(usernameInput, errorData.detail);
        } else if (errorData.detail && errorData.detail.includes("Email")) {
          showError(emailInput, errorData.detail);
        }
      }
    } catch (error) {
      // Handle network errors
      console.error('Network error during signup:', error);
      showGeneralError(signupForm, 'Signup failed due to a network error. Please try again.');
    } finally {
      // Reset button state
      signupButton.disabled = false;
      signupButton.classList.remove('loading');
      signupButton.textContent = 'Sign Up';
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
  
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  function checkPasswordStrength(password) {
    let strength = 0;
    
    // Check length
    if (password.length >= 8) {
      strength += 1;
    }
    
    // Check for mixed case
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) {
      strength += 1;
    }
    
    // Check for numbers
    if (password.match(/\d/)) {
      strength += 1;
    }
    
    // Check for special characters
    if (password.match(/[^a-zA-Z\d]/)) {
      strength += 1;
    }
    
    return strength;
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