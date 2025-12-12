const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);

const USERNAME = 'essa6502';
const PASSWORD = '0531055420';

db.serialize(() => {
    // Drop users table if exists to start fresh, or just delete all
    db.run("DELETE FROM users", (err) => {
        if (err) {
            console.error("Error clearing users:", err);
        } else {
            console.log("Users table cleared.");
        }
    });

    // Insert the specific user
    const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    stmt.run(USERNAME, PASSWORD, (err) => {
        if (err) {
            console.error("Error inserting user:", err);
        } else {
            console.log(`User ${USERNAME} created successfully.`);
        }
    });
    stmt.finalize();
});

db.close((err) => {
    if (err) {
        console.error("Error closing database:", err);
    } else {
        console.log("Database connection closed.");
    }
});
