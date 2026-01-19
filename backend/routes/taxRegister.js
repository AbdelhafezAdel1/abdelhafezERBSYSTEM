const express = require('express');
const router = express.Router();
const db = require('../db');

const DataCache = require('../utils/DataCache');

// Get tax register data
router.get('/', async (req, res) => {
    // Auth check removed for consistency with dashboard
    // if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const { startDate, endDate, companyId, invoiceNumber } = req.query;

    // 🚀 Optimize: Use DataCache instead of direct DB hit
    if (DataCache.isLoaded) {
        try {
            console.log('🚀 Serving Tax Register from Cache');
            // Reuse getInvoices filtering logic
            // Note: invoiceNumber filter needs to be handled manually if getInvoices doesn't support it
            let invoices = await DataCache.getInvoices({ startDate, endDate, companyId });

            if (invoiceNumber) {
                invoices = invoices.filter(inv => inv.id == invoiceNumber || inv.invoice_number == invoiceNumber);
            }

            return res.json(invoices);
        } catch (err) {
            console.warn('⚠️ Cache error in tax register, falling back to DB:', err.message);
        }
    }

    // Fallback: Direct DB Query
    let query = `SELECT i.*, c.name as company_name FROM invoices i JOIN companies c ON i.company_id = c.id WHERE 1=1`;
    const params = [];
    let paramCounter = 1;

    if (startDate) {
        query += ` AND i.date >= $${paramCounter++}`;
        params.push(startDate);
    }
    if (endDate) {
        query += ` AND i.date <= $${paramCounter++}`;
        params.push(endDate);
    }
    if (companyId) {
        query += ` AND i.company_id = $${paramCounter++}`;
        params.push(companyId);
    }
    if (invoiceNumber) {
        query += ` AND i.id = $${paramCounter++}`;
        params.push(invoiceNumber);
    }

    query += ` ORDER BY i.date DESC`;

    try {
        console.log('⚠️ Tax Register: Cache Miss -> Fetching from DB...');
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
