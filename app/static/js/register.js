const registerBtn = document.getElementById('registerBtn');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('authError');
const togglePassword = document.getElementById('togglePassword');
const toggleIcon = document.getElementById('toggleIcon');

// Toggle password visibility
togglePassword?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleIcon.textContent = isPassword ? '🙈' : '👁';
});

function showError(message) {
    authError.textContent = message;
    authError.style.display = 'block';
}

function clearError() {
    authError.style.display = 'none';
}

function setLoading(loading) {
    registerBtn.disabled = loading;
    registerBtn.textContent = loading ? 'Creating account...' : 'Create account';
}

// Register
registerBtn?.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    clearError();

    if (!username || !email || !password) {
        showError('Please fill in all fields.');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
    }

    setLoading(true);

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.detail || 'Registration failed. Please try again.');
            return;
        }

        // Auto-login after register
        const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (loginRes.ok) {
            window.location.href = '/';
        } else {
            window.location.href = '/login';
        }

    } catch (err) {
        showError('Something went wrong. Please try again.');
    } finally {
        setLoading(false);
    }
});

// Submit on Enter
passwordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') registerBtn.click();
});