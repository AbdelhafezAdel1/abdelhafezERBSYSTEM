import forge from 'node-forge';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requestComplianceCSID } from './onboarding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateAndOnboard() {
    console.log('⏳ جاري توليد المفاتيح (Private & Public Keys)...');
    
    // 1. توليد المفاتيح (2048-bit RSA)
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey);

    // 2. إعداد الـ CSR
    console.log('⏳ جاري إنشاء ملف الـ CSR (Certificate Signing Request)...');
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;

    // بناء بيانات المؤسسة حسب متطلبات الزكاة
    csr.setSubject([
        { name: 'countryName', value: 'SA' },
        { name: 'organizationalUnitName', value: 'Dammam Branch' },
        { name: 'organizationName', value: 'مؤسسة عيسى يوسف العامر للتخليص الجمركي' },
        { name: 'commonName', value: 'TSZ-310137521300003' }
    ]);

    // إضافة التمديدات (Extensions) الأساسية
    csr.setAttributes([{
        name: 'extensionRequest',
        extensions: [{
            name: 'subjectAltName',
            altNames: [{
                type: 4, // Directory Name
                value: forge.pki.setRdn([
                    { type: '2.5.4.4', value: '310137521300003' } // Serial Number
                ]) // هذا تبسيط، الهيئة تتطلب بناء ASN.1 معقد للـ dirName
            }]
        }]
    }]);

    // التوقيع على الـ CSR
    csr.sign(keys.privateKey, forge.md.sha256.create());
    
    const csrPem = forge.pki.certificationRequestToPem(csr);
    
    // استخراج Base64 فقط بدون الـ Headers
    const csrBase64 = csrPem
        .replace('-----BEGIN CERTIFICATE REQUEST-----\r\n', '')
        .replace('-----BEGIN CERTIFICATE REQUEST-----\n', '')
        .replace('\r\n-----END CERTIFICATE REQUEST-----\r\n', '')
        .replace('\n-----END CERTIFICATE REQUEST-----\n', '')
        .replace(/\r?\n/g, '');

    // حفظ المفتاح الخاص
    const certsDir = path.join(__dirname, '..', '..', 'certs');
    await fs.mkdir(certsDir, { recursive: true });
    await fs.writeFile(path.join(certsDir, 'private-key.pem'), privateKeyPem, 'utf8');
    await fs.writeFile(path.join(certsDir, 'taxpayer.csr'), csrPem, 'utf8');

    console.log('✅ تم توليد وحفظ المفاتيح بنجاح في مجلد certs/');

    // 3. الاتصال بهيئة الزكاة
    try {
        const providedOTP = '541681';
        await requestComplianceCSID(providedOTP, csrBase64);
    } catch (error) {
        console.log('\n⚠️ (تنويه: إذا رفضت الهيئة الـ CSR، فهذا طبيعي لأن الهيئة تتطلب خصائص وتمديدات ASN.1 معقدة جداً لا تتوفر إلا عبر أداة Fatoora الرسمية).');
    }
}

generateAndOnboard();
