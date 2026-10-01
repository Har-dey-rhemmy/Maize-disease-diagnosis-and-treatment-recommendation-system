document.addEventListener('DOMContentLoaded', () => {
    const togglePasswordIcons = document.querySelectorAll('.password-toggle-icon');

    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            const inputField = this.previousElementSibling;
            if (inputField.type === 'password') {
                inputField.type = 'text';
                inputField.classList.add('password-visible');
                this.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                inputField.type = 'password';
                inputField.classList.remove('password-visible');
                this.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    const confirmModalHTML = `
        <div id="emailConfirmModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(3px);">
            <div style="background: white; padding: 2.5rem; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                <i class="fa-solid fa-envelope-open-text" style="font-size: 3.5rem; color: var(--primary-green); margin-bottom: 1rem;"></i>
                <h3 style="margin-bottom: 0.5rem; color: var(--dark-slate); font-size: 1.4rem;">Confirm Your Email</h3>
                <p style="color: #666; font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
                    We will send your 6-digit verification code to:<br>
                    <strong id="confirmEmailText" style="color: var(--primary-green); font-size: 1.1rem; display: block; margin-top: 0.5rem; word-break: break-all;"></strong><br>
                    Is this email address completely correct?
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="cancelRegisterBtn" style="flex: 1; padding: 0.8rem; border: none; border-radius: 6px; background: #f1f3f4; color: #333; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Let me fix it</button>
                    <button id="confirmRegisterBtn" style="flex: 1; padding: 0.8rem; border: none; border-radius: 6px; background: var(--primary-green); color: white; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Yes, it's correct</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', confirmModalHTML);

    // --- CUSTOM TOAST NOTIFICATION SYSTEM ---
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fa-circle-check'; 
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span class="toast-message">${message}</span>
        `;

        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); 
        }, 4000);
    }

    // --- EXISTING AUTH LOGIC ---
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const otpForm = document.getElementById('otpForm');
    const regPasswordInput = document.getElementById('regPassword');
    const ruleLength = document.getElementById('ruleLength');
    const ruleNumber = document.getElementById('ruleNumber');
    const ruleSpecial = document.getElementById('ruleSpecial');
    const regUsernameInput = document.getElementById('regUsername');
    const usernameWarning = document.getElementById('usernameWarning');
    const regEmailInput = document.getElementById('regEmail');
    const emailWarning = document.getElementById('emailWarning');
    let pendingVerificationEmail = ""; 

    regPasswordInput.addEventListener('input', () => {
        const val = regPasswordInput.value;
        if (val.length >= 8) {
            ruleLength.classList.replace('invalid', 'valid');
            ruleLength.querySelector('i').classList.replace('fa-circle-xmark', 'fa-circle-check');
        } else {
            ruleLength.classList.replace('valid', 'invalid');
            ruleLength.querySelector('i').classList.replace('fa-circle-check', 'fa-circle-xmark');
        }
        if (/[0-9]/.test(val)) {
            ruleNumber.classList.replace('invalid', 'valid');
            ruleNumber.querySelector('i').classList.replace('fa-circle-xmark', 'fa-circle-check');
        } else {
            ruleNumber.classList.replace('valid', 'invalid');
            ruleNumber.querySelector('i').classList.replace('fa-circle-check', 'fa-circle-xmark');
        }
        if (/[!@#$%^&*(),.?":{}|<>\-_]/.test(val)) {
            ruleSpecial.classList.replace('invalid', 'valid');
            ruleSpecial.querySelector('i').classList.replace('fa-circle-xmark', 'fa-circle-check');
        } else {
            ruleSpecial.classList.replace('valid', 'invalid');
            ruleSpecial.querySelector('i').classList.replace('fa-circle-check', 'fa-circle-xmark');
        }
    });

    loginTab.addEventListener('click', () => {
        switchTab(loginTab, registerTab, loginForm, registerForm);
    });

    registerTab.addEventListener('click', () => {
        switchTab(registerTab, loginTab, registerForm, loginForm);
    });

    function switchTab(activeTab, inactiveTab, showForm, hideForm) {
        activeTab.classList.add('active');
        inactiveTab.classList.remove('active');
        showForm.classList.add('active');
        hideForm.classList.remove('active');

        const authTabsContainer = document.querySelector('.auth-tabs');
        if (activeTab.id === 'registerTab') {
            authTabsContainer.classList.add('right-active');
        } else {
            authTabsContainer.classList.remove('right-active');
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'register') {
        switchTab(registerTab, loginTab, registerForm, loginForm);
    } else {
        switchTab(loginTab, registerTab, loginForm, registerForm);
    }

    const BASE_URL = 'http://127.0.0.1:8000/api'; 

    // --- LOGIN LOGIC ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const submitBtn = loginForm.querySelector('.submit-btn');
        submitBtn.textContent = "Logging in...";

        try {
            const response = await fetch(`${BASE_URL}/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('maizeToken', data.token);
                localStorage.setItem('maizeUser', data.username);
                window.location.href = '/'; 
            } else {
                showToast(data.error || "Invalid Email or password.", "error"); 
                submitBtn.textContent = "Sign In";
            }
        } catch (error) {
            console.error('Error:', error);
            showToast("Could not connect to the server.", "error"); 
            submitBtn.textContent = "Sign In";
        }
    });

    // --- UNIQUENESS CHECKER ---
    async function checkUnique(field, value, warningElement, inputElement) {
        if (!value) return true; 

        try {
            const response = await fetch(`${BASE_URL}/check-unique/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field: field, value: value })
            });
            const data = await response.json();

            if (data.is_taken) {
                warningElement.style.display = 'block';
                inputElement.style.border = '2px solid #d32f2f'; 
                return false;
            } else {
                warningElement.style.display = 'none';
                inputElement.style.border = '1px solid #ccc'; 
                return true;
            }
        } catch (error) {
            console.error('Error checking uniqueness:', error);
            return true; 
        }
    }

    regUsernameInput.addEventListener('blur', () => { checkUnique('username', regUsernameInput.value.trim(), usernameWarning, regUsernameInput); });
    regEmailInput.addEventListener('blur', () => { checkUnique('email', regEmailInput.value.trim(), emailWarning, regEmailInput); });
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const username = document.getElementById('regUsername').value.trim(); 
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const submitBtn = registerForm.querySelector('.submit-btn');
        const validDomains = ['@gmail.com', '@yahoo.com', '@hotmail.com'];
        const isValidDomain = validDomains.some(domain => email.toLowerCase().endsWith(domain));
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
            showToast("Please enter a valid email address.", "warning");
            document.getElementById('regEmail').style.border = '2px solid #f57c00';
            return;
        } else {
            document.getElementById('regEmail').style.border = '1px solid #ccc';
        }
        if (password.length < 8 || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>\-_]/.test(password)) {
            showToast("Please ensure your password meets all security requirements.", "warning"); 
            return;
        }
        
        const confirmModal = document.getElementById('emailConfirmModal');
        document.getElementById('confirmEmailText').textContent = email;
        confirmModal.style.display = 'flex';
        document.getElementById('cancelRegisterBtn').onclick = (e) => {
            e.preventDefault();
            confirmModal.style.display = 'none';
        };

        document.getElementById('confirmRegisterBtn').onclick = async (e) => {
            e.preventDefault();
            confirmModal.style.display = 'none';
            submitBtn.textContent = "Creating Profile...";

            try {
                const response = await fetch(`${BASE_URL}/register/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, username, email, password }) 
                });
                const data = await response.json();

                if (response.ok) {
                    pendingVerificationEmail = email;
                    document.getElementById('displayOtpEmail').textContent = email;
                    registerForm.reset();

                    document.querySelectorAll('.password-rules li').forEach(li => {
                        li.classList.replace('valid', 'invalid');
                        li.querySelector('i').classList.replace('fa-circle-check', 'fa-circle-xmark');
                    });

                    document.querySelector('.auth-tabs').style.display = 'none';
                    registerForm.classList.remove('active');
                    otpForm.classList.add('active');
                    
                    showToast("Account created! Please check your email.", "success"); 

                } else {
                    showToast(data.error || "Registration failed.", "error"); 
                    submitBtn.textContent = "Register Account";
                }
            } catch (error) {
                console.error('Error:', error);
                showToast("Could not connect to the server.", "error"); 
                submitBtn.textContent = "Register Account";
            }
        };
    });

    // --- VERIFY OTP LOGIC ---
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpCode = document.getElementById('otpInput').value.trim();
        const submitBtn = otpForm.querySelector('.submit-btn');
        submitBtn.textContent = "Verifying...";

        try {
            const response = await fetch(`${BASE_URL}/verify-otp/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingVerificationEmail, otp_code: otpCode })
            });
            const data = await response.json();

            if (response.ok) {
                // 1. Show the success message
                showToast("Verification Complete! Logging you in...", "success"); 
                
                // 2. Save the session keys provided by Django
                localStorage.setItem('maizeToken', data.token);
                localStorage.setItem('maizeUser', data.username);
                
                // 3. Wait exactly half a second so they can read the toast, then redirect!
                setTimeout(() => {
                    window.location.href = '/';
                }, 500);

            } else {
                // If the code is wrong, let them try again
                showToast(data.error || "Invalid code. Please try again.", "error"); 
                submitBtn.textContent = "Verify Account";
            }
        } catch (error) {
            showToast("Could not connect to the server.", "error"); 
            submitBtn.textContent = "Verify Account";
        }
    });

    document.getElementById('backToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.auth-tabs').style.display = 'flex';
        otpForm.classList.remove('active');
        loginForm.classList.add('active');
        loginTab.classList.add('active');
    });

    // --- FORGOT PASSWORD LOGIC ---
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    let resetEmailTarget = ""; 

    document.getElementById('showForgotPassword').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.auth-tabs').style.display = 'none';
        loginForm.classList.remove('active');
        forgotPasswordForm.classList.add('active');
    });

    document.getElementById('backToLoginFromForgot').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.auth-tabs').style.display = 'flex';
        forgotPasswordForm.classList.remove('active');
        loginForm.classList.add('active');
    });

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim();
        const submitBtn = forgotPasswordForm.querySelector('.submit-btn');
        submitBtn.textContent = "Sending...";

        try {
            const response = await fetch(`${BASE_URL}/password-reset-request/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            const data = await response.json();

            if (response.ok) {
                resetEmailTarget = email;
                document.getElementById('displayResetEmail').textContent = email;
                forgotPasswordForm.classList.remove('active');
                resetPasswordForm.classList.add('active');
                showToast("Recovery code sent to your email.", "success"); 
            } else {
                if (response.status === 404) {
                    showToast("Email not found. Let's create an account instead!", "warning");
                    
                    document.querySelector('.auth-tabs').style.display = 'flex';
                    forgotPasswordForm.classList.remove('active');
                    switchTab(registerTab, loginTab, registerForm, loginForm);
                    document.getElementById('regEmail').value = email;
                    
                } else {
                    showToast(data.error || "Failed to send reset code.", "error"); 
                }
                submitBtn.textContent = "Send Recovery Code";
            }
        } catch (error) {
            showToast("Could not connect to the server.", "error"); 
            submitBtn.textContent = "Send Recovery Code";
        }
    });

    const newPasswordInput = document.getElementById('newPassword');
    const resetRuleLength = document.getElementById('resetRuleLength');
    const resetRuleNumber = document.getElementById('resetRuleNumber');
    const resetRuleSpecial = document.getElementById('resetRuleSpecial');

    newPasswordInput.addEventListener('input', () => {
        const val = newPasswordInput.value;
        const updateRule = (ruleEl, isValid) => {
            if (isValid) {
                ruleEl.classList.replace('invalid', 'valid');
                ruleEl.querySelector('i').classList.replace('fa-circle-xmark', 'fa-circle-check');
            } else {
                ruleEl.classList.replace('valid', 'invalid');
                ruleEl.querySelector('i').classList.replace('fa-circle-check', 'fa-circle-xmark');
            }
        };
        updateRule(resetRuleLength, val.length >= 8);
        updateRule(resetRuleNumber, /[0-9]/.test(val));
        updateRule(resetRuleSpecial, /[!@#$%^&*(),.?":{}|<>\-_]/.test(val));
    });

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpCode = document.getElementById('resetOtpInput').value.trim();
        const newPassword = newPasswordInput.value;
        const submitBtn = resetPasswordForm.querySelector('.submit-btn');

        if (newPassword.length < 8 || !/[0-9]/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>\-_]/.test(newPassword)) {
            showToast("Please ensure your new password meets all security requirements.", "warning"); 
            return;
        }

        submitBtn.textContent = "Saving...";

        try {
            const response = await fetch(`${BASE_URL}/password-reset-confirm/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmailTarget, otp_code: otpCode, new_password: newPassword })
            });
            const data = await response.json();

            if (response.ok) {
                showToast("Password reset successful! You can now log in.", "success"); 
                resetPasswordForm.reset();
                forgotPasswordForm.reset();
                document.querySelector('.auth-tabs').style.display = 'flex';
                resetPasswordForm.classList.remove('active');
                loginForm.classList.add('active');
                document.getElementById('loginEmail').value = resetEmailTarget;
                submitBtn.textContent = "Save New Password";
            } else {
                showToast(data.error || "Invalid code. Please try again.", "error"); 
                submitBtn.textContent = "Save New Password";
            }
        } catch (error) {
            showToast("Could not connect to the server.", "error"); 
            submitBtn.textContent = "Save New Password";
        }
    });
});

// --- GOOGLE SIGN-IN BRIDGE ---
window.handleGoogleLogin = async function(response) {
    const googleToken = response.credential;
    const BASE_URL = 'http://127.0.0.1:8000/api';

    try {
        const res = await fetch(`${BASE_URL}/google-login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: googleToken })
        });
        
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('maizeToken', data.token);
            localStorage.setItem('maizeUser', data.username);
            showToast("Google Login successful! Redirecting...", "success"); 
            setTimeout(() => { window.location.href = "/"; }, 1000);
        } else {
            showToast(data.error || "Google login failed.", "error");
        }
    } catch (error) {
        showToast("Could not connect to the server.", "error");
    }
};

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'error' ? 'fa-circle-xmark' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span class="toast-message">${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
}

window.handleGoogleLogin = async function(response) {
    const googleToken = response.credential;
    
    try {
        const res = await fetch('/api/google-login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credential: googleToken })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('maizeToken', data.token);
            localStorage.setItem('maizeUser', data.username);
            window.location.href = '/';
        } else {
            alert("Google Login Failed: " + (data.error || "Unknown error"));
        }
    } catch (error) {
        console.error("Network error during Google login:", error);
    }
};