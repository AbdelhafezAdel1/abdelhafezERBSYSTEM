-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL  -- In production, hash this
);

-- Companies table
CREATE TABLE companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    vat_number TEXT,
    contact TEXT,
    phone TEXT,
    address TEXT,
    bank_account TEXT
);

-- Invoices table
CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    customs_office TEXT,
    shipment_type TEXT CHECK(shipment_type IN ('Export', 'Import', 'Transit')),
    notes TEXT,
    total_before_tax REAL DEFAULT 0,
    clearance_fee REAL DEFAULT 0,
    vat_amount REAL DEFAULT 0,
    total_after_tax REAL DEFAULT 0,
    status TEXT CHECK(status IN ('Draft', 'Issued')) DEFAULT 'Draft',
    qr_code TEXT,  -- Base64 encoded QR
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Invoice Items table
CREATE TABLE invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    description TEXT,
    category TEXT CHECK(category IN ('Booking 1', 'Booking 2', 'Insurance', 'Translation', 'Clearance', 'Manual item')),
    quantity INTEGER,
    unit_price REAL,
    line_total REAL,
    taxable BOOLEAN DEFAULT 1,
    clearance_percentage REAL DEFAULT 15,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Bonds table
CREATE TABLE bonds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    type TEXT CHECK(type IN ('Receipt', 'Payment')),
    amount REAL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Audit Logs table
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Settings table (Owner Profile)
CREATE TABLE settings (
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
);

-- Insert a default user for testing
INSERT INTO users (username, password) VALUES ('admin', 'password');

-- Insert default settings
INSERT INTO settings (id, company_name_ar, company_name_en, vat_number, bank_account, address, phone, email) 
VALUES (1, 'مؤسسة عبدالحفيظ عادل', 'Abdelhafiz Adel Est.', '300000000000003', '', 'Jeddah', '0126425999', 'ALDHAWI@ABRALHDUD.COM');
