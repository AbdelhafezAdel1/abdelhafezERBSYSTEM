import pkg from 'zatca-xml-js';
const { EGS, ZATCASimplifiedTaxInvoice } = pkg;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPANY = {
    vatNumber: '310137521300003',
    vatName: 'مؤسسة عيسى يوسف العامر للتخليص الجمركي',
    crnNumber: '7052683492',
    city: 'Dammam',
    district: 'Ash Shifa',
    street: 'Prince Mohammed bin Fahd St',
    building: '0008',
    postalCode: '32236'
};

async function main() {
    const otp = process.argv[2];
    if (!otp) {
        console.error('❌ يرجى تزويد الـ OTP كمعامل (e.g. node full_onboarding.js 123456)');
        return;
    }

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║    ZATCA Full Onboarding — الربط الكامل والشامل          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Setup Paths
    const certsDir = path.join(__dirname, 'certs');
    await fs.mkdir(certsDir, { recursive: true });
    process.env.TEMP_FOLDER = process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp\\';

    // Check OpenSSL
    const gitOpenSSL = 'C:\\Program Files\\Git\\usr\\bin';
    process.env.PATH = `${gitOpenSSL}${path.delimiter}${process.env.PATH}`;

    try {
        execSync('openssl version', { stdio: 'ignore' });
    } catch (e) {
        console.error('❌ openssl not found even after adding Git path!');
        return;
    }

    try {
        console.log('⏳ 1. جاري إعداد وحدة EGS وتوليد المفاتيح...');
        const egs = new EGS({
            uuid: 'ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
            custom_id: 'EGS-1',
            model: 'Model-1',
            CRN_number: COMPANY.crnNumber,
            VAT_name: COMPANY.vatName,
            VAT_number: COMPANY.vatNumber,
            branch_name: 'Dammam Branch',
            branch_industry: 'Customs Clearance',
            location: {
                city: COMPANY.city,
                city_subdivision: COMPANY.district,
                street: COMPANY.street,
                plot_identification: '1234',
                building: COMPANY.building,
                postal_zone: COMPANY.postalCode
            }
        });

        await egs.generateNewKeysAndCSR(true, 'Issa Yousuf Al Amer Customs Clearance');

        console.log(`⏳ 2. طلب شهادة الامتثال (Compliance CSID) باستخدام OTP: ${otp}...`);
        const complianceRequestId = await egs.issueComplianceCertificate(otp);
        console.log(`✅ تم استلام شهادة الامتثال. Request ID: ${complianceRequestId}`);

        const complianceData = egs.get();
        console.log(`📜 Compliance Cert Preview: ${complianceData.compliance_certificate.substring(0, 50)}...`);

        // حفظ مبدئي لشهادة الامتثال لكي لا تضيع إذا فشل فحص الامتثال
        const tempToken = complianceData.compliance_certificate
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/\r?\n/g, '')
            .trim();
        await fs.writeFile(
            path.join(certsDir, 'ccsid.json'),
            JSON.stringify({
                binarySecurityToken: tempToken,
                secret: complianceData.compliance_api_secret,
                requestId: complianceRequestId,
                savedAt: new Date().toISOString()
            }, null, 2),
            'utf8'
        );
        await fs.writeFile(
            path.join(certsDir, 'private-key.pem'),
            complianceData.private_key,
            'utf8'
        );

        console.log('⏳ 3. فحص الامتثال (Compliance Checks)...');
        
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

        console.log('⏳ 3. فحص الامتثال (Compliance Checks)...');


        const runCompliance = async (cancelation_type, payment_method, reason, canceled_invoice_number) => {
            const zInvoice = new ZATCASimplifiedTaxInvoice({
                props: {
                    egs_info: egs.get(),
                    invoice_counter_number: 1,
                    invoice_serial_number: dummyInvoice.id + (cancelation_type || ''),
                    issue_date: dummyInvoice.date,
                    issue_time: new Date().toTimeString().split(' ')[0],
                    previous_invoice_hash: 'NWZlY2ViOTZmOTk1OWYwOTVjOWQ5NzI2NDljNzVlZTk1ZTEzNTYwNzVlZTM1NDlkYmU4ZDA2NTlhOTVhMmU0M2I=',
                    line_items: dummyItems.map((it, idx) => ({
                        id: String(idx + 1),
                        name: it.description,
                        quantity: it.quantity,
                        tax_exclusive_price: it.unit_price,
                        VAT_percent: it.taxable ? 0.15 : 0
                    })),
                    cancelation: cancelation_type ? {
                        cancelation_type,
                        payment_method,
                        reason,
                        canceled_invoice_number
                    } : undefined
                }
            });
            const { signed_invoice_string, invoice_hash } = egs.signInvoice(zInvoice, false);
            return await egs.checkInvoiceCompliance(signed_invoice_string, invoice_hash);
        };

        // 1. Simplified Invoice
        console.log('   - فحص الفاتورة المبسطة...');
        await runCompliance();
        
        // 2. Simplified Credit Note
        console.log('   - فحص الإشعار الدائن...');
        await runCompliance('381', '10', 'Refund', dummyInvoice.id);

        // 3. Simplified Debit Note
        console.log('   - فحص الإشعار المدين...');
        await runCompliance('383', '10', 'Correction', dummyInvoice.id);
        
        console.log('✅ اكتملت جميع فحوصات الامتثال بنجاح!');

        console.log('⏳ 4. تحويل شهادة الامتثال إلى شهادة إنتاج (Production CSID)...');
        let finalRequestId = String(complianceRequestId);
        
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

        await fs.writeFile(
            path.join(certsDir, 'private-key.pem'),
            egsData.private_key,
            'utf8'
        );

        console.log('\n✨ تم الانتهاء من عملية الربط بنجاح!');
        console.log(`📁 تم حفظ الشهادة في: ${path.join(certsDir, 'production_csid.json')}`);

    } catch (error) {
        console.error('\n❌ فشل الربط:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

main();
