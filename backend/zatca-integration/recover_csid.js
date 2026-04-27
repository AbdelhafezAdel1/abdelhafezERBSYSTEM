import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'zatca-xml-js';
const { EGS } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const certsDir = path.join(__dirname, 'certs');

async function recoverAndIssueProd() {
    try {
        console.log('🔄 استرداد شهادة الامتثال المحفوظة واستكمال الربط...');
        const ccsidRaw = await fs.readFile(path.join(certsDir, 'ccsid.json'), 'utf8');
        const ccsid = JSON.parse(ccsidRaw);
        const privateKey = await fs.readFile(path.join(certsDir, 'private-key.pem'), 'utf8');

        const egs = new EGS({
            uuid: 'ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
            custom_id: 'EGS-1',
            model: 'EGS-Model-1',
            CRN_number: '7052683492',
            VAT_name: 'مؤسسة عيسى يوسف العامر للتخليص الجمركي',
            VAT_number: '310137521300003',
            branch_name: 'Dammam Branch',
            branch_industry: 'Customs Clearance',
            location: {
                city: 'Dammam',
                city_subdivision: 'Al Manar',
                street: 'King Fahd Road',
                plot_identification: '1234',
                building: '0008',
                postal_zone: '31411'
            },
            private_key: privateKey,
            compliance_certificate: ccsid.binarySecurityToken,
            compliance_api_secret: ccsid.secret
        });

        console.log('⏳ 3. فحص الامتثال (Compliance Checks)...');
        const pkg2 = await import('zatca-xml-js');
        const ZATCASimplifiedTaxInvoice = pkg2.default.ZATCASimplifiedTaxInvoice;
        
        const dummyInvoice = {
            id: `INV-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            total_before_tax: 100.00,
            vat_amount: 15.00,
            total_after_tax: 115.00,
            company_name: "عميل تجريبي",
            company_vat: "300000000000003"
        };
        const dummyItems = [{
            description: "خدمة تجريبية",
            quantity: 1,
            unit_price: 100.00,
            taxable: true
        }];

        const zInvoice = new ZATCASimplifiedTaxInvoice({
            props: {
                egs_info: egs.get(),
                invoice_counter_number: 1,
                invoice_serial_number: dummyInvoice.id,
                issue_date: dummyInvoice.date,
                issue_time: new Date().toTimeString().split(' ')[0],
                previous_invoice_hash: 'NWZlY2ViOTZmOTk1OWYwOTVjOWQ5NzI2NDljNzVlZTk1ZTEzNTYwNzVlZTM1NDlkYmU4ZDA2NTlhOTVhMmU0M2I=',
                line_items: dummyItems.map((it, idx) => ({
                    id: String(idx + 1),
                    name: it.description,
                    quantity: it.quantity,
                    tax_exclusive_price: it.unit_price,
                    VAT_percent: it.taxable ? 0.15 : 0
                }))
            }
        });

        const { signed_invoice_string, invoice_hash } = egs.signInvoice(zInvoice, false);
        
        try {
            const checkResult = await egs.checkInvoiceCompliance(signed_invoice_string, invoice_hash);
            console.log(`✅ فحص الامتثال للفاتورة المبسطة تم بنجاح. حالة الرد:`, checkResult.validationResults?.status);
        } catch(e) {
            console.error('❌ فشل فحص الامتثال!:', e.response?.data || e.message);
        }

        console.log('⏳ 4. تحويل شهادة الامتثال إلى شهادة إنتاج (Production CSID)...');
        let finalRequestId = String(ccsid.requestId);
        
        const productionRequestId = await egs.issueProductionCertificate(finalRequestId);
        console.log(`✅ تم استلام شهادة الإنتاج بنجاح! Request ID: ${productionRequestId}`);

        const egsData = egs.get();

        // 5. حفظ البيانات النهائية
        const token = egsData.production_certificate
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/\r?\n/g, '')
            .trim();

        await fs.writeFile(
            path.join(certsDir, 'production_csid.json'),
            JSON.stringify({
                binarySecurityToken: token,
                secret: egsData.production_api_secret,
                requestId: productionRequestId,
                savedAt: new Date().toISOString()
            }, null, 2),
            'utf8'
        );

        console.log('🎉 مبروك! تم الربط بنجاح واستخراج شهادة الإنتاج (Production CSID). النظام جاهز للعمل!');

    } catch (e) {
        console.error('❌ فشل:', e.response?.data || e.message);
    }
}

recoverAndIssueProd();
