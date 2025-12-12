const { query } = require('./db');
require('dotenv').config();

const createTables = async () => {
    try {
        console.log('Creating tables...');

        // Users
        await query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        )`);

        // Companies
        await query(`CREATE TABLE IF NOT EXISTS companies (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            vat_number VARCHAR(50),
            contact_person VARCHAR(255),
            phone VARCHAR(50),
            address TEXT,
            bank_account VARCHAR(255)
        )`);

        // Invoices
        await query(`CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id),
            invoice_number VARCHAR(50),
            date TIMESTAMP,
            customs_office VARCHAR(255),
            shipment_type VARCHAR(50),
            notes TEXT,
            status VARCHAR(50) DEFAULT 'Draft',
            qr_code TEXT,
            total_before_tax DECIMAL(10, 2),
            clearance_fee DECIMAL(10, 2),
            vat_amount DECIMAL(10, 2),
            total_after_tax DECIMAL(10, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Invoice Items
        await query(`CREATE TABLE IF NOT EXISTS invoice_items (
            id SERIAL PRIMARY KEY,
            invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
            description TEXT,
            category VARCHAR(50),
            quantity DECIMAL(10, 2),
            unit_price DECIMAL(10, 2),
            line_total DECIMAL(10, 2),
            taxable INTEGER DEFAULT 1
        )`);

        // Bonds
        await query(`CREATE TABLE IF NOT EXISTS bonds (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id),
            type VARCHAR(50),
            amount DECIMAL(10, 2),
            date TIMESTAMP,
            notes TEXT
        )`);

        // Audit Logs
        await query(`CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            action VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Settings
        await query(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            company_name_ar VARCHAR(255),
            company_name_en VARCHAR(255),
            vat_number VARCHAR(50),
            bank_account VARCHAR(255),
            address TEXT,
            phone VARCHAR(50),
            email VARCHAR(255),
            logo_path VARCHAR(255),
            stamp_path VARCHAR(255)
        )`);

        // Default User
        const userCheck = await query('SELECT * FROM users WHERE username = $1', ['essa6502']);
        if (userCheck.rows.length === 0) {
            await query('INSERT INTO users (username, password) VALUES ($1, $2)', ['essa6502', '0531055420']);
            console.log('Default user created.');
        }

        // Default Settings
        await query(`INSERT INTO settings (id, company_name_ar, company_name_en, vat_number, bank_account, address, phone, email) 
            VALUES (1, 'مؤسسة عبدالحفيظ عادل', 'Abdelhafiz Adel Est.', '300000000000003', '', 'Jeddah', '0126425999', 'ALDHAWI@ABRALHDUD.COM')
            ON CONFLICT (id) DO NOTHING`);

        console.log('Database setup completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating tables:', err);
        process.exit(1);
    }
};

createTables();
