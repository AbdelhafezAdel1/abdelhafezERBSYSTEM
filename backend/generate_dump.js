const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);
const dumpFile = path.join(__dirname, 'data_exports', 'info.sql');

const stream = fs.createWriteStream(dumpFile, { flags: 'w' });

stream.write('-- PostgreSQL Data Dump from SQLite\n');
stream.write('-- Generated automatically\n\n');

db.serialize(() => {
    // 1. Tables Schema (Compatible with PG)
    // We will write CREATE TABLE statements adapted for PG
    const tables = [
        {
            name: 'users',
            create: `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );`
        },
        {
            name: 'companies',
            create: `CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                vat_number VARCHAR(50),
                contact_person VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                bank_account VARCHAR(255)
            );`
        },
        {
            name: 'invoices',
            create: `CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                uuid VARCHAR(255),
                zatca_submitted INTEGER DEFAULT 0,
                zatca_cleared INTEGER DEFAULT 0,
                zatca_status VARCHAR(50),
                zatca_response TEXT,
                submitted_at TIMESTAMP,
                cleared_at TIMESTAMP,
                xml_content TEXT
            );`
        },
        {
            name: 'invoice_items',
            create: `CREATE TABLE IF NOT EXISTS invoice_items (
                id SERIAL PRIMARY KEY,
                invoice_id INTEGER,
                description TEXT,
                category VARCHAR(50),
                quantity DECIMAL(10, 2),
                unit_price DECIMAL(10, 2),
                line_total DECIMAL(10, 2),
                taxable INTEGER DEFAULT 1
            );`
        },
        {
            name: 'bonds',
            create: `CREATE TABLE IF NOT EXISTS bonds (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                type VARCHAR(50),
                amount DECIMAL(10, 2),
                date TIMESTAMP,
                notes TEXT
            );`
        },
        {
            name: 'settings',
            create: `CREATE TABLE IF NOT EXISTS settings (
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
            );`
        }
    ];

    tables.forEach(t => {
        stream.write(`\n-- Table: ${t.name}\n`);
        stream.write(t.create + '\n');
    });

    // 2. Data Insertion
    const tablesToDump = ['users', 'companies', 'invoices', 'invoice_items', 'bonds', 'settings'];

    let completed = 0;

    tablesToDump.forEach(tableName => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
            if (err) {
                console.error(`Error reading ${tableName}:`, err);
            } else if (rows.length > 0) {
                stream.write(`\n-- Data for ${tableName}\n`);
                rows.forEach(row => {
                    const columns = Object.keys(row);
                    const values = Object.values(row).map(v => {
                        if (v === null) return 'NULL';
                        if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`; // Escape single quotes
                        return v;
                    });
                    stream.write(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`);
                });

                // Reset sequences for auto-increment columns (Postgres specific)
                if (tableName !== 'settings') {
                    const maxId = rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
                    stream.write(`SELECT setval('${tableName}_id_seq', ${maxId});\n`);
                }
            }
            completed++;
            if (completed === tablesToDump.length) {
                stream.write('\nCOMMIT;\n');
                stream.end();
                console.log('Dump completed successfully.');
            }
        });
    });
});
