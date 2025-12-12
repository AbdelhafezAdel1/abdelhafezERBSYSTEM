const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);

console.log("Checking users in database...");

db.all("SELECT id, username, password FROM users", (err, rows) => {
    if (err) {
        console.error("Error reading users:", err);
    } else {
        console.log("Users found:", rows);
        if (rows.length === 0) {
            console.log("WARNING: No users found in the database!");
        }
    }
    db.close();
});
