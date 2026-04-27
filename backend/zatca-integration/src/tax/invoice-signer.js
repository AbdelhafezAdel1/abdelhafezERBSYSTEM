import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * دالة تغلف استخدام أداة هيئة الزكاة الرسمية (Fatoora CLI)
 * لتوقيع الفواتير تلقائياً من داخل الكود.
 * 
 * تعتمد هذه الطريقة على استدعاء الأداة من النظام لضمان الامتثال بنسبة 100% لخوارزميات الهيئة.
 * 
 * @param {string} invoiceXml - نص الـ XML للفاتورة (غير الموقعة)
 * @returns {Promise<{signedXml: string, invoiceHash: string, qrBase64: string}>}
 */
export async function signInvoiceWithFatooraSDK(invoiceXml) {
    const tempDir = path.join(__dirname, '..', '..', 'temp_invoices');
    const unsignedPath = path.join(tempDir, `unsigned_${Date.now()}.xml`);
    
    // المجلد الذي ستنتج فيه الأداة الفاتورة الموقعة
    const signedDir = path.join(tempDir, 'signed');

    try {
        // تأكد من وجود المجلدات
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(signedDir, { recursive: true });

        // حفظ الفاتورة الغير موقعة مؤقتاً
        await fs.writeFile(unsignedPath, invoiceXml, 'utf8');

        // أمر أداة فاتورة:
        // fatoora -sign -invoice <مسار_الفاتورة> -signedInvoiceDir <مسار_الحفظ>
        const command = `fatoora -sign -invoice "${unsignedPath}" -signedInvoiceDir "${signedDir}"`;
        
        console.log('⏳ جاري توقيع الفاتورة باستخدام Fatoora SDK...');
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stderr.includes('INFO')) {
            console.warn('⚠️ ملاحظات أثناء التوقيع:', stderr);
        }

        // الأداة تقوم بإنشاء الفاتورة الموقعة بنفس اسم الملف الأصلي مضافاً إليه توقيع أو يتم حفظه في مجلد signed
        // نقوم بالبحث عن أحدث ملف في المجلد signed
        const signedFiles = await fs.readdir(signedDir);
        const signedFileName = signedFiles.find(f => f.includes(path.basename(unsignedPath, '.xml')));
        
        if (!signedFileName) {
            throw new Error('لم يتم العثور على الفاتورة الموقعة، تأكد من صحة أداة Fatoora.');
        }

        const signedFilePath = path.join(signedDir, signedFileName);
        const signedXml = await fs.readFile(signedFilePath, 'utf8');

        // TODO: استخراج الهاش والـ QR من الفاتورة الموقعة (يمكن تحليله برمجياً من الـ XML)
        
        // تنظيف الملفات المؤقتة (اختياري)
        // await fs.unlink(unsignedPath);

        console.log('✅ تم توقيع الفاتورة بنجاح!');
        return {
            signedXml,
            // في البيئة الحقيقية يتم استخراج الهاش من <ds:DigestValue>
            invoiceHash: 'hash_will_be_extracted_here', 
            qrBase64: 'qr_will_be_extracted_here'
        };

    } catch (error) {
        console.error('❌ خطأ في عملية توقيع الفاتورة:', error.message);
        throw error;
    }
}
