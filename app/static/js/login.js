const loginBtn = document.getElementById('loginBtn');
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

// Show error message
function showError(message) {
    authError.textContent = message;
    authError.style.display = 'block';
}

function clearError() {
    authError.style.display = 'none';
}

function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtn.textContent = loading ? 'Signing in...' : 'Sign in';
}

// Login
loginBtn?.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    clearError();

    if (!email || !password) {
        showError('Please fill in all fields.');
        return;
    }

    setLoading(true);

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.detail || 'Login failed. Please try again.');
            return;
        }

        // Redirect to home after successful login
        window.location.href = '/';

    } catch (err) {
        showError('Something went wrong. Please try again.');
    } finally {
        setLoading(false);
    }
});

// Submit on Enter
passwordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});