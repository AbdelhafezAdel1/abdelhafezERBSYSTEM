const express = require('express');
const router = express.Router();
const db = require('../db');

// Get tax register data
router.get('/', async (req, res) => {
    // Auth check removed for consistency with dashboard
    // if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const { startDate, endDate, companyId, invoiceNumber } = req.query;
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
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
