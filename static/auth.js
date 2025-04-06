document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const signinForm = document.getElementById('signin-form');
    const showSignup = document.getElementById('show-signup');
    const showSignin = document.getElementById('show-signin');

    showSignup.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signin').classList.add('hidden');
        document.getElementById('signup').classList.remove('hidden');
    });

    showSignin.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup').classList.add('hidden');
        document.getElementById('signin').classList.remove('hidden');
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        const response = await fetch('/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            document.getElementById('signup').classList.add('hidden');
            document.getElementById('chat').classList.remove('hidden');
        } else {
            alert('Signup failed');
        }
    });

    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signin-username').value;
        const password = document.getElementById('signin-password').value;
        const response = await fetch('/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            document.getElementById('signin').classList.add('hidden');
            document.getElementById('chat').classList.remove('hidden');
        } else {
            alert('Signin failed');
        }
    });
});