const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

// SQLite setup
const dbPath = path.join(__dirname, '../database/database.db');
const sqliteDb = new sqlite3.Database(dbPath);

// PG setup
const pgPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'erb_system',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function migrate() {
    console.log('Starting migration...');

    // Helper to get data from sqlite
    const getSqliteData = (query) => {
        return new Promise((resolve, reject) => {
            sqliteDb.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    try {
        // 1. Companies
        console.log('Migrating Companies...');
        const companies = await getSqliteData('SELECT * FROM companies');
        for (const c of companies) {
            await pgPool.query(
                `INSERT INTO companies (id, name, vat_number, contact_person, phone, address, bank_account) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET 
                 name=EXCLUDED.name, vat_number=EXCLUDED.vat_number, contact_person=EXCLUDED.contact_person, 
                 phone=EXCLUDED.phone, address=EXCLUDED.address, bank_account=EXCLUDED.bank_account`,
                [c.id, c.name, c.vat_number, c.contact_person, c.phone, c.address, c.bank_account]
            );
        }
        if (companies.length > 0) {
            const maxId = Math.max(...companies.map(c => c.id));
            await pgPool.query(`SELECT setval('companies_id_seq', $1)`, [maxId]);
        }

        // 2. Users
        console.log('Migrating Users...');
        const users = await getSqliteData('SELECT * FROM users');
        for (const u of users) {
            // Check if user exists (to avoid re-hashing or whatever, though here we just copy raw password)
            await pgPool.query(
                `INSERT INTO users (id, username, password) VALUES ($1, $2, $3)
                 ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, password=EXCLUDED.password`,
                [u.id, u.username, u.password]
            );
        }
        if (users.length > 0) {
            const maxId = Math.max(...users.map(u => u.id));
            await pgPool.query(`SELECT setval('users_id_seq', $1)`, [maxId]);
        }

        // 3. Settings
        console.log('Migrating Settings...');
        const settings = await getSqliteData('SELECT * FROM settings');
        for (const s of settings) {
            await pgPool.query(
                `INSERT INTO settings (id, company_name_ar, company_name_en, vat_number, bank_account, address, phone, email, logo_path, stamp_path)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (id) DO UPDATE SET 
                 company_name_ar=EXCLUDED.company_name_ar, company_name_en=EXCLUDED.company_name_en,
                 vat_number=EXCLUDED.vat_number, bank_account=EXCLUDED.bank_account,
                 address=EXCLUDED.address, phone=EXCLUDED.phone, email=EXCLUDED.email,
                 logo_path=EXCLUDED.logo_path, stamp_path=EXCLUDED.stamp_path`,
                [s.id, s.company_name_ar, s.company_name_en, s.vat_number, s.bank_account, s.address, s.phone, s.email, s.logo_path, s.stamp_path]
            );
        }

        // 4. Invoices
        console.log('Migrating Invoices...');
        const invoices = await getSqliteData('SELECT * FROM invoices');
        for (const i of invoices) {
            // Convert SQLite date string to Postgres timestamp-friendly format if needed.
            // SQLite: '2024-05-12' or '2024-05-12T...' 
            // Postgres works fine with ISO strings.
            await pgPool.query(
                `INSERT INTO invoices (id, company_id, invoice_number, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO UPDATE SET
                 company_id=EXCLUDED.company_id, invoice_number=EXCLUDED.invoice_number, date=EXCLUDED.date, 
                 customs_office=EXCLUDED.customs_office, shipment_type=EXCLUDED.shipment_type, notes=EXCLUDED.notes,
                 status=EXCLUDED.status, qr_code=EXCLUDED.qr_code, total_before_tax=EXCLUDED.total_before_tax,
                 clearance_fee=EXCLUDED.clearance_fee, vat_amount=EXCLUDED.vat_amount, total_after_tax=EXCLUDED.total_after_tax`,
                [i.id, i.company_id, i.invoice_number, i.date, i.customs_office, i.shipment_type, i.notes, i.status, i.qr_code, i.total_before_tax, i.clearance_fee, i.vat_amount, i.total_after_tax]
            );
        }
        if (invoices.length > 0) {
            const maxId = Math.max(...invoices.map(i => i.id));
            await pgPool.query(`SELECT setval('invoices_id_seq', $1)`, [maxId]);
        }

        // 5. Invoice Items
        console.log('Migrating Invoice Items...');
        const items = await getSqliteData('SELECT * FROM invoice_items');
        for (const item of items) {
            await pgPool.query(
                `INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                 invoice_id=EXCLUDED.invoice_id, description=EXCLUDED.description, category=EXCLUDED.category,
                 quantity=EXCLUDED.quantity, unit_price=EXCLUDED.unit_price, line_total=EXCLUDED.line_total, taxable=EXCLUDED.taxable`,
                [item.id, item.invoice_id, item.description, item.category, item.quantity, item.unit_price, item.line_total, item.taxable]
            );
        }
        if (items.length > 0) {
            const maxId = Math.max(...items.map(i => i.id));
            await pgPool.query(`SELECT setval('invoice_items_id_seq', $1)`, [maxId]);
        }

        // 6. Bonds
        console.log('Migrating Bonds...');
        const bonds = await getSqliteData('SELECT * FROM bonds');
        for (const b of bonds) {
            await pgPool.query(
                `INSERT INTO bonds (id, company_id, type, amount, date, notes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET
                 company_id=EXCLUDED.company_id, type=EXCLUDED.type, amount=EXCLUDED.amount, date=EXCLUDED.date, notes=EXCLUDED.notes`,
                [b.id, b.company_id, b.type, b.amount, b.date, b.notes]
            );
        }
        if (bonds.length > 0) {
            const maxId = Math.max(...bonds.map(b => b.id));
            await pgPool.query(`SELECT setval('bonds_id_seq', $1)`, [maxId]);
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
