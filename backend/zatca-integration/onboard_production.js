import pkg from 'zatca-xml-js';
const { EGS } = pkg;
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ZATCA_PRODUCTION_CSID_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids';

async function main() {
    console.log('🚀 بدء تحويل شهادة الامتثال إلى شهادة إنتاج (Production CSID) في الـ Sandbox...');

    const certsDir = path.join(__dirname, 'certs');
    const ccsidPath = path.join(certsDir, 'ccsid.json');
    const privKeyPath = path.join(certsDir, 'private-key.pem');

    try {
        const ccsid = JSON.parse(await fs.readFile(ccsidPath, 'utf8'));
        const privKey = await fs.readFile(privKeyPath, 'utf8');

        const egs = new EGS({
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
            },
            compliance_certificate: ccsid.binarySecurityToken,
            compliance_api_secret: ccsid.secret,
            private_key: privKey
        });

        console.log(`⏳ جاري طلب شهادة الإنتاج باستخدام Request ID: ${ccsid.requestId}...`);
        const auth = Buffer.from(`${ccsid.binarySecurityToken}:${ccsid.secret}`).toString('base64');
        const response = await axios.post(
            ZATCA_PRODUCTION_CSID_URL,
            { compliance_request_id: String(ccsid.requestId) },
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Accept-Version': 'V2',
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                timeout: 20000
            }
        );

        console.log('\n✅ تم استلام شهادة الإنتاج بنجاح!');
        const egsData = egs.get();
        egsData.production_certificate = Buffer.from(response.data.binarySecurityToken, 'base64').toString('utf8');
        egsData.production_api_secret = response.data.secret;
        const productionRequestId = response.data.requestID || response.data.requestId;

        // حفظ البيانات النهائية (Production)
        await fs.writeFile(
            path.join(certsDir, 'production_csid.json'),
            JSON.stringify({
                binarySecurityToken: egsData.production_certificate.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\r?\n/g, '').trim(),
                secret: egsData.production_api_secret,
                requestId: productionRequestId,
                savedAt: new Date().toISOString()
            }, null, 2),
            'utf8'
        );

        console.log(`📁 تم حفظ شهادة الإنتاج في: ${path.join(certsDir, 'production_csid.json')}`);
        console.log('\n🎉 الآن يمكنك إرسال الفواتير بشكل فعلي!');

    } catch (error) {
        console.error('\n❌ فشل التحويل:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

main();
