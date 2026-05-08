async function handleLogin() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: password }) // NEW: Sending the data!
                });

                const data = await response.json();

                if (data.token) {
                    localStorage.setItem('corleon_token', data.token);
                    window.location.href = '/dashboard.html';
                } else {
                    document.getElementById('errorMsg').innerText = data.error || "Login failed.";
                    document.getElementById('errorMsg').style.display = 'block';
                }
            } catch (error) {
                console.error("Login Error:", error);
            }
        }