// Global variables to hold reCAPTCHA widget IDs
let registerRecaptchaId;
let loginRecaptchaId;

// Function to initialize reCAPTCHA widgets after the API is loaded
function onRecaptchaLoad() {
    // Render register reCAPTCHA
    if (document.getElementById('register-recaptcha')) {
        registerRecaptchaId = grecaptcha.render('register-recaptcha', {
            'sitekey': '6LeyLJEqAAAAAFG_tm9Sl8aj1C_WIRmz-kcp0_mG'
        });
    }

    // Render login reCAPTCHA
    if (document.getElementById('login-recaptcha')) {
        loginRecaptchaId = grecaptcha.render('login-recaptcha', {
            'sitekey': '6LeyLJEqAAAAAFG_tm9Sl8aj1C_WIRmz-kcp0_mG'
        });
    }

    console.log('reCAPTCHA widgets initialized');
}

// Function to load protected pages with authentication token
function loadProtectedPage(url) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        showMessage(loginMessage, 'Authentication token not found. Please log in again.', true);
        return;
    }

    // Navigate to the URL with the token in the Authorization header
    window.location.href = url;
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a token in localStorage on page load
    const token = localStorage.getItem('access_token');
    if (token && window.location.pathname === '/') {
        // If we have a token and we're on the homepage, redirect to chat
        loadProtectedPage('/chat');
    }

    const panelContainer = document.getElementById('panel-container');
    const signInButton = document.getElementById('signIn');
    const registerButton = document.getElementById('register');
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const registerMessage = document.getElementById('registerMessage');
    const loginMessage = document.getElementById('loginMessage');

    // Switch to Sign In form
    signInButton.addEventListener('click', () => {
        panelContainer.classList.add('right-active');
    });

    // Switch to Register form
    registerButton.addEventListener('click', () => {
        panelContainer.classList.remove('right-active');
    });

    // Form validation functions
    function validatePassword(password, confirmPassword) {
        if (password.length < 8) {
            return 'Password must be at least 8 characters long';
        }
        if (!/[A-Z]/.test(password)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[a-z]/.test(password)) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!/[0-9]/.test(password)) {
            return 'Password must contain at least one number';
        }
        if (password !== confirmPassword) {
            return 'Passwords do not match';
        }
        return null;
    }

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) ? null : 'Invalid email format';
    }

    function validatePhone(phone) {
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        return phoneRegex.test(phone) ? null : 'Invalid phone number format';
    }

    function showMessage(element, message, isError) {
        element.textContent = message;
        element.classList.remove('error', 'success');
        element.classList.add(isError ? 'error' : 'success');
        element.style.display = 'block';

        // Auto hide after 5 seconds
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }

    // Handle Registration Form Submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form values
        const nickname = document.getElementById('nickname').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const recaptchaResponse = grecaptcha.getResponse(registerRecaptchaId);

        console.log("reCAPTCHA response length:", recaptchaResponse.length);

        // Validate form data
        const passwordError = validatePassword(password, confirmPassword);
        const emailError = validateEmail(email);
        const phoneError = validatePhone(phone);

        if (passwordError) {
            showMessage(registerMessage, passwordError, true);
            return;
        }

        if (emailError) {
            showMessage(registerMessage, emailError, true);
            return;
        }

        if (phoneError) {
            showMessage(registerMessage, phoneError, true);
            return;
        }

        if (!recaptchaResponse) {
            showMessage(registerMessage, 'Please complete the reCAPTCHA verification', true);
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nickname,
                    email,
                    phone,
                    password,
                    recaptcha: recaptchaResponse
                })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(registerMessage, data.message, false);
                registerForm.reset();
                grecaptcha.reset(0);

                // Automatically switch to login form after successful registration
                setTimeout(() => {
                    panelContainer.classList.add('right-active');
                }, 2000);
            } else {
                showMessage(registerMessage, data.detail || 'Registration failed', true);
                grecaptcha.reset(0);
            }
        } catch (error) {
            showMessage(registerMessage, 'Server error. Please try again later.', true);
            grecaptcha.reset(0);
        }
    });

    // Handle Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form values
        const phone = document.getElementById('loginPhone').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        const recaptchaResponse = grecaptcha.getResponse(loginRecaptchaId);


        // Validate form data
        const phoneError = validatePhone(phone);

        if (phoneError) {
            showMessage(loginMessage, phoneError, true);
            return;
        }

        if (!recaptchaResponse) {
            showMessage(loginMessage, 'Please complete the reCAPTCHA verification', true);
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone,
                    password,
                    remember_me: rememberMe,
                    recaptcha: recaptchaResponse
                })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(loginMessage, 'Login successful! Redirecting...', false);
                loginForm.reset();

                // Store the token in localStorage (secure storage)
                localStorage.setItem('access_token', data.access_token);

                // Redirect to chat page without exposing the token in URL
                setTimeout(() => {
                    window.location.href = '/chat';
                }, 500);
            } else {
                showMessage(loginMessage, data.detail || 'Login failed', true);
                grecaptcha.reset(1);
            }
        } catch (error) {
            showMessage(loginMessage, 'Server error. Please try again later.', true);
            grecaptcha.reset(1);
        }
    });

    // Function to position emojis with maximum randomness
    function positionEmojisRandomly() {
        const emojis = document.querySelectorAll('.emoji');
        const rightPanel = document.querySelector('.right-panel');
        
        if (!rightPanel || emojis.length === 0) return;
        
        // Get panel dimensions
        const panelWidth = rightPanel.clientWidth;
        const panelHeight = rightPanel.clientHeight;
        
        
        // Create a list of already used positions (to avoid clustering)
        const usedPositions = [];
        const minDistanceBetweenEmojis = 100; // Minimum distance between emoji centers
        
        emojis.forEach((emoji, index) => {
            emoji.style.position = 'absolute';
            
            // Get current timestamp to add to randomness
            const timestamp = new Date().getTime();
            
            // Use a different random seed for each emoji and each time
            const randomSeed = (timestamp % 10000) + (index * 1000) + (Math.random() * 10000);
            const random = (max) => {
                // Custom random function with different seed for each call
                const x = Math.sin(randomSeed + usedPositions.length) * 10000;
                return (x - Math.floor(x)) * max;
            };
            
            let leftPos, topPos;
            let attempts = 0;
            let validPosition = false;
            
            // Try to find a position that's not too close to existing emojis
            while (!validPosition && attempts < 20) {
                attempts++;
                
                // Divide panel into a grid of cells and select a random cell
                const cellSize = 100;
                const gridColumns = Math.floor(panelWidth / cellSize);
                const gridRows = Math.floor(panelHeight / cellSize);
                
                // Choose a random cell
                const cellX = Math.floor(random(gridColumns));
                const cellY = Math.floor(random(gridRows));
                
                // Position within the cell with some randomness
                leftPos = (cellX * cellSize) + random(cellSize);
                topPos = (cellY * cellSize) + random(cellSize);
                
                // Prefer positions closer to edges
                if (random(100) < 70) {
                    // 70% chance to be positioned near an edge
                    const edge = Math.floor(random(4));
                    switch(edge) {
                        case 0: // top edge
                            topPos = random(panelHeight * 0.2);
                            break;
                        case 1: // right edge
                            leftPos = panelWidth - random(panelWidth * 0.2);
                            break;
                        case 2: // bottom edge
                            topPos = panelHeight - random(panelHeight * 0.2);
                            break;
                        case 3: // left edge
                            leftPos = random(panelWidth * 0.2);
                            break;
                    }
                }
                
                // Add some extra randomness based on time
                leftPos += Math.sin(timestamp / 1000 + index) * 30;
                topPos += Math.cos(timestamp / 1000 + index) * 30;
                     // Get emoji dimensions for better boundary check
            const emojiSize = Math.max(emoji.clientWidth, emoji.clientHeight) || 80;
            const scaledSize = emojiSize * (0.5 + random(0.8)); // Account for scaling
            const safeMargin = Math.ceil(scaledSize / 2) + 20;
            
            // Make sure emojis stay within the panel with better margins
            leftPos = Math.max(safeMargin, Math.min(panelWidth - safeMargin, leftPos));
            topPos = Math.max(safeMargin, Math.min(panelHeight - safeMargin, topPos));
            
            // Check if this position is far enough from other emojis
            validPosition = true;
            
            // Use a larger minimum distance to ensure emojis are well-separated
            const minDistance = Math.max(minDistanceBetweenEmojis, scaledSize * 1.5);
            
            for (const pos of usedPositions) {
                const distance = Math.sqrt(Math.pow(leftPos - pos.left, 2) + Math.pow(topPos - pos.top, 2));
                if (distance < minDistance) {
                    validPosition = false;
                    break;
                }
            }
            }
            
            // Store this position
            usedPositions.push({ left: leftPos, top: topPos });
            
            // Apply truly random rotation and scale
            const rotation = random(360);
            const scale = 0.5 + random(0.8); // 50% to 130%
            const opacity = 0.3 + random(0.4); // 30% to 70% opacity
            
            // Apply styles
            emoji.style.left = `${leftPos}px`;
            emoji.style.top = `${topPos}px`;
            emoji.style.transform = `rotate(${rotation}deg) scale(${scale})`;
            emoji.style.opacity = opacity;
            
            // Apply a random z-index for layering
            emoji.style.zIndex = Math.floor(random(10)) - 5;
            
        });
    }
    
    // Position emojis on page load
    positionEmojisRandomly();
    
    // Reposition emojis when switching forms
    signInButton.addEventListener('click', () => {
        panelContainer.classList.add('right-active');
        setTimeout(positionEmojisRandomly, 600); // Wait for animation to complete
    });

    registerButton.addEventListener('click', () => {
        panelContainer.classList.remove('right-active');
        setTimeout(positionEmojisRandomly, 600); // Wait for animation to complete
    });

    // Reposition emojis on window resize
    window.addEventListener('resize', positionEmojisRandomly);
});
