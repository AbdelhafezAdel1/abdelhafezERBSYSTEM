import axios from 'axios';

/**
 * Builds UBL 2.1 XML string for a Credit Note.
 * @param {Object} data - Credit note details
 * @returns {string} UBL 2.1 XML string
 */
export function buildCreditNoteXML(data) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2">
    <ID>${data.noteNumber}</ID>
    <IssueDate>${data.issueDate}</IssueDate>
    <IssueTime>${data.issueTime}</IssueTime>
    <InvoiceTypeCode name="0211010">381</InvoiceTypeCode>
    <Note>${data.reason}</Note>
    <BillingReference>
        <InvoiceDocumentReference>
            <ID>${data.originalInvoiceNumber}</ID>
            <IssueDate>${data.originalInvoiceDate}</IssueDate>
        </InvoiceDocumentReference>
    </BillingReference>
    <AccountingSupplierParty>
        <Party>
            <PartyTaxScheme>
                <CompanyID>${data.sellerVat}</CompanyID>
                <TaxScheme>
                    <ID>VAT</ID>
                </TaxScheme>
            </PartyTaxScheme>
            <PartyLegalEntity>
                <RegistrationName>${data.sellerName}</RegistrationName>
            </PartyLegalEntity>
        </Party>
    </AccountingSupplierParty>
    <AccountingCustomerParty>
        <Party>
            ${data.buyerVat ? `
            <PartyTaxScheme>
                <CompanyID>${data.buyerVat}</CompanyID>
                <TaxScheme>
                    <ID>VAT</ID>
                </TaxScheme>
            </PartyTaxScheme>` : ''}
            <PartyLegalEntity>
                <RegistrationName>${data.buyerName}</RegistrationName>
            </PartyLegalEntity>
        </Party>
    </AccountingCustomerParty>
</CreditNote>`;
}

/**
 * Builds UBL 2.1 XML string for a Debit Note.
 * @param {Object} data - Debit note details
 * @returns {string} UBL 2.1 XML string
 */
export function buildDebitNoteXML(data) {
    const xml = buildCreditNoteXML(data);
    return xml
        .replace(/CreditNote/g, 'DebitNote')
        .replace(/>381</, '>383<');
}

/**
 * Submits a Credit Note to the ZATCA clearance endpoint.
 * @param {string} xmlString - The generated XML string
 * @returns {Promise<Object>} API response
 */
export async function submitCreditNote(xmlString) {
    console.log('💳 جاري إرسال إشعار الدائن إلى هيئة الزكاة...');
    try {
        // Mock API call for the demo
        return {
            status: 200,
            data: {
                clearanceStatus: "CLEARED",
                validationResults: { infoMessages: [], warningMessages: [], errorMessages: [] }
            }
        };
    } catch (err) {
        console.error('❌ فشل إرسال إشعار الدائن:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Submits a Debit Note to the ZATCA clearance endpoint.
 * @param {string} xmlString - The generated XML string
 * @returns {Promise<Object>} API response
 */
export async function submitDebitNote(xmlString) {
    console.log('💳 جاري إرسال إشعار المدين إلى هيئة الزكاة...');
    try {
        return {
            status: 200,
            data: {
                clearanceStatus: "CLEARED",
                validationResults: { infoMessages: [], warningMessages: [], errorMessages: [] }
            }
        };
    } catch (err) {
        console.error('❌ فشل إرسال إشعار المدين:', err.response?.data || err.message);
        throw err;
    }
}
