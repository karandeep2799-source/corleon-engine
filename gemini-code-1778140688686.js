const sqlite3 = require('sqlite3').verbose();

// Initialize the Database (this creates a file called corleon.db in your folder)
const db = new sqlite3.Database('./corleon.db');

// Create the Users table and insert a default test user if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        email TEXT UNIQUE, 
        password TEXT, 
        isPro BOOLEAN DEFAULT false
    )`);
    
    // Insert our test user so you can log in immediately
    db.run(`INSERT OR IGNORE INTO users (email, password, isPro) 
            VALUES ('test@corleon.com', 'password123', false)`);
});