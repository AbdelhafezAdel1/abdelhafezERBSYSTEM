import axios from 'axios';

async function runAudit() {
    console.log('🔍 بدء التدقيق النهائي للربط مع ZATCA...');
    
    const testInvoice = {
        invoice: {
            id: `INV-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            total_before_tax: 100.00,
            vat_amount: 15.00,
            total_after_tax: 115.00,
            company_name: "عميل تجريبي",
            company_vat: "300000000000003"
        },
        items: [{
            description: "خدمة تخليص جمركي",
            quantity: 1,
            unit_price: 100.00,
            taxable: true
        }]
    };

    try {
        console.log('\n--- 1. Testing Reporting Endpoint (Simplified Invoice) ---');
        const res = await axios.post('http://localhost:3100/api/zatca/report', testInvoice);
        console.log(`Status: ${res.data.status}`);
        console.log(`XML Hash: ${res.data.xmlHash}`);
        console.log(`QR Code: ${res.data.qrCode ? 'Generated' : 'Failed'}`);
        if (res.data.validationResults?.warningMessages?.length > 0) {
            console.warn('⚠️ Warnings:', JSON.stringify(res.data.validationResults.warningMessages, null, 2));
        }
        if (res.data.validationResults?.errorMessages?.length > 0) {
            console.error('❌ Errors:', JSON.stringify(res.data.validationResults.errorMessages, null, 2));
        }

        console.log('\n--- 2. Testing Clearance Endpoint (Standard Invoice) ---');
        const res2 = await axios.post('http://localhost:3100/api/zatca/clearance', testInvoice);
        console.log(`Status: ${res2.data.status}`);
        console.log(`Cleared Invoice: ${res2.data.clearedInvoice ? 'Received' : 'Not Received'}`);
        if (res2.data.warnings?.length > 0) {
            console.warn('⚠️ Warnings:', JSON.stringify(res2.data.warnings, null, 2));
        }
        if (res2.data.errors?.length > 0) {
            console.error('❌ Errors:', JSON.stringify(res2.data.errors, null, 2));
        }

    } catch (err) {
        console.error('\n❌ Audit Error:', err.response?.data || err.message);
    }
}
runAudit();
