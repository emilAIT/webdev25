document.addEventListener('DOMContentLoaded', function() {
    const codeInputs = document.querySelectorAll('.code-input');
    const verifyBtn = document.getElementById('verify-btn');
    const resendBtn = document.getElementById('resend-btn');
    const errorMessage = document.getElementById('error-message');
    
    // Get email and temp token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const tempToken = urlParams.get('token');
    
    // Focus first input on page load
    codeInputs[0].focus();
    
    // Handle input in code fields
    codeInputs.forEach((input, index) => {
        input.addEventListener('keyup', function(e) {
            // Allow only numbers
            this.value = this.value.replace(/[^0-9]/g, '');
            
            // Auto-move to next input
            if (this.value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
            
            // Handle backspace - move to previous input
            if (e.key === 'Backspace' && index > 0 && this.value === '') {
                codeInputs[index - 1].focus();
            }
            
            // Enable submit button if all fields are filled
            verifyBtn.disabled = !isCodeComplete();
        });
        
        // Handle paste event
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text');
            if (/^\d+$/.test(pastedData)) {
                // Fill inputs with pasted digits
                for (let i = 0; i < Math.min(pastedData.length, codeInputs.length); i++) {
                    codeInputs[i].value = pastedData[i];
                    if (i < codeInputs.length - 1) {
                        codeInputs[i + 1].focus();
                    }
                }
            }
        });
    });
    
    // Check if all code inputs are filled
    function isCodeComplete() {
        return Array.from(codeInputs).every(input => input.value.length === 1);
    }
    
    // Get full code from inputs
    function getFullCode() {
        return Array.from(codeInputs).map(input => input.value).join('');
    }
    
    // Handle verification button click
    verifyBtn.addEventListener('click', async function() {
        if (!isCodeComplete()) {
            errorMessage.textContent = "Please enter all 6 digits";
            return;
        }
        
        const code = getFullCode();
        
        try {
            const response = await fetch('/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code: code,
                    email: email,
                    temp_token: tempToken
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // On success, store the token and redirect to chat
                localStorage.setItem("token", data.access_token);
                window.location.href = `/chat?token=${data.access_token}`;
            } else {
                errorMessage.textContent = data.detail || "Invalid verification code";
            }
        } catch (error) {
            console.error("Verification error:", error);
            errorMessage.textContent = "An error occurred during verification";
        }
    });
    
    // Handle resend button click
    resendBtn.addEventListener('click', async function() {
        try {
            resendBtn.disabled = true;
            resendBtn.textContent = "Sending...";
            
            const response = await fetch('/resend-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: email,
                    temp_token: tempToken
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                errorMessage.textContent = "";
                alert("A new verification code has been sent to your email.");
                // Clear inputs
                codeInputs.forEach(input => input.value = '');
                codeInputs[0].focus();
            } else {
                errorMessage.textContent = data.detail || "Failed to resend code";
            }
        } catch (error) {
            console.error("Resend error:", error);
            errorMessage.textContent = "An error occurred while resending code";
        } finally {
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend Code";
        }
    });
});