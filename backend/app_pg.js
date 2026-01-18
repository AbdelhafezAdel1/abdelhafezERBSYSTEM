const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db'); // Use the new PG module
const QRCode = require('qrcode');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure session for production
// نستخدم MemoryStore حالياً لضمان أسرع أداء ممكن في تسجيل الدخول
// هذا يزيل التأخير الناتج عن الاتصال بقاعدة البيانات البعيدة لحفظ الجلسة
const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1); // Trust first proxy (Render)

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: isProduction, // true in production (HTTPS), false in development
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware - protect index.html
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login.html');
};

// Serve login page without auth
app.use('/login.html', express.static(path.join(__dirname, '../frontend/login.html')));
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
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

const zatcaRoutes = require('./routes/zatca');
const taxRegisterRoutes = require('./routes/taxRegister');
app.use('/api/zatca', zatcaRoutes);
app.use('/api/tax-register', taxRegisterRoutes);

// إنشاء المستخدم الافتراضي عند بدء التشغيل
const SEED_USER = {
    username: 'admin',
    password: '100200300aa'
};

// التحقق من وجود المستخدم وإنشائه إذا لم يكن موجوداً
(async () => {
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [SEED_USER.username]);
        if (result.rows.length === 0) {
            await db.query('INSERT INTO users (username, password) VALUES ($1, $2)',
                [SEED_USER.username, SEED_USER.password]);
            console.log('✅ تم إنشاء المستخدم الافتراضي:', SEED_USER.username);
        } else {
            console.log('✅ المستخدم موجود:', SEED_USER.username);
        }
    } catch (err) {
        console.error('❌ خطأ في إنشاء المستخدم:', err.message);
    }
})();

const UserCache = require('./utils/UserCache');
const DataCache = require('./utils/DataCache');

// ---------- Auth ----------
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log('🔐 محاولة تسجيل دخول:', username);

    try {
        // 1. محاولة البحث في الذاكرة (سريع جداً)
        let user = UserCache.getUser(username);

        // 2. إذا لم يوجد في الذاكرة، نبحث في قاعدة البيانات (احتياطي)
        if (!user) {
            console.log('⚠️ المستخدم غير موجود في الكاش، جاري البحث في قاعدة البيانات...');
            const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
            if (result.rows.length > 0) {
                user = result.rows[0];
                // تحديث الكاش للمرة القادمة
                UserCache.refresh();
            }
        }

        if (user && user.password === password) {
            // حفظ معلومات المستخدم في الـ session
            req.session.userId = user.id;
            req.session.username = user.username;

            req.session.save((err) => {
                if (err) {
                    console.error('❌ خطأ في حفظ session:', err.message);
                    return res.status(500).json({ error: 'Session save failed' });
                }
                console.log('✅ تم تسجيل الدخول بنجاح (Instant):', username);
                res.json({ success: true, username: user.username });
            });
        } else {
            console.log('❌ بيانات دخول خاطئة:', username);
            res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
    } catch (err) {
        console.error('❌ خطأ في تسجيل الدخول:', err.message);
        res.status(500).json({ error: 'حدث خطأ في النظام' });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.put('/auth/update-user', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        await db.query('UPDATE users SET username = $1, password = $2 WHERE id = $3', [username, password, req.session.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UserCache and DataCache are already required above or will be moved there.

// ---------- Auth ----------
// ... (Auth code remains unchanged)

// ---------- Companies ----------
app.get('/api/companies', (req, res) => {
    // 🚀 Speed: Read from Memory if loaded
    if (DataCache.isLoaded && DataCache.getCompanies().length > 0) {
        console.log(`🚀 Serving ${DataCache.getCompanies().length} companies from Cache`);
        return res.json(DataCache.getCompanies());
    }

    console.log('🔄 Cache miss/empty, fetching companies from DB...');
    db.query('SELECT * FROM companies ORDER BY name', (err, result) => {
        if (err) {
            console.error('❌ Error fetching companies:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(result.rows);
    });
});

app.post('/api/companies', async (req, res) => {
    const { name, vat_number, contact_person, phone, address, bank_account } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO companies (name, vat_number, contact_person, phone, address, bank_account) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [name, vat_number, contact_person, phone, address, bank_account]
        );
        const newId = result.rows[0].id;

        // Update Cache
        DataCache.addCompany({ id: newId, name, vat_number, contact_person, phone, address, bank_account });

        res.json({ id: newId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Invoices ----------
app.get('/api/invoices', async (req, res) => {
    const { startDate, endDate, companyId } = req.query;

    // 🚀 Speed: Read from Memory
    if (DataCache.isLoaded && DataCache.getInvoices().length > 0) {
        // Apply filters in memory
        const filtered = DataCache.getInvoices({ startDate, endDate, companyId });
        console.log(`🚀 Serving ${filtered.length} invoices from Cache (${DataCache.getInvoices().length} total)`);
        return res.json(filtered);
    }

    let where = '1=1';
    const params = [];
    let paramCounter = 1;

    if (startDate) { where += ` AND i.date >= $${paramCounter++}`; params.push(startDate); }
    if (endDate) { where += ` AND i.date <= $${paramCounter++}`; params.push(endDate); }
    if (companyId) { where += ` AND i.company_id = $${paramCounter++}`; params.push(companyId); }

    const sql = `SELECT i.*, c.name as company_name FROM invoices i JOIN companies c ON i.company_id = c.id WHERE ${where} ORDER BY i.date DESC`;
    try {
        console.log('🔄 Cache miss/empty, fetching invoices from DB with params:', params);
        const result = await db.query(sql, params);
        console.log(`✅ Fetched ${result.rows.length} invoices from DB.`);

        // Debug: Check if companies exist
        if (result.rows.length === 0) {
            const countCompanies = await db.query('SELECT COUNT(*) FROM companies');
            const countInvoices = await db.query('SELECT COUNT(*) FROM invoices');
            console.log(`⚠️ Debug Stats: Companies=${countCompanies.rows[0].count}, Invoices=${countInvoices.rows[0].count}`);
        }

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ... (POST invoice logic needs to call DataCache.addInvoice at the end)


app.put('/api/companies/:id', async (req, res) => {
    const { name, vat_number, contact_person, phone, address, bank_account } = req.body;
    try {
        const result = await db.query(
            'UPDATE companies SET name = $1, vat_number = $2, contact_person = $3, phone = $4, address = $5, bank_account = $6 WHERE id = $7',
            [name, vat_number, contact_person, phone, address, bank_account, req.params.id]
        );
        DataCache.updateCompany(req.params.id, { name, vat_number, contact_person, phone, address, bank_account });
        res.json({ changes: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/companies/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
        DataCache.deleteCompany(req.params.id);
        res.json({ changes: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Invoices ----------
app.get('/api/invoices', async (req, res) => {
    const { startDate, endDate, companyId } = req.query;
    let where = '1=1';
    const params = [];
    let paramCounter = 1;

    if (startDate) { where += ` AND i.date >= $${paramCounter++}`; params.push(startDate); }
    if (endDate) { where += ` AND i.date <= $${paramCounter++}`; params.push(endDate); }
    if (companyId) { where += ` AND i.company_id = $${paramCounter++}`; params.push(companyId); }

    const sql = `SELECT i.*, c.name as company_name FROM invoices i JOIN companies c ON i.company_id = c.id WHERE ${where} ORDER BY i.date DESC`;
    try {
        const result = await db.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices', async (req, res) => {
    const { company_id, date, customs_office, shipment_type, notes, status, items } = req.body;

    let total_before_tax = 0;
    let taxable_total = 0;
    let clearance_total = 0;

    if (items && Array.isArray(items)) {
        items.forEach(it => {
            const line = it.quantity * it.unit_price;
            total_before_tax += line;
            if (it.taxable) taxable_total += line;
            if (it.category === 'Clearance') clearance_total += line;
        });
    }

    const vat_amount = taxable_total * 0.15;
    const clearance_fee = clearance_total;
    const total_after_tax = total_before_tax + vat_amount;

    const qrBase64 = generateZatcaTLV('Abdelhafiz Adel', '300000000000003', new Date().toISOString(), total_after_tax.toFixed(2), vat_amount.toFixed(2));

    // استخدام client واحد من pool للمعاملة
    const client = await db.getClient();
    try {
        // Start transaction
        await client.query('BEGIN');

        const invoiceResult = await client.query(
            `INSERT INTO invoices (company_id, date, customs_office, shipment_type, notes, status, qr_code, total_before_tax, clearance_fee, vat_amount, total_after_tax)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [company_id, date, customs_office, shipment_type, notes, status, qrBase64, total_before_tax, clearance_fee, vat_amount, total_after_tax]
        );

        const invoiceId = invoiceResult.rows[0].id;

        if (items && Array.isArray(items)) {
            for (const it of items) {
                await client.query(
                    `INSERT INTO invoice_items (invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [invoiceId, it.description, it.category, it.quantity, it.unit_price, it.quantity * it.unit_price, it.taxable ? 1 : 0]
                );
            }
        }

        await client.query('COMMIT');

        // Update Cache
        DataCache.addInvoice({
            id: invoiceId, company_id, date, customs_office, shipment_type, notes, status, qr_code: qrBase64,
            total_before_tax, clearance_fee, vat_amount, total_after_tax
        });

        res.json({ id: invoiceId, qr_code: qrBase64 });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        // إرجاع الـ client إلى الـ pool
        client.release();
    }
});

app.get('/api/invoices/:id', async (req, res) => {
    try {
        const invoiceRes = await db.query(
            `SELECT i.*, c.name as company_name, c.vat_number, c.address, c.phone FROM invoices i JOIN companies c ON i.company_id = c.id WHERE i.id = $1`,
            [req.params.id]
        );
        if (invoiceRes.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

        const invoice = invoiceRes.rows[0];
        const itemsRes = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
        invoice.items = itemsRes.rows;
        res.json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/invoices/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM invoices WHERE id = $1', [req.params.id]); // Cascade delete handles items

        // Update Cache
        DataCache.deleteInvoice(req.params.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/invoices/:id', async (req, res) => {
    const { company_id, date, customs_office, shipment_type, notes, status, items } = req.body;
    const invoiceId = req.params.id;

    // Calculate totals (same as POST)
    let total_before_tax = 0;
    let taxable_total = 0;
    let clearance_total = 0;

    if (items && Array.isArray(items)) {
        items.forEach(it => {
            const line = it.quantity * it.unit_price;
            total_before_tax += line;
            if (it.taxable) taxable_total += line;
            if (it.category === 'Clearance') clearance_total += line;
        });
    }

    const vat_amount = taxable_total * 0.15;
    const clearance_fee = clearance_total;
    const total_after_tax = total_before_tax + vat_amount;
    const qrBase64 = generateZatcaTLV('Abdelhafiz Adel', '300000000000003', new Date().toISOString(), total_after_tax.toFixed(2), vat_amount.toFixed(2));

    // استخدام client واحد من pool للمعاملة
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE invoices SET company_id = $1, date = $2, customs_office = $3, shipment_type = $4, notes = $5, status = $6, total_before_tax = $7, clearance_fee = $8, vat_amount = $9, total_after_tax = $10, qr_code = $11 WHERE id = $12`,
            [company_id, date, customs_office, shipment_type, notes, status, total_before_tax, clearance_fee, vat_amount, total_after_tax, qrBase64, invoiceId]
        );

        // Replace items
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

        if (items && Array.isArray(items)) {
            for (const it of items) {
                await client.query(
                    `INSERT INTO invoice_items (invoice_id, description, category, quantity, unit_price, line_total, taxable) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [invoiceId, it.description, it.category, it.quantity, it.unit_price, it.quantity * it.unit_price, it.taxable ? 1 : 0]
                );
            }
        }
        await client.query('COMMIT');

        // Update Cache
        DataCache.updateInvoice(invoiceId, {
            company_id, date, customs_office, shipment_type, notes, status, qr_code: qrBase64,
            total_before_tax, clearance_fee, vat_amount, total_after_tax
        });

        res.json({ id: invoiceId, changes: 1 });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        // إرجاع الـ client إلى الـ pool
        client.release();
    }
});

// ---------- Bonds ----------
app.get('/api/bonds', async (req, res) => {
    // 🚀 Speed: Read from Memory
    if (DataCache.isLoaded) {
        return res.json(DataCache.getBonds());
    }

    // Fallback
    try {
        const result = await db.query(`SELECT b.*, c.name as company_name FROM bonds b JOIN companies c ON b.company_id = c.id ORDER BY b.date DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bonds', async (req, res) => {
    const { company_id, type, amount, date, notes } = req.body;
    try {
        const result = await db.query(`INSERT INTO bonds (company_id, type, amount, date, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [company_id, type, amount, date, notes]);

        // Update Cache
        DataCache.addBond({ id: result.rows[0].id, company_id, type, amount, date, notes });

        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Dashboard ----------
app.get('/api/dashboard', async (req, res) => {
    const { startDate, endDate, companyId } = req.query;

    let where = '1=1';
    const params = [];
    let paramCounter = 1;

    if (startDate) { where += ` AND i.date >= $${paramCounter++}`; params.push(startDate); }
    if (endDate) { where += ` AND i.date <= $${paramCounter++}`; params.push(endDate); }
    if (companyId) { where += ` AND i.company_id = $${paramCounter++}`; params.push(companyId); }

    try {
        const statsRes = await db.query(`SELECT COUNT(*) as total_invoices, SUM(total_after_tax) as total_revenue, SUM(vat_amount) as total_vat FROM invoices i WHERE ${where}`, params);
        const companyCountRes = await db.query('SELECT COUNT(*) as total_companies FROM companies');

        // Postgres date truncation: date_trunc('month', i.date) or to_char(i.date, 'YYYY-MM')
        const monthlyRes = await db.query(`SELECT to_char(i.date, 'YYYY-MM') as month, SUM(total_after_tax) as revenue FROM invoices i WHERE ${where} GROUP BY month ORDER BY month DESC LIMIT 6`, params);

        const byCompanyRes = await db.query(`SELECT c.name as company_name, SUM(i.total_after_tax) as revenue, COUNT(i.id) as invoice_count FROM invoices i JOIN companies c ON i.company_id = c.id WHERE ${where} GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 10`, params);

        res.json({
            stats: {
                total_invoices: statsRes.rows[0].total_invoices || 0,
                total_revenue: statsRes.rows[0].total_revenue || 0,
                total_vat: statsRes.rows[0].total_vat || 0,
                total_companies: companyCountRes.rows[0].total_companies || 0,
            },
            monthly_revenue: monthlyRes.rows.reverse(),
            company_revenue: byCompanyRes.rows,
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Settings ----------
app.get('/api/settings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM settings WHERE id = 1');
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/settings', async (req, res) => {
    const { company_name_ar, company_name_en, vat_number, bank_account, address, phone, email, logo_path, stamp_path } = req.body;
    try {
        const result = await db.query(`UPDATE settings SET company_name_ar = $1, company_name_en = $2, vat_number = $3, bank_account = $4, address = $5, phone = $6, email = $7, logo_path = $8, stamp_path = $9 WHERE id = 1`,
            [company_name_ar, company_name_en, vat_number, bank_account, address, phone, email, logo_path, stamp_path]);
        res.json({ success: true, changes: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Serve Frontend ----------
// Login page (public)
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Protected index.html - block direct access
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Protected root route
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Catch all other frontend routes - require auth (using middleware instead of wildcard)
app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
        return next();
    }
    // Skip public assets
    if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/images') || req.path.startsWith('/pic') || req.path === '/login.html') {
        return next();
    }
    // Require auth for everything else
    if (!req.session || !req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, async () => {
    console.log(`PostgreSQL Server running on http://localhost:${PORT}`);

    // Warm-up Database Connection (non-blocking)
    console.log('🔥 Starting database warm-up (non-blocking)...');
    
    // محاولة اتصال سريعة (non-blocking)
    (async () => {
        try {
            // محاولة سريعة واحدة فقط
            await db.query('SELECT 1');
            console.log('✅ Database connection successful on startup');
            
            // 🚀 تحسين الأداء: إنشاء فهارس للسرعة إذا لم تكن موجودة
            try {
                await db.query(`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date DESC)`);
                await db.query(`CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id)`);
                await db.query(`CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)`);
                console.log('⚡ Database indexes verified for maximum speed.');
            } catch (indexErr) {
                console.error('⚠️  Error creating indexes (may be expected on first run):', indexErr.message);
            }

            // Load User Cache
            try {
                await UserCache.init();
                console.log('✅ User cache loaded');
            } catch (cacheErr) {
                console.error('⚠️  Error loading user cache:', cacheErr.message);
            }

            // Load Data Cache (Companies, Invoices, Bonds)
            try {
                await DataCache.init();
                console.log('✅ Data cache loaded');
            } catch (dataErr) {
                console.error('⚠️  Error loading data cache:', dataErr.message);
            }
            
            console.log('✅ Database is warm and ready!');
        } catch (err) {
            console.error('⚠️  Initial connection failed - will retry on first query');
            console.error('   Error:', err.message);
        }
    })();

    // 🛡️ Heartbeat: Keep DB connection alive FOREVER
    // ينفذ استعلام بسيط كل 25 ثانية لمنع قطع الاتصال
    setInterval(async () => {
        try {
            await db.query('SELECT 1');
            // console.log('💓 DB Heartbeat sent'); // Uncomment for debug
        } catch (err) {
            console.error('💔 DB Heartbeat failed:', err.message);
            // In case of failure, usually the next query will trigger reconnection logic in pool
        }
    }, 25000); // 25 seconds
});
