-- PostgreSQL Schema for ERP System
-- Fixed: Changed AUTOINCREMENT to SERIAL for PostgreSQL compatibility

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,  -- In production, hash this
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    vat_number TEXT,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    bank_account TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    customs_office TEXT,
    shipment_type TEXT CHECK(shipment_type IN ('Export', 'Import', 'Transit')),
    notes TEXT,
    total_before_tax DECIMAL(15,2) DEFAULT 0,
    clearance_fee DECIMAL(15,2) DEFAULT 0,
    vat_amount DECIMAL(15,2) DEFAULT 0,
    total_after_tax DECIMAL(15,2) DEFAULT 0,
    status TEXT CHECK(status IN ('Draft', 'Issued')) DEFAULT 'Draft',
    qr_code TEXT,  -- Base64 encoded QR
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice Items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT CHECK(category IN ('Booking 1', 'Booking 2', 'Insurance', 'Translation', 'Clearance', 'Manual item')),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    taxable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bonds table
CREATE TABLE IF NOT EXISTS bonds (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    type TEXT CHECK(type IN ('Receipt', 'Payment')) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    notes TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (Owner Profile)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name_ar TEXT,
    company_name_en TEXT,
    vat_number TEXT,
    bank_account TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_path TEXT,
    stamp_path TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bonds_company_id ON bonds(company_id);
CREATE INDEX IF NOT EXISTS idx_bonds_date ON bonds(date);

-- Insert default settings if not exists
INSERT INTO settings (id, company_name_ar, company_name_en, vat_number, bank_account, address, phone, email) 
VALUES (1, 'مؤسسة عبدالحفيظ عادل', 'Abdelhafiz Adel Est.', '300000000000003', '', 'Jeddah', '0126425999', 'ALDHAWI@ABRALHDUD.COM')
ON CONFLICT (id) DO NOTHING;
