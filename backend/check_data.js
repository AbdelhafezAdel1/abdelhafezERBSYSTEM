const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.get("SELECT COUNT(*) as count FROM invoices", (err, row) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log(`Invoice count: ${row.count}`);
            if (row.count === 0) {
                console.log("No invoices found. Charts will be empty.");
                insertDummyData();
            } else {
                console.log("Invoices found. Charts should display data.");
                checkChartData();
            }
        }
    });
});

function insertDummyData() {
    console.log("Inserting dummy data...");
    const companies = [
        ['شركة الأفق', '300000000000001'],
        ['مؤسسة البنيان', '300000000000002'],
        ['شركة النقل السريع', '300000000000003']
    ];

    db.serialize(() => {
        // Insert companies
        const stmt = db.prepare("INSERT INTO companies (name, vat_number) VALUES (?, ?)");
        companies.forEach(c => stmt.run(c));
        stmt.finalize();

        // Insert invoices for different months
        const invoices = [
            // Current month
            { amount: 5000, date: new Date().toISOString().split('T')[0], company_id: 1 },
            { amount: 7500, date: new Date().toISOString().split('T')[0], company_id: 2 },
            // Last month
            { amount: 3000, date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0], company_id: 1 },
            // 2 months ago
            { amount: 12000, date: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().split('T')[0], company_id: 3 },
        ];

        const invStmt = db.prepare(`
            INSERT INTO invoices (company_id, date, total_after_tax, vat_amount, status, total_before_tax, clearance_fee) 
            VALUES (?, ?, ?, ?, 'Final', ?, 0)
        `);

        invoices.forEach(inv => {
            const vat = inv.amount * 0.15;
            const before = inv.amount - vat;
            invStmt.run(inv.company_id, inv.date, inv.amount, vat, before);
        });
        invStmt.finalize(() => {
            console.log("Dummy data inserted.");
        });
    });
}

function checkChartData() {
    // Simulate the query used in app.js for dashboard
    const sql = `SELECT strftime('%Y-%m', date) as month, SUM(total_after_tax) as revenue FROM invoices GROUP BY month ORDER BY month DESC LIMIT 6`;
    db.all(sql, [], (err, rows) => {
        if (err) console.error(err);
        else console.log("Monthly Revenue Data:", rows);
    });
}
