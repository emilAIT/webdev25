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
            // Toastify({
            //     text: "Passwords do not match",
            //     duration: 3000,
            //     close: true,
            //     gravity: "top",
            //     position: "right",
            //     backgroundColor: "#F44336",
            // }).showToast();
            console.error("Passwords do not match"); // Keep console log for debugging
            return;
        }
        try {
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

                // Reload page to ensure everything is initialized properly
                window.location.reload();
            } else {
                const error = await response.json();
                // Toastify({
                //     text: error.detail || "Signup failed",
                //     duration: 3000,
                //     close: true,
                //     gravity: "top",
                //     position: "right",
                //     backgroundColor: "#F44336",
                // }).showToast();
                console.error("Signup failed:", error.detail);
            }
        } catch (error) {
            // Toastify({
            //     text: error.message || "Signup failed",
            //     duration: 3000,
            //     close: true,
            //     gravity: "top",
            //     position: "right",
            //     backgroundColor: "#F44336",
            // }).showToast();
            console.error("Signup error:", error.message);
        }
    });

    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signin-username').value;
        const password = document.getElementById('signin-password').value;

        try {
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

                // Reload page to ensure everything is initialized properly
                window.location.reload();
            } else {
                const error = await response.json();
                // Toastify({
                //     text: error.detail || "Signin failed",
                //     duration: 3000,
                //     close: true,
                //     gravity: "top",
                //     position: "right",
                //     backgroundColor: "#F44336",
                // }).showToast();
                console.error("Signin failed:", error.detail);
            }
        } catch (error) {
            // Toastify({
            //     text: error.message || "Signin failed",
            //     duration: 3000,
            //     close: true,
            //     gravity: "top",
            //     position: "right",
            //     backgroundColor: "#F44336",
            // }).showToast();
            console.error("Signin error:", error.message);
        }
    });
});