const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);

const user = 'essa6502';
const pass = '0531055420';

db.serialize(() => {
    db.run("UPDATE users SET password = ? WHERE username = ?", [pass, user], function (err) {
        if (err) {
            console.error('Error resetting password:', err.message);
        } else {
            console.log(`Password reset for user '${user}' to '${pass}'. Changes: ${this.changes}`);
        }
        db.close((err) => {
            if (err) console.error("Error closing database:", err);
            else console.log("Database connection closed.");
        });
    });
});
