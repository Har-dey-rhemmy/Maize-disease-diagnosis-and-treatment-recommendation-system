document.addEventListener('DOMContentLoaded', async () => {
    // --- PASSWORD VISIBILITY TOGGLE ---
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
    
    const BASE_URL = 'http://127.0.0.1:8000/api';
    const token = localStorage.getItem('maizeToken');

    if (!token) {
        window.location.href = "auth.html";
        return;
    }

    // --- CUSTOM TOAST SYSTEM ---
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = type === 'error' ? 'fa-circle-xmark' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check');
        
        toast.innerHTML = `<i class="fa-solid ${icon}"></i><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); 
        }, 4000);
    }

    // --- FETCH CURRENT PROFILE DATA ---
    try {
        const response = await fetch(`${BASE_URL}/profile/`, {
            method: 'GET',
            headers: { 'Authorization': `Token ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('set-email').value = data.email;
            document.getElementById('set-name').value = data.name;
            document.getElementById('set-username').value = data.username;
        } else {
            localStorage.clear();
            window.location.href = "auth.html";
        }
    } catch (error) {
        showToast("Could not load profile data.", "error");
    }

    // --- UPDATE PROFILE LOGIC ---
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('updateProfileBtn');
        const name = document.getElementById('set-name').value.trim();
        const username = document.getElementById('set-username').value.trim();
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        try {
            const response = await fetch(`${BASE_URL}/profile/`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}` 
                },
                body: JSON.stringify({ name, username })
            });
            const data = await response.json();

            if (response.ok) {
                showToast("Profile updated successfully!", "success");
                localStorage.setItem('maizeUser', data.username);
            } else {
                showToast(data.error || "Failed to update profile.", "error");
            }
        } catch (error) {
            showToast("Server connection error.", "error");
        } finally {
            btn.textContent = "Save Changes";
            btn.disabled = false;
        }
    });

    // --- CHANGE PASSWORD LOGIC ---
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('updatePasswordBtn');
        const old_password = document.getElementById('set-old-password').value;
        const new_password = document.getElementById('set-new-password').value;
        if (new_password.length < 8) {
            showToast("New password must be at least 8 characters long.", "warning");
            return;
        }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
        btn.disabled = true;

        try {
            const response = await fetch(`${BASE_URL}/change-password/`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}` 
                },
                body: JSON.stringify({ old_password, new_password })
            });
            const data = await response.json();

            if (response.ok) {
                showToast("Password updated successfully!", "success");
                document.getElementById('passwordForm').reset();
            } else {
                showToast(data.error || "Failed to change password.", "error");
            }
        } catch (error) {
            showToast("Server connection error.", "error");
        } finally {
            btn.innerHTML = "Update Password";
            btn.disabled = false;
        }
    });

    // --- DELETE ACCOUNT LOGIC ---
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (deleteAccountBtn && deleteConfirmModal) {
        deleteAccountBtn.addEventListener('click', () => {
            deleteConfirmModal.style.display = 'flex';
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteConfirmModal.style.display = 'none';
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            deleteConfirmModal.style.display = 'none';
            const originalText = deleteAccountBtn.innerHTML;
            deleteAccountBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
            deleteAccountBtn.disabled = true;

            try {
                const response = await fetch(`${BASE_URL}/delete-account/`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                });

                if (response.ok) {
                    showToast("Account deleted successfully. We are sorry to see you go.", "success");
                    localStorage.removeItem('maizeUser');
                    localStorage.removeItem('maizeToken');
                    setTimeout(() => {
                        window.location.href = "/auth/"; 
                    }, 2000);

                } else {
                    let errorMsg = "Failed to delete account.";
                    try {
                        const data = await response.json();
                        errorMsg = data.error || errorMsg;
                    } catch (e) {}
                    
                    showToast(errorMsg, "error");
                    deleteAccountBtn.innerHTML = originalText;
                    deleteAccountBtn.disabled = false;
                }
            } catch (error) {
                showToast("Server connection error. Could not delete account.", "error");
                deleteAccountBtn.innerHTML = originalText;
                deleteAccountBtn.disabled = false;
            }
        });
    }
});