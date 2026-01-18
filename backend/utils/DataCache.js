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
            console.log(`✅ DataCache loaded: ${this.companies.length} companies, ${this.invoices.length} invoices.`);
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
}

const dataCache = new DataCache();
module.exports = dataCache;
