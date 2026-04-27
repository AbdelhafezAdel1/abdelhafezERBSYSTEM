import axios from 'axios';

async function testSandboxReport() {
    console.log('🚀 بدء اختبار إرسال فاتورة ضريبية مبسطة إلى ZATCA Sandbox...');

    const sampleInvoice = {
        invoice: {
            id: `INV-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            total_before_tax: 100.00,
            vat_amount: 15.00,
            total_after_tax: 115.00,
            company_name: "عميل تجريبي",
            company_vat: "300000000000003",
            company_address: "الرياض، المملكة العربية السعودية"
        },
        items: [
            {
                description: "خدمة استشارية تجريبية",
                quantity: 1,
                unit_price: 100.00,
                taxable: true
            }
        ]
    };

    try {
        const response = await axios.post('http://localhost:3100/api/zatca/report', sampleInvoice);
        
        console.log('\n✅ استجابة الهيئة:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            console.log('\n🎉 نجاح! الفاتورة تم قبولها في الـ Sandbox.');
            console.log(`🔗 Hash: ${response.data.xmlHash}`);
            console.log(`📱 QR Code generated successfully.`);
        } else {
            console.log('\n⚠️ الفاتورة رُفضت أو تحتوي على تحذيرات.');
        }

    } catch (error) {
        console.error('\n❌ فشل الاختبار:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testSandboxReport();
