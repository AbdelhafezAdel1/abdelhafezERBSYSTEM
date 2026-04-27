import { calculateVAT, formatVATSummary, validateVATNumber } from './vat-calculator.js';
import { generateVATReport, formatReportForZATCA, saveReportToFile } from './vat-report.js';
import { buildCreditNoteXML, submitCreditNote } from './credit-debit-note.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runDemo() {
    console.log('✅ بدء تشغيل وحدة الضريبة (VAT Module)...\n');

    // ==========================================
    // Step 1: VAT Calculation
    // ==========================================
    console.log('🧾 --- الخطوة 1: حساب الضريبة ---');
    const items = [
        { name: 'خدمة استشارة تقنية', qty: 1, unitPrice: 1000, vatCategory: 'standard' },
        { name: 'تصدير برمجيات', qty: 2, unitPrice: 500, vatCategory: 'zero' },
        { name: 'خدمات مالية معفاة', qty: 1, unitPrice: 300, vatCategory: 'exempt' }
    ];

    const calcResult = calculateVAT(items);
    console.log(formatVATSummary(calcResult));

    const sampleVatNumber = '312345678912343';
    const validation = validateVATNumber(sampleVatNumber);
    if (validation.valid) {
        console.log(`✅ الرقم الضريبي ${sampleVatNumber} صحيح`);
    } else {
        console.log(`❌ الرقم الضريبي ${sampleVatNumber} غير صحيح: ${validation.error}`);
    }
    console.log('\n');

    // ==========================================
    // Step 2: VAT Report
    // ==========================================
    console.log('📊 --- الخطوة 2: تقرير الضريبة ---');
    const mockInvoices = [
        { type: 'invoice', vatSummary: calculateVAT([{ name: 'صنف 1', qty: 1, unitPrice: 2000, vatCategory: 'standard' }]).summary },
        { type: 'invoice', vatSummary: calculateVAT([{ name: 'صنف 2', qty: 5, unitPrice: 100, vatCategory: 'standard' }]).summary },
        { type: 'credit_note', vatSummary: calculateVAT([{ name: 'استرجاع', qty: 1, unitPrice: 500, vatCategory: 'standard' }]).summary }
    ];

    const period = { month: 4, year: 2026 };
    const report = generateVATReport(mockInvoices, period);
    
    console.log(`ملخص تقرير ${report.period.label}:`);
    console.log(`إجمالي المبيعات: ${report.totalSales} ريال`);
    console.log(`صافي الضريبة المستحقة: ${report.netVATDue} ريال`);
    console.log(`الموعد النهائي للتقديم: ${report.filingDeadline}`);

    const zatcaFormat = formatReportForZATCA(report);
    
    const outputPath = path.join(__dirname, '..', '..', 'output', 'vat-report-2026-04.json');
    await saveReportToFile(zatcaFormat, outputPath);
    console.log('\n');

    // ==========================================
    // Step 3: Credit Note
    // ==========================================
    console.log('💳 --- الخطوة 3: الإشعار الدائن ---');
    const creditNoteData = {
        noteNumber: 'CN-2026-001',
        issueDate: '2026-04-25',
        issueTime: '14:30:00',
        originalInvoiceNumber: 'INV-001',
        originalInvoiceDate: '2026-04-20',
        reason: 'استرجاع بضاعة تالفة',
        sellerVat: '312345678912343',
        sellerName: 'مؤسسة التقنية المتطورة',
        buyerName: 'شركة العميل',
        buyerVat: '398765432109873',
        lineItems: [
            { name: 'جهاز حاسب', qty: 1, unitPrice: 500, vatRate: 15 }
        ]
    };

    const xml = buildCreditNoteXML(creditNoteData);
    console.log('تم إنشاء ملف XML للإشعار الدائن بنجاح.');
    
    try {
        const response = await submitCreditNote(xml);
        console.log('✅ حالة الاعتماد من هيئة الزكاة:', response.data.clearanceStatus);
    } catch (error) {
        console.error('حدث خطأ أثناء رفع الإشعار:', error);
    }
}

runDemo();
