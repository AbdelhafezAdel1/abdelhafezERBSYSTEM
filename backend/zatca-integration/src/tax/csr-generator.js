import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateCSRConfig() {
    const vatNumber = '310137521300003';
    const companyName = 'مؤسسة عيسى يوسف العامر للتخليص الجمركي';
    const branchName = 'Dammam Branch';
    const location = 'Dammam';
    const industry = 'Customs Clearance';
    
    // الهيئة تتطلب وجود رقم تسلسلي فريد
    const uuid = crypto.randomUUID();
    const serialNumber = `1-TST|2-TST|3-${uuid}`;
    
    const configContent = `csr.common.name=TSZ-${vatNumber}
csr.serial.number=${serialNumber}
csr.organization.identifier=${vatNumber}
csr.organization.unit.name=${branchName}
csr.organization.name=${companyName}
csr.country.name=SA
csr.invoice.type=1100
csr.location.address=${location}
csr.industry.business.category=${industry}
`;

    const configPath = path.join(__dirname, '..', '..', 'csr-config.properties');
    
    try {
        await fs.writeFile(configPath, configContent, 'utf8');
        console.log(`✅ تم تحديث ملف إعدادات الـ CSR بنجاح بالبيانات الصحيحة في: ${configPath}`);
        console.log('\n--- محتوى الملف ---');
        console.log(configContent);
        console.log('-------------------\n');
    } catch (error) {
        console.error('❌ خطأ في إنشاء ملف الـ CSR:', error.message);
    }
}

generateCSRConfig();
