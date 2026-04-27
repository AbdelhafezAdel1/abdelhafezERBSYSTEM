import pkg from 'zatca-xml-js';
const {
    EGS,
    ZATCASimplifiedTaxInvoice,
    ZATCAInvoiceTypes,
    ZATCAPaymentMethods
} = pkg;
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPANY = {
    uuid: 'ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
    custom_id: 'EGS-1',
    model: 'EGS-Model-1',
    CRN_number: '7052683492',
    VAT_name: 'Issa Yousuf Al Amer Customs Clearance',
    VAT_number: '310137521300003',
    branch_name: 'Dammam Branch',
    branch_industry: 'Customs Clearance',
    location: {
        city: 'Dammam',
        city_subdivision: 'Ash Shifa',
        street: 'Prince Mohammed bin Fahd St',
        plot_identification: '1234',
        building: '8',
        postal_zone: '32236'
    }
};

function makeInvoice(egsInfo, serial, counter, cancelation) {
    return new ZATCASimplifiedTaxInvoice({
        props: {
            egs_info: egsInfo,
            invoice_counter_number: counter,
            invoice_serial_number: serial,
            issue_date: new Date().toISOString().split('T')[0],
            issue_time: new Date().toTimeString().split(' ')[0],
            previous_invoice_hash: 'NWZlY2ViOTZmOTk1OWYwOTVjOWQ5NzI2NDljNzVlZTk1ZTEzNTYwNzVlZTM1NDlkYmU4ZDA2NTlhOTVhMmU0M2I=',
            cancelation,
            line_items: [
                {
                    id: '1',
                    name: cancelation ? 'Adjustment line' : 'Test line',
                    quantity: 1,
                    tax_exclusive_price: cancelation ? 50 : 100,
                    VAT_percent: 0.15
                }
            ]
        }
    });
}

async function checkInvoiceCompliance(rawToken, secret, uuid, signedInvoice, invoiceHash) {
    const auth = Buffer.from(`${rawToken}:${secret}`).toString('base64');
    const response = await axios.post(
        'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance/invoices',
        {
            invoiceHash,
            uuid,
            invoice: Buffer.from(signedInvoice).toString('base64')
        },
        {
            headers: {
                Authorization: `Basic ${auth}`,
                'Accept-Version': 'V2',
                'Accept-Language': 'en',
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            timeout: 20000
        }
    );
    return response.data;
}

async function runComplianceStep(egs, authInfo, label, serial, counter, cancelation) {
    const invoice = makeInvoice(egs.get(), serial, counter, cancelation);
    const { signed_invoice_string, invoice_hash } = egs.signInvoice(invoice, false);
    const result = await checkInvoiceCompliance(
        authInfo.rawToken,
        authInfo.secret,
        egs.get().uuid,
        signed_invoice_string,
        invoice_hash
    );
    console.log(`✅ ${label}: ${result.validationResults?.status || 'OK'}`);
    return result;
}

async function main() {
    const certsDir = path.join(__dirname, 'certs');
    const ccsid = JSON.parse(await fs.readFile(path.join(certsDir, 'ccsid.json'), 'utf8'));
    const privateKey = await fs.readFile(path.join(certsDir, 'private-key.pem'), 'utf8');
    const complianceCertificateBody = Buffer.from(ccsid.binarySecurityToken, 'base64').toString('utf8').trim();
    const complianceCertificatePem = `-----BEGIN CERTIFICATE-----\n${complianceCertificateBody}\n-----END CERTIFICATE-----`;

    const egs = new EGS({
        ...COMPANY,
        compliance_certificate: complianceCertificatePem,
        compliance_api_secret: ccsid.secret,
        private_key: privateKey
    });

    const baseId = Date.now();
    const originalInvoiceNumber = `SIM-${baseId}-001`;

    const authInfo = { rawToken: ccsid.binarySecurityToken, secret: ccsid.secret };

    await runComplianceStep(
        egs,
        authInfo,
        'simplified-compliant',
        originalInvoiceNumber,
        1
    );

    await runComplianceStep(
        egs,
        authInfo,
        'simplified-credit-note-compliant',
        `SIM-${baseId}-002`,
        2,
        {
            cancelation_type: ZATCAInvoiceTypes.CREDIT_NOTE,
            canceled_invoice_number: originalInvoiceNumber,
            payment_method: ZATCAPaymentMethods.CASH,
            reason: 'Compliance credit note test'
        }
    );

    await runComplianceStep(
        egs,
        authInfo,
        'simplified-debit-note-compliant',
        `SIM-${baseId}-003`,
        3,
        {
            cancelation_type: ZATCAInvoiceTypes.DEBIT_NOTE,
            canceled_invoice_number: originalInvoiceNumber,
            payment_method: ZATCAPaymentMethods.CASH,
            reason: 'Compliance debit note test'
        }
    );

    console.log('🎉 All required compliance steps completed.');
}

main().catch((error) => {
    console.error('❌ Compliance steps failed:');
    if (error.response?.data) {
        console.error(JSON.stringify(error.response.data, null, 2));
    } else {
        console.error(error.message);
    }
    process.exit(1);
});
