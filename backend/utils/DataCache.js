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
            console.log(`✅ تم استرجاع جميع الفواتير والبيانات من قاعدة البيانات بنجاح: ${this.companies.length} شركة, ${this.invoices.length} فاتورة.`);
        } catch (err) {
            console.error('❌ Failed to load DataCache (Data might be stale or empty):', err.message);
        }
    }

    // --- Companies ---
    getCompanies() {
        return this.companies;
    }

    addCompany(company) {
        this.companies.push(company);
        this.companies.sort((a, b) => a.name.localeCompare(b.name));
    }

    updateCompany(id, updatedData) {
        const index = this.companies.findIndex(c => c.id == id);
        if (index !== -1) {
            this.companies[index] = { ...this.companies[index], ...updatedData };
        }
    }

    deleteCompany(id) {
        this.companies = this.companies.filter(c => c.id != id);
    }

    // --- Invoices ---
    getInvoices(filters = {}) {
        let results = this.invoices;

        if (filters.companyId) {
            results = results.filter(i => i.company_id == filters.companyId);
        }
        if (filters.startDate) {
            results = results.filter(i => i.date >= filters.startDate);
        }
        if (filters.endDate) {
            results = results.filter(i => i.date <= filters.endDate);
        }

        return results;
    }

    addInvoice(invoice) {
        // We ensure the invoice object has company_name for display
        const company = this.companies.find(c => c.id == invoice.company_id);
        if (company) invoice.company_name = company.name;

        this.invoices.unshift(invoice); // Add to top
    }

    updateInvoice(id, updatedData) {
        const index = this.invoices.findIndex(i => i.id == id);
        if (index !== -1) {
            // Preserve company_name if not in updatedData
            const company = this.companies.find(c => c.id == (updatedData.company_id || this.invoices[index].company_id));
            const company_name = company ? company.name : this.invoices[index].company_name;

            this.invoices[index] = { ...this.invoices[index], ...updatedData, company_name };
        }
    }

    deleteInvoice(id) {
        this.invoices = this.invoices.filter(i => i.id != id);
    }

    // --- Bonds ---
    getBonds() {
        return this.bonds;
    }

    addBond(bond) {
        const company = this.companies.find(c => c.id == bond.company_id);
        if (company) bond.company_name = company.name;
        this.bonds.unshift(bond);
    }

    // --- Dashboard Stats (Calculated in Memory) ---
    getDashboardStats(filters = {}) {
        // Filter invoices first
        const filteredInvoices = this.getInvoices(filters);

        // Calculate Totals
        const total_invoices = filteredInvoices.length;
        const total_revenue = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_after_tax || 0), 0);
        const total_vat = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.vat_amount || 0), 0);
        const total_companies = this.companies.length;

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
            if (!companyMap[inv.company_name]) {
                companyMap[inv.company_name] = { company_name: inv.company_name, revenue: 0, invoice_count: 0 };
            }
            companyMap[inv.company_name].revenue += parseFloat(inv.total_after_tax || 0);
            companyMap[inv.company_name].invoice_count++;
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
