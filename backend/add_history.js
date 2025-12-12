const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log("Adding historical data for better chart visualization...");

const historicalInvoices = [
    { date: '2024-10-15', amount: 15000, company_id: 1 },
    { date: '2024-09-20', amount: 8500, company_id: 1 },
    { date: '2024-08-05', amount: 12000, company_id: 1 },
    { date: '2024-10-01', amount: 6000, company_id: 1 },
];

db.serialize(() => {
    const stmt = db.prepare(`
        INSERT INTO invoices (company_id, date, total_after_tax, vat_amount, status, total_before_tax, clearance_fee) 
        VALUES (?, ?, ?, ?, 'Final', ?, 0)
    `);

    historicalInvoices.forEach(inv => {
        const vat = inv.amount * 0.15;
        const before = inv.amount - vat;
        stmt.run(inv.company_id, inv.date, inv.amount, vat, before);
    });

    stmt.finalize(() => {
        console.log("Historical data added.");
        db.all(`SELECT strftime('%Y-%m', date) as month, SUM(total_after_tax) as revenue FROM invoices GROUP BY month ORDER BY month DESC LIMIT 6`, [], (err, rows) => {
            if (err) console.error(err);
            else console.log("Updated Monthly Data:", rows);
        });
    });
});
