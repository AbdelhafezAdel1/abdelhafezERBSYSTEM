const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(__dirname, "../database/database.db");
const db = new sqlite3.Database(dbPath);

const SEED_USER = {
  username: "essa6502",
  password: "0531055420",
};

db.run(
  "INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)",
  [SEED_USER.username, SEED_USER.password],
  (err) => {
    if (err) {
      console.error("Error inserting user:", err.message);
    } else {
      console.log("User inserted or already exists.");
    }
    db.close();
  }
);
