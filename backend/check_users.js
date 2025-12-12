const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Users found:", rows);
});
