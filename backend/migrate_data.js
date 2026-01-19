const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

// SQLite setup
const dbPath = path.join(__dirname, '../database/database.db');
const sqliteDb = new sqlite3.Database(dbPath);

// PG setup
if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL. Set it to your Supabase connection string (pooler 6543).');
    process.exit(1);
}

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function sqliteAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function sqliteGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function sqliteColumns(tableName) {
    const rows = await sqliteAll(`PRAGMA table_info(${tableName})`);
    return rows.map(r => r.name);
}

async function setSequence(tableName, maxId) {
    if (!maxId || Number.isNaN(maxId)) return;
    const seqRes = await pgPool.query(
        `SELECT pg_get_serial_sequence($1, 'id') as seq`,
        [tableName]
    );
    const seq = seqRes.rows?.[0]?.seq;
    if (seq) {
        await pgPool.query(`SELECT setval($1, $2, true)`, [seq, maxId]);
    }
}

async function migrate() {
    console.log('Starting migration...');

    const today = new Date().toISOString().slice(0, 10);

    try {
        console.log('🔍 Inspecting SQLite schema...');
        const companiesCols = await sqliteColumns('companies').catch(() => []);
        const invoicesCols = await sqliteColumns('invoices').catch(() => []);
        const bondsCols = await sqliteColumns('bonds').catch(() => []);

        // 1. Companies
        console.log('Migrating Companies...');
        const companies = await sqliteAll('SELECT * FROM companies').catch(() => []);
        for (const c of companies) {
            const contactPerson = companiesCols.includes('contact_person')
                ? c.contact_person
                : (companiesCols.includes('contact') ? c.contact : null);
            await pgPool.query(
                `INSERT INTO companies (id, name, vat_number, contact_person, phone, address, bank_account) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET 
                 name=EXCLUDED.name, vat_number=EXCLUDED.vat_number, contact_person=EXCLUDED.contact_person, 
                 phone=EXCLUDED.phone, address=EXCLUDED.address, bank_account=EXCLUDED.bank_account`,
                [c.id, c.name, c.vat_number, contactPerson, c.phone, c.address, c.bank_account]
            );
        }
        if (companies.length > 0) {
            const maxId = Math.max(...companies.map(c => c.id));
            await setSequence('companies', maxId);
        }

        // 2. Users
        console.log('Migrating Users...');
        const users = await sqliteAll('SELECT * FROM users').catch(() => []);
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
            await setSequence('users', maxId);
        }

        // 3. Settings
        console.log('Migrating Settings...');
        const settings = await sqliteAll('SELECT * FROM settings').catch(() => []);
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
        const invoices = await sqliteAll('SELECT * FROM invoices').catch(() => []);
        for (const i of invoices) {
            const invoiceDate = i.date || i.created_at || today;
            await pgPool.query(
                `INSERT INTO invoices (id, company_id, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (id) DO UPDATE SET
                 company_id=EXCLUDED.company_id, date=EXCLUDED.date, 
                 customs_office=EXCLUDED.customs_office, shipment_type=EXCLUDED.shipment_type, notes=EXCLUDED.notes,
                 status=EXCLUDED.status, qr_code=EXCLUDED.qr_code, total_before_tax=EXCLUDED.total_before_tax,
                 clearance_fee=EXCLUDED.clearance_fee, vat_amount=EXCLUDED.vat_amount, total_after_tax=EXCLUDED.total_after_tax`,
                [i.id, i.company_id, invoiceDate, i.customs_office, i.shipment_type, i.notes, i.status, i.qr_code, i.total_before_tax, i.clearance_fee, i.vat_amount, i.total_after_tax]
            );
        }
        if (invoices.length > 0) {
            const maxId = Math.max(...invoices.map(i => i.id));
            await setSequence('invoices', maxId);
        }

        // 5. Invoice Items
        console.log('Migrating Invoice Items...');
        const items = await sqliteAll('SELECT * FROM invoice_items').catch(() => []);
        for (const item of items) {
            const taxable = item.taxable === 1 || item.taxable === true || item.taxable === '1';
            await pgPool.query(
                `INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, line_total, taxable)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                 invoice_id=EXCLUDED.invoice_id, description=EXCLUDED.description, category=EXCLUDED.category,
                 quantity=EXCLUDED.quantity, unit_price=EXCLUDED.unit_price, line_total=EXCLUDED.line_total, taxable=EXCLUDED.taxable`,
                [item.id, item.invoice_id, item.description, item.category, item.quantity, item.unit_price, item.line_total, taxable]
            );
        }
        if (items.length > 0) {
            const maxId = Math.max(...items.map(i => i.id));
            await setSequence('invoice_items', maxId);
        }

        // 6. Bonds
        console.log('Migrating Bonds...');
        const bonds = await sqliteAll('SELECT * FROM bonds').catch(() => []);
        for (const b of bonds) {
            const notes = bondsCols.includes('notes')
                ? b.notes
                : (bondsCols.includes('description') ? b.description : null);
            const bondDate = b.date || b.created_at || today;
            await pgPool.query(
                `INSERT INTO bonds (id, company_id, type, amount, date, notes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET
                 company_id=EXCLUDED.company_id, type=EXCLUDED.type, amount=EXCLUDED.amount, date=EXCLUDED.date, notes=EXCLUDED.notes`,
                [b.id, b.company_id, b.type, b.amount, bondDate, notes]
            );
        }
        if (bonds.length > 0) {
            const maxId = Math.max(...bonds.map(b => b.id));
            await setSequence('bonds', maxId);
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
