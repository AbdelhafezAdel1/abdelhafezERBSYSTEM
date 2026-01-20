const db = require('../db');

class DataCache {
    constructor() {
        this.companies = [];
        this.invoices = [];
        this.bonds = [];
        this.isLoaded = false;
    }

    async init() {
        try {
            console.log('🔄 Loading operational data into memory...');
            const start = Date.now();

            // Load Companies
            const companiesRes = await db.query('SELECT * FROM companies ORDER BY name');
            this.companies = companiesRes.rows;

            // Load Invoices (with joins pre-calculated for speed)
            const invoicesRes = await db.query(`
                SELECT i.*, c.name as company_name 
                FROM invoices i 
                JOIN companies c ON i.company_id = c.id 
                ORDER BY i.date DESC
            `);
            this.invoices = invoicesRes.rows;

            // Load Bonds
            const bondsRes = await db.query(`
                SELECT b.*, c.name as company_name 
                FROM bonds b 
                JOIN companies c ON b.company_id = c.id 
                ORDER BY b.date DESC
            `);
            this.bonds = bondsRes.rows;

            this.isLoaded = true;
            const duration = Date.now() - start;

            console.log(`✅ DataCache loaded in ${duration}ms: ${this.companies.length} companies, ${this.invoices.length} invoices, ${this.bonds.length} bonds`);
        } catch (err) {
            console.error('❌ Failed to load DataCache:', err.message);
            // Don't set isLoaded to true on error
            this.isLoaded = false;
        }
    }

    // --- Companies ---
    getCompanies() {
        return Array.isArray(this.companies) ? this.companies : [];
    }

    addCompany(company) {
        if (!Array.isArray(this.companies)) this.companies = [];
        this.companies.push(company);
        this.companies.sort((a, b) => a.name.localeCompare(b.name));
    }

    updateCompany(id, updatedData) {
        if (!Array.isArray(this.companies)) return;
        const index = this.companies.findIndex(c => c.id == id);
        if (index !== -1) {
            this.companies[index] = { ...this.companies[index], ...updatedData };
        }
    }

    deleteCompany(id) {
        if (!Array.isArray(this.companies)) return;
        this.companies = this.companies.filter(c => c.id != id);
    }

    // --- Invoices ---
    getInvoices(filters = {}) {
        // Defensive: ensure this.invoices is an array
        let results = Array.isArray(this.invoices) ? this.invoices : [];

        if (filters.companyId) {
            results = results.filter(i => i.company_id == filters.companyId);
        }
        if (filters.startDate) {
            const start = new Date(filters.startDate);
            start.setHours(0, 0, 0, 0);
            results = results.filter(i => new Date(i.date) >= start);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            results = results.filter(i => new Date(i.date) <= end);
        }

        return results;
    }

    addInvoice(invoice) {
        if (!Array.isArray(this.companies)) this.companies = [];
        const company = this.companies.find(c => c.id == invoice.company_id);
        if (company) invoice.company_name = company.name;

        if (!Array.isArray(this.invoices)) this.invoices = [];
        this.invoices.unshift(invoice); // Add to top
    }

    updateInvoice(id, updatedData) {
        if (!Array.isArray(this.invoices)) return;
        const index = this.invoices.findIndex(i => i.id == id);
        if (index !== -1) {
            if (!Array.isArray(this.companies)) this.companies = [];
            const company = this.companies.find(c => c.id == (updatedData.company_id || this.invoices[index].company_id));
            const company_name = company ? company.name : this.invoices[index].company_name;
            this.invoices[index] = { ...this.invoices[index], ...updatedData, company_name };
        }
    }

    deleteInvoice(id) {
        if (!Array.isArray(this.invoices)) return;
        this.invoices = this.invoices.filter(i => i.id != id);
    }

    // --- Bonds ---
    getBonds() {
        return Array.isArray(this.bonds) ? this.bonds : [];
    }

    addBond(bond) {
        if (!Array.isArray(this.companies)) this.companies = [];
        const company = this.companies.find(c => c.id == bond.company_id);
        if (company) bond.company_name = company.name;

        if (!Array.isArray(this.bonds)) this.bonds = [];
        this.bonds.unshift(bond);
    }

    // --- Cache Management ---
    async refresh() {
        console.log('🔄 Manually refreshing DataCache...');
        await this.init();
    }

    getCacheInfo() {
        return {
            isLoaded: this.isLoaded,
            companies: Array.isArray(this.companies) ? this.companies.length : 0,
            invoices: Array.isArray(this.invoices) ? this.invoices.length : 0,
            bonds: Array.isArray(this.bonds) ? this.bonds.length : 0,
            memoryUsage: process.memoryUsage()
        };
    }

    // --- Dashboard Stats (Calculated in Memory) ---
    getDashboardStats(filters = {}) {
        // Filter invoices first
        const filteredInvoices = this.getInvoices(filters);

        // Defensive check explicitly requested
        if (!Array.isArray(filteredInvoices)) {
            console.warn('⚠️ getDashboardStats: filteredInvoices is not an array!', filteredInvoices);
            return {
                stats: { total_invoices: 0, total_revenue: 0, total_vat: 0, total_companies: 0 },
                monthly_revenue: [],
                company_revenue: []
            };
        }

        // Calculate Totals
        const total_invoices = filteredInvoices.length;
        const total_revenue = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_after_tax || 0), 0);
        const total_vat = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.vat_amount || 0), 0);
        const total_companies = Array.isArray(this.companies) ? this.companies.length : 0;

        // Calculate Monthly Revenue (Last 6 months)
        // Group by YYYY-MM
        const monthlyMap = {};
        filteredInvoices.forEach(inv => {
            const date = new Date(inv.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap[key] = (monthlyMap[key] || 0) + parseFloat(inv.total_after_tax || 0);
        });

        // Convert Map to sorted Array
        const monthly_revenue = Object.keys(monthlyMap)
            .sort().reverse().slice(0, 6)
            .map(key => ({ month: key, revenue: monthlyMap[key] }));

        // Calculate Company Revenue (Top 10)
        const companyMap = {};
        filteredInvoices.forEach(inv => {
            // Ensure company_name exists
            const companyName = inv.company_name || 'Unknown';

            if (!companyMap[companyName]) {
                companyMap[companyName] = { company_name: companyName, revenue: 0, invoice_count: 0 };
            }
            companyMap[companyName].revenue += parseFloat(inv.total_after_tax || 0);
            companyMap[companyName].invoice_count++;
        });

        const company_revenue = Object.values(companyMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        return {
            stats: { total_invoices, total_revenue, total_vat, total_companies },
            monthly_revenue,
            company_revenue
        };
    }
}

const dataCache = new DataCache();
module.exports = dataCache;
