const axios = require('axios');
const config = require('../config/zatca.config');
const logger = require('./logger');
const xmlGenerator = require('./zatcaXMLGenerator');

/**
 * ZATCA API Client
 * Handles all communication with ZATCA e-invoicing API
 */
class ZATCAAPIClient {
    constructor() {
        this.config = config.ZATCA_API;
        this.baseURL = this.config.ENVIRONMENT === 'PRODUCTION'
            ? this.config.PRODUCTION_URL
            : this.config.SANDBOX_URL;

        this.retryConfig = config.RETRY_CONFIG;
    }

    /**
     * Get API headers with authentication
     */
    getHeaders() {
        return {
            'Accept': 'application/json',
            'Accept-Language': 'en',
            'Accept-Version': 'V2',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.API_KEY}`
        };
    }

    /**
     * Submit invoice to ZATCA
     */
    async submitInvoice(invoice, company) {
        try {
            logger.info('Submitting invoice to ZATCA', { invoiceId: invoice.id });

            // Generate XML
            const xml = xmlGenerator.generateInvoiceXML(invoice, company);

            // Validate XML
            xmlGenerator.validateXML(xml);

            // Prepare request payload
            const payload = {
                invoiceHash: this.generateInvoiceHash(xml),
                uuid: invoice.uuid || this.generateUUID(),
                invoice: Buffer.from(xml).toString('base64')
            };

            // Submit to ZATCA API
            const response = await this.makeRequest('POST', '/invoices/reporting/single', payload);

            logger.logInvoiceSubmission(invoice.id, 'success', response.data);

            return {
                success: true,
                data: response.data,
                clearanceStatus: response.data.clearanceStatus,
                reportingStatus: response.data.reportingStatus
            };

        } catch (error) {
            logger.logAPIError('/invoices/reporting/single', error, { invoiceId: invoice.id });

            return {
                success: false,
                error: error.message,
                details: error.response?.data
            };
        }
    }

    /**
     * Clear invoice (for clearance invoices)
     */
    async clearInvoice(invoice, company) {
        try {
            logger.info('Clearing invoice with ZATCA', { invoiceId: invoice.id });

            const xml = xmlGenerator.generateInvoiceXML(invoice, company);
            xmlGenerator.validateXML(xml);

            const payload = {
                invoiceHash: this.generateInvoiceHash(xml),
                uuid: invoice.uuid || this.generateUUID(),
                invoice: Buffer.from(xml).toString('base64')
            };

            const response = await this.makeRequest('POST', '/invoices/clearance/single', payload);

            logger.logInvoiceSubmission(invoice.id, 'cleared', response.data);

            return {
                success: true,
                data: response.data,
                clearedInvoice: response.data.clearedInvoice
            };

        } catch (error) {
            logger.logAPIError('/invoices/clearance/single', error, { invoiceId: invoice.id });

            return {
                success: false,
                error: error.message,
                details: error.response?.data
            };
        }
    }

    /**
     * Validate invoice compliance
     */
    async validateCompliance(invoice, company) {
        try {
            logger.info('Validating invoice compliance', { invoiceId: invoice.id });

            const xml = xmlGenerator.generateInvoiceXML(invoice, company);

            // Validate XML structure
            const isValid = xmlGenerator.validateXML(xml);

            // Check business rules
            const businessRules = this.validateBusinessRules(invoice);

            const isCompliant = isValid && businessRules.valid;

            logger.logComplianceCheck(invoice.id, isCompliant, businessRules.issues);

            return {
                isCompliant,
                issues: businessRules.issues,
                warnings: businessRules.warnings
            };

        } catch (error) {
            logger.error('Compliance validation failed', error, { invoiceId: invoice.id });

            return {
                isCompliant: false,
                issues: [error.message]
            };
        }
    }

    /**
     * Validate business rules
     */
    validateBusinessRules(invoice) {
        const issues = [];
        const warnings = [];

        // Check required fields
        if (!invoice.company_id) issues.push('Company ID is required');
        if (!invoice.date) issues.push('Invoice date is required');
        if (!invoice.items || invoice.items.length === 0) issues.push('At least one item is required');

        // Check amounts
        if (invoice.total_after_tax < config.VALIDATION.MIN_INVOICE_AMOUNT) {
            issues.push(`Invoice amount must be at least ${config.VALIDATION.MIN_INVOICE_AMOUNT}`);
        }

        if (invoice.total_after_tax > config.VALIDATION.MAX_INVOICE_AMOUNT) {
            issues.push(`Invoice amount cannot exceed ${config.VALIDATION.MAX_INVOICE_AMOUNT}`);
        }

        // Check line items
        if (invoice.items && invoice.items.length > config.VALIDATION.MAX_LINE_ITEMS) {
            issues.push(`Maximum ${config.VALIDATION.MAX_LINE_ITEMS} line items allowed`);
        }

        // Check VAT calculation
        const calculatedVAT = invoice.total_before_tax * config.TAX_CONFIG.VAT_RATE;
        const difference = Math.abs(calculatedVAT - invoice.vat_amount);
        if (difference > 0.01) {
            warnings.push('VAT calculation may be incorrect');
        }

        return {
            valid: issues.length === 0,
            issues,
            warnings
        };
    }

    /**
     * Make HTTP request with retry logic
     */
    async makeRequest(method, endpoint, data = null, attempt = 1) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const headers = this.getHeaders();

            logger.debug('Making API request', { method, url, attempt });

            const response = await axios({
                method,
                url,
                headers,
                data,
                timeout: 30000 // 30 seconds
            });

            return response;

        } catch (error) {
            // Retry logic
            if (attempt < this.retryConfig.MAX_RETRIES) {
                const delay = this.retryConfig.RETRY_DELAY * Math.pow(this.retryConfig.BACKOFF_MULTIPLIER, attempt - 1);

                logger.logRetryAttempt(endpoint, attempt, this.retryConfig.MAX_RETRIES);

                await this.sleep(delay);
                return this.makeRequest(method, endpoint, data, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * Generate invoice hash (SHA-256)
     */
    generateInvoiceHash(xml) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(xml).digest('base64');
    }

    /**
     * Generate UUID v4
     */
    generateUUID() {
        const { v4: uuidv4 } = require('uuid');
        return uuidv4();
    }

    /**
     * Sleep utility for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get invoice status from ZATCA
     */
    async getInvoiceStatus(uuid) {
        try {
            const response = await this.makeRequest('GET', `/invoices/${uuid}`);
            return {
                success: true,
                status: response.data
            };
        } catch (error) {
            logger.logAPIError(`/invoices/${uuid}`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test connection to ZATCA API
     */
    async testConnection() {
        try {
            logger.info('Testing ZATCA API connection');

            // Simple health check
            const response = await axios.get(`${this.baseURL}/health`, {
                headers: this.getHeaders(),
                timeout: 5000
            });

            logger.info('ZATCA API connection successful');

            return {
                success: true,
                environment: this.config.ENVIRONMENT,
                baseURL: this.baseURL
            };

        } catch (error) {
            logger.error('ZATCA API connection failed', error);

            return {
                success: false,
                error: error.message,
                environment: this.config.ENVIRONMENT,
                baseURL: this.baseURL
            };
        }
    }
}

module.exports = new ZATCAAPIClient();
