// app.js – Clean implementation for ERP system
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const QRCode = require('qrcode');

// Database connection
const dbPath = path.join(__dirname, '../database/database.db');
const db = new sqlite3.Database(dbPath);

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/pic', express.static(path.join(__dirname, 'pic')));

// Helper: ZATCA TLV QR generator
function generateZatcaTLV(sellerName, vatNumber, timestamp, total, vat) {
  const tags = [
    { id: 1, value: sellerName },
    { id: 2, value: vatNumber },
    { id: 3, value: timestamp },
    { id: 4, value: total },
    { id: 5, value: vat },
  ];
  let buffer = Buffer.alloc(0);
  for (const tag of tags) {
    const val = Buffer.from(tag.value.toString(), 'utf8');
    const len = Buffer.from([val.length]);
    const id = Buffer.from([tag.id]);
    buffer = Buffer.concat([buffer, id, len, val]);
  }
  return buffer.toString('base64');
}

// Routes imports
const zatcaRoutes = require('./routes/zatca');
const taxRegisterRoutes = require('./routes/taxRegister');
app.use('/api/zatca', zatcaRoutes);

// ---------- Auth ----------
// ---------- Auth ----------
const SEED_USER = {
  username: 'essa6502',
  password: '0531055420'
};

// Seed User on Start
db.get('SELECT * FROM users', (err, row) => {
  if (err) console.error(err);
  if (!row) {
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [SEED_USER.username, SEED_USER.password], (err) => {
      if (!err) console.log('Default user created.');
    });
  }
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      req.session.userId = row.id;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.put('/auth/update-user', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  db.run('UPDATE users SET username = ?, password = ? WHERE id = ?', [username, password, req.session.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ---------- Companies ----------
app.get('/api/companies', (req, res) => {
  db.all('SELECT * FROM companies', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/companies', (req, res) => {
  const { name, vat_number, contact_person, phone, address, bank_account } = req.body;
  db.run(
    'INSERT INTO companies (name, vat_number, contact_person, phone, address, bank_account) VALUES (?,?,?,?,?,?)',
    [name, vat_number, contact_person, phone, address, bank_account],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/companies/:id', (req, res) => {
  const { name, vat_number, contact_person, phone, address, bank_account } = req.body;
  db.run(
    'UPDATE companies SET name = ?, vat_number = ?, contact_person = ?, phone = ?, address = ?, bank_account = ? WHERE id = ?',
    [name, vat_number, contact_person, phone, address, bank_account, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    }
  );
});

app.delete('/api/companies/:id', (req, res) => {
  db.run('DELETE FROM companies WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

// ---------- Invoices ----------
// Get list with optional filters
app.get('/api/invoices', (req, res) => {
  const { startDate, endDate, companyId } = req.query;
  let where = '1=1';
  const params = [];
  if (startDate) { where += ' AND i.date >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND i.date <= ?'; params.push(endDate); }
  if (companyId) { where += ' AND i.company_id = ?'; params.push(companyId); }
  const sql = `SELECT i.*, c.name as company_name FROM invoices i JOIN companies c ON i.company_id = c.id WHERE ${where} ORDER BY i.date DESC`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/invoices', (req, res) => {
  const { company_id, date, customs_office, shipment_type, notes, status, items } = req.body;
  // Calculate totals
  let total_before_tax = 0;
  let taxable_total = 0;
  let clearance_total = 0;

  items.forEach(it => {
    const line = it.quantity * it.unit_price;
    total_before_tax += line;
    if (it.taxable) taxable_total += line;
    if (it.category === 'Clearance') clearance_total += line;
  });

  const vat_amount = taxable_total * 0.15;
  // Clearance fee is just for record, usually it's the clearance amount itself
  const clearance_fee = clearance_total;
  const total_after_tax = total_before_tax + vat_amount;

  const qrBase64 = generateZatcaTLV('Abdelhafiz Adel', '300000000000003', new Date().toISOString(), total_after_tax.toFixed(2), vat_amount.toFixed(2));

  db.run(
    `INSERT INTO invoices (company_id, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [company_id, date, customs_office, shipment_type, notes, status, qrBase64, total_before_tax, clearance_fee, vat_amount, total_after_tax],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const invoiceId = this.lastID;
      const stmt = db.prepare(`INSERT INTO invoice_items (invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (?,?,?,?,?,?,?)`);
      items.forEach(it => {
        stmt.run(invoiceId, it.description, it.category, it.quantity, it.unit_price, it.quantity * it.unit_price, it.taxable ? 1 : 0);
      });
      stmt.finalize();
      res.json({ id: invoiceId, qr_code: qrBase64 });
    }
  );
});

app.get('/api/invoices/:id', (req, res) => {
  db.get(
    `SELECT i.*, c.name as company_name, c.vat_number, c.address, c.phone FROM invoices i JOIN companies c ON i.company_id = c.id WHERE i.id = ?`,
    [req.params.id],
    (err, invoice) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id], (err2, items) => {
        if (err2) return res.status(500).json({ error: err2.message });
        invoice.items = items;
        res.json(invoice);
      });
    }
  );
});

app.delete('/api/invoices/:id', (req, res) => {
  db.run('DELETE FROM invoices WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM invoice_items WHERE invoice_id = ?', req.params.id, (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ changes: this.changes });
    });
  });
});

app.put('/api/invoices/:id', (req, res) => {
  const { company_id, date, customs_office, shipment_type, notes, status, items } = req.body;
  const invoiceId = req.params.id;
  // Calculate totals
  let total_before_tax = 0;
  let taxable_total = 0;
  let clearance_total = 0;

  items.forEach(it => {
    const line = it.quantity * it.unit_price;
    total_before_tax += line;
    if (it.taxable) taxable_total += line;
    if (it.category === 'Clearance') clearance_total += line;
  });

  const vat_amount = taxable_total * 0.15;
  const clearance_fee = clearance_total;
  const total_after_tax = total_before_tax + vat_amount;

  const qrBase64 = generateZatcaTLV('Abdelhafiz Adel', '300000000000003', new Date().toISOString(), total_after_tax.toFixed(2), vat_amount.toFixed(2));

  db.run(
    `UPDATE invoices SET company_id = ?, date = ?, customs_office = ?, shipment_type = ?, notes = ?, status = ?, total_before_tax = ?, clearance_fee = ?, vat_amount = ?, total_after_tax = ?, qr_code = ? WHERE id = ?`,
    [company_id, date, customs_office, shipment_type, notes, status, total_before_tax, clearance_fee, vat_amount, total_after_tax, qrBase64, invoiceId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      // Replace items
      db.run('DELETE FROM invoice_items WHERE invoice_id = ?', invoiceId, (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        const stmt = db.prepare(`INSERT INTO invoice_items (invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES (?,?,?,?,?,?,?)`);
        items.forEach(it => {
          stmt.run(invoiceId, it.description, it.category, it.quantity, it.unit_price, it.quantity * it.unit_price, it.taxable ? 1 : 0);
        });
        stmt.finalize();
        res.json({ id: invoiceId, changes: this.changes });
      });
    }
  );
});

// ---------- Tax Register ----------
app.use('/api/tax-register', taxRegisterRoutes);

// ---------- Bonds ----------
app.get('/api/bonds', (req, res) => {
  db.all(`SELECT b.*, c.name as company_name FROM bonds b JOIN companies c ON b.company_id = c.id ORDER BY b.date DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/bonds', (req, res) => {
  const { company_id, type, amount, date, notes } = req.body;
  db.run(`INSERT INTO bonds (company_id, type, amount, date, notes) VALUES (?,?,?,?,?)`,
    [company_id, type, amount, date, notes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// ---------- Dashboard ----------
app.get('/api/dashboard', (req, res) => {
  const { startDate, endDate, companyId } = req.query;
  let where = '1=1';
  const params = [];
  if (startDate) { where += ' AND i.date >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND i.date <= ?'; params.push(endDate); }
  if (companyId) { where += ' AND i.company_id = ?'; params.push(companyId); }

  // Overall stats
  db.get(`SELECT COUNT(*) as total_invoices, SUM(total_after_tax) as total_revenue, SUM(vat_amount) as total_vat FROM invoices i WHERE ${where}`,
    params,
    (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });
      // Company count
      db.get('SELECT COUNT(*) as total_companies FROM companies', (err2, companyCount) => {
        if (err2) return res.status(500).json({ error: err2.message });
        // Monthly revenue (last 6 months)
        db.all(`SELECT strftime('%Y-%m', i.date) as month, SUM(total_after_tax) as revenue FROM invoices i WHERE ${where} GROUP BY month ORDER BY month DESC LIMIT 6`,
          params,
          (err3, monthly) => {
            if (err3) return res.status(500).json({ error: err3.message });
            // Revenue by company (top 10)
            db.all(`SELECT c.name as company_name, SUM(i.total_after_tax) as revenue, COUNT(i.id) as invoice_count FROM invoices i JOIN companies c ON i.company_id = c.id WHERE ${where} GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 10`,
              params,
              (err4, byCompany) => {
                if (err4) return res.status(500).json({ error: err4.message });
                res.json({
                  stats: {
                    total_invoices: stats.total_invoices || 0,
                    total_revenue: stats.total_revenue || 0,
                    total_vat: stats.total_vat || 0,
                    total_companies: companyCount.total_companies || 0,
                  },
                  monthly_revenue: monthly.reverse(),
                  company_revenue: byCompany,
                });
              }
            );
          }
        );
      });
    }
  );
});

// ---------- Settings ----------
app.get('/api/settings', (req, res) => {
  db.get('SELECT * FROM settings WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || {});
  });
});

app.put('/api/settings', (req, res) => {
  const { company_name_ar, company_name_en, vat_number, bank_account, address, phone, email, logo_path, stamp_path } = req.body;
  db.run(`UPDATE settings SET company_name_ar = ?, company_name_en = ?, vat_number = ?, bank_account = ?, address = ?, phone = ?, email = ?, logo_path = ?, stamp_path = ? WHERE id = 1`,
    [company_name_ar, company_name_en, vat_number, bank_account, address, phone, email, logo_path, stamp_path],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
});

// ---------- Serve Frontend ----------
app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

module.exports = app;
