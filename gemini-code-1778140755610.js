// ==========================================
// ROUTE 2: REAL LOGIN (DATABASE VERIFIED)
// ==========================================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body; // Expecting email & password from login.html

    // Look up the user in the SQLite database
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        
        if (user) {
            console.log(`🔑 User ${user.email} logged in. Pro Status: ${user.isPro}`);
            // Generate token with their actual DB ID and Pro status
            const accessToken = jwt.sign(
                { id: user.id, email: user.email, isPro: user.isPro }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );
            res.json({ token: accessToken });
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    });
});