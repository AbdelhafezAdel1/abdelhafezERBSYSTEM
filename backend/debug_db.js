const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../database/database.db');
console.log('Testing connection to:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Connection error:', err.message);
    } else {
        console.log('Connected to DB.');
        db.all("SELECT * FROM users", [], (err, rows) => {
            if (err) console.error('Query error:', err.message);
            else console.log('Users found:', rows);
        });
    }
});
