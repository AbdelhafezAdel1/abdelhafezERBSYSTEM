const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const config = require('../config/zatca.config');
const logger = require('./logger');

/**
 * Generate UBL 2.1 XML for ZATCA e-invoicing
 * This follows the ZATCA technical specifications
 */
class ZATCAXMLGenerator {
    constructor() {
        this.config = config;
    }

    /**
     * Generate complete XML for an invoice
     */
    generateInvoiceXML(invoice, company) {
        try {
            const invoiceType = this.determineInvoiceType(invoice);
            const uuid = uuidv4();
            const issueDate = moment(invoice.date).format('YYYY-MM-DD');
            const issueTime = moment().format('HH:mm:ss');

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" 
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" 
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" 
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${invoice.id}</cbc:ID>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${invoiceType.name}">${invoiceType.code}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${this.config.INVOICE_CONFIG.CURRENCY}</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>${this.config.INVOICE_CONFIG.CURRENCY}</cbc:TaxCurrencyCode>
    
    ${this.generateAdditionalDocumentReference(invoice)}
    
    ${this.generateAccountingSupplierParty(company)}
    
    ${this.generateAccountingCustomerParty(invoice, company)}
    
    ${this.generateTaxTotal(invoice)}
    
    ${this.generateLegalMonetaryTotal(invoice)}
    
    ${this.generateInvoiceLines(invoice)}
</Invoice>`;

            logger.logXMLGeneration(invoice.id, true);
            return xml;
        } catch (error) {
            logger.logXMLGeneration(invoice.id, false, error);
            throw error;
        }
    }

    /**
     * Determine invoice type based on transaction
     */
    determineInvoiceType(invoice) {
        // Standard invoice (B2B)
        return {
            code: this.config.INVOICE_CONFIG.TYPES.STANDARD,
            name: this.config.INVOICE_CONFIG.TRANSACTION_TYPES.STANDARD
        };
    }

    /**
     * Generate Additional Document Reference (for QR code)
     */
    generateAdditionalDocumentReference(invoice) {
        return `<cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${invoice.qr_code || ''}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>`;
    }

    /**
     * Generate Accounting Supplier Party (Seller)
     */
    generateAccountingSupplierParty(company) {
        const companyInfo = this.config.COMPANY_INFO;
        return `<cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${companyInfo.CR_NUMBER}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${companyInfo.STREET_NAME_AR}</cbc:StreetName>
                <cbc:BuildingNumber>${companyInfo.BUILDING_NUMBER}</cbc:BuildingNumber>
                <cbc:PlotIdentification>${companyInfo.ADDITIONAL_NUMBER}</cbc:PlotIdentification>
                <cbc:CitySubdivisionName>${companyInfo.DISTRICT_AR}</cbc:CitySubdivisionName>
                <cbc:CityName>${companyInfo.CITY_AR}</cbc:CityName>
                <cbc:PostalZone>${companyInfo.POSTAL_CODE}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${companyInfo.COUNTRY}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${companyInfo.VAT_NUMBER}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${companyInfo.COMPANY_NAME_AR}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>`;
    }

    /**
     * Generate Accounting Customer Party (Buyer)
     */
    generateAccountingCustomerParty(invoice, company) {
        return `<cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PostalAddress>
                <cbc:StreetName>${company.address || 'N/A'}</cbc:StreetName>
                <cbc:CityName>${this.config.COMPANY_INFO.CITY_AR}</cbc:CityName>
                <cac:Country>
                    <cbc:IdentificationCode>${this.config.COMPANY_INFO.COUNTRY}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${company.vat_number || 'N/A'}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${invoice.company_name}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>`;
    }

    /**
     * Generate Tax Total
     */
    generateTaxTotal(invoice) {
        const vatAmount = parseFloat(invoice.vat_amount || 0);
        const taxableAmount = parseFloat(invoice.total_before_tax || 0);

        return `<cac:TaxTotal>
        <cbc:TaxAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${vatAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${taxableAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${vatAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${this.config.TAX_CONFIG.VAT_CATEGORY_CODE}</cbc:ID>
                <cbc:Percent>${(this.config.TAX_CONFIG.VAT_RATE * 100).toFixed(2)}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>`;
    }

    /**
     * Generate Legal Monetary Total
     */
    generateLegalMonetaryTotal(invoice) {
        const lineExtensionAmount = parseFloat(invoice.total_before_tax || 0);
        const taxExclusiveAmount = parseFloat(invoice.total_before_tax || 0);
        const taxInclusiveAmount = parseFloat(invoice.total_after_tax || 0);
        const payableAmount = parseFloat(invoice.total_after_tax || 0);

        return `<cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${lineExtensionAmount.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${taxExclusiveAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${taxInclusiveAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${payableAmount.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>`;
    }

    /**
     * Generate Invoice Lines
     */
    generateInvoiceLines(invoice) {
        if (!invoice.items || invoice.items.length === 0) {
            return '';
        }

        return invoice.items.map((item, index) => {
            const lineExtensionAmount = parseFloat(item.quantity) * parseFloat(item.unit_price);
            const taxAmount = item.taxable ? lineExtensionAmount * this.config.TAX_CONFIG.VAT_RATE : 0;

            return `<cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${lineExtensionAmount.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${(lineExtensionAmount + taxAmount).toFixed(2)}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${this.escapeXML(item.description)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${this.config.TAX_CONFIG.VAT_CATEGORY_CODE}</cbc:ID>
                <cbc:Percent>${item.taxable ? (this.config.TAX_CONFIG.VAT_RATE * 100).toFixed(2) : '0.00'}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${this.config.INVOICE_CONFIG.CURRENCY}">${parseFloat(item.unit_price).toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
        }).join('\n    ');
    }

    /**
     * Escape XML special characters
     */
    escapeXML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Validate generated XML
     */
    validateXML(xml) {
        // Basic validation
        if (!xml || xml.trim().length === 0) {
            throw new Error('XML is empty');
        }

        if (!xml.includes('<?xml version="1.0"')) {
            throw new Error('XML declaration missing');
        }

        if (!xml.includes('<Invoice')) {
            throw new Error('Invoice root element missing');
        }

        return true;
    }
}

module.exports = new ZATCAXMLGenerator();
