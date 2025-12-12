const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  // Companies
  db.run(`CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    vat_number TEXT,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    bank_account TEXT
  )`);

  // Invoices
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    invoice_number TEXT,
    date TEXT,
    customs_office TEXT,
    shipment_type TEXT,
    notes TEXT,
    status TEXT, 
    qr_code TEXT,
    total_before_tax REAL,
    clearance_fee REAL,
    vat_amount REAL,
    total_after_tax REAL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )`);

  // Invoice Items
  db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    description TEXT,
    category TEXT,
    quantity REAL,
    unit_price REAL,
    line_total REAL,
    taxable INTEGER, 
    FOREIGN KEY(invoice_id) REFERENCES invoices(id)
  )`);

  // Bonds
  db.run(`CREATE TABLE IF NOT EXISTS bonds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    type TEXT, 
    amount REAL,
    date TEXT,
    notes TEXT,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )`);

  // Audit Logs
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default user
  db.run(`INSERT OR IGNORE INTO users (username, password) VALUES ('admin', 'admin')`);

  // Settings (Profile)
  db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name_ar TEXT,
        company_name_en TEXT,
        vat_number TEXT,
        bank_account TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        logo_path TEXT,
        stamp_path TEXT
    )`);

  // Insert default settings
  db.run(`INSERT OR IGNORE INTO settings (id, company_name_ar, company_name_en, vat_number, bank_account, address, phone, email) 
    VALUES (1, 'مؤسسة عبدالحفيظ عادل', 'Abdelhafiz Adel Est.', '300000000000003', '', 'Jeddah', '0126425999', 'ALDHAWI@ABRALHDUD.COM')`);
});

db.close();
console.log("Database initialized.");
